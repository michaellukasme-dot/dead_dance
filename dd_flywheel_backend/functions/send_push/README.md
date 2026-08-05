# send_push — server-side APNs/FCM push sender (Phase 4)

**Honest status:** SKELETON. This function does not deliver a real push in the dev sandbox —
sending needs Michael's **Apple APNs auth key** (`.p8` + Key ID + Team ID) and a **FCM
service account**, which live only in the **server environment**. If those env vars are
missing the function returns **HTTP 501** with an honest message; it never returns a fake
"delivered".

## Why a server (House Law + security)
The APNs auth key and the FCM service-account key can send push to any of your users. They
must **never** be shipped in the client (a WebView is not a secret store — anything in JS is
extractable). So the split is:
- **Client** only ever *registers a token* (`DDShell.push.register()` → `dd_push_client` →
  `dd_push_register_token` RPC). It holds no sending credential.
- **Server** (this function) reads the keys from env, looks up tokens (`dd_push_token`), and
  POSTs to APNs / FCM.

## What is remote push FOR (and what it is NOT)
- **Remote push (this function):** the few genuinely-**live** things the server alone knows —
  a **schedule change**, **"band on NOW"**. A fan may be in a dead zone, so these are
  best-effort.
- **NOT remote push:** the known, time-based reminders (doors, "band on in 10",
  set-break-over). Those are scheduled **on the device** and fire **offline** via
  `dd_notify_schedule.js` — no server, no radio needed.

## Contract
`POST /functions/v1/send_push`
```json
{ "platform": "ios" | "android",
  "tokens": ["<apns-or-fcm-token>", "..."],
  "message": { "title": "🎸 Band on NOW", "body": "Head to the Main Stage", "kind": "band_now", "refId": "musikfest-2026|deal", "band": "deal" } }
```
- iOS → `200 { ok, sent }` once APNs sending is implemented; `501` until the auth key is configured.
- Android → `200 { ok, sent }` once FCM sending is implemented; `501` until the service account is configured.
- No tokens → `400`.
- **No PII in the payload** — ids + display copy only (enforced by `buildApnsPayload` / `buildFcmMessage`).

## Server env (SET IN SUPABASE — never in the repo, never in the client)
```
APNS_AUTH_KEY_P8   the .p8 auth-key contents (PEM)          # SERVER ONLY
APNS_KEY_ID        the 10-char Key ID for that .p8
APNS_TEAM_ID       your Apple Team ID
APNS_TOPIC         the app bundle id (aps-topic), e.g. app.deaddance
APNS_PRODUCTION    "true" for prod gateway, else sandbox
FCM_SA_JSON        Google service-account JSON (contains the private key)  # SERVER ONLY
FCM_PROJECT_ID     your Firebase/GCP project id
```

## To finish (the key-dependent work — Michael + a server run)
1. Provision the APNs auth key + FCM service account (RUNBOOK §Phase-4, "Michael's steps").
2. Implement `sendApns()` — mint an ES256 JWT from the `.p8` (Key ID + Team ID), then HTTP/2
   `POST https://api.push.apple.com/3/device/<token>` with `apns-topic` and the payload. A
   library such as `node-apn` / `@parse/node-apn` or a raw HTTP/2 client does this.
3. Implement `sendFcm()` — get an OAuth2 access token from the service account, then
   `POST https://fcm.googleapis.com/v1/projects/<projectId>/messages:send`.
4. On a `410`/`Unregistered` (APNs) or `NOT_FOUND`/`UNREGISTERED` (FCM) response, call the
   `dd_push_disable_token` RPC so the dead token is dropped (retention).
5. `supabase functions deploy send_push` and set the env secrets with `supabase secrets set ...`.

Until steps 2–3 run on a real server with real keys, the function honestly returns 501 — it is
wired, guarded, and not faking a delivery.
