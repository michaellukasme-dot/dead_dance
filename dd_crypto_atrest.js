/* dd_crypto_atrest.js — DeadDance PHASE 3 encrypt-at-rest cipher (the REAL security work)
   ============================================================================
   HONEST STATUS (House Law, first lines):
     • WEB / NODE backend = REAL WebCrypto AES-GCM. Round-trip encrypt/decrypt is
       exercised by the Node harness (dd_wallet.test.js) and is NOT faked. Every
       encryption uses a FRESH random 12-byte IV; the key is INJECTED by the caller
       (opts.key), NEVER hardcoded in this file. Tamper (any ciphertext/IV bit flip)
       or wrong key → decrypt REJECTS (GCM auth tag), never returns garbage-as-success.
     • NATIVE backend = SEAM, designed + guarded, NOT device-proven here. On a real
       device the recommended at-rest is TWO layers: (1) whole-DB SQLCipher page
       encryption on @capacitor-community/sqlite, keyed from the OS secure store, and
       (2) this field-level AES-GCM as defense-in-depth (WKWebView/Android WebView
       both expose crypto.subtle, so the SAME code runs there). The SQLCipher key + its
       Keychain/Keystore binding is a DEVICE task on Michael's Mac — see KEY_MANAGEMENT.

   ── KEY MANAGEMENT — the hard part, stated honestly (do not skip) ─────────────
     The cipher is only as safe as where its key lives. This module does NOT invent
     a key and does NOT persist one; the key is always INJECTED. The honest rules:
       • NATIVE (iOS/Android): derive/store the AES key in the OS SECURE ENCLAVE —
         iOS Keychain (kSecAttrAccessibleWhenUnlockedThisDeviceOnly) / Android
         Keystore. That key is hardware-backed and not extractable. THIS is where
         encrypt-at-rest is actually meaningful. SQLCipher gets the same treatment.
       • WEB / PWA: the browser has NO secure keystore. Any key reachable from JS is
         extractable by a determined local attacker (devtools, disk forensics). So
         encryption in the PWA protects ONLY against casual inspection — NOT a
         determined local attacker. THEREFORE the honest rule, enforced by policy:
         ⇒ DO NOT STORE TICKET-HOLDER PII IN THE PWA AT ALL. Keep PII server-side;
           the PWA holds only the single-use signed token (TIX:id:sig), which is not
           a secret. This module's web path exists for the native WebView and for the
           rare "de-identified but still sensitive" blob — never as a license to cache
           real PII in a browser. See KEY_MANAGEMENT export below.

   EXPORTS: module.exports (Node) AND window.DDCryptoAtRest (browser) — dual, guarded.
   ============================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") { if (!window.DDCryptoAtRest) window.DDCryptoAtRest = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- environment plumbing (WebCrypto in browser / native WebView / Node) -----
  function glob() {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    return {};
  }
  function getSubtle(opts) {
    if (opts && opts.subtle) return opts.subtle;
    var g = glob();
    if (g.crypto && g.crypto.subtle) return g.crypto.subtle;
    try { var nc = require("crypto"); if (nc && nc.webcrypto && nc.webcrypto.subtle) return nc.webcrypto.subtle; } catch (e) {}
    return null;
  }
  function getRandom(opts) {
    if (opts && typeof opts.getRandomValues === "function") return opts.getRandomValues;
    var g = glob();
    if (g.crypto && typeof g.crypto.getRandomValues === "function") return g.crypto.getRandomValues.bind(g.crypto);
    try { var nc = require("crypto"); if (nc && nc.webcrypto && nc.webcrypto.getRandomValues) return nc.webcrypto.getRandomValues.bind(nc.webcrypto); } catch (e) {}
    return null;
  }
  function TE() { var g = glob(); return (g.TextEncoder ? new g.TextEncoder() : new TextEncoder()); }
  function TD() { var g = glob(); return (g.TextDecoder ? new g.TextDecoder() : new TextDecoder()); }

  // ---- portable base64 (Buffer in Node, btoa/atob in browser) ------------------
  function toB64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    var s = ""; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return glob().btoa(s);
  }
  function fromB64(b64) {
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(String(b64), "base64"));
    var s = glob().atob(String(b64)), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }

  // ---- key resolution — INJECTED only, never hardcoded -------------------------
  function looksLikeCryptoKey(k) {
    return !!(k && typeof k === "object" && k.type === "secret" && k.algorithm && typeof k.extractable !== "undefined");
  }
  function resolveKey(subtle, key) {
    if (key == null) {
      return Promise.reject(new Error("dd_crypto_atrest: opts.key is REQUIRED and must be INJECTED (never hardcoded). " +
        "Native: derive/store it in Keychain/Keystore. Web: do not persist PII — see KEY_MANAGEMENT."));
    }
    if (looksLikeCryptoKey(key)) return Promise.resolve(key);
    var raw;
    try {
      if (typeof key === "string") raw = fromB64(key);
      else if (key instanceof Uint8Array) raw = key;
      else if (typeof ArrayBuffer !== "undefined" && key instanceof ArrayBuffer) raw = new Uint8Array(key);
      else if (key && key.buffer) raw = new Uint8Array(key.buffer);
      else return Promise.reject(new Error("dd_crypto_atrest: unsupported key type (want CryptoKey | Uint8Array | ArrayBuffer | base64 string)"));
    } catch (e) { return Promise.reject(e); }
    if (raw.length !== 16 && raw.length !== 32) {
      return Promise.reject(new Error("dd_crypto_atrest: AES key must be 128 or 256 bits (16 or 32 bytes), got " + raw.length));
    }
    return subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }

  // ==========================================================================
  // createCipher(opts) → { backend, alg, ready(), encrypt(plaintext), decrypt(env) }
  //   opts.key      REQUIRED — injected key material (see resolveKey).
  //   opts.subtle   optional — inject a SubtleCrypto (else auto: global / node webcrypto).
  //   opts.backend  optional — 'web' | 'native' | 'node' | 'auto' (label only; the
  //                 real engine is WebCrypto everywhere it is available).
  //   encrypt(str)  → Promise<{ v:1, alg:'AES-GCM', iv:<b64>, ct:<b64> }>  (fresh IV each call)
  //   decrypt(env)  → Promise<string>  (REJECTS on tamper / wrong key — never fakes success)
  // ==========================================================================
  function createCipher(opts) {
    opts = opts || {};
    var subtle = getSubtle(opts), rnd = getRandom(opts);
    var label = opts.backend && opts.backend !== "auto" ? opts.backend : "webcrypto";

    if (!subtle || !rnd) {
      // HONEST: no WebCrypto here → we cannot encrypt. Fail loud, never a plaintext fallback.
      var why = "dd_crypto_atrest: WebCrypto subtle/getRandomValues unavailable — cannot encrypt at rest here (refusing to store plaintext).";
      return {
        backend: "unavailable", alg: "AES-GCM",
        ready: function () { return Promise.reject(new Error(why)); },
        encrypt: function () { return Promise.reject(new Error(why)); },
        decrypt: function () { return Promise.reject(new Error(why)); }
      };
    }

    var keyP = resolveKey(subtle, opts.key);
    // surface a key error early via ready(), but don't crash construction
    keyP.catch(function () {});

    function encrypt(plaintext) {
      return keyP.then(function (k) {
        var iv = new Uint8Array(12); rnd(iv);                 // FRESH random IV per record — never reused
        var data = (typeof plaintext === "string") ? TE().encode(plaintext)
                 : (plaintext instanceof Uint8Array ? plaintext : TE().encode(String(plaintext)));
        return subtle.encrypt({ name: "AES-GCM", iv: iv }, k, data).then(function (ctBuf) {
          return { v: 1, alg: "AES-GCM", iv: toB64(iv), ct: toB64(new Uint8Array(ctBuf)) };
        });
      });
    }
    function decrypt(env) {
      return keyP.then(function (k) {
        if (!env || env.iv == null || env.ct == null) {
          return Promise.reject(new Error("dd_crypto_atrest.decrypt: sealed envelope { iv, ct } required"));
        }
        var iv = fromB64(env.iv), ct = fromB64(env.ct);
        // subtle.decrypt REJECTS if the GCM auth tag doesn't verify (tamper / wrong key).
        return subtle.decrypt({ name: "AES-GCM", iv: iv }, k, ct).then(function (ptBuf) {
          return TD().decode(ptBuf);
        });
      });
    }
    return { backend: label, alg: "AES-GCM", ready: function () { return keyP.then(function () {}); }, encrypt: encrypt, decrypt: decrypt };
  }

  // ==========================================================================
  // randomKey(opts) → raw 32-byte AES-256 key (Uint8Array). For TESTS / provisioning.
  //   ⚠️ HONESTY: generating a key is easy; STORING it safely is the whole problem.
  //   Native: hand this to Keychain/Keystore. Web: there is nowhere safe to persist it
  //   — which is exactly why PWA-side PII storage is banned (see KEY_MANAGEMENT).
  // ==========================================================================
  function randomKey(opts) {
    var rnd = getRandom(opts);
    if (!rnd) throw new Error("dd_crypto_atrest.randomKey: no CSPRNG available");
    var b = new Uint8Array(32); rnd(b); return b;
  }
  function keyToB64(bytes) { return toB64(bytes); }

  // ==========================================================================
  // NATIVE SQLCipher SEAM — designed + guarded, NOT proven here.
  //   Returns a small descriptor a native entrypoint uses to open an ENCRYPTED
  //   @capacitor-community/sqlite DB. Without an injected plugin + a Keychain-sourced
  //   key it is a HONEST no-op (usable:false) so callers can SEE it is not wired.
  //   The real PRAGMA key / open runs on-device; this sandbox cannot bind SQLCipher.
  // ==========================================================================
  function nativeSqlcipherSeam(opts) {
    opts = opts || {};
    var plugin = opts.sqlite || opts.sqlitePlugin || null;
    var key = opts.dbKey || null;   // MUST come from Keychain/Keystore on-device, never from JS source
    var usable = !!(plugin && key);
    return {
      backend: "sqlcipher-native",
      usable: usable,
      _noop: !usable,
      // How a native entrypoint would open an encrypted connection (documented, not executed here):
      openParams: usable ? {
        database: opts.name || "dd_secure",
        encrypted: true,
        mode: "secret",
        // @capacitor-community/sqlite: createConnection(name, encrypted:true, mode:'secret', ...)
        // then setEncryptionSecret(key) ONCE from a Keychain-derived value on first run.
        _note: "key is Keychain/Keystore-sourced; NEVER embedded in shipped JS"
      } : null,
      note: usable
        ? "sqlcipher seam ready (params only — actual open + PRAGMA key runs on device)"
        : "sqlcipher seam NOT usable: inject { sqlite, dbKey(from Keychain) }; refusing to imply encryption"
    };
  }

  // Honest, machine-readable statement of the key-management rules (for UI/docs/tests).
  var KEY_MANAGEMENT = {
    native: "Key lives in OS secure store (iOS Keychain / Android Keystore), hardware-backed, non-extractable. " +
            "SQLCipher whole-DB + AES-GCM field-level as defense-in-depth. Encrypt-at-rest is meaningful here.",
    web:    "No secure keystore in the browser. Any JS-reachable key is extractable by a determined local attacker. " +
            "Encryption protects ONLY against casual inspection. RULE: do NOT store ticket-holder PII in the PWA at all — " +
            "keep PII server-side; the PWA holds only the single-use signed token (TIX:id:sig), which is not a secret.",
    rule:   "PII at rest requires a real cipher AND a safe key location. On web the safe location does not exist → don't store PII there."
  };

  return {
    VERSION: "1.0.0-phase3",
    createCipher: createCipher,
    randomKey: randomKey,
    keyToB64: keyToB64,
    nativeSqlcipherSeam: nativeSqlcipherSeam,
    KEY_MANAGEMENT: KEY_MANAGEMENT,
    // low-level, exported for tests / reuse
    _toB64: toB64, _fromB64: fromB64
  };
});
