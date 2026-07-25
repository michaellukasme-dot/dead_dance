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

## Band freemium (the DeadDance side) — pay with money OR with your ticketing

Same philosophy as festivals, tuned for bands (`dd_band_plan.sql`). A band **unlocks everything free**
by turning on DeadDance ticketing; the subscription is the escape hatch for bands that won't cede it:

> **Unlock everything — free.** Turn on DeadDance ticketing and we handle checkout (you keep selling
> anywhere else, too). *Rather keep your own ticketing? $20/month.*

- `unlocked = ticketing_enabled OR subscribed` — one boolean either way, mirroring `sf_gate`.
- The console has the ✅ toggle (`dd_band_ticketing_set`); the band page's ticket action gates on
  `dd_band_plan_get`. Subscription is set only by the billing webhook (`dd_band_subscribe`, service-role).
- Non-exclusive by design: turning on our ticketing is *presence*, not exclusivity.
- **Always-free floor:** a band's page + map are free regardless; only pro/selling locks.

Consistent language across the product: **"free" means free to build and use; the subscription is the
alternative to letting us run ticketing.** Festivals: free to build, subscription due ~14 days before
the gates. Bands: free with DeadDance ticketing on, else $20/mo. Platform take on tickets is 15%
(festivals) / a band-friendly rate for acts.

## Every venue is a ticket-sales shop (`sf_venue.sql`, `venue.html`, `door.html`)

A venue is the general case of an event host — from a corner-guitarist café to MusikFest. The same engine
that runs a festival runs a 40-seat room.

- **Externalized shop** — `venue.html?v=<key>` lists a venue's live shows, each with **Buy**, and gives the
  venue a **link to embed on its own website**. `venue_key = slug(name|city|state)`; `sf_venue_get` returns the
  venue's sellable events (owner also previews locked). *"When the where is fixed → Buy."*
- **Freemium = the band model.** Free if StageFill runs your ticketing (15% platform fee); a **subscription**
  is the escape hatch if a venue won't cede ticketing. Tiered by size: café **$20/mo**, club **$99/mo**,
  theater **$299/mo**, festival = seasonal + the 14-day deadline. The 15% take is the business; the
  subscription is a wall almost nobody chooses. `ticketing_enabled` defaults **on**.
- **Door mode** — `door.html?ev=<slug>`, owner-gated. **Check-in**: the door phone's camera scans a fan's
  ticket QR (jsQR) → `sf_checkin(token)` marks it used (green ✓ / red used/invalid). **Sell at door**:
  - **Card → Scan-to-Pay** (web, no app): a QR to Stripe hosted checkout; the fan scans and pays on **their
    own** phone — Apple Pay auto-surfaces on iOS Safari, Google Pay on Android, card fallback. No card data
    ever touches the venue.
  - **Cash** → `sf_issue_ticket(tender=cash)` mints a paid ticket + check-in QR (`sf_ticket.html?t=<token>`).
  - Every `sf_order` carries a unique `checkin_token`; `tender ∈ {stripe,cash,scan}`; `checked_in_at` stamps entry.
- **Autonomous calendar coach** (`sf_calendar_coach.js`) — owner-only. An **expiring Cookie Monster toast**
  suggests fill-nights ("your Tuesdays are dark → Tuesday Night Karaoke ≈ $X/mo"); a link opens a **modal**
  with a full **sample month** and $$ potential, computed from the managed-booking proforma
  (`nightPL = gate + bar − cost − house`; self-run nights use a host fee, band nights the touring model).
  Each idea's **Add →** deep-links to the Festival/Event Maker, prefilled.

### Roadmap — native Tap to Pay (separate track)
Web Scan-to-Pay covers card-at-the-door today with **zero hardware and no app**. **Tap to Pay on iPhone**
(fan taps card/wallet directly to the employee's phone) requires a **native iOS app** — Apple's Tap to Pay
entitlement + the Stripe Terminal SDK — so it can't live in the PWA. It's a future native-wrapper project;
Scan-to-Pay is the v1 and needs nothing installed.

## Deploy order (Michael runs)
1. Run `sf_spine.sql` in Supabase; enable Realtime on `sf_event`, `sf_order`.
2. Deploy `sf-rollup`; schedule it (cron) with `DD_CRON_SECRET`.
3. Extend + redeploy `dd-checkout` / `dd-webhook` for `sf_order`.
4. Ship the client wiring (behind `ddClient()` — degrades to local drafts if offline).
5. Venue layer: run `sf_venue.sql` (after `sf_reserve.sql`); ship `venue.html`, `door.html`, `sf_ticket.html`,
   `sf_calendar_coach.js`. Door check-in needs camera permission (https only).
