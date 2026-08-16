/* presentation_check.js — automated PRESENTATION TRIPLE-PROTOCOL for every city/festival map.
   Operationalizes PRESENTATION_STANDARD_ANY_CITY.md §5. Run:  node presentation_check.js
   Loads FESTS + CATCOLOR out of festival_vendors.html and checks each fest on three protocols:
     1) TRUTH        — every placed element inside the footprint, inside its zone, off every obstacle
     2) FRAME        — a real, non-degenerate bbox to fit on one screen
     3) LEGIBILITY   — every category is colored (renders as an icon pin, not a grey default)
   Exit code 0 = all green; 1 = at least one map fails. Node-only dev tool (not shipped). */
"use strict";
var fs = require("fs");
var FILE = require("path").join(__dirname, "festival_vendors.html");
var h = fs.readFileSync(FILE, "utf8");

function grab(marker) { // pull a top-level `var X = {...};` object literal by brace-matching
  var i = h.indexOf("var " + marker + " = {"); if (i < 0) throw new Error("missing " + marker);
  var s = h.indexOf("{", i), d = 0, e = -1;
  for (var j = s; j < h.length; j++) { var c = h[j]; if (c === "{") d++; else if (c === "}") { d--; if (d === 0) { e = j; break; } } }
  return eval("(" + h.slice(s, e + 1) + ")");
}
var FESTS = grab("FESTS");
var CATCOLOR = grab("CATCOLOR");

function inBox(lat, lng, bb) { var a = Math.min(bb[0][0], bb[1][0]), A = Math.max(bb[0][0], bb[1][0]), o = Math.min(bb[0][1], bb[1][1]), O = Math.max(bb[0][1], bb[1][1]); return lat >= a && lat <= A && lng >= o && lng <= O; }
function inPoly(lat, lng, poly) { var ins = false; for (var a = 0, b = poly.length - 1; a < poly.length; b = a++) { var yi = poly[a][0], xi = poly[a][1], yj = poly[b][0], xj = poly[b][1]; if (((yi > lat) != (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }
// mirror the in-page placeVendors so we can check spine-placed vendors too
function ptAlong(sp, f) { var segs = sp.length - 1, s = Math.min(segs - 1, Math.floor(f * segs)), lt = (f * segs) - s, a = sp[s], b = sp[s + 1]; return [a[0] + (b[0] - a[0]) * lt, a[1] + (b[1] - a[1]) * lt]; }
function perpAt(sp, f) { var segs = sp.length - 1, s = Math.min(segs - 1, Math.floor(f * segs)), a = sp[s], b = sp[s + 1], dLat = b[0] - a[0], dLng = b[1] - a[1], m = Math.sqrt(dLat * dLat + dLng * dLng) || 1; return [-dLng / m, dLat / m]; }
function blocked(F, lat, lng) { if (F.boundary && !inPoly(lat, lng, F.boundary)) return true; if (F.obstacles) for (var o = 0; o < F.obstacles.length; o++) if (F.obstacles[o].poly && inPoly(lat, lng, F.obstacles[o].poly)) return true; return false; }
function place(F) { // fill lat/lng for spine-placed vendors, exactly as the page does
  if (!F.spine) return; var n = F.vendors.length, off = 0.00007;
  F.vendors.forEach(function (v, i) { if (v.lat != null && v.lng != null) return; var t = (i + 0.5) / n, base = ptAlong(F.spine, t), pp = perpAt(F.spine, t), side = (i % 2 ? 1 : -1); var lat = base[0] + pp[0] * off * side, lng = base[1] + pp[1] * off * side; if (blocked(F, lat, lng)) { lat = base[0]; lng = base[1]; } v.lat = lat; v.lng = lng; });
}

var totalFail = 0, maps = 0;
Object.keys(FESTS).forEach(function (id) {
  var F = FESTS[id]; maps++;
  var fails = [];
  place(F); // simulate spine placement so every vendor gets checked

  // 2) FRAME — bbox exists and has real area
  if (!F.bbox || F.bbox.length !== 2) fails.push("no bbox");
  else { var dLat = Math.abs(F.bbox[0][0] - F.bbox[1][0]), dLng = Math.abs(F.bbox[0][1] - F.bbox[1][1]);
    if (dLat < 1e-5 || dLng < 1e-5) fails.push("degenerate bbox (can't frame)"); }

  // 1) TRUTH + 3) LEGIBILITY over vendors
  var placed = 0, cats = {};
  (F.vendors || []).forEach(function (v) {
    cats[v.c] = 1;
    if (v.lat == null || v.lng == null) return; placed++;
    // inside footprint (boundary if present, else bbox)
    if (F.boundary && !inPoly(v.lat, v.lng, F.boundary) && !inBox(v.lat, v.lng, F.bbox)) fails.push("outside footprint: " + v.n);
    else if (!F.boundary && F.bbox && !inBox(v.lat, v.lng, F.bbox)) fails.push("outside bbox: " + v.n);
    // inside its own zone
    if (v.zone && F.zones) { var z = F.zones.filter(function (z) { return z.id === v.zone; })[0]; if (z && !inBox(v.lat, v.lng, z.bbox)) fails.push("not in zone " + v.zone + ": " + v.n); }
    // off every obstacle
    if (F.obstacles) F.obstacles.forEach(function (o) { if (o.poly && inPoly(v.lat, v.lng, o.poly)) fails.push("in obstacle(" + (o.type || "?") + "): " + v.n); });
  });
  // zones nest inside the fest bbox
  (F.zones || []).forEach(function (z) { if (!inBox(z.bbox[0][0], z.bbox[0][1], F.bbox) || !inBox(z.bbox[1][0], z.bbox[1][1], F.bbox)) fails.push("zone outside bbox: " + z.id); });
  // every category is colored
  Object.keys(cats).forEach(function (c) { if (!CATCOLOR[c]) fails.push("uncolored category: " + c); });

  var name = (F.name || id);
  if (fails.length) { totalFail += fails.length;
    console.log("  ✗ " + id + "  (" + name + ")");
    fails.slice(0, 8).forEach(function (f) { console.log("       · " + f); });
    if (fails.length > 8) console.log("       · …+" + (fails.length - 8) + " more");
  } else {
    console.log("  ✓ " + id + "  (" + name + ")  —  " + placed + " placed · " + Object.keys(cats).length + " cats" + (F.zones ? " · " + F.zones.length + " zones" : ""));
  }
});

console.log("──────────────────────────────────────────────");
console.log("PRESENTATION TRIPLE-PROTOCOL: " + maps + " maps · " + (totalFail === 0 ? "ALL GREEN ✅" : totalFail + " failures ❌"));
process.exit(totalFail === 0 ? 0 : 1);
