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

  // Esri World Imagery — FREE satellite tiles, no API key required. Gives us the Google-style
  // Map ⇄ Satellite toggle TODAY. (Upgrades to MapTiler hybrid automatically once a key is pasted.)
  var ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  // DDtile(map) → street base + a Google/Apple-style "Map ⇄ Satellite" toggle in the map window.
  // Auto-falls-back to OSM so a map is never blank.
  w.DDtile = function (map) {
    // one-time CSS — skin the real street tiles in DeadDance purple (our brand on a real walking map)
    if (!document.getElementById('dd-purple-css')) { var st = document.createElement('style'); st.id = 'dd-purple-css';
      st.textContent = '.dd-purple-tiles{filter:grayscale(.5) sepia(.5) hue-rotate(210deg) saturate(1.8) brightness(1.03) contrast(.96)}';
      document.head.appendChild(st); }
    var k = w.DD_TILE_KEY, usingKey = !!k;
    var url = usingKey ? mt("streets-v2", "png", k) : OSM.url;
    var attr = usingKey ? ATTR : OSM.attribution;
    var mz = usingKey ? 20 : OSM.maxZoom;
    var base   = L.tileLayer(url, { attribution: attr, maxZoom: mz, crossOrigin: true });                               // 🗺 plain geo
    var purple = L.tileLayer(url, { attribution: attr, maxZoom: mz, crossOrigin: true, className: 'dd-purple-tiles' });  // 🌹 DeadDance brand
    purple.addTo(map);   // default to our purple — no Satellite (doesn't help the walk, per Issa)

    // toggle: brand (purple) ⇄ 🗺 Map (plain geo), top-right. Brand label is per-page overridable (white-label maps set w.DD_MAP_BRAND).
    try { var _lyr = {}; _lyr[w.DD_MAP_BRAND || "🌹 DeadDance"] = purple; _lyr["🗺 Map"] = base; L.control.layers(_lyr, null, { position: "topright", collapsed: false }).addTo(map); } catch (e) {}

    var errs = 0, swapped = false;
    function watch(layer) { layer.on("tileerror", function () {
      try { if (w.DDHealth) DDHealth.tileErr(); } catch (e) {}
      errs++;
      if (usingKey && !swapped && errs >= 6) { swapped = true;                     // keyed provider failing → never leave a blank map
        try { map.removeLayer(base); map.removeLayer(purple); } catch (e) {}
        L.tileLayer(OSM.url, { attribution: OSM.attribution, maxZoom: OSM.maxZoom, className: 'dd-purple-tiles' }).addTo(map);
      }
    }); }
    watch(base); watch(purple);
    return purple;
  };
})(window);
