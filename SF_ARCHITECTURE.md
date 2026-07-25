# StageFill — production backend architecture

Turns the Festival Maker + Event List from a browser-only prototype into a real multi-user
product on Supabase (same project + conventions as the DeadDance app). Three layers:

1. **Persistence** — publish an event once; it appears on everyone's national list and opens by link.
2. **Ticketing** — real ticket sales on the event page, 15% to ArtsQuest, via the existing Stripe marketplace.
3. **Live occupancy** — devices report which geofence they sit in; a rollup turns pings into the daily report.

Identity everywhere is `auth.uid()::text` (anonymous or signed-in), exactly like the rest of the app.
All writes go through `security definer` RPCs; reads are gated by RLS. Client uses `ddClient().rpc(...)`.

---

## Data model (`sf_spine.sql`)

| table | purpose | key columns |
|---|---|---|
| `sf_event` | one festival/event | `slug` (unique), `owner`, name, city, state, venue, cat, `date_start/end`, `start_time`, lat/lng, `corners` jsonb, `floor_url`, `status` (draft/live) |
| `sf_act` | acts/stages on an event | `event_id`, name, stage, time, cat, lat/lng, xpct/ypct |
| `sf_ticket_type` | sellable ticket tiers | `event_id`, name, `price_cents`, currency, `qty_total`, `qty_sold`, active |
| `sf_order` | a ticket purchase | `event_id`, `ticket_type_id`, buyer, qty, `amount_cents`, `fee_cents` (15%), `stripe_session`, status (pending/paid/refunded) |
| `sf_partner` | shop/truck/vendor + ad buy | `event_id`, name, type, plan, days, lat/lng, `points` jsonb, `spend_cents`, status |
| `sf_geofence` | a circle to detect presence | `event_id`, kind (platz/stage/potty/first_aid/shop/partner), label, lat/lng, `radius_m` |
| `sf_ping` | raw device-in-geofence event | `event_id`, `device` (hashed, **never identity**), `geofence_id`, lat/lng, `dwell_s`, ts |
| `sf_occupancy` | hourly rollup (the report) | unique(`event_id`,`geofence_id`,day,hour): `devices`, `uses` |

Geofences are generated from acts (stages), partners (shops/trucks), and survey captures (potty/first-aid/corners).

### RPCs (all `security definer`, owner derived server-side)
- `sf_publish(p jsonb) → text(slug)` — upsert the caller's event + acts + ticket types + geofences; returns slug.
- `sf_list(p_state text, p_city text, p_cat text) → setof` — **public**, `status='live'` only.
- `sf_get(p_slug text) → jsonb` — **public**, one event bundle (event + acts + ticket types).
- `sf_partner_upsert(...)`, `sf_partner_pin(p_id, p_points jsonb)` — owner only.
- `sf_ping_batch(p_event uuid, p_pings jsonb)` — insert pings (rate-limited; anonymous ok; no identity stored).
- `sf_rollup(p_event uuid, p_day date)` — aggregate `sf_ping` → `sf_occupancy` (called by cron/edge).
- `sf_occupancy_get(p_event uuid, p_day date) → setof` — **owner/admin only** (RLS on the event).

### RLS summary
- `sf_event`: public `select` where `status='live'`; owner (`owner = auth.uid()::text`) full control.
- `sf_act` / `sf_ticket_type`: public `select` when parent event is live; owner manages via RPC.
- `sf_order`: buyer sees own; event owner sees the event's; inserts only via checkout edge fn (service role).
- `sf_partner` / `sf_geofence`: owner manages; minimal public `select` (ad serving + presence detection on the map).
- `sf_ping`: `insert` allowed (rate-limited in RPC); **no public select** — only the rollup/owner reads.
- `sf_occupancy`: `select` only to the event owner (the daily report is private operations data).

---

## Ticketing (reuse the marketplace — do NOT rebuild)

The app already has `dd-connect` (Stripe Connect onboarding), `dd-checkout` (create a Checkout Session),
and `dd-webhook` (mark paid). StageFill tickets ride the same rails:

1. Event owner connects a Stripe account once (`dd-connect`), stored on `sf_event.stripe_account`.
2. Buyer taps **Buy** on the event page → `dd-checkout` extended: line item = ticket type, `application_fee = 15%`
   to the ArtsQuest/StageFill platform account, transfer to the owner's connected account.
3. `dd-webhook` on `checkout.session.completed` → mark `sf_order.status='paid'`, `qty_sold += qty`.

15% is the platform `application_fee_amount`; owners are paid out by Stripe Connect. No card data ever touches us.

---

## Live occupancy telemetry

- The map (musikfest/artsquest/event_page) already has GPS + geofence math + `mfPerf`. Add a lightweight
  **ping**: while a session is open, every ~60s it computes which `sf_geofence` it's inside and buffers a ping
  (device = a rotating on-device hash, **never** an identity). Batches flush via `sf_ping_batch`.
- Dwell rules live client-side before send (≥2 min in a restroom = a "use"; a 15 m frontage crossing = a pass-by),
  so `sf_ping` carries `dwell_s` and the rollup counts distinct devices + uses.
- `sf-rollup` (cron, every 15 min) aggregates the day's pings into `sf_occupancy`.
- The **occupancy report** and the **admin Console** read `sf_occupancy_get` instead of the synthetic generator —
  same UI, now live. Synthetic stays as the fallback when a fresh event has no data yet.

Privacy: counts are **distinct devices, never identities**; raw pings are retention-capped (e.g., 7 days) and
never publicly selectable. This is the "no personal data leaves the phone" promise, enforced by RLS.

---

## Edge functions
- `dd-connect` *(exists)* — owner Stripe onboarding.
- `dd-checkout` *(extend)* — add StageFill ticket line items + 15% application fee.
- `dd-webhook` *(extend)* — handle `sf_order` paid.
- `sf-ingest` *(new, optional)* — high-volume ping intake if we outgrow the RPC.
- `sf-rollup` *(new)* — cron: `sf_ping` → `sf_occupancy`.

## Client touchpoints
- `festival_event_maker.html` — Publish → `sf_publish`; Partners pin → `sf_partner_pin`.
- `stagefill_events.html` — list from `sf_list` (+ local drafts as "yours").
- `event_page.html` — event from `sf_get`; **Buy** → `dd-checkout`.
- map pages — geofence ping loop → `sf_ping_batch`.
- `platz_occupancy_report.html` + Console curtain — read `sf_occupancy_get`, synthetic fallback.

## Go-to-market: direct to the 800, freemium-with-a-deadline

ArtsQuest is the marquee partner, not the gate. StageFill goes **direct to all 800 US festivals**:

- **Prospect CRM** (`sf_prospect`, admin-gated): the 800 pre-seeded with name/city/state/attendance/contact and a
  `maker_token`. Each gets a **Festival Maker link** that prefills their event. Status tracks the funnel
  (`new → sent → opened → building → subscribed`).
- **Free to build, forever, until it counts.** A festival admin builds stages, indoor + outdoor, acts, partners,
  and verifies every coordinate with Cookie Monster — **all free**. No card, no wall.
- **The deadline is the close.** `sf_event.grace_days` (default 14) sets when billing starts: once
  `current_date >= date_start − grace_days`, `sf_gate(slug)` returns `locked: true` and the client drops a
  **subscription toast that blocks access** until they subscribe. They've already done the work and their festival
  is days away — the easiest yes in the world.
- Subscription is set by the billing webhook (`sf_mark_subscribed`, service-role only) — never self-served.

This flips the pitch: they don't decide on a map in the abstract; they decide whether to turn on the map they
already built and love, right before their gates open.

## Deploy order (Michael runs)
1. Run `sf_spine.sql` in Supabase; enable Realtime on `sf_event`, `sf_order`.
2. Deploy `sf-rollup`; schedule it (cron) with `DD_CRON_SECRET`.
3. Extend + redeploy `dd-checkout` / `dd-webhook` for `sf_order`.
4. Ship the client wiring (behind `ddClient()` — degrades to local drafts if offline).
