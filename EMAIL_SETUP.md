# deaddance.app — Email Deliverability Setup (stay out of spam)

Domain verified ✅ · Gmail (Google Workspace) activated ✅ · MX records live ✅

Goal: authenticate the domain (SPF + DKIM + DMARC), then send in a way Gmail/Yahoo trust — so both
transactional mail (tickets, invoices, proofs) and the 800-festival campaign land in the inbox.

---

## Phase 1 — The three authentication records (do these first)

Add at wherever deaddance.app's DNS lives (registrar or Cloudflare). One SPF record only.

### ☐ SPF — TXT on root host `@`
```
v=spf1 include:_spf.google.com ~all
```
- If you later send via Mailchimp, do **not** add a second SPF record. Mailchimp signs with its own DKIM;
  this SPF stays as-is.

### ☐ DKIM — generate in Google, then publish
1. Admin console → **Apps → Google Workspace → Gmail → Authenticate email**
2. Select **deaddance.app** → **Generate new record** → key length **2048-bit**
3. Google gives a TXT value → publish it as TXT at host **`google._domainkey`**
4. Back in the console → **Start authentication**

### ☐ DMARC — TXT at host `_dmarc` (start in MONITOR mode)
```
v=DMARC1; p=none; rua=mailto:dmarc@deaddance.app
```
- Leave at `p=none` while you confirm SPF+DKIM pass (48h+).
- After ~1 week of clean reports → tighten to `p=quarantine`, then eventually `p=reject`.
- **Do not** start at `p=reject`.

### ⚠️ If DNS is on Cloudflare
- Keep mail records **DNS-only (grey cloud, NOT proxied)**.
- If DKIM shows "not authenticated," remove the double-quotes Cloudflare may wrap around the long TXT value.

---

## Phase 2 — Bulk sending (the 800-festival campaign via Mailchimp)

Gmail/Yahoo **reject** non-compliant bulk mail (5,000+/day to personal inboxes). Before any blast:

- ☐ **Authenticate deaddance.app inside Mailchimp** (it adds its own CNAME/DKIM records) so campaigns are
  DKIM-signed as your domain and **align with DMARC**.
- ☐ **One-click unsubscribe** on (Mailchimp adds the required `List-Unsubscribe` header) — honor opt-outs within **2 days**.
- ☐ Keep **spam-complaint rate < 0.3%** (above it, Gmail throttles/blocks; you need 7 clean days to recover).
- ☐ **Pro move — send marketing from a SUBDOMAIN** (e.g. `news@mail.deaddance.app`) so cold-outreach
  reputation never touches your main `@deaddance.app` transactional mail. Set up SPF/DKIM/DMARC on the subdomain too.

---

## Phase 3 — Habits that keep you in the inbox

- ☐ **Warm up** — don't send 800 cold on day one. Start with engaged/known contacts; ramp volume over 1–2 weeks.
- ☐ Real **From name** + working **Reply-To**.
- ☐ Include a **physical mailing address** + unsubscribe link in every marketing email (CAN-SPAM).
- ☐ Avoid: ALL-CAPS subjects, URL shorteners, image-only emails, sketchy links, misleading subject lines.
- ☐ **Clean the list** — remove invalid/bounced addresses before sending (bad addresses tank reputation fast).
- ☐ **Turn on Google Postmaster Tools** for deaddance.app — your dashboard for spam rate, domain reputation,
  and SPF/DKIM/DMARC pass-fail. This is how you *see* deliverability. https://postmaster.google.com

---

## Order of operations
1. Publish SPF + DKIM → verify DKIM in Admin console.
2. Wait 48h, confirm pass in Postmaster Tools.
3. Publish DMARC `p=none` → read reports a week → tighten to quarantine/reject.
4. Authenticate deaddance.app (or the `mail.` subdomain) in Mailchimp before any campaign.
5. Warm up, then send.

## Sources
- Google Workspace SPF/DKIM/DMARC setup — https://easydmarc.com/blog/spf-dkim-dmarc-setup-guide-for-g-suite-gmail-for-business/
- Set up DMARC (Google Workspace Help) — https://knowledge.workspace.google.com/admin/security/set-up-dmarc
- Gmail/Yahoo bulk sender requirements — https://support.google.com/a/answer/14229414
- dmarcian: Yahoo & Google DMARC required — https://dmarcian.com/yahoo-and-google-dmarc-required/
