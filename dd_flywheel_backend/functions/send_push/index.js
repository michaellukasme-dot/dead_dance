/* send_push/index.js — DeadDance PHASE 4 SERVER-SIDE push sender (SKELETON).
   ============================================================================
   HONEST STATUS (House Law, first lines):
     • This is a SERVER function SKELETON. It CANNOT deliver a real push in this
       sandbox: APNs needs Michael's Apple auth key (.p8 + Key ID + Team ID); FCM
       needs a Google service-account (project id + private key). Those are NOT
       present here. Where the real HTTP/2 APNs POST and the FCM v1 POST happen is
       marked TODO and GUARDED: if the keys are missing from the SERVER env, this
       returns HTTP 501 with an honest message. It NEVER returns a fake "delivered".
     • ALL secrets are read from the SERVER environment (Deno.env / process.env). NO
       APNs key, FCM key, or service_role key is ever shipped to the client. The
       client only ever REGISTERS a token (dd_push_client → dd_push_register_token);
       it never holds a sending credential.
     • On-device SCHEDULED reminders do NOT use this — they fire offline from the
       device (dd_notify_schedule.js). This function is ONLY for the few genuinely-
       live pushes the server alone knows (a schedule change, "band on NOW").

   DEPLOY: written as a Supabase Edge Function (Deno). The `Deno.serve(handler)`
   wrapper is at the bottom, guarded so it is a no-op under Node (where `node --check`
   / unit reuse of the pure helpers still works). See sibling README.md + RUNBOOK §Phase-4.
   ============================================================================ */
"use strict";

// ---- env access that works under Deno (Edge) AND Node (check/reuse) ------------
function env(name) {
  try { if (typeof Deno !== "undefined" && Deno.env && Deno.env.get) return Deno.env.get(name) || null; } catch (e) {}
  try { if (typeof process !== "undefined" && process.env) return process.env[name] || null; } catch (e) {}
  return null;
}

// The SERVER-ONLY secrets. Absent in this sandbox → the sender refuses honestly.
function apnsCreds() {
  return {
    authKeyP8: env("APNS_AUTH_KEY_P8"),   // the .p8 auth-key contents (PEM) — SERVER ONLY
    keyId:     env("APNS_KEY_ID"),        // 10-char Key ID for the .p8
    teamId:    env("APNS_TEAM_ID"),       // Apple Team ID
    topic:     env("APNS_TOPIC"),         // the app bundle id (aps-topic)
    production: env("APNS_PRODUCTION") === "true"
  };
}
function fcmCreds() {
  return {
    saJson:    env("FCM_SA_JSON"),        // service-account JSON (contains the private key) — SERVER ONLY
    projectId: env("FCM_PROJECT_ID")
  };
}

function json(status, obj) {
  var body = JSON.stringify(obj);
  if (typeof Response !== "undefined") return new Response(body, { status: status, headers: { "content-type": "application/json" } });
  return { status: status, body: body }; // Node-shape fallback (skeleton reuse/tests)
}

// ---- PURE: build the platform notification payload from a neutral message -------
// NO PII goes in a push payload — only the show/band ids + display copy the app
// already shows. (House Law: the payload is not a place to leak identity.)
function buildApnsPayload(message) {
  var m = message || {};
  return {
    aps: {
      alert: { title: String(m.title || "DeadDance"), body: String(m.body || "") },
      sound: "default",
      "content-available": m.silent ? 1 : undefined
    },
    // custom keys the app routes on — ids only, never PII.
    kind: m.kind || "live",
    refId: m.refId || null,
    band: m.band || null
  };
}
function buildFcmMessage(token, message) {
  var m = message || {};
  return {
    message: {
      token: String(token),
      notification: { title: String(m.title || "DeadDance"), body: String(m.body || "") },
      data: { kind: String(m.kind || "live"), refId: String(m.refId || ""), band: String(m.band || "") }
    }
  };
}

// ---- GUARDED send steps — NOT implemented here (keys required) -----------------
// On a real server these do the JWT-signed HTTP/2 POST to APNs, and the OAuth2
// FCM v1 POST. This skeleton refuses rather than fake a delivery.
function sendApns(/* tokens, payload, apns */) {
  throw new Error("NOT_IMPLEMENTED: APNs send requires the .p8 auth key + Key ID + Team ID on the SERVER, " +
    "then a JWT-authorized HTTP/2 POST to api.push.apple.com. key required — not proven here.");
}
function sendFcm(/* tokens, message, fcm */) {
  throw new Error("NOT_IMPLEMENTED: FCM send requires the service-account JSON on the SERVER, " +
    "then an OAuth2-authorized POST to fcm.googleapis.com/v1/projects/<id>/messages:send. account required — not proven here.");
}

// ---- the request handler -------------------------------------------------------
// POST { platform:'ios'|'android', tokens:[...], message:{ title, body, kind, refId, band } }
// → 200 { ok, sent } once implemented   OR   501 honest "keys not configured".
function handler(req) {
  return Promise.resolve().then(function () {
    if (!req || (req.method && req.method !== "POST")) return json(405, { ok: false, error: "POST only" });
    var parseBody = (req.json ? req.json() : Promise.resolve(req.body || {}));
    return Promise.resolve(parseBody).then(function (raw) {
      var body = (typeof raw === "string") ? JSON.parse(raw || "{}") : (raw || {});
      var platform = body.platform || "ios";
      var tokens = Array.isArray(body.tokens) ? body.tokens : [];
      var message = body.message || {};
      if (!tokens.length) return json(400, { ok: false, error: "tokens[] required" });

      if (platform === "android") {
        var f = fcmCreds();
        if (!f.saJson || !f.projectId) {
          return json(501, { ok: false, error: "FCM not configured on server (FCM_SA_JSON / FCM_PROJECT_ID). Not sending — no fake delivery." });
        }
        var fmsgs = tokens.map(function (t) { return buildFcmMessage(t, message); });
        var fres = sendFcm(fmsgs, message, f); // throws NOT_IMPLEMENTED until implemented on a real server
        return json(200, { ok: true, sent: fres });
      }

      // default: Apple / iOS
      var a = apnsCreds();
      if (!a.authKeyP8 || !a.keyId || !a.teamId || !a.topic) {
        return json(501, { ok: false, error: "APNs not configured on server (APNS_AUTH_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID / APNS_TOPIC). Not sending — no fake delivery." });
      }
      var payload = buildApnsPayload(message);
      var ares = sendApns(tokens, payload, a); // throws NOT_IMPLEMENTED until implemented on a real server
      return json(200, { ok: true, sent: ares });
    });
  }).catch(function (e) {
    var msg = (e && e.message) || String(e);
    var notReady = msg.indexOf("NOT_IMPLEMENTED") === 0;
    return json(notReady ? 501 : 400, { ok: false, error: msg });
  });
}

// ---- Deno (Edge) entrypoint — guarded so Node just reuses the pure helpers ------
try {
  if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
    Deno.serve(handler);
  }
} catch (e) { /* not on Deno — exports below cover Node reuse / tests */ }

if (typeof module !== "undefined" && module.exports) {
  module.exports = { handler: handler, buildApnsPayload: buildApnsPayload, buildFcmMessage: buildFcmMessage, sendApns: sendApns, sendFcm: sendFcm };
}
