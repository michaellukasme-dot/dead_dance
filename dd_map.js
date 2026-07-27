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
  // Dev default + universal fallback: CARTO. Unlike OSM's servers it does NOT 403 no-referer / file://
  // loads, so maps render whether opened locally or served. (MapTiler key still upgrades everything.)
  var CARTO = { url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", subdomains: "abcd", attribution: "© OpenStreetMap © CARTO", maxZoom: 20 };
  // 1px transparent → any blocked/failed tile renders BLANK, never the ugly "403 / Access blocked" graphic.
  var BLANK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  w.DD_TILE = w.DD_TILE_KEY
    ? { url: mt("streets-v2", "png", w.DD_TILE_KEY), attribution: ATTR, maxZoom: 20 }
    : CARTO;

  // Esri World Imagery — FREE satellite tiles, no API key required. Gives us the Google-style
  // Map ⇄ Satellite toggle TODAY. (Upgrades to MapTiler hybrid automatically once a key is pasted.)
  var ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  // DDtile(map) → street base + a Google/Apple-style "Map ⇄ Satellite" toggle in the map window.
  // Auto-falls-back to OSM so a map is never blank.
  w.DDtile = function (map) {
    // The PLAIN, real map — no purple skin, no brand/Map layer toggle. We are the better map; don't tint it.
    var k = w.DD_TILE_KEY, usingKey = !!k;
    var url = usingKey ? mt("streets-v2", "png", k) : CARTO.url;
    var attr = usingKey ? ATTR : CARTO.attribution;
    var mz = usingKey ? 20 : CARTO.maxZoom;
    var subs = usingKey ? 'abc' : CARTO.subdomains;
    var base = L.tileLayer(url, { attribution: attr, maxZoom: mz, crossOrigin: true, subdomains: subs, errorTileUrl: BLANK }).addTo(map);

    var errs = 0, swapped = false;
    base.on("tileerror", function () {
      try { if (w.DDHealth) DDHealth.tileErr(); } catch (e) {}
      errs++;
      if (usingKey && !swapped && errs >= 6) { swapped = true;                     // keyed provider failing → never leave a blank map
        try { map.removeLayer(base); } catch (e) {}
        L.tileLayer(CARTO.url, { attribution: CARTO.attribution, maxZoom: CARTO.maxZoom, subdomains: CARTO.subdomains, errorTileUrl: BLANK }).addTo(map);
      }
    });
    return base;
  };
})(window);
