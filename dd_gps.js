/* dd_gps.js — DeadDance hardened GPS engine ("know where the hiker is, to the smallest possible")
   Framework-OPTIONAL. Core = a 1-D Kalman filter that fuses successive fixes weighted by their
   reported accuracy, so the blue dot stops jittering and the *effective* accuracy shrinks with
   every fix. Leaflet attach is optional (YOU dot + honest accuracy ring + follow + Center-Me),
   so TCTP / TrailGummy can lift the whole thing. Lineage: musikfest walk engine + the TCTP H2HC
   "you are here" ring, merged and hardened (2026-07-16).

   WHY a Kalman filter: phones hand you a COARSE first fix (cell/wifi, ~500–2000 m) then refine to
   real GNSS (~5–15 m) over a few seconds. Trusting each raw fix equally = a dot that teleports.
   The filter weights each new fix by 1/accuracy² and inflates uncertainty for motion (process
   noise Q, tuned to walking ~1.4 m/s). Result: a steady dot whose reported σ collapses toward the
   best fix you've seen. This is the accepted mobile-GNSS smoothing approach, one file, no deps. */
(function (w) {
  "use strict";
  if (w.DDGPS) return;

  // dev-only flag: window.DD_GEO_DEBUG on THIS frame OR the top frame (same-origin, iframe-safe).
  // Default unset → the native debug overlay is NEVER created, on ANY page. window.DD_GEO_DEBUG=1 re-enables.
  function _geoDbgOn() {
    try { if (w.DD_GEO_DEBUG) return true; } catch (e) {}
    try { if (w.top && w.top !== w && w.top.DD_GEO_DEBUG) return true; } catch (e) {}
    return false;
  }

  // ---- 1-D lat/lng Kalman (variance in metres²) ---------------------------------------------
  function Kalman(qMetresPerSec) {
    this.q = qMetresPerSec || 3;   // process noise: how fast the target can move (m/s). 3 ≈ brisk walk+jitter headroom
    this.v = -1;                   // variance, -1 = uninitialised
    this.t = 0; this.lat = 0; this.lng = 0;
  }
  Kalman.prototype.reset = function () { this.v = -1; };
  Kalman.prototype.process = function (lat, lng, accuracy, tsMs) {
    if (!(accuracy > 0)) accuracy = 1;
    if (accuracy < 1) accuracy = 1;
    if (this.v < 0) {                              // first fix seeds the state
      this.t = tsMs; this.lat = lat; this.lng = lng; this.v = accuracy * accuracy;
    } else {
      var dt = (tsMs - this.t) / 1000;
      if (dt > 0) { this.v += dt * this.q * this.q; this.t = tsMs; }   // motion inflates uncertainty
      var K = this.v / (this.v + accuracy * accuracy);                 // Kalman gain
      this.lat += K * (lat - this.lat);
      this.lng += K * (lng - this.lng);
      this.v = (1 - K) * this.v;
    }
    return { lat: this.lat, lng: this.lng, accuracy: Math.sqrt(this.v) };
  };

  // ---- core watch ---------------------------------------------------------------------------
  // DDGPS.start({onFix, onError, q, lockAcc, dropAcc}) → handle{stop(), best}
  //   onFix({lat,lng,acc,rawAcc,speed,heading,locked,raw})  acc = filtered σ (m), rawAcc = device σ (m)
  //   locked = we've seen a fix at/under lockAcc (default 25 m) → geofencing is now trustworthy
  //   dropAcc: ignore garbage fixes coarser than this ONCE we already have a good one (default 120 m)
  // ── Screen Wake Lock ─────────────────────────────────────────────────────────
  // The best a web app can do: keep the screen awake WHILE actively tracking, so the
  // walk keeps counting until you stop or lock the phone yourself. A slept/locked phone
  // SUSPENDS geolocation — a hard browser limit; true background tracking (screen off,
  // app closed) requires a NATIVE app. Ref-counted, and re-acquired when the tab returns
  // to the foreground (the OS drops the lock whenever you switch away).
  var _wakeLock = null, _wakeCount = 0, _wakeBound = false;
  function _wakeReq() {
    try {
      if (w.navigator && w.navigator.wakeLock && _wakeCount > 0 && !_wakeLock) {
        w.navigator.wakeLock.request('screen').then(function (s) {
          _wakeLock = s; if (s && s.addEventListener) s.addEventListener('release', function () { _wakeLock = null; });
        }, function () {});
      }
    } catch (e) {}
  }
  function wakeAcquire() {
    _wakeCount++;
    if (!_wakeBound) { _wakeBound = true; try { document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') _wakeReq(); }); } catch (e) {} }
    _wakeReq();
  }
  function wakeRelease() { _wakeCount = Math.max(0, _wakeCount - 1); if (_wakeCount === 0 && _wakeLock) { try { _wakeLock.release(); } catch (e) {} _wakeLock = null; } }

  // ── native nav-mode (which watchGeo mode a map requests). DEFAULT passive on map
  //    open (battery-safe: adaptive, no continuous GPS). A map switches to 'active'
  //    for a "walk me to my stage" session, then back to 'passive'. No-op on web. ─
  var _navMode = "passive";
  function setNavMode(m) {
    _navMode = (m === "active") ? "active" : "passive";
    try { if (w.DDShell && typeof w.DDShell.setGeoMode === "function") w.DDShell.setGeoMode(_navMode); } catch (e) {}
    return _navMode;
  }
  function _assign(a, b) { for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k]; return a; }

  // ── NATIVE watch — source fixes from the proven background engine (DDShell.watchGeo)
  //    and feed them through the SAME onFix contract every map consumer already uses,
  //    so the blue dot survives a locked screen. Native fused location is pre-smoothed,
  //    so the Kalman step is BYPASSED by default (§4.4 pass-through); a map may re-enable
  //    a 'light'/'full' Kalman via opts.nativeKalman. Honest fallback: if the bridge
  //    signals _useWeb, we start the EXISTING web engine (opts._noNative) with no gap. ─
  function startNative(opts) {
    var lockAcc = opts.lockAcc || 25, dropAcc = opts.dropAcc || 120;
    var locked = false, bestRaw = Infinity, dead = false, fellBack = false, active = null;
    var nk = opts.nativeKalman || "passthrough";
    var kf = (nk === "light" || nk === "full") ? new Kalman(nk === "light" ? (opts.q || 6) : (opts.q || 3)) : null;

    function emit(f) {
      if (dead || !f) return;
      var rawAcc = (f.rawAcc != null ? f.rawAcc : (f.acc != null ? f.acc : 99));
      if (rawAcc < bestRaw) bestRaw = rawAcc;
      if (locked && rawAcc > dropAcc && rawAcc > bestRaw * 3) return;   // same regression guard as the web path
      var lat = f.lat, lng = f.lng, acc = (f.acc != null ? f.acc : rawAcc);
      if (kf) { var s = kf.process(f.lat, f.lng, rawAcc, (f.ts || Date.now())); lat = s.lat; lng = s.lng; acc = s.accuracy; }
      if (rawAcc <= lockAcc) locked = true;
      if (opts.onFix) opts.onFix({
        lat: lat, lng: lng, acc: acc, rawAcc: rawAcc,
        speed: (f.speed != null ? f.speed : null),
        heading: (f.heading != null ? f.heading : null),
        alt: (f.alt != null ? f.alt : null),
        locked: locked, raw: f.raw || [f.lat, f.lng],
        _native: true, _bg: (f._bg !== false)
      });
    }
    function fallbackToWeb() {
      if (fellBack || dead) return; fellBack = true;
      try { if (active && active.stop) active.stop(); } catch (e) {}
      active = start(_assign(_assign({}, opts), { _noNative: true }));   // pure web engine, unchanged
      if (dead && active && active.stop) { try { active.stop(); } catch (e) {} }
    }
    try {
      active = w.DDShell.watchGeo({
        mode: opts.navMode || _navMode, lockAcc: opts.lockAcc, timeout: opts.timeout,
        onFix: emit,
        onError: function (e) { if (e && e._useWeb) { fallbackToWeb(); return; } if (opts.onError) opts.onError(e); }
      });
    } catch (e) {
      return start(_assign(_assign({}, opts), { _noNative: true }));    // bridge threw → honest web fallback
    }
    return {
      stop: function () { if (dead) return; dead = true; try { if (active && active.stop) active.stop(); } catch (e) {} },
      recenterKalman: function () { if (kf) kf.reset(); locked = false; },
      get best() { return bestRaw; }
    };
  }

  function start(opts) {
    opts = opts || {};
    // ── NATIVE branch (guarded) — the ONLY addition to start(). When running inside the
    //    Capacitor shell with the bridge present, route to startNative(). The WEB body
    //    below is byte-for-byte unchanged and runs for every browser/PWA (isNative()===false)
    //    and for the honest native→web fallback (opts._noNative). ─────────────────────────
    if (opts._noNative !== true && w.DDShell && typeof w.DDShell.isNative === "function" &&
        w.DDShell.isNative() && typeof w.DDShell.watchGeo === "function") {
      return startNative(opts);
    }
    if (!w.navigator || !w.navigator.geolocation) { if (opts.onError) opts.onError({ code: 0, message: "no geolocation" }); return { stop: function () {} }; }
    var kf = new Kalman(opts.q || 3);
    var lockAcc = opts.lockAcc || 25, dropAcc = opts.dropAcc || 120;
    var locked = false, bestRaw = Infinity, id = null, dead = false;

    function onPos(p) {
      if (dead) return;
      var c = p.coords, rawAcc = (c.accuracy != null ? c.accuracy : 99), now = p.timestamp || Date.now();
      if (rawAcc < bestRaw) bestRaw = rawAcc;
      // once we have a decent fix, discard sudden coarse regressions (a cell fix crashing the party)
      if (locked && rawAcc > dropAcc && rawAcc > bestRaw * 3) return;
      var f = kf.process(c.latitude, c.longitude, rawAcc, now);
      if (rawAcc <= lockAcc) locked = true;
      if (opts.onFix) opts.onFix({
        lat: f.lat, lng: f.lng, acc: f.accuracy, rawAcc: rawAcc,
        speed: (c.speed != null && c.speed >= 0) ? c.speed : null,       // m/s
        heading: (c.heading != null && !isNaN(c.heading)) ? c.heading : null,
        alt: (c.altitude != null ? c.altitude : null),                   // metres (for elevation gain)
        locked: locked, raw: [c.latitude, c.longitude]
      });
    }
    function onErr(e) { if (opts.onError) opts.onError(e); }

    // KICK a fast first fix (cached/coarse ok) so the dot appears in a second or two, and any
    // permission/timeout error surfaces immediately — then the high-accuracy watch refines it.
    try { w.navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }); } catch (e) {}
    // enableHighAccuracy → the real GNSS chip. maximumAge:8000 → accept a fix up to 8s old so you
    // appear INSTANTLY (this is exactly what makes TCTP snap to you); the chip refines it live.
    id = w.navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true, maximumAge: 8000, timeout: (opts.timeout || 30000)
    });
    wakeAcquire();   // keep the screen awake while this watch runs → the walk keeps counting
    return {
      stop: function () { if (dead) return; dead = true; try { w.navigator.geolocation.clearWatch(id); } catch (e) {} wakeRelease(); },
      recenterKalman: function () { kf.reset(); locked = false; },
      get best() { return bestRaw; }
    };
  }

  // ---- Leaflet attach (optional): YOU dot + accuracy ring + follow + Center-Me ---------------
  // DDGPS.attach(map, {walkZoom, onFix, autoZoom}) → { center(), stop(), following }
  function attach(map, opts) {
    opts = opts || {};
    var L = w.L; if (!L || !map) return start(opts);          // no Leaflet? just run the core watch
    var walkZoom = opts.walkZoom || 18;                        // block-level: where a walker wants to be
    var following = false, firstLock = false, you = null, ring = null, hdg = null, ctrl = null, manualLock = false;

    // ── NATIVE-ONLY debug readout (tiny, top-left corner) — how Michael visually
    //    verifies background survival on the REAL map: GPS source (native-bg /
    //    foreground / web), fix count, seconds since last fix, current mode. Guarded
    //    by isNative(): the div is NEVER created on web, so the PWA is untouched. ──
    function _dbgNative() { try { return !!(w.DDShell && typeof w.DDShell.isNative === "function" && w.DDShell.isNative()); } catch (e) { return false; } }
    var _dbg = null, _dbgN = 0, _dbgLast = 0, _dbgSrc = "…", _dbgTick = null;
    function _dbgPaint() {
      if (!_dbg) return;
      var age = _dbgLast ? Math.round((Date.now() - _dbgLast) / 1000) : -1;
      _dbg.textContent = "GPS " + _dbgSrc + "\nfixes " + _dbgN + "  age " + (age < 0 ? "—" : age + "s") + "\nmode " + _navMode;
    }
    function _dbgOnFix(f) {
      if (!_geoDbgOn()) return;                                // dev flag OFF (default) → overlay NEVER created, on ANY page (incl. home)
      if (!_dbgNative()) return;                                // web → no-op, nothing rendered
      if (!_dbg && w.document && w.document.body) {
        _dbg = w.document.createElement("div");
        _dbg.className = "ddgps-dbg";
        _dbg.style.cssText = "position:fixed;left:6px;top:calc(6px + env(safe-area-inset-top,0px));z-index:400;background:rgba(0,0,0,.72);color:#8ff;font:700 10px/1.35 monospace;padding:4px 7px;border-radius:7px;pointer-events:none;max-width:52vw;white-space:pre";
        w.document.body.appendChild(_dbg);
        _dbgTick = setInterval(_dbgPaint, 1000);
      }
      _dbgN++; _dbgLast = Date.now();
      _dbgSrc = (f && f._bg) ? "native-bg" : ((f && f._native) ? "foreground" : "web");
      _dbgPaint();
    }
    function _dbgStop() { try { if (_dbgTick) { clearInterval(_dbgTick); _dbgTick = null; } if (_dbg && _dbg.parentNode) _dbg.parentNode.removeChild(_dbg); _dbg = null; } catch (e) {} }

    function drawYou(f) {
      var ll = [f.lat, f.lng];
      if (!you) {
        you = L.circleMarker(ll, { radius: 8, color: "#fff", weight: 3, fillColor: "#1f6fe0", fillOpacity: 1, className: "ddgps-you" }).addTo(map);
        ring = L.circle(ll, { radius: f.rawAcc, color: "#1f6fe0", weight: 1, opacity: .5, fillColor: "#1f6fe0", fillOpacity: .12 }).addTo(map);
      } else { you.setLatLng(ll); ring.setLatLng(ll).setRadius(f.rawAcc); }
      // heading cone if we're moving with a real bearing
      if (f.heading != null && f.speed != null && f.speed > 0.4) {
        var rad = f.heading * Math.PI / 180, dm = 14 / 111320, tip = [f.lat + Math.cos(rad) * dm, f.lng + Math.sin(rad) * dm / Math.cos(f.lat * Math.PI / 180)];
        if (!hdg) hdg = L.polyline([ll, tip], { color: "#1f6fe0", weight: 4, opacity: .8 }).addTo(map); else hdg.setLatLngs([ll, tip]);
      } else if (hdg) { try { map.removeLayer(hdg); } catch (e) {} hdg = null; }
    }
    function centerOn(f, z) { following = true; setBtn(true); try { map.setView([f.lat, f.lng], z || (map.getZoom() < walkZoom ? walkZoom : map.getZoom()), { animate: true }); } catch (e) {} }

    var last = null;
    var h = start({
      q: opts.q, lockAcc: opts.lockAcc, dropAcc: opts.dropAcc, timeout: opts.timeout,
      onError: opts.onError,
      onFix: function (f) {
        _dbgOnFix(f);                                            // native-only corner readout (no-op on web)
        if (manualLock) return;                                  // a manual pin is set → ignore device fixes until cleared
        last = f; drawYou(f);
        if (!firstLock) { firstLock = true; if (opts.autoZoom !== false) centerOn(f, walkZoom); }  // center + walking-zoom on the VERY FIRST fix (any accuracy), then follow — never sit parked on the default view
        else if (following) { try { map.panTo([f.lat, f.lng], { animate: true }); } catch (e) {} }
        if (opts.onFix) opts.onFix(f);
      }
    });

    // user grabs the map → stop chasing them; tapping Center-Me re-arms follow
    map.on("dragstart zoomstart", function (e) { if (e && e.hard) return; following = false; setBtn(false); });

    // Center-Me control (bottom-right), styled to read at a glance
    var Ctl = L.Control.extend({
      options: { position: "bottomright" },
      onAdd: function () {
        var d = L.DomUtil.create("div", "ddgps-center");
        d.innerHTML = "📍";
        d.title = "Center on me";
        d.style.cssText = "width:46px;height:46px;border-radius:50%;background:#fff;box-shadow:0 2px 8px #0004;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;border:2px solid #1f6fe0;user-select:none";
        L.DomEvent.disableClickPropagation(d);
        L.DomEvent.on(d, "click", function () {
          if (last) centerOn(last, walkZoom);
          else d.innerHTML = "…";   // waiting on first fix
        });
        ctrl = d; return d;
      }
    });
    map.addControl(new Ctl());
    function setBtn(on) { if (ctrl) ctrl.style.background = on ? "#1f6fe0" : "#fff"; if (ctrl) ctrl.style.color = on ? "#fff" : "#000"; }

    return { center: function () { if (last) centerOn(last, walkZoom); }, stop: function () { _dbgStop(); h.stop(); }, get following() { return following; }, get last() { return last; },
      // manual override: drop the ONE dot where the user taps and ignore device fixes until cleared (festival GPS insurance)
      setManual: function (la, lo) { manualLock = true; var f = { lat: la, lng: lo, rawAcc: 8, acc: 8, manual: true }; last = f; drawYou(f); following = false; setBtn(false); if (opts.onFix) { try { opts.onFix(f); } catch (e) {} } },  // NO recenter — the user tapped a visible spot; leave the map (and all fixed fest pins) put
      clearManual: function () { manualLock = false; }, get manual() { return manualLock; } };
  }

  // setNavMode('active'|'passive'): a map requests responsive vs battery-saving native
  // tracking (no-op on web). navMode(): read the current request. DEFAULT 'passive'.
  w.DDGPS = { start: start, attach: attach, Kalman: Kalman, setNavMode: setNavMode, navMode: function () { return _navMode; } };
})(window);
