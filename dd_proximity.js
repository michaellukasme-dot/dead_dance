/* dd_proximity.js — PROXIMITY AD lifecycle. A premium advertiser ad appears by proximity and
   DISAPPEARS when either:
     (a) the fan walks PAST the advertiser's boundary  (geofence exit), or
     (b) the ad TIMES OUT.
   Either way it expires: fades out, hides, and fires a "dd-ad-expired" event so the ad rotation
   can move on. Privacy-safe: geolocation stays on the device; nothing is sent anywhere.

   Usage:
     DDProximity.guard(el, { lat, lng, radiusM:120, ttlS:90, onExpire:function(reason){} });
     DDProximity.fromQuery(el, { ttlS:90 });   // reads ?plat=&plng=&prad=&ttl= from the URL

   reason is "boundary" (walked past) or "timeout".  Returns a handle with .stop(). */
(function (root) {
  function haversine(aLat, aLng, bLat, bLng) {
    var R = 6371000, x = (bLat - aLat) * Math.PI / 180, y = (bLng - aLng) * Math.PI / 180,
        s = Math.sin(x / 2) * Math.sin(x / 2) +
            Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(y / 2) * Math.sin(y / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function guard(el, opts) {
    opts = opts || {};
    if (typeof el === "string") el = document.getElementById(el);
    if (!el) return { stop: function () {} };

    var radius = opts.radiusM || 120;          // advertiser boundary (m)
    var edge   = radius + (opts.graceM != null ? opts.graceM : 15); // hysteresis so we don't flicker at the line
    var ttlMs  = (opts.ttlS || 90) * 1000;      // time-out
    var requireInsideFirst = opts.requireInsideFirst !== false; // only boundary-expire after we've seen them inside
    var seenInside = false, done = false, watchId = null, timer = null;

    function expire(reason) {
      if (done) return; done = true;
      try { if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId); } catch (e) {}
      try { clearTimeout(timer); } catch (e) {}
      // fade, then remove from layout
      try {
        el.style.transition = "opacity .5s ease";
        el.style.opacity = "0";
        setTimeout(function () { try { el.style.display = "none"; } catch (e) {} }, 520);
      } catch (e) { try { el.style.display = "none"; } catch (_) {} }
      var detail = { reason: reason, ad: el };
      try { el.dispatchEvent(new CustomEvent("dd-ad-expired", { detail: detail, bubbles: true })); } catch (e) {}
      try { root.dispatchEvent(new CustomEvent("dd-ad-expired", { detail: detail })); } catch (e) {}
      if (typeof opts.onExpire === "function") { try { opts.onExpire(reason); } catch (e) {} }
    }

    // (b) time-out
    timer = setTimeout(function () { expire("timeout"); }, ttlMs);

    // (a) boundary — needs a location to compare against
    if (opts.lat != null && opts.lng != null && navigator.geolocation) {
      try {
        watchId = navigator.geolocation.watchPosition(function (pos) {
          if (done) return;
          var d = haversine(pos.coords.latitude, pos.coords.longitude, opts.lat, opts.lng);
          if (d <= radius) { seenInside = true; }
          else if (d > edge && (seenInside || !requireInsideFirst)) { expire("boundary"); }
        }, function () { /* GPS denied/unavailable → TTL still governs */ },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
      } catch (e) {}
    }

    return { stop: function () { if (done) return; done = true;
      try { if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId); } catch (e) {}
      try { clearTimeout(timer); } catch (e) {} } };
  }

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function fromQuery(el, defaults) {
    defaults = defaults || {};
    var q = new URLSearchParams(location.search);
    var lat = num(q.get("plat")), lng = num(q.get("plng"));
    var rad = num(q.get("prad")), ttl = num(q.get("ttl"));
    // only arm if the ad actually carries proximity/ttl params — otherwise a plain ad never expires
    if (lat == null && lng == null && ttl == null && defaults.ttlS == null) return { stop: function () {} };
    return guard(el, {
      lat: lat, lng: lng,
      radiusM: rad != null ? rad : defaults.radiusM,
      ttlS: ttl != null ? ttl : defaults.ttlS,
      graceM: defaults.graceM, requireInsideFirst: defaults.requireInsideFirst,
      onExpire: defaults.onExpire
    });
  }

  root.DDProximity = { guard: guard, fromQuery: fromQuery, distanceM: haversine };
})(typeof window !== "undefined" ? window : this);
