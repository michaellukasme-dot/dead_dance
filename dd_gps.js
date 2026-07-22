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

  function start(opts) {
    opts = opts || {};
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

    return { center: function () { if (last) centerOn(last, walkZoom); }, stop: function () { h.stop(); }, get following() { return following; }, get last() { return last; },
      // manual override: drop the ONE dot where the user taps and ignore device fixes until cleared (festival GPS insurance)
      setManual: function (la, lo) { manualLock = true; var f = { lat: la, lng: lo, rawAcc: 8, acc: 8, manual: true }; last = f; drawYou(f); following = false; setBtn(false); if (opts.onFix) { try { opts.onFix(f); } catch (e) {} } },  // NO recenter — the user tapped a visible spot; leave the map (and all fixed fest pins) put
      clearManual: function () { manualLock = false; }, get manual() { return manualLock; } };
  }

  w.DDGPS = { start: start, attach: attach, Kalman: Kalman };
})(window);
