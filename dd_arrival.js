/* ============================================================================
 * dd_arrival.js — "Drive me there" + ARRIVAL PROXIMITY  (window.DDArrival)
 *
 * TWO layers, deliberately split by the legal gate:
 *
 *  1) driveTo(dest)  — 🟢 PURE GO. Opens the phone's own turn-by-turn nav (Google / Apple / geo:)
 *     to the venue. Our StageFill grounds map stays in use for on-site. NO location leaves the device.
 *
 *  2) arm(event, opts) — 🔴 THE ARRIVAL BROADCAST. DARK by default. Runs ONLY when BOTH are true:
 *        window.SF_ARRIVAL_ENABLED === true            (org / counsel go-live flag), AND
 *        the fan granted 'arrival' consent (DDConsent).
 *     Then — with the fan's explicit OK — it watches distance to the venue and, at thresholds, asks
 *     the SERVER to: notify the VENUE HOST (Twilio SMS) that a guest is N minutes out, PRE-ASSIGN
 *     parking, PRE-CHECK-IN the party, and notify the FAN that all of the above happened.
 *
 *  Gate off OR no consent → driveTo still works; the broadcast is completely inert (no watch, no ping,
 *  nothing transmitted). This is the Build-to-the-Gate pattern: built + verified, flip when legal clears.
 *  Legal seam: fan live-location + Twilio to a third party (the venue) → STAGEFILL_PRIVACY_CHARTER_v2 +
 *  consent + a live Twilio number. See dd_arrival_UNRUN.sql (server, do-not-run) + COUNSEL_FLAGS_REGISTER.
 * ==========================================================================*/
;(function (root) {
  'use strict';
  if (typeof root.SF_ARRIVAL_ENABLED === 'undefined') root.SF_ARRIVAL_ENABLED = false;   // DARK by default

  // ---- pure geo math (no network, no DOM — testable) ----
  function haversineM(a, b) {
    if (!a || !b) return Infinity;
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var la1 = a.lat * toR, la2 = b.lat * toR;
    var h = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  // meters + optional live speed (m/s) → ETA minutes. Falls back to ~48 km/h mixed-driving.
  function etaMin(distM, speedMps) {
    var v = (speedMps && speedMps > 1) ? speedMps : 13.4;   // ~30 mph
    return Math.max(0, Math.round((distM / v) / 60));
  }
  // which arrival phase a distance is in (thresholds tuned for a drive-up). Returns null when far off.
  function phaseFor(distM) {
    if (distM <= 120)  return 'arrived';      // on-site
    if (distM <= 400)  return 'arriving';     // pull-in — pre-park + pre-check-in
    if (distM <= 3200) return 'approaching';  // ~2 mi — first heads-up to the host
    return null;                              // too far — say nothing
  }

  // ---- 🟢 driveTo — hand off to the phone's OWN DEFAULT map app (pure go) ----
  // Android → geo: intent (the OS routes it to WHATEVER map app the user set as default).
  // iOS → maps: (the system default). Desktop → the universal web link. Web link is also the
  // fallback if the scheme doesn't launch. We choose WHEN to permit this handoff; the phone chooses WHICH app.
  function driveTo(dest) {
    if (!dest || dest.lat == null || dest.lng == null) return false;
    var lat = dest.lat, lng = dest.lng, label = encodeURIComponent(dest.name || 'Event');
    var ua = (root.navigator && navigator.userAgent) || '';
    var isApple = /iPhone|iPad|iPod/.test(ua), isMobile = isApple || /Android|Mobile/.test(ua);
    var web = isApple ? ('https://maps.apple.com/?daddr=' + lat + ',' + lng + '&dirflg=d')
                      : ('https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng + '&travelmode=driving');
    if (!isMobile) { try { root.open(web, '_blank', 'noopener'); return true; } catch (e) { return false; } }
    var scheme = isApple ? ('maps://?daddr=' + lat + ',' + lng + '&dirflg=d')
                         : ('geo:' + lat + ',' + lng + '?q=' + lat + ',' + lng + '(' + label + ')');
    try {
      var fell = false, tmr = setTimeout(function () { if (!fell) { try { root.location.href = web; } catch (e) {} } }, 900);
      try { root.addEventListener('pagehide', function () { fell = true; clearTimeout(tmr); }, { once: true }); } catch (e) {}
      root.location.href = scheme;                                  // launch the default map app
      return true;
    } catch (e) { try { root.location.href = web; return true; } catch (e2) { return false; } }
  }

  // ---- gate ----
  function consentOK() { try { return !!(root.DDConsent && root.DDConsent.gate && root.DDConsent.gate('arrival')); } catch (e) { return false; } }
  function enabled() { return root.SF_ARRIVAL_ENABLED === true && consentOK(); }
  function client() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }

  // ---- 🔴 arm — the arrival broadcast (dark unless enabled() ) ----
  var _watch = null, _fired = {};
  function arm(event, opts) {
    opts = opts || {};
    if (!enabled()) return { ok: false, reason: 'dark' };            // no gate / no consent → inert
    if (!event || !event.slug || event.lat == null || event.lng == null) return { ok: false, reason: 'event' };
    if (!(root.navigator && navigator.geolocation)) return { ok: false, reason: 'no_geo' };
    var dest = { lat: +event.lat, lng: +event.lng };
    _fired = {};
    _watch = navigator.geolocation.watchPosition(function (p) {
      var here = { lat: p.coords.latitude, lng: p.coords.longitude };
      var distM = haversineM(here, dest);
      var phase = phaseFor(distM);
      if (!phase || _fired[phase]) return;                          // only the first crossing of each phase
      _fired[phase] = 1;
      ping(event, distM, etaMin(distM, p.coords.speed), phase, opts);
      if (phase === 'arrived') disarm();
    }, function () {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    return { ok: true };
  }
  function disarm() { try { if (_watch != null && navigator.geolocation) navigator.geolocation.clearWatch(_watch); } catch (e) {} _watch = null; }

  // one server ping per phase. The SERVER (dd_arrival_UNRUN.sql, when run) does the Twilio-to-host +
  // pre-park + pre-check-in; here we just report distance/eta and relay the fan-facing confirmation.
  function ping(event, distM, eta, phase, opts) {
    var c = client(); if (!c || !c.rpc) return;
    try {
      c.rpc('sf_arrival_ping', {
        p_event: String(event.slug), p_dist_m: Math.round(distM), p_eta_min: eta, p_phase: phase,
        p_owner: (opts.owner != null ? String(opts.owner) : null)
      }).then(function (r) {
        var d = (r && r.data) || {};
        if (d && d.tell && typeof opts.onFanNotice === 'function') opts.onFanNotice(d.tell, phase, eta);
      }).catch(function () {});
    } catch (e) {}
  }

  root.DDArrival = {
    driveTo: driveTo, arm: arm, disarm: disarm, enabled: enabled,
    haversineM: haversineM, etaMin: etaMin, phaseFor: phaseFor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DDArrival;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
