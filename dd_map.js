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
  var ATTR = '© MapTiler © OpenStreetMap contributors';
  function mt(style, ext, k) { return "https://api.maptiler.com/maps/" + style + "/{z}/{x}/{y}." + ext + "?key=" + k; }
  var OSM = { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap", maxZoom: 19 };

  w.DD_TILE = w.DD_TILE_KEY
    ? { url: mt("streets-v2", "png", w.DD_TILE_KEY), attribution: ATTR, maxZoom: 20 }
    : OSM;

  // DDtile(map) → adds a modern street base AND, when keyed, a Google/Apple-style
  // "Map ⇄ Satellite" toggle (satellite+labels = hybrid). Auto-falls-back to OSM so a map is never blank.
  w.DDtile = function (map) {
    var k = w.DD_TILE_KEY, usingKey = !!k;
    var base = usingKey
      ? L.tileLayer(mt("streets-v2", "png", k), { attribution: ATTR, maxZoom: 20, crossOrigin: true })
      : L.tileLayer(OSM.url, { attribution: OSM.attribution, maxZoom: OSM.maxZoom, crossOrigin: true });
    base.addTo(map);

    if (usingKey) {
      // the familiar satellite toggle — the paradigm ~1B drivers already know
      var hybrid = L.tileLayer(mt("hybrid", "jpg", k), { attribution: ATTR, maxZoom: 20, crossOrigin: true });
      try { L.control.layers({ "🗺 Map": base, "🛰 Satellite": hybrid }, null, { position: "topright", collapsed: false }).addTo(map); } catch (e) {}
    }

    var errs = 0, swapped = false;
    base.on("tileerror", function () {
      try { if (w.DDHealth) DDHealth.tileErr(); } catch (e) {}
      errs++;
      if (usingKey && !swapped && errs >= 6) {                     // keyed provider failing → never leave a blank map
        swapped = true;
        try { map.removeLayer(base); } catch (e) {}
        L.tileLayer(OSM.url, { attribution: OSM.attribution, maxZoom: OSM.maxZoom }).addTo(map);
      }
    });
    if (!usingKey && w.console) console.warn("dd_map.js: no DD_TILE_KEY set — using dev-only OSM tiles (the '2012' look). Paste a MapTiler key in dd_map.js to go modern + enable the satellite toggle.");
    return base;
  };
})(window);
