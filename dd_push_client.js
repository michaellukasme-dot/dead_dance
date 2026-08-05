/* dd_push_client.js — DeadDance PHASE 4 push CLIENT seam (window.DDPush).
   ============================================================================
   HONEST STATUS (House Law, first lines):
     • This is the CLIENT glue for REMOTE push: it asks DDShell.push to register the
       device (native only) and SAVES the returned token to the server via the
       dd_push_register_token RPC (24_push.sql). It holds NO APNs/FCM key and NO
       service_role — the actual SEND is server-side (functions/send_push, a 501
       skeleton until Michael sets the keys). The token is a routing ADDRESS, not a
       secret; the row is IDS-ONLY (a subject HASH, never email/name).
     • In a plain browser DDShell.isNative() is false → register() resolves null and
       registerDevice() reports 📴 "not native — no token" HONESTLY. Nothing here
       fakes a registration or a delivered push.
     • Every write to the server chains .then/.catch and returns the REAL result
       (✅ saved / ⚠️ didn't reach server / 📴 no backend|not native). No blanket
       "registered!" — House Law Truth Audit.

   subjectHash: an APP-IDENTITY HASH, never PII. We reuse the app's existing
   de-identified subject hash if present (DDGeo/consent style); callers may pass one.
   ============================================================================ */
(function (root) {
  "use strict";
  function C() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function shell() { return root.DDShell || null; }

  // Resolve a de-identified subject hash (NOT email/name). Prefer an app-provided
  // hash; fall back to a stable random per-device id kept in DDShell storage.
  function subjectHash(explicit) {
    if (explicit) return Promise.resolve(String(explicit));
    try {
      if (root.DDGeo && typeof root.DDGeo.subjectHash === "function") {
        return Promise.resolve(root.DDGeo.subjectHash());
      }
    } catch (e) {}
    var s = shell();
    if (s && s.storageGet) {
      return Promise.resolve(s.storageGet("dd.push.subject")).then(function (v) {
        if (v) return v;
        var gen = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        return Promise.resolve(s.storageSet("dd.push.subject", gen)).then(function () { return gen; });
      });
    }
    return Promise.resolve("dev_" + Math.random().toString(36).slice(2));
  }

  function platform() {
    var s = shell();
    try { if (s && typeof s.platform === "function") return s.platform(); } catch (e) {}
    return "web";
  }

  // Register this device for REMOTE push and SAVE the token to the server.
  // Returns Promise<{ ok, status, token?, error? }>:
  //   status 'saved'      → ✅ token persisted server-side (real RPC success)
  //   status 'not_native' → 📴 browser/PWA, no native token (honest no-op)
  //   status 'denied'     → 📴 user denied / no plugin → no token
  //   status 'no_backend' → 📴 supabase client absent
  //   status 'error'      → ⚠️ token obtained but the save did NOT reach the server
  function registerDevice(opts) {
    opts = opts || {};
    var s = shell();
    if (!s || typeof s.isNative !== "function" || !s.isNative()) {
      return Promise.resolve({ ok: false, status: "not_native", note: "📴 not native — no push token here" });
    }
    if (!s.push || typeof s.push.register !== "function") {
      return Promise.resolve({ ok: false, status: "denied", note: "📴 no push plugin" });
    }
    return Promise.resolve(s.push.register()).then(function (token) {
      if (!token) return { ok: false, status: "denied", note: "📴 push not granted — no token" };
      return saveToken(token, opts).then(function (saved) {
        return saved;
      });
    }).catch(function (e) {
      return { ok: false, status: "error", note: "⚠️ registration failed", error: (e && e.message) || String(e) };
    });
  }

  // Persist a device token. Ids-only payload. Chains then/catch → honest result.
  function saveToken(token, opts) {
    opts = opts || {};
    var c = C();
    if (!token) return Promise.resolve({ ok: false, status: "denied", note: "📴 no token" });
    if (!c) return Promise.resolve({ ok: false, status: "no_backend", note: "📴 offline — token not saved" });
    return subjectHash(opts.subjectHash).then(function (hash) {
      return c.rpc("dd_push_register_token", {
        p_subject_hash: hash,
        p_device_token: String(token),
        p_platform: opts.platform || platform(),
        p_app_version: opts.appVersion || null
      }).then(function (r) {
        if (r && r.error) throw r.error;
        var data = (r && r.data) || null;
        if (data && data.ok === false) return { ok: false, status: "error", note: "⚠️ server rejected token: " + (data.err || "?"), token: token };
        return { ok: true, status: "saved", note: "✅ push token saved", token: token };
      }).catch(function (e) {
        return { ok: false, status: "error", note: "⚠️ token didn't reach server", token: token, error: (e && e.message) || String(e) };
      });
    });
  }

  // Subscribe to incoming push payloads (native only). Returns an unsubscribe fn.
  function onMessage(cb) {
    var s = shell();
    if (!s || !s.push || typeof s.push.onNotification !== "function") return function () {};
    return s.push.onNotification(cb);
  }

  root.DDPush = {
    registerDevice: registerDevice,
    saveToken: saveToken,
    onMessage: onMessage,
    subjectHash: subjectHash,
    platform: platform
  };
})(typeof window !== "undefined" ? window : this);
