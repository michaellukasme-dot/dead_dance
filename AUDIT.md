# StageFill / DeadDance — Full Application Audit (today's build)

Scope: everything designed & built today — ticketing, venue box office, door mode, occupancy,
fill co-promotion, national map, street team, band/venue merch, print-partner network. (Legacy/removed
features like Records are out of scope.)

Method: verified — matched every client `rpc()` call against defined SQL functions; scanned for
mock/sample/stub markers; checked payment/PII/legal surfaces. **Not** from memory.

---

## ✅ WIRED & SPINE-COMPLETE (real backend, not representative)

**RPC wiring is 100%.** All **27** client RPC calls resolve to a real security-definer function in the
SQL spine — zero missing. RLS is deny-by-default; writes go only through the RPCs; money paths passed two
Claudine adversarial reviews.

- **Ticketing** — `sf_publish/list/get/gate`, `sf_reserve` (row-locked, no oversell), `sf-checkout` →
  `sf-webhook` (`sf_ticket_fulfill` atomic + idempotent), `sf-rollup`. Real.
- **Venue** — `sf_venue_claim`, `sf_venue_get`, door check-in `sf_checkin`, cash `sf_issue_ticket`
  (capacity-safe), web Scan-to-Pay. Real.
- **Occupancy telemetry** — event page ping loop → `sf_ping_batch` (server-derived device) →
  `sf_rollup_mine` → `sf_occupancy_get`. Real for live events.
- **Fill co-promotion** — attribution `ref_src`, `sf_fill_status` (owner-gated). Real.
- **Street team** — join/cookies/`sf_shirt_claim_free`/`sf_shirt_redeem_cookies` (atomic), fulfill
  handshake, friends, Recruiter Cup. Real, Claudine-passed.
- **Merch + print partner** — `sf_band_merch_create` (server-priced from size mix), chapter routing,
  admin/partner queues. Real intake.

---

## ⚙️ BLOCKED ON DEPLOY / CONFIG (built — goes live when you do these; NOT liabilities)

1. **Deploy 3 edge functions:** `sf-checkout`, `sf-webhook`, `sf-rollup`. Until then, ticket money can't move.
2. **Enable Anonymous sign-ins** (Supabase Auth) — required for `auth.uid()` identity.
3. **Move Stripe to `@deaddance`** + set secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `PRICE_FESTIVAL`, `DD_CRON_SECRET`, `APP_URL`.
4. **Seed `sf_admin`** with your auth uid — unlocks the CRM **and** all queues (shirt, band-merch, print-partner).
5. **Schedule `sf-rollup`** (cron, ~15 min) with the cron secret.
6. **SQL run order** (all re-runnable): `sf_spine` → `sf_hardening` → `sf_hardening2` → `sf_reserve` →
   `sf_stage2` → `sf_venue` → `sf_fill` → `sf_streetteam` → `dd_band_plan` → `sf_band_merch` → `sf_print_partner`.

---

## 🧪 EXAMPLE / REPRESENTATIVE — **NOT PRODUCT-RELEASE-READY** (the list you asked for)

1. **`platz_occupancy_report.html`** — labeled **"Sample · illustrative synthetic data."** It's a **pitch
   artifact**, not a live page. (The live occupancy engine *is* real — but this standalone report shows
   fabricated numbers. Don't expose it as a product page.)
2. **`stagefill_calculator.html`** — the revenue **model / pitch tool**, not app functionality.
3. **`stagefill_events.js` seed (23 events)** — the national **list and roll-up map** render these
   **representative sample events** (Musikfest, etc.) alongside any real ones. Before public launch, flag
   or remove the seed; real events come from `sf_list`.
4. **Free ticket / RSVP** — `sfFree()` is a **stub** ("RSVP coming soon"). Free-ticket buttons and the
   venue "Free · RSVP" link do **nothing real** (no RSVP capture, capacity, or check-in for free tickets).
   Decision needed: build free RSVP, or don't offer free ticket types.
5. **Band/Venue merch = invoice-only** — no in-app payment; "reserve → we email an invoice." Working
   **intake**, not a closed e-commerce purchase.
6. **Reorder "charge to your account"** — copy promises **stored billing that doesn't exist yet** (no
   band/venue account billing). Cosmetic until Stripe-on-file is built.
7. **Native Tap to Pay** — **roadmap only.** Web Scan-to-Pay is the shipped card-at-door path.

---

## ⚠️ LIABILITIES (address before real users / real money)

1. **Legal surfaces missing for commerce** — no **Terms of Service**, **refund/cancellation policy**, or
   **sales-tax** handling on ticket + merch sales. Stripe and selling physical goods both require these.
   `privacy.html` exists but predates ticketing/merch — **verify it covers ticket buyers, shipping PII,
   and payment data**, or update it.
2. **PII in plaintext** — shirt **shipping name/address**, band/venue **contact**, print-partner
   **contact** stored unencrypted (admin-gated reads only). No consent capture, retention, or delete.
   GDPR/CCPA exposure.
3. **User-uploaded logos stored as base64 data URLs (≤2 MB) in a text column** → DB bloat + **unmoderated
   user content going to print**. Move to object storage; add a review gate (the "review"/proof step
   partly covers this).
4. **Street-team farming** (accepted MVP) — anon-session farming is **bounded** by human-review on shipped
   shirts + a daily cookie cap + physical booth handoff, but **not eliminated**.
5. **Checkout inventory-denial via unpaid holds** (accepted for small venues) — revisit before any
   high-demand on-sale.
6. **`sf_shirt_fulfill`** — possession of the pickup code = authorization (shoulder-surf risk). Fine for a
   staffed booth; note it.
7. **Venue-plan squatting** — first-claimer-wins on a display record; admin-reversible, no ticketing
   authority. Low blast radius.
8. **No refund/chargeback flow** — arrives with Stripe go-live; not present today.

---

## ✅ Punchlist resolution (v573 pass — everything not gated on Stripe)

- **Legal surfaces WRITTEN & wired** — `terms.html`, `privacy_policy.html`, `refunds.html` (formal drafts
  with clearly bracketed items for your attorney), linked via `dd_legal_footer.js` on every commerce page,
  plus consent gates: required checkboxes on merch order (`#tcok`, artwork-ownership) and street redeem
  (`#rtc`), and purchase microcopy on the event page + partner/claim flows. **Consent is now recorded
  server-side** on merch orders (`terms_version` + `consented_at`).
- **Free RSVP is REAL** — `sf_rsvp` / `sf_rsvp_release` (capacity-safe, one per device, scannable check-in
  token). The stub is gone. Claudine-confirmed: money/fulfillment isolated, no oversell, XSS-clean.
- **Sample data is LABELED** — seed events flagged `sample`, "sample" chip on the list, caption on the map,
  and a **sample/demo banner on the event page** itself so a shared seed link can't pass as a real booking.
- **Legal copy corrected** to match code — platform fee is a deduction from Organizer proceeds (not a buyer
  surcharge); occupancy wording fixed to "rotating daily device token."
- **Second Claudine pass: READY, no blockers/highs.**

### Still accepted-for-MVP (documented, revisit before scale)
- **Free-RSVP exhaustion** — anon sessions can consume a capped *free* allocation (no expiry). Same class as
  the accepted paid inventory-denial; fine for free events at staffed small venues. **Fix before scale:** edge
  rate-limit / light proof-of-humanity + a TTL sweep of un-checked-in free RSVPs.
- **`platz_occupancy_report.html` / `stagefill_calculator.html`** remain **pitch artifacts** (clearly
  labeled), not live product pages.
- **Merch = invoice-first** (no in-app charge until the Stripe move); **reorder billing** copy softened to
  "we'll invoice your account."
- **Logos** still stored as data URLs — proof/review gate covers moderation; **move to object storage** at scale.

## Bottom line
The **spine is complete and fully wired**, the **legal surfaces exist and are consented**, the **free path is
real**, and **sample data is unmistakably labeled**. What remains is entirely **Stripe-gated**: the
`@deaddance` email → Stripe move → connect Stripe/Mailchimp → deploy the 3 edge functions. Nothing else
stands between this build and taking real money — and the legal list is checked before that gate, per the rule.
