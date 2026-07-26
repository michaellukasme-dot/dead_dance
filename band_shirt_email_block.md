# Band-tee offer — paste-ready email block

Drop this into the DeadDance→band outreach (below the fold, after the ticketing/map pitch). Swap `https://deaddance.app/band_shirts.html` if the link changes, and set the "MOST" fabric name once you pick it.

---

## Plain-text version (for Mailchimp text / simple email)

**Your logo. Your merch table. We print it.**

Sell your own band tees at every show — we handle the printing and shipping through Jay Customz, you keep the merch-table margin. Sold by the dozen (12 shirts), three fabrics:

- **LESS — $15/shirt** · Cotton blend (Gildan-style 50/50) — soft, easy, budget-friendly
- **MORE — $20/shirt** · Gildan 100% cotton — the classic heavyweight bands know
- **MOST — $25/shirt** · Premium 100% cotton composite — the high-end feel

No charge up front — we email you a logo proof and an invoice first, and nothing prints until you approve.

👉 **Reserve your tees:** https://deaddance.app/band_shirts.html

---

## HTML version (for Mailchimp rich block)

```html
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <tr><td style="padding:18px 16px;background:#2a1b3d;border-radius:14px;color:#f4ecff">
    <div style="font-weight:800;font-size:12px;letter-spacing:.04em;color:#c79a3a">🎸 DEADDANCE × YOUR BAND</div>
    <div style="font-size:22px;font-weight:800;margin:6px 0 4px">Your logo. Your merch table. We print it.</div>
    <div style="color:#b6a9d6;font-size:14px;margin-bottom:14px">Sold by the dozen, printed &amp; shipped by Jay Customz. You keep the merch-table margin.</div>
    <div style="border-top:1px solid #ffffff22;padding-top:10px">
      <div style="margin:8px 0"><b style="color:#c79a3a">LESS · $15</b> — Cotton blend (Gildan-style 50/50)</div>
      <div style="margin:8px 0"><b style="color:#c79a3a">MORE · $20</b> — Gildan 100% cotton</div>
      <div style="margin:8px 0"><b style="color:#c79a3a">MOST · $25</b> — Premium 100% cotton composite</div>
    </div>
    <div style="color:#b6a9d6;font-size:12.5px;margin:12px 0">No charge up front — we send a logo proof + invoice first. Nothing prints until you approve.</div>
    <a href="https://deaddance.app/band_shirts.html" style="display:inline-block;background:linear-gradient(180deg,#e0b94a,#c79a3a);color:#3a2400;font-weight:800;text-decoration:none;padding:12px 20px;border-radius:12px">Reserve your tees →</a>
  </td></tr>
</table>
```

---

## The margin math (internal — not for the email)

- 12 shirts / dozen. Retail to band: $15 / $20 / $25 per shirt.
- At ~$1.50 net per shirt after Jay's cost, **100 dozen (1,200 shirts) ≈ $1,800** — which quietly funds the street-team giveaway (1,000 shirts × $18.50 cap = $18,500, so ~10× this volume fully offsets it; every dozen sold chips at the giveaway cost).
- Orders land in `sf_band_merch_order` (server-set pricing). Jay/booth read them via `sf_band_merch_queue()` once you're seeded in `sf_admin`.
- Payment is collected on invoice for now; a Stripe "Reserve → Pay" button drops in after the @deaddance Stripe account is live.
