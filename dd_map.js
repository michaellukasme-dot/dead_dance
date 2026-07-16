/* dd_map.js — ONE place, ONE paste to make every map in the app production-grade.

   ┌────────────────────────────────────────────────────────────────────────────┐
   │  THE FIX — paste your MapTiler key between the quotes below. That is all.     │
   │  Get it free in 2 minutes: https://cloud.maptiler.com → sign up → Account →   │
   │  "API keys" → copy the key. Every map in DeadDance switches to it at once.    │
   └────────────────────────────────────────────────────────────────────────────┘ */
window.DD_TILE_KEY = "";   // ←←← PASTE KEY HERE, e.g. "AbCdEf123456"  (leave blank = dev-only OSM)

/* Why this matters: the public OpenStreetMap tiles are DEV-ONLY. OSM's policy forbids heavy app use and
   WILL block by referer/IP at festival scale — every map goes blank for everyone. A keyed provider fixes
   it. And below, if the keyed provider ever errors, we AUTO-FALL-BACK to OSM so a map is NEVER blank. */

(function (w) {
  "use strict";
  function maptiler(k){ return {
    url: "https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=" + k,
    attribution: '© MapTiler © OpenStreetMap contributors', maxZoom: 20 }; }
  var OSM = { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap", maxZoom: 19 };

  w.DD_TILE = w.DD_TILE_KEY ? maptiler(w.DD_TILE_KEY) : OSM;   // primary provider

  w.DDtile = function (map) {
    var t = w.DD_TILE || OSM, usingKey = !!w.DD_TILE_KEY;
    var layer = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: t.maxZoom || 19, crossOrigin: true }).addTo(map);
    var errs = 0, swapped = false;
    layer.on("tileerror", function () {
      try { if (w.DDHealth) DDHealth.tileErr(); } catch (e) {}     // early-warning to the health beacon
      errs++;
      if (usingKey && !swapped && errs >= 6) {                     // keyed provider failing → never leave a blank map
        swapped = true;
        try { map.removeLayer(layer); } catch (e) {}
        L.tileLayer(OSM.url, { attribution: OSM.attribution, maxZoom: OSM.maxZoom }).addTo(map);
      }
    });
    if (!usingKey && w.console) console.warn("dd_map.js: no DD_TILE_KEY set — using dev-only OSM tiles. Paste a MapTiler key before launch.");
    return layer;
  };
})(window);
