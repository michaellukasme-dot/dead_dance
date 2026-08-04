/* dd_geo_native.js — DeadDance PHASE 1 native-GPS brain (pure logic + guarded runtime)
   ============================================================================
   HONEST STATUS (House Law, first lines):
     • The PURE logic in here (tier state machine + hysteresis, sampler cadence,
       uploader policy, geofence distance math, de-identified token rotation,
       ingest-item builder, the native→onFix adapter, the Transistorsoft config
       builder) is deterministic and Node-tested — see dd_native/dd_geo_native.test.js.
     • Background GPS was NOT proven working here. This file cannot compile iOS/
       Android and cannot run @transistorsoft background-geolocation in a Linux
       sandbox or a browser. The one runtime function that talks to the plugin
       (`startBackground`) is a GUARDED no-op unless a real Transistorsoft plugin
       object is injected — which only exists in the native shell on Michael's Mac.
     • Every accuracy number in the plan is TARGET-UNMEASURED until a field bench.
       Nothing here measures or asserts accuracy.
     • This does NOT change the live PWA: in a browser DDShell routes geolocation
       to the existing web dd_gps engine (unchanged). This module only supplies
       config + adapters the NATIVE shell uses, and pure helpers that are inert
       until called. Loading it in a browser adds no capability and no side effect.

   EXPORTS: module.exports (Node) AND window.DDGeoNative (browser) — dual, guarded.
   No I/O, no globals mutated, no network. The plugin is INJECTED, never imported.
   ============================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") { if (!window.DDGeoNative) window.DDGeoNative = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ==========================================================================
  // 0. CONSTANTS — the tune-on-device knobs. All planning values; the field
  //    bench (NATIVE_GPS_PLAN §6 step 7) replaces these. Never a measurement.
  // ==========================================================================
  var TIER = { none: 0, weak: 1, medium: 2, strong: 3, wifi: 4 };
  var TIER_NAME = ["none", "weak", "medium", "strong", "wifi"];

  var DEFAULTS = {
    // hysteresis (Brandon's rule): promote only after SUSTAINED better link,
    // demote immediately on a hard failure. Stops tier-thrash that burns battery.
    promoteAfterMs: 75000,        // ~60–90 s sustained-better before we promote
    // sampler battery floors (battery is sacred — Lakshmi's law)
    batteryParkedFloor: 8,        // below this (and not charging) → PARKED, no GPS
    batterySigChangeFloor: 15,    // below this (and not charging) → SIGNIFICANT-CHANGE only
    // geofence flap guard: enter at r, must leave r*exitMultiplier to count as exit
    geofenceExitMultiplier: 1.2,
    // de-identified contributor token rotation (privacy: NOT identity, ephemeral)
    tokenRotationMs: 30 * 60 * 1000,   // rotate every 30 min
    // native Kalman decision (NATIVE_GPS_PLAN §4.4). Native fused location is
    // ALREADY OS-smoothed, so double-filtering can over-smooth / add lag.
    // 'passthrough' = trust native fused; 'light' = gentle normalize (raised Q);
    // 'full' = today's web-strength Kalman. DEFAULT 'light' per the plan, and it
    // is DOCUMENTED AS TUNE-ON-DEVICE — settle it empirically in the field bench.
    nativeKalmanMode: "light",
    lockAcc: 25,                  // rawAcc ≤ this → locked (geofencing trustworthy)
    dropAcc: 120                  // once locked, discard coarser regressions
  };

  // ==========================================================================
  // 1. CONNECTIVITY-TIER STATE MACHINE + HYSTERESIS
  //    Port of GPSG's CONNECTIVITY_TIER_MATRIX. Tier is the control signal for
  //    UPLOAD cadence — NOT for the blue dot (nav is offline-first, GNSS needs
  //    no cell). promote-slow / demote-fast hysteresis kills thrash.
  // ==========================================================================
  function tierRank(t) { return (t in TIER) ? TIER[t] : 0; }
  function tierName(r) { return TIER_NAME[r] || "none"; }

  function createTierController(opts) {
    opts = opts || {};
    var promoteAfterMs = opts.promoteAfterMs != null ? opts.promoteAfterMs : DEFAULTS.promoteAfterMs;
    var current = opts.initial && (opts.initial in TIER) ? opts.initial : "none";
    var candidate = null, candidateSince = 0;

    // update(observedTier, nowMs) → the STABLE tier after hysteresis.
    function update(observed, nowMs) {
      if (!(observed in TIER)) observed = "none";
      var oR = tierRank(observed), cR = tierRank(current);
      if (oR < cR) {
        // hard failure / worse link → demote IMMEDIATELY (don't keep flushing on a dead pipe)
        current = observed; candidate = null; candidateSince = 0;
      } else if (oR > cR) {
        // better link → promote only after it holds for promoteAfterMs
        if (candidate !== observed) { candidate = observed; candidateSince = nowMs; }
        if (nowMs - candidateSince >= promoteAfterMs) { current = observed; candidate = null; candidateSince = 0; }
      } else {
        candidate = null; candidateSince = 0; // same tier — clear any pending promote
      }
      return current;
    }
    return {
      update: update,
      tier: function () { return current; },
      rank: function () { return tierRank(current); },
      _debug: function () { return { current: current, candidate: candidate, candidateSince: candidateSince }; }
    };
  }

  // Map a raw signal observation to a coarse tier. `reachableMs` = probe latency
  // (probe-based truth per Brandon; navigator.connection is only a hint). null
  // reachable = probe failed = no usable cell. wifi flag short-circuits to wifi.
  function classifyTier(obs) {
    obs = obs || {};
    if (obs.wifi) return "wifi";
    if (obs.reachableMs == null) return "none";      // probe failed → dead zone
    if (obs.reachableMs > 2500) return "weak";       // flaky, high-latency
    if (obs.reachableMs > 800) return "medium";
    return "strong";
  }

  // ==========================================================================
  // 2. SAMPLER — GPS cadence from (motion, battery), throttled by tier & session.
  //    Port of telemetry_client_contract §sampler. PARKED / SIGNIFICANT /
  //    INTERVAL / DENSE. Battery floors are hard. This is the GPSG sampler that
  //    Transistorsoft's activity engine executes natively.
  // ==========================================================================
  function samplerDecision(input) {
    input = input || {};
    var battery = input.batteryPct != null ? input.batteryPct : 100;
    var charging = !!input.charging;
    var activity = input.activity || (input.moving ? "walking" : "still"); // still|walking|running|in_vehicle
    var activeSession = !!input.activeSession;   // user tapped "walk me to my stage"
    var wellMapped = !!input.wellMapped;         // corridor geometry already solved → sample less
    var b = DEFAULTS;

    function out(state, intervalSec, desiredAccuracy) {
      return { state: state, intervalSec: intervalSec, desiredAccuracy: desiredAccuracy, activeSession: activeSession };
    }

    // hard battery floors first — battery is sacred, overrides everything
    if (!charging && battery <= b.batteryParkedFloor) return out("PARKED", null, "low");
    if (!charging && battery <= b.batterySigChangeFloor) return out("SIGNIFICANT", null, "low");

    if (!activeSession) {
      // between navigate sessions: geofence-only / near-zero cost
      return activity === "still" ? out("PARKED", null, "low") : out("SIGNIFICANT", null, "medium");
    }

    // active "walk me to my stage" session
    var interval;
    switch (activity) {
      case "still":      return out("SIGNIFICANT", null, "medium"); // arrived / waiting — cheap
      case "running":    interval = 2; return out("DENSE", wellMapped ? interval + 2 : interval, "high");
      case "in_vehicle": interval = 10; return out("INTERVAL", interval, "medium");
      case "walking":
      default:           interval = wellMapped ? 6 : 4; return out("INTERVAL", interval, "high");
    }
  }

  // ==========================================================================
  // 3. UPLOADER POLICY — phone-home behavior from the STABLE tier.
  //    Nav ignores this (offline-first). This governs telemetry/presence upload.
  //    T0 rule: DO NOT hunt the tower in a dead zone — the #1 festival battery sink.
  // ==========================================================================
  function uploaderPolicy(tier) {
    switch (tier) {
      case "none":   return { mode: "buffer-only", scanRadio: false, flush: false };
      case "weak":   return { mode: "tiny-priority", scanRadio: true, flush: true, decimate: true, priorityOnly: true };
      case "medium": return { mode: "scheduled", scanRadio: true, flush: true, decimate: true };
      case "strong": return { mode: "full", scanRadio: true, flush: true, decimate: false };
      case "wifi":   return { mode: "maintenance", scanRadio: true, flush: true, decimate: false, heavy: true };
      default:       return { mode: "buffer-only", scanRadio: false, flush: false };
    }
  }

  // ==========================================================================
  // 4. GEOFENCE DISTANCE MATH — "you're near Stage X". Haversine metres.
  // ==========================================================================
  function haversineMeters(lat1, lon1, lat2, lon2) {
    var R = 6371000, toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  // nearest stage/zone to a fix → { stage, distanceM }
  function nearestGeofence(fix, geofences) {
    var best = null, bestD = Infinity;
    (geofences || []).forEach(function (g) {
      var d = haversineMeters(fix.lat, fix.lng, g.lat, g.lng);
      if (d < bestD) { bestD = d; best = g; }
    });
    return best ? { stage: best, distanceM: bestD } : null;
  }
  // stateful enter/exit with flap-guard hysteresis (enter at r, leave at r*mult)
  function createGeofenceTracker(opts) {
    opts = opts || {};
    var exitMult = opts.exitMultiplier != null ? opts.exitMultiplier : DEFAULTS.geofenceExitMultiplier;
    var inside = {};   // id → true
    // returns array of { id, event: 'enter'|'exit', distanceM }
    function update(fix, geofences) {
      var events = [];
      (geofences || []).forEach(function (g) {
        var id = g.id != null ? g.id : g.name;
        var d = haversineMeters(fix.lat, fix.lng, g.lat, g.lng);
        var r = g.radius != null ? g.radius : 50;
        var was = !!inside[id];
        if (!was && d <= r) { inside[id] = true; events.push({ id: id, event: "enter", distanceM: d }); }
        else if (was && d > r * exitMult) { delete inside[id]; events.push({ id: id, event: "exit", distanceM: d }); }
      });
      return events;
    }
    return { update: update, inside: function () { return Object.keys(inside); } };
  }

  // ==========================================================================
  // 5. DE-IDENTIFIED CONTRIBUTOR TOKEN ROTATION (privacy skeleton).
  //    NOT identity. Rotating + ephemeral. rng + now injected → deterministic test.
  //    The token is the ONLY per-contributor handle that ever reaches the server,
  //    and it changes on a timer so no continuous life can be reassembled.
  // ==========================================================================
  function randomToken(rng) {
    var r = typeof rng === "function" ? rng : Math.random;
    var s = "";
    for (var i = 0; i < 4; i++) { s += Math.floor(r() * 0x100000000).toString(16).padStart(8, "0"); }
    return s; // 32 hex chars, no identity, no PII
  }
  function createTokenRotator(opts) {
    opts = opts || {};
    var rotationMs = opts.rotationMs != null ? opts.rotationMs : DEFAULTS.tokenRotationMs;
    var rng = opts.rng, tok = null, issuedAt = -Infinity;
    function token(nowMs) {
      if (tok == null || (nowMs - issuedAt) >= rotationMs) { tok = randomToken(rng); issuedAt = nowMs; }
      return tok;
    }
    return { token: token, rotationMs: rotationMs };
  }

  // ==========================================================================
  // 6. NATIVE FIX → onFix ADAPTER — preserves the dd_gps onFix CONTRACT exactly,
  //    so the live map / geofences / step counters consume native fixes UNCHANGED.
  //    Accepts Transistorsoft ({coords:{...}}) OR capacitor ({coords:{...}}) shape.
  //    `filter` is an OPTIONAL injected Kalman step fn(lat,lng,acc,tsMs)→{lat,lng,
  //    accuracy}; supply DDGPS.Kalman in native runtime. Absent = passthrough.
  //    Kalman mode (§4.4) is TUNE-ON-DEVICE; default 'light'.
  // ==========================================================================
  function normalizeNativeFix(loc, opts) {
    opts = opts || {};
    var c = (loc && loc.coords) ? loc.coords : loc || {};
    var lat = c.latitude, lng = c.longitude;
    var rawAcc = (c.accuracy != null ? c.accuracy : 99);
    var ts = loc && loc.timestamp != null ? (typeof loc.timestamp === "number" ? loc.timestamp : Date.parse(loc.timestamp) || Date.now()) : Date.now();
    var lockAcc = opts.lockAcc != null ? opts.lockAcc : DEFAULTS.lockAcc;
    var mode = opts.kalmanMode || DEFAULTS.nativeKalmanMode;

    var oLat = lat, oLng = lng, acc = rawAcc;
    // 'passthrough' → trust native fused; else run the injected filter if present.
    if (mode !== "passthrough" && typeof opts.filter === "function") {
      var f = opts.filter(lat, lng, rawAcc, ts);
      if (f && isFinite(f.lat) && isFinite(f.lng)) { oLat = f.lat; oLng = f.lng; acc = (f.accuracy != null ? f.accuracy : rawAcc); }
    }
    return {
      lat: oLat, lng: oLng,
      acc: acc, rawAcc: rawAcc,           // ring stays HONEST = rawAcc (device σ)
      speed: (c.speed != null && c.speed >= 0) ? c.speed : null,
      heading: (c.heading != null && !isNaN(c.heading)) ? c.heading : null,
      alt: (c.altitude != null ? c.altitude : null),
      locked: rawAcc <= lockAcc,
      raw: [lat, lng],
      _native: true,
      _bg: !!opts.background            // true when it came from background-geo
    };
  }

  // ==========================================================================
  // 7. INGEST-ITEM BUILDER (for dd_offline_queue) — IDS ONLY, NO PII.
  //    Produces the queue item whose payload is exactly what the SECURITY DEFINER
  //    RPC dd_geo_ingest_fragment accepts: venue/corridor ids, rotating token,
  //    tier, decimated points, idempotency key. NO lat/lng-as-identity, no email,
  //    no user id, no name. client_frag_id = the queue dedupe key (resumable).
  // ==========================================================================
  function buildIngestItem(input) {
    input = input || {};
    var fragId = input.fragId || input.client_frag_id;
    if (!fragId) throw new Error("buildIngestItem: fragId (idempotency key) required");
    return {
      key: fragId,                 // queue dedupe / idempotency
      op: "geo_ingest_fragment",
      payload: {
        p_venue: input.venueId || null,
        p_corridor: input.corridorId || null,
        p_token: input.token || null,       // rotating, NOT identity
        p_tier: input.tier || null,
        p_points: Array.isArray(input.points) ? input.points : [],  // decimated [[dlat,dlon,dt,acc]…]
        p_client_frag_id: String(fragId)
      }
    };
  }

  // decimate a raw point list by a minimum inter-point distance (metres). We send
  // SHAPE, not every raw sample (telemetry_client_contract). Pure + testable.
  function decimatePointsByDistance(points, minMeters) {
    if (!Array.isArray(points) || points.length === 0) return [];
    minMeters = minMeters || 8;
    var out = [points[0]], last = points[0];
    for (var i = 1; i < points.length; i++) {
      var p = points[i];
      if (haversineMeters(last[0], last[1], p[0], p[1]) >= minMeters) { out.push(p); last = p; }
    }
    // always keep the final point so the fragment's end is truthful
    if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
    return out;
  }

  // ==========================================================================
  // 8. TRANSISTORSOFT CONFIG BUILDER — pure. The knobs from NATIVE_GPS_PLAN §4.2.
  //    Returns the config object to hand BackgroundGeolocation.ready(). No plugin
  //    touched here. `preventSuspend`/HIGH accuracy ONLY inside an active session.
  // ==========================================================================
  function buildBgGeoConfig(opts) {
    opts = opts || {};
    var active = !!opts.activeSession;
    return {
      // accuracy / cadence
      desiredAccuracy: active ? "HIGH" : "MEDIUM",  // mapped to plugin enum in runtime shim
      distanceFilter: opts.distanceFilter != null ? opts.distanceFilter : 8, // metres of movement per fix
      stationaryRadius: opts.stationaryRadius != null ? opts.stationaryRadius : 25,
      stopTimeout: opts.stopTimeout != null ? opts.stopTimeout : 5, // min still before "stationary"
      // motion/activity detection → the GPSG sampler, natively
      isMoving: active,
      stopOnStationary: false,
      disableMotionActivityUpdates: false,
      // background survival — SCOPED to an active navigate session (battery/privacy
      // footgun otherwise: never keep continuous tracking alive across force-quit /
      // reboot when the user is NOT navigating). Between sessions, tracking is
      // stopped; the cheap geofence-only "you're near Stage X" wake is a separate
      // config path to build, not this continuous mode.
      stopOnTerminate: !active,   // active session survives termination; idle stops
      startOnBoot: active,        // resume continuous tracking on reboot ONLY mid-session
      enableHeadless: active,     // android headless events only when tracking
      pausesLocationUpdatesAutomatically: !active, // iOS: allow OS pauses only when NOT actively guiding
      preventSuspend: active,   // hold the CPU awake ONLY during an active navigate session
      heartbeatInterval: opts.heartbeatInterval != null ? opts.heartbeatInterval : 60,
      // battery floors (sampler drops below these — battery is sacred)
      // (the plugin can't self-enforce these; the sampler/runtime applies them)
      // radio: never hunt the tower in a dead zone — we buffer & flush on reconnect
      autoSync: false,          // WE own upload cadence via the tier uploader, not the plugin
      // android foreground-service notification (required while tracking)
      foregroundService: true,
      notification: {
        title: opts.notifTitle || "DeadDance is guiding you",
        text: opts.notifText || "Keeping you on the festival map. This uses extra battery.",
        sticky: active
      },
      // logging kept lean for release
      logLevel: opts.debug ? 5 : 1,
      // license is injected at runtime from a secure source — NEVER hardcode it here
      // (see startBackground: opts.license). No secret lives in this file.
      debug: false
    };
  }

  // ==========================================================================
  // 9. GUARDED RUNTIME — startBackground(bgGeo, opts)
  //    Wires @transistorsoft/capacitor-background-geolocation. GUARDED: returns a
  //    no-op handle unless a real plugin object is injected. NEVER runs in a
  //    browser or Node — there is no plugin there. This is the ONLY impure export
  //    and it proves nothing about background GPS until run on a device.
  // ==========================================================================
  function startBackground(bgGeo, opts) {
    opts = opts || {};
    var onFix = typeof opts.onFix === "function" ? opts.onFix : function () {};
    var onError = typeof opts.onError === "function" ? opts.onError : function () {};
    var onGeofence = typeof opts.onGeofence === "function" ? opts.onGeofence : function () {};

    // honest degradation: no plugin → tell the caller so it can fall back a rung.
    if (!bgGeo || typeof bgGeo.ready !== "function" || typeof bgGeo.onLocation !== "function") {
      onError({ code: 0, message: "background-geolocation plugin not present", fallback: true });
      return { stop: function () {}, _noop: true };
    }

    var dead = false;
    var filter = (typeof opts.filter === "function") ? opts.filter : null; // inject DDGPS.Kalman step
    var cfg = buildBgGeoConfig({ activeSession: opts.activeSession, distanceFilter: opts.distanceFilter, debug: opts.debug });
    // license is passed through from a secure caller-supplied source, never stored here
    if (opts.license) cfg.license = opts.license;

    var subs = [];
    try {
      subs.push(bgGeo.onLocation(function (location) {
        if (dead) return;
        onFix(normalizeNativeFix(location, {
          lockAcc: opts.lockAcc, kalmanMode: opts.kalmanMode || DEFAULTS.nativeKalmanMode,
          filter: filter, background: true
        }));
      }, function (err) { if (!dead) onError({ code: (err && err.code) || 0, message: (err && err.message) || "onLocation error" }); }));

      if (typeof bgGeo.onGeofence === "function") {
        subs.push(bgGeo.onGeofence(function (ev) { if (!dead) onGeofence(ev); }));
      }

      bgGeo.ready(cfg).then(function (state) {
        if (dead) return;
        if (opts.activeSession && !state.enabled && typeof bgGeo.start === "function") { bgGeo.start(); }
      }, function (e) { onError({ code: 0, message: (e && e.message) || "bgGeo.ready failed" }); });
    } catch (e) {
      onError({ code: 0, message: (e && e.message) || "startBackground threw", fallback: true });
      return { stop: function () {}, _noop: true };
    }

    return {
      stop: function () {
        if (dead) return; dead = true;
        try { subs.forEach(function (s) { if (s && s.remove) s.remove(); }); } catch (e) {}
        try { if (bgGeo.stop) bgGeo.stop(); } catch (e) {}
      },
      _noop: false
    };
  }

  // ==========================================================================
  // EXPORT SURFACE
  // ==========================================================================
  return {
    // constants
    TIER: TIER, DEFAULTS: DEFAULTS,
    // tier machine
    tierRank: tierRank, tierName: tierName, classifyTier: classifyTier,
    createTierController: createTierController,
    // sampler + uploader
    samplerDecision: samplerDecision, uploaderPolicy: uploaderPolicy,
    // geofence
    haversineMeters: haversineMeters, nearestGeofence: nearestGeofence,
    createGeofenceTracker: createGeofenceTracker,
    // privacy token
    randomToken: randomToken, createTokenRotator: createTokenRotator,
    // adapters + queue
    normalizeNativeFix: normalizeNativeFix, buildIngestItem: buildIngestItem,
    decimatePointsByDistance: decimatePointsByDistance,
    // native config + runtime
    buildBgGeoConfig: buildBgGeoConfig, startBackground: startBackground,
    VERSION: "1.0.0-phase1"
  };
});
