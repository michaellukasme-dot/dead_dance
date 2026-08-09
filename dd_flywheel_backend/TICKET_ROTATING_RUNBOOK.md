# Rotating Ticket Code — making "Screenshots won't get you in" true

**Prepared:** 2026-08-07 · Built on the existing signed-ticket spine (`19_ticket_security.sql`).

## The verdict that started this

Today the barcode a fan photographs is **decorative** (`Math.random()` canvas noise). The real credential (`TIX:id:sig`) is a properly HMAC-signed, single-use, server-verified token — solid, but **static**, so a screenshot works **once** (first scan wins). Honest claim today: *"a screenshot only works once."* This build upgrades that to the literal promise.

## What's built (verified)

- **`sql/20_ticket_rotating.sql`** — adds a per-ticket `seed`, `sf_ticket_seed` (hands the device its seed only on a valid static sig), and `sf_ticket_redeem_rot` (verifies a time-stepped code, rejects stale steps and forgeries, keeps single-use + the paid/staff gate + full audit). 15s window, ±1 step for clock skew ⇒ a screenshot is dead within ~30s.
- **`dd_ticketsec.js`** — `getSeed(token)`, `startRotating(id, seed, onTick)` (rolls a fresh code every second via Web Crypto HMAC), `parseRot`, `redeemRot(token,…)`, plus a `'stale'` door banner.

## Deploy (your credentialed actions)

1. **Set the HMAC secret** if not already (it's still the commented placeholder in `19`):
   `insert into public.dd_secret(name,val) values ('ticket_hmac', encode(gen_random_bytes(32),'hex')) on conflict (name) do update set val = excluded.val;`
2. **Apply the migrations** in order: `19_ticket_security.sql`, then `20_ticket_rotating.sql`.
3. **Smoke-test** with the block at the bottom of `20_…sql` (issue → seed → redeem_rot admits → an old step returns `stale`).

## Wire the fan ticket (replace the fake barcode with the live one)

In the ticket render (`ticket.html`, and the door pass `sf_ticket.html`), where today it draws the faux barcode and the static show-QR:

```js
// once: get the seed for this ticket (needs the real TIX:id:sig token)
DDTicketSec.getSeed(token).then(function (r) {
  if (!r.ok || !r.seed) return;            // fall back to the static QR / show link
  DDTicketSec.startRotating(r.id, r.seed, function (rotToken, secsLeft) {
    DDQR.into('showqr', rotToken);         // redraw the QR from the LIVE code
    // drive the countdown ring from secsLeft (0..15) — this is the real "rotates" indicator
  });
});
```

Delete `setInterval(drawBars, 4000)` (the random-noise "barcode") — the rotating QR *is* the live code now.

## Wire the gate (`door.html`)

On a scan, branch by prefix:

```js
if (raw.indexOf('TIXR:') === 0) DDTicketSec.redeemRot(raw, {staffToken, lat, lng, by});
else                            DDTicketSec.redeem(raw,    {staffToken, lat, lng, by});  // legacy static
```

`humanStatus()` already renders the new `stale` result ("Expired code — refresh").

## Honesty fixes (do these regardless — #1 priority)

The app currently contradicts its own headline. Until rotation is deployed **and** wired, either ship this build or soften the claim. Fix the copy:

- `sf_ticket.html` — *"Screenshot this to keep it — the code is your entry"* → **"Keep this open at the gate — your code refreshes live."**
- `door.html` — *"Fan can screenshot this as their ticket"* → **"Fan shows their live code — a screenshot won't scan."**
- The **"works offline at the gate / no network required"** line (`ticket.html`, `index.html`) is **false** — verification is server-side. Remove it, or state "gate needs a connection to verify."

Once 19+20 are live and the render is wired, **"Screenshots won't get you in" is literally true** — the photographed code is stale within ~30 seconds.

## Note on wallet passes

Apple/Google Wallet barcodes are static by design (`dd_wallet.js`) — they can't rotate. Wallet users fall back to single-use ("works once"). The in-app live ticket is where the rotating promise holds.
