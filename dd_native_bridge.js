/* dd_native_bridge.js — DeadDance hybrid-native BRIDGE (Phase 0)
   ---------------------------------------------------------------------------
   PROGRESSIVE ENHANCEMENT, ONE CODEBASE. This file loads in the SAME web app,
   whether it is running:
     (a) inside the Capacitor native shell (iOS WKWebView / Android WebView), or
     (b) in a plain browser as today's PWA.

   In a plain browser `window.Capacitor` is undefined → isNative() === false →
   EVERY method here falls back to the EXISTING web behavior (DDGPS, localStorage,
   window.open, the app's own auth redirect). It never throws. It adds no new
   capability to the browser build. It is a no-op wrapper until a native shell is
   present. This is the House-Law-safe way to wrap: nothing here fakes a native
   capability in a browser — it either routes to a real native plugin (when the
   shell is there) or to the real web path (when it isn't).

   This EXTENDS dd_native.js (DDNative: A2HS / haptics / wakelock / badge — the
   web-native helpers). It does NOT duplicate them; DDShell.buzz()/keepAwake()
   just defer to DDNative. What DDShell adds are the FIRST real web↔native SEAMS:
     • geolocation   native → @capacitor/geolocation  | web → DDGPS.start
     • storage       native → @capacitor/preferences  | web → localStorage
     • openExternal  native → @capacitor/browser       | web → window.open
                     (payment / ticket links LEAVE the WebView — money-stays-outside)
     • authRedirect  native → documented https redirect | web → the app's default

   Native plugins are reached lazily via window.Capacitor.Plugins.<Name>, which the
   Capacitor runtime injects when the corresponding plugin is installed + synced on
   the Mac. If a plugin is missing at runtime, the bridge FALLS BACK to the web path
   rather than throwing — honest degradation, never a silent lie about a capability.

   Exposed as window.DDShell. Load it EARLY (before the service-worker registration
   and before any auth call), e.g. in <head>. Safe to load anywhere: if it is absent
   or fails to load, callers that guard on `window.DDShell` simply keep old behavior.
   ------------------------------------------------------------------------------- */
(function (w) {
  "use strict";
  if (w.DDShell) return; // idempotent

  // ---- native detection ------------------------------------------------------
  function cap() { return w.Capacitor || null; }
  function isNative() {
    try {
      var c = cap();
      return !!(c && typeof c.isNativePlatform === "function" && c.isNativePlatform());
    } catch (e) { return false; }
  }
  function platform() {
    try {
      var c = cap();
      if (c && typeof c.getPlatform === "function") return c.getPlatform();
    } catch (e) {}
    return "web";
  }
  function plugin(name) {
    try { var c = cap(); return (c && c.Plugins && c.Plugins[name]) || null; } catch (e) { return null; }
  }

  // ===========================================================================
  // AUTH REDIRECT — the panel's #1 risk (capacitor://localhost origin).
  // In a browser: return the app's default (location.origin + pathname) UNCHANGED
  //   → zero behavior change to the live PWA.
  // In the native shell: location.origin is `capacitor://localhost` (iOS) /
  //   `https://localhost` (Android). Supabase magic-link/OAuth callbacks are
  //   origin-bound, so we must hand Supabase a real, allow-listed https URL that
  //   the OS/app can catch. For Phase 0 we return the canonical site URL below;
  //   Michael allow-lists it in the Supabase dashboard (see RUNBOOK §Auth). Full
  //   in-app deep-link CAPTURE of that callback (App URL-open listener + custom
  //   scheme / Universal Link) is a Phase-1 deliverable — DECLARED, not faked.
  // ===========================================================================
  var DD_AUTH_REDIRECT = "https://deaddance.app/"; // must be in Supabase → Auth → URL Configuration (Redirect URLs)
  function authRedirect(defaultUrl) {
    try {
      if (isNative()) return DD_AUTH_REDIRECT;
    } catch (e) {}
    return defaultUrl; // browser / PWA: unchanged
  }

  // ===========================================================================
  // GEOLOCATION SEAM  — graceful tiers, one onFix contract for all of them:
  //   native + bg-granted + active session → @transistorsoft background-geo  [Phase 1]
  //   native, foreground only              → @capacitor/geolocation          [Phase 0]
  //   web / no shell                       → DDGPS.start (Kalman engine)      [today, UNCHANGED]
  //
  // The Phase-1 background tier is OFF by default (opts.background falsy) so every
  // existing caller behaves EXACTLY as before. A caller opts in with
  // { background:true } once the user has granted "Always" location AND started a
  // "walk me to my stage" session. If the Transistorsoft plugin isn't present /
  // isn't licensed, this falls through to the foreground native tier, then to the
  // web engine — honest degradation at every rung, never a fake "background on".
  // Every tier emits: onFix({lat,lng,acc,rawAcc,speed,heading,alt,locked,raw,_native}).
  //   Returns a handle { stop() } in all modes.
  //
  // HONEST BOUNDARY: background GPS is unproven in a browser/sandbox — the branch
  // below only does anything inside the native shell with the licensed plugin
  // installed on Michael's Mac. In a plain browser isNative() is false and this
  // whole block is skipped; the live PWA keeps using DDGPS unchanged.
  // ===========================================================================
  function bgGeoPlugin() {
    // Transistorsoft registers as Capacitor.Plugins.BackgroundGeolocation and/or
    // is assigned to window.BackgroundGeolocation by the app's native entrypoint.
    try {
      return plugin("BackgroundGeolocation") ||
             (w.BackgroundGeolocation && typeof w.BackgroundGeolocation.onLocation === "function" ? w.BackgroundGeolocation : null);
    } catch (e) { return null; }
  }

  function watchPosition(opts) {
    opts = opts || {};
    var onFix = opts.onFix || function () {};
    var onError = opts.onError || function () {};

    if (isNative()) {
      // --- Phase-1 tier: background-geo (only when the caller opts in) ---------
      if (opts.background) {
        var bg = bgGeoPlugin();
        if (bg && w.DDGeoNative && typeof w.DDGeoNative.startBackground === "function") {
          // reuse the live dd_gps Kalman as the OPTIONAL light normalizer (§4.4,
          // tune-on-device). Passthrough if DDGPS/Kalman is absent.
          var filter = null;
          try {
            if (w.DDGPS && w.DDGPS.Kalman) {
              var kf = new w.DDGPS.Kalman(opts.q || 3);
              filter = function (la, lo, ac, ts) { return kf.process(la, lo, ac, ts); };
            }
          } catch (e) {}
          var h = w.DDGeoNative.startBackground(bg, {
            activeSession: opts.activeSession !== false,
            onFix: onFix,
            onError: function (e) { if (!(e && e.fallback)) onError(e); }, // swallow "no plugin" → we fall through
            onGeofence: opts.onGeofence,
            lockAcc: opts.lockAcc, kalmanMode: opts.kalmanMode,
            distanceFilter: opts.distanceFilter, filter: filter,
            license: opts.bgLicense   // injected by the caller from a secure source; never stored in the bridge
          });
          if (h && !h._noop) return h;   // background running → done
          // h._noop → plugin/brain not usable → fall through to the foreground tier
        }
        // no bg plugin → fall through to foreground native (honest degradation)
      }

      var geo = plugin("Geolocation");
      if (geo && typeof geo.watchPosition === "function") {
        var watchId = null, dead = false, lockAcc = opts.lockAcc || 25;
        try {
          var p = geo.watchPosition(
            { enableHighAccuracy: true, timeout: opts.timeout || 30000, maximumAge: 8000 },
            function (pos, err) {
              if (dead) return;
              if (err) { onError({ code: err.code || 0, message: err.message || "geolocation error" }); return; }
              if (!pos || !pos.coords) return;
              var c = pos.coords, rawAcc = (c.accuracy != null ? c.accuracy : 99);
              onFix({
                lat: c.latitude, lng: c.longitude,
                acc: rawAcc, rawAcc: rawAcc,
                speed: (c.speed != null && c.speed >= 0) ? c.speed : null,
                heading: (c.heading != null && !isNaN(c.heading)) ? c.heading : null,
                alt: (c.altitude != null ? c.altitude : null),
                locked: rawAcc <= lockAcc,
                raw: [c.latitude, c.longitude],
                _native: true
              });
            }
          );
          if (p && p.then) p.then(function (id) { watchId = id; }, function (e) { onError({ code: 0, message: (e && e.message) || "watch failed" }); });
        } catch (e) {
          onError({ code: 0, message: (e && e.message) || "native geolocation threw" });
        }
        return {
          stop: function () {
            if (dead) return; dead = true;
            try { if (watchId != null && geo.clearWatch) geo.clearWatch({ id: watchId }); } catch (e) {}
          }
        };
      }
      // native shell present but plugin not installed → fall through to web path (honest fallback)
    }

    // web path — the existing engine, untouched
    if (w.DDGPS && typeof w.DDGPS.start === "function") {
      return w.DDGPS.start({
        onFix: onFix, onError: onError,
        q: opts.q, lockAcc: opts.lockAcc, dropAcc: opts.dropAcc, timeout: opts.timeout
      });
    }
    onError({ code: 0, message: "no geolocation engine available" });
    return { stop: function () {} };
  }

  // ===========================================================================
  // STORAGE SEAM
  //   web    → localStorage (synchronous under the hood, wrapped in a Promise so
  //            the API is identical in both modes).
  //   native → @capacitor/preferences (durable, not subject to WebKit's 7-day
  //            script-storage eviction). Large binary / tile packs → Filesystem in
  //            Phase 2; this seam is the small key/value durable store.
  //   All three return Promises. Never throw.
  // ===========================================================================
  function storageGet(key) {
    if (isNative()) {
      var pref = plugin("Preferences");
      if (pref && pref.get) {
        return Promise.resolve(pref.get({ key: key })).then(function (r) { return r ? r.value : null; }, function () { return webGet(key); });
      }
    }
    return Promise.resolve(webGet(key));
  }
  function storageSet(key, value) {
    if (isNative()) {
      var pref = plugin("Preferences");
      if (pref && pref.set) {
        return Promise.resolve(pref.set({ key: key, value: String(value) })).then(function () {}, function () { webSet(key, value); });
      }
    }
    webSet(key, value);
    return Promise.resolve();
  }
  function storageRemove(key) {
    if (isNative()) {
      var pref = plugin("Preferences");
      if (pref && pref.remove) {
        return Promise.resolve(pref.remove({ key: key })).then(function () {}, function () { webRemove(key); });
      }
    }
    webRemove(key);
    return Promise.resolve();
  }
  function webGet(key) { try { return w.localStorage ? w.localStorage.getItem(key) : null; } catch (e) { return null; } }
  function webSet(key, value) { try { if (w.localStorage) w.localStorage.setItem(key, String(value)); } catch (e) {} }
  function webRemove(key) { try { if (w.localStorage) w.localStorage.removeItem(key); } catch (e) {} }

  // ===========================================================================
  // EXTERNAL LINK SEAM — money / tickets LEAVE the WebView.
  //   web    → window.open(url,'_blank','noopener') — today's behavior.
  //   native → @capacitor/browser Browser.open — opens Stripe / ticket / payment
  //            links in the SYSTEM browser (SFSafariViewController / Custom Tab),
  //            NOT inside the app's WebView. This directly supports the
  //            money-stays-outside rule and keeps in-app-purchase rules clean.
  //   Returns a Promise (resolves when the sheet is presented / tab opened).
  // ===========================================================================
  function openExternal(url) {
    if (!url) return Promise.resolve();
    if (isNative()) {
      var br = plugin("Browser");
      if (br && br.open) {
        try { return Promise.resolve(br.open({ url: String(url) })).catch(function () { webOpen(url); }); }
        catch (e) { webOpen(url); return Promise.resolve(); }
      }
    }
    webOpen(url);
    return Promise.resolve();
  }
  function webOpen(url) { try { w.open(String(url), "_blank", "noopener"); } catch (e) { try { w.location.href = url; } catch (x) {} } }

  // ---- passthroughs to DDNative (web-native helpers) — do NOT reimplement -----
  function buzz(p) { try { if (w.DDNative && w.DDNative.buzz) w.DDNative.buzz(p); else if (w.navigator && navigator.vibrate) navigator.vibrate(p || 12); } catch (e) {} }
  function keepAwake(on) { try { if (w.DDNative && w.DDNative.keepAwake) w.DDNative.keepAwake(on); } catch (e) {} }

  w.DDShell = {
    // identity
    isNative: isNative,
    platform: platform,
    hasPlugin: function (name) { return !!plugin(name); },
    // seams
    watchPosition: watchPosition,
    hasBackgroundGeo: function () { return isNative() && !!bgGeoPlugin() && !!(w.DDGeoNative && w.DDGeoNative.startBackground); },
    storageGet: storageGet,
    storageSet: storageSet,
    storageRemove: storageRemove,
    openExternal: openExternal,
    authRedirect: authRedirect,
    AUTH_REDIRECT: DD_AUTH_REDIRECT,
    // passthroughs
    buzz: buzz,
    keepAwake: keepAwake,
    // meta
    _phase: 1,
    _version: "0.2.0"
  };
})(typeof window !== "undefined" ? window : this);
