/* sign_pass/index.js — DeadDance PHASE 3 SERVER-SIDE pass signer (SKELETON).
   ============================================================================
   HONEST STATUS (House Law, first lines):
     • This is a SERVER function SKELETON. It CANNOT sign a real pass in this sandbox:
       signing needs Michael's Apple Pass Type ID certificate + private key (Apple)
       and a Google Wallet service-account key (Google). Those are NOT present here.
     • Where the real PKCS#7 sign + zip (Apple) and RS256 JWT sign (Google) happen is
       marked TODO and GUARDED: if the certs/keys are missing from the SERVER env, this
       returns HTTP 501 with an honest message. It NEVER returns a fake "signed pass".
     • ALL secrets are read from the SERVER environment (Deno.env / process.env). NO
       certificate, private key, or service_role key is ever shipped to the client. The
       client only ever receives a URL/blob to open (see DDShell.addToWallet).

   DEPLOY: this is written as a Supabase Edge Function. On Supabase it runs under Deno;
   the `Deno.serve(handler)` wrapper is at the bottom, guarded so it is a no-op under
   Node (where `node --check` / unit reuse of the pure helpers still works). See the
   sibling README.md and RUNBOOK.md §Phase-3 for cert procurement + `supabase functions
   deploy sign_pass` steps.
   ============================================================================ */
"use strict";

// ---- env access that works under Deno (Edge) AND Node (check/reuse) ------------
function env(name) {
  try { if (typeof Deno !== "undefined" && Deno.env && Deno.env.get) return Deno.env.get(name) || null; } catch (e) {}
  try { if (typeof process !== "undefined" && process.env) return process.env[name] || null; } catch (e) {}
  return null;
}

// The SERVER-ONLY secrets. Absent in this sandbox → the signer refuses honestly.
function appleCreds() {
  return {
    certPem: env("APPLE_PASS_CERT_PEM"),         // Pass Type ID certificate (PEM)
    keyPem: env("APPLE_PASS_KEY_PEM"),           // its private key (PEM) — SERVER ONLY
    wwdrPem: env("APPLE_WWDR_PEM"),              // Apple WWDR intermediate cert (PEM)
    passTypeId: env("APPLE_PASS_TYPE_ID"),       // e.g. pass.app.deaddance.ticket
    teamId: env("APPLE_TEAM_ID")
  };
}
function googleCreds() {
  return {
    saJson: env("GOOGLE_SA_JSON"),               // service-account JSON (contains the RS256 private key) — SERVER ONLY
    issuerId: env("GOOGLE_WALLET_ISSUER_ID")
  };
}

function json(status, obj) {
  var body = JSON.stringify(obj);
  if (typeof Response !== "undefined") return new Response(body, { status: status, headers: { "content-type": "application/json" } });
  return { status: status, body: body }; // Node-shape fallback (skeleton reuse/tests)
}

// ---- PURE: assemble the pass STRUCTURE (mirrors dd_wallet.buildPkpassJson) ------
// Kept inline so the Edge function is self-contained (Deno can't require the browser
// dual-module directly). The SHAPE is identical to dd_wallet.js — the single source of
// truth for the client; server just re-derives it with the REAL cert identifiers.
function assemblePassJson(ticket, apple) {
  var t = ticket || {};
  var msg = t.token;                              // the client sends the TIX:id:sig token (a signed token, not a secret)
  if (!msg || String(msg).indexOf("TIX:") !== 0) {
    throw new Error("sign_pass: ticket.token (TIX:id:sig) required — refusing to sign a pass with no secure token");
  }
  var id = t.ticket_id || t.id || msg;
  var barcode = { format: "PKBarcodeFormatQR", message: String(msg), messageEncoding: "iso-8859-1", altText: String(id) };
  return {
    formatVersion: 1,
    passTypeIdentifier: apple.passTypeId,         // REAL value from the server cert env
    teamIdentifier: apple.teamId,
    organizationName: "DeadDance",
    description: (t.event || t.event_slug || "DeadDance") + " ticket",
    serialNumber: String(id),
    barcode: barcode,
    barcodes: [barcode],
    eventTicket: {
      primaryFields: [{ key: "event", label: "EVENT", value: String(t.event || t.event_slug || "DeadDance Event") }],
      auxiliaryFields: [{ key: "admission", label: "ADMISSION", value: String(t.seat || t.tier || "GA").toUpperCase() }]
    }
  };
}

// ---- GUARDED sign steps — NOT implemented here (cert required) -----------------
// On a real server these do the PKCS#7 detached signature over the manifest + zip
// (Apple), and the RS256 JWT sign (Google). This skeleton refuses rather than fake it.
function signApplePkpass(/* passJson, apple */) {
  throw new Error("NOT_IMPLEMENTED: Apple .pkpass signing requires the Pass Type ID cert + key + WWDR on the SERVER. " +
    "Implement PKCS#7 detached-sign of manifest.json + zip here (e.g. node-forge / passkit-generator). cert required — not proven here.");
}
function signGoogleJwt(/* claims, google */) {
  throw new Error("NOT_IMPLEMENTED: Google Wallet JWT signing requires the service-account private key (RS256) on the SERVER. " +
    "Implement RS256 sign of the savetowallet claims here. account required — not proven here.");
}

// ---- the request handler -------------------------------------------------------
// POST { platform: 'apple'|'google', ticket: { token, ticket_id, event, tier, seat } }
// → 200 { url } | { jwt }  (server-signed)   OR   501 honest "cert not configured".
function handler(req) {
  return Promise.resolve().then(function () {
    if (!req || (req.method && req.method !== "POST")) return json(405, { ok: false, error: "POST only" });
    var parseBody = (req.json ? req.json() : Promise.resolve(req.body || {}));
    return Promise.resolve(parseBody).then(function (raw) {
      var body = (typeof raw === "string") ? JSON.parse(raw || "{}") : (raw || {});
      var platform = body.platform || "apple";
      var ticket = body.ticket || {};

      if (platform === "google") {
        var g = googleCreds();
        if (!g.saJson || !g.issuerId) {
          return json(501, { ok: false, error: "Google Wallet not configured on server (GOOGLE_SA_JSON / GOOGLE_WALLET_ISSUER_ID). Not signing — no fake pass." });
        }
        var claims = { typ: "savetowallet", payload: { eventTicketObjects: [{ id: g.issuerId + "." + (ticket.ticket_id || ""), barcode: { type: "QR_CODE", value: ticket.token } }] } };
        var jwt = signGoogleJwt(claims, g); // throws NOT_IMPLEMENTED until implemented on a real server
        return json(200, { ok: true, jwt: jwt, saveUrl: "https://pay.google.com/gp/v/save/" + jwt });
      }

      // default: Apple
      var a = appleCreds();
      if (!a.certPem || !a.keyPem || !a.wwdrPem || !a.passTypeId || !a.teamId) {
        return json(501, { ok: false, error: "Apple Wallet not configured on server (APPLE_PASS_CERT_PEM / APPLE_PASS_KEY_PEM / APPLE_WWDR_PEM / APPLE_PASS_TYPE_ID / APPLE_TEAM_ID). Not signing — no fake pass." });
      }
      var passJson = assemblePassJson(ticket, a);
      var pkpassBytes = signApplePkpass(passJson, a); // throws NOT_IMPLEMENTED until implemented on a real server
      return json(200, { ok: true, contentType: "application/vnd.apple.pkpass", bytesBase64: pkpassBytes });
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
  module.exports = { handler: handler, assemblePassJson: assemblePassJson, signApplePkpass: signApplePkpass, signGoogleJwt: signGoogleJwt };
}
