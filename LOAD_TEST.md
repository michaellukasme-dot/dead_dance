# MusikFest Map — 0 → 1.5M Load Simulation: where she breaks

**Test:** simulate zero users growing to **1.5M** across the **10 MusikFest days (Jul 31 – Aug 9, 2026)**,
driven by **phone-to-phone** (street-team) invitations, with full active users exercising the map, curtains,
and every backend touchpoint — and the two-weekend **Fri/Sat spikes**. MusikFest map only. Harness +
instrumentation: `load_test_harness.js` (runnable: `node load_test_harness.js`).

**Why a simulation, not live fire:** actually firing 1.5M sessions at the real Supabase project would DoS
your own instance and burn quota. This is a deterministic model built from the **real backend costs in the
shipped code** (anon auth, occupancy pings, the street-team 4.5s poll, the contest aggregate, `sf_reserve` /
`sf_rsvp` row locks, viral `sf_street_join` writes). Assumptions are labeled and tunable in the harness.

---

## Result: **she collapses on the first busy evening — she never reaches 1.5M.**

- **Peak concurrency modeled:** ~**223k on the map / ~20k on the street page** on **Sat Aug 8, 8pm** (biggest day).
- **Peak API load:** ~**17,000 req/s** against a ~**2,500 req/s** single-instance ceiling — **~7× over**.
- **First break:** the **street-team contest leaderboard**, at roughly **135 concurrent recruiters** — reached
  within the **first hour** the street team is live. The 1.5M curve is academic; the system is down by dinner on Day 1.

Daily rollup (baseline): **every day shows ✖ DOWN** at peak hour.

---

## Where she breaks — in order

### 1. 🟥 CATASTROPHIC — the contest leaderboard (`sf_street_contest`)
`street.html` polls the board **every 4.5s**, and the board is a **`GROUP BY` aggregate over the entire
`sf_referral` table** (which is growing toward 1.5M rows). An unindexed aggregate polled that often
saturates at **~30 queries/sec ≈ 135 concurrent recruiters**. Breaks **first hour**, at **<500 total users**.
This one query takes the whole DB down and starves everything else.

### 2. 🟧 The street-team poll firehose (`street.html`)
Every open street page fires **3 RPCs every 4.5s** (`sf_street_me` + `sf_street_contest` + `sf_friend_pending`)
= **0.67 req/s per user**. At ~**4k concurrent recruiters** that's the whole **2,500 req/s** API budget — reached
**Fri Jul 31 midday** at only **~20k registered**. Polling, not the work, is the load.

### 3. 🟧 Occupancy ping writes (`sf_ping_batch`)
Every open map session pings the geofence batch every ~60s. At **~134k concurrent maps** that's **~2,000
writes/s**, and each call does per-row **geofence lookups** inside a security-definer function. Breaks **Fri
Jul 31 evening**, ~92k registered.

### 4. 🟨 Latent — hot-row lock (`sf_reserve` / `sf_rsvp`)
Did **not** breach at festival rates, but both take `SELECT … FOR UPDATE` on **one** `sf_ticket_type` row. A
single mega-popular ticket or free RSVP drop would serialize all buyers on that row (~500 tx/s ceiling) — a
real risk for a headliner on-sale even though the aggregate festival load is fine.

### 5. 🟨 Anon auth sign-ins
Never breached but runs **close** to the ceiling on the two Saturdays — a hotter viral spike would throttle
new sign-ins (and every new device needs one).

**Fri/Sat effect:** the two Saturdays (Aug 1, Aug 8) drive **2.3–2.4×** the weekday concurrency and are where
every ceiling is blown hardest — exactly the high-use scenario requested, and exactly when it must not fall over.

---

## The fixes (mapped to each break) — and proof they scale

| # | Break | Fix |
|---|-------|-----|
| P0 | Contest aggregate | Stop aggregating on read. Keep a **counter** (`sf_streeter.signups`, incremented inside `sf_street_join`), index it, and make the board `ORDER BY signups DESC LIMIT 10` — or a **cached/materialized** snapshot refreshed server-side every 30–60s. |
| P0 | 4.5s polling | Replace polling with **Supabase Realtime** (websocket push) for the counter + pending friends; if keeping polls, raise to **30s** and serve indexed reads only. |
| P1 | Occupancy writes | Ping every **120s**; make `sf_ping_batch` an **append-only insert** that trusts the client-computed `geofence_id` (audit async) instead of a per-row lookup; keep rollup on cron. Optionally an edge **ingest that batches**. |
| P1 | API tier | Scale Supabase compute, enable **PgBouncer** (transaction pooling), add a **read replica** for hot reads (board, `sf_get`). ~2.5k → ~12k req/s. |
| P2 | Hot-row lock | For a headliner drop, **shard** the ticket type or use a **reservation queue**; the per-row `FOR UPDATE` is fine for normal loads only. |
| P2 | Anon auth | Confirm auth rate limits / scaling for the Saturday spikes. |

**Hardened re-run (fixes applied):** peak API load drops to **~4,000 req/s** against a 12,000 ceiling —
**✓ survives the entire curve to 1.5M**, across all 10 days including both peak Saturdays.

---

## Bottom line
The functional build is correct (both Claudine passes), but at festival scale the **polling architecture** is
the wall — a leaderboard aggregate polled every 4.5s by every recruiter takes her down at **a few hundred
users**, not a few hundred thousand. The four P0/P1 changes (counter-not-aggregate, Realtime-not-poll,
lighter pings, scaled tier) move the ceiling from **~135 recruiters to 1.5M users**. None of these are
rewrites — they're the standard "turn a demo into a festival" hardening pass, and they're the thing to do
**before** MusikFest traffic, independent of the Stripe gate.
