# dd_flywheel_backend — server-side fans (RUNBOOK)

Persists the Band→Fan flywheel to the spine: **Fans = Ticket Holders; Band = Grouped Users.**
Until you run this, the flywheel works fully client-side (localStorage + the `dd.mytix` wallet) and the
spine call silently no-ops. Running it turns on server-side persistence + real cross-device fan counts.

## What it creates
- **Table `dd_fans`** — one row per fan per band per show (`band_slug, fan_id, show_date`, unique → idempotent grabs). RLS on; **no direct table access** — only the RPCs below.
- **`dd_fan_join(p_band, p_name, p_show, p_fan)`** — the write. A fan grabs a free ticket → joins the band. Returns the band's live fan count. De-duped, so re-grabs don't inflate.
- **`dd_band_fans(p_band)`** — read: a band's fan count (the group size).
- **`dd_fan_bands(p_fan)`** — read: the bands one fan follows (server-side wallet).
- Grants `execute` on the three RPCs to `anon` + `authenticated`. No token needed — becoming a fan is a public action, and the unique index blocks spam per fan.

## Run it (2 min)
1. Supabase → your project → **SQL Editor** → New query.
2. Paste all of `sql/01_fans_schema.sql` → **Run**. (Idempotent — safe to re-run.)
3. Smoke test (uncomment the three lines at the bottom of the file, or run):
   ```sql
   select public.dd_fan_join('rift','Rift','{"stage":"Plaza Tropical","date":"2026-08-05"}'::jsonb,'test-fan-1');
   select public.dd_band_fans('rift');      -- → {"band":"rift","fans":1}
   select public.dd_fan_bands('test-fan-1');-- → [{"band":"rift","name":"Rift"}]
   ```

## Client side (already wired)
`dd_flywheel.js` now sends a stable anonymous **`dd.fanid`** (device-local) with every grab, so the spine
can de-dup and count. It's guarded — no Supabase client, no call, no error.
**Re-push `dd_flywheel.js`** (it changed) with your next deploy; the RPC + client match.

## Notes / next
- Reading server counts into the group UI (so `DDFlywheel.group().fans` shows the *real* cross-device
  number, not just the local +1) is the natural follow-up — `dd_band_fans` is ready for it; it's an async
  read, so wire it where the group list renders.
- This is the seed of the **Friends** graph server-side: fans → bands → groups, all in the spine.
