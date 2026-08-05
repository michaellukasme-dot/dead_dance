# sign_pass — server-side Wallet pass signer (Phase 3)

**Honest status:** SKELETON. This function does not sign a real pass in the dev sandbox —
signing needs Michael's Apple Pass Type ID certificate/key and a Google Wallet service
account, which live only in the **server environment**. If those env vars are missing the
function returns **HTTP 501** with an honest message; it never returns a fake signed pass.

## Why a server (House Law + security panel)
The Apple pass certificate/private key and the Google service-account key can mint valid
passes. They must **never** be shipped in the client (a WebView is not a secret store —
anything in JS is extractable). So: the client sends the ticket's **single-use signed
token** (`TIX:<id>:<sig>`, not a secret) to this function; the function assembles + signs
on the server and returns a **URL/blob** the client hands to the OS Wallet
(`DDShell.addToWallet`).

## Contract
`POST /functions/v1/sign_pass`
```json
{ "platform": "apple" | "google",
  "ticket": { "token": "TIX:<id>:<sig>", "ticket_id": "<id>", "event": "musikfest-2026", "tier": "ga", "seat": null } }
```
- Apple → `200 { ok, contentType:"application/vnd.apple.pkpass", bytesBase64 }` once signing is implemented; `501` until certs are configured.
- Google → `200 { ok, jwt, saveUrl }` once implemented; `501` until the service account is configured.
- No token / bad token → `400` (refuses to sign a pass with no secure barcode).

## Server env (SET IN SUPABASE — never in the repo, never in the client)
```
APPLE_PASS_CERT_PEM   Pass Type ID certificate (PEM)
APPLE_PASS_KEY_PEM    its private key (PEM)          # SERVER ONLY
APPLE_WWDR_PEM        Apple WWDR intermediate (PEM)
APPLE_PASS_TYPE_ID    e.g. pass.app.deaddance.ticket
APPLE_TEAM_ID         your Apple team id
GOOGLE_SA_JSON        Google service-account JSON (contains the RS256 key)  # SERVER ONLY
GOOGLE_WALLET_ISSUER_ID   your Google Wallet issuer id
```

## To finish (the cert-dependent work — Michael + a server run)
1. Provision certs/accounts (RUNBOOK §Phase-3, "Michael's steps").
2. Implement `signApplePkpass()` — build `manifest.json` (SHA-1 of each file), PKCS#7
   **detached** sign it with the pass cert + key + WWDR, zip `pass.json` + `manifest.json`
   + `signature` + images. A library such as `passkit-generator` or `node-forge` does this.
3. Implement `signGoogleJwt()` — RS256-sign the `savetowallet` claims with the
   service-account private key; return `https://pay.google.com/gp/v/save/<jwt>`.
4. `supabase functions deploy sign_pass` and set the env secrets with
   `supabase secrets set ...`.

Until steps 2–3 run on a real server with real certs, the function honestly returns 501 —
it is wired, guarded, and not faking success.
