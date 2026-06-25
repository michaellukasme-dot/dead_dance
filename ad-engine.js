/* ============================================================================
 * ad-engine.js — dead_dance band-ad engine. Targets by GEO + DATE, serves ranked,
 * tracks impressions/clicks. HONEST-STATE: this is a real engine, but there is NO
 * paid auction / money here — a band registers its OWN ad (its copy, its ticket
 * link) and the house places it in front of nearby heads. "priority" is a simple
 * editorial field, NOT a paid bid (paid placement = money + disclosure + counsel-gated).
 * Zero dependencies. Runs in the browser and in Node (for tests).
 * ========================================================================== */
(function (root) {
  "use strict";
  function haversine(a, b, c, d) {
    var R = 3958.8, p = Math.PI / 180, dla = (c - a) * p, dlo = (d - b) * p, la1 = a * p, la2 = c * p;
    var h = Math.sin(dla / 2) * Math.sin(dla / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dlo / 2) * Math.sin(dlo / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function offsetPt(lat, lng, mi, brg) {
    var R = 3958.8, p = Math.PI / 180, d = mi / R, b = brg * p, la1 = lat * p, lo1 = lng * p;
    var la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
    var lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
    return { lat: la2 / p, lng: lo2 / p };
  }
  function num(x, dflt) { x = +x; return isFinite(x) ? x : dflt; }

  function Engine() {
    var ads = [], log = [], seq = 0;
    /* ad = { band, venue, time, when(0=today,1=tomorrow), headline, body, ticketUrl,
             show:{lat,lng} OR demo:{mi,brg}, priority(0..10), surfaces:[...] } */
    function register(ad) {
      if (!ad || typeof ad !== "object") return null;
      ad = Object.assign({}, ad);
      ad.id = ad.id || ("ad" + (++seq));
      ad.priority = num(ad.priority, 0);
      ads.push(ad);
      return ad.id;
    }
    function seed(list) { (list || []).forEach(register); return ads.length; }
    function get(id) { for (var i = 0; i < ads.length; i++) if (ads[i].id === id) return ads[i]; return null; }
    function reset() { ads = []; log = []; seq = 0; }

    /* point an ad resolves to for a given viewer (absolute show coords, or demo offset) */
    function pointFor(ad, lat, lng) {
      if (ad.show && isFinite(ad.show.lat) && isFinite(ad.show.lng)) return { lat: ad.show.lat, lng: ad.show.lng };
      if (ad.demo && isFinite(ad.demo.mi)) return offsetPt(lat, lng, num(ad.demo.mi, 0), num(ad.demo.brg, 0));
      return { lat: lat, lng: lng };
    }

    /* serve: { lat, lng, radiusMi=50, when(optional) } -> ranked ads each with _dist (mi) */
    function serve(opts) {
      opts = opts || {};
      var lat = num(opts.lat, NaN), lng = num(opts.lng, NaN), R = num(opts.radiusMi, 50);
      if (!isFinite(lat) || !isFinite(lng)) return [];
      return ads.map(function (a) {
        var pt = pointFor(a, lat, lng);
        var copy = Object.assign({}, a);
        copy._dist = Math.round(haversine(lat, lng, pt.lat, pt.lng));
        return copy;
      }).filter(function (a) {
        if (a._dist > R) return false;
        if (opts.when != null && a.when != null && a.when !== opts.when) return false;
        return true;
      }).sort(function (x, y) {
        /* today before tomorrow, then editorial priority, then nearest */
        return (num(x.when, 9) - num(y.when, 9)) || (num(y.priority, 0) - num(x.priority, 0)) || (x._dist - y._dist);
      });
    }
    function track(id, event) {
      if (!get(id)) return false;
      log.push({ id: id, event: String(event || "view"), t: Date.now() });
      return true;
    }
    function stats(id) {
      var imp = 0, clk = 0;
      for (var i = 0; i < log.length; i++) if (log[i].id === id) { if (log[i].event === "click") clk++; else imp++; }
      return { impressions: imp, clicks: clk };
    }
    return { register: register, seed: seed, get: get, reset: reset, serve: serve, track: track, stats: stats, _ads: function () { return ads.slice(); } };
  }

  var api = { create: function () { return Engine(); }, haversine: haversine, offsetPt: offsetPt, VERSION: "0.1" };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AdEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
