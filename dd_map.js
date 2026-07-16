/* dd_map.js — ONE place to swap the map tile provider.
   ⚠️ SCALE (Claudine P0-2): the OpenStreetMap public tiles below are DEV-ONLY. OSM's usage policy
   forbids heavy app use — at 1.45M–10M festival traffic they WILL throttle/block by referer/IP and
   every map goes blank for everyone. Before a big launch, sign up for a keyed provider (MapTiler,
   Mapbox, or Stadia Maps — a few $/mo) and paste ONE url below; every map in the app switches at once.
   Example MapTiler:  url:"https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=YOUR_KEY" (no {s}). */
window.DD_TILE = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap",
  maxZoom: 19
};
window.DDtile = function (map) {
  var t = window.DD_TILE || {};
  var layer = L.tileLayer(t.url || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: t.attribution || "© OpenStreetMap", maxZoom: t.maxZoom || 19 }).addTo(map);
  try { layer.on("tileerror", function () { if (window.DDHealth) DDHealth.tileErr(); }); } catch (e) {}  // blank-map early warning
  return layer;
};
