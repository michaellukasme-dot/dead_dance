/* dd_images_curtain.test.js — node harness for the PURE core of dd_images_curtain.js.
   Proves the testable brain (projection, slider→size, time-order, captions, active sync,
   missing-geo, after-walk composition, node no-op safety). The DOM/gesture feel is
   device-validated-later (cannot run a browser here) — said plainly.

   Run:  node dd_images_curtain.test.js   → exits 0 on all-green, 1 on any failure. */
"use strict";
var IC = require("./dd_images_curtain.js");

var pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error("  ✗ " + msg); } }
function eq(a, b, msg) { ok(a === b, msg + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")"); }

/* fixtures: capture order jumbled so ordering is actually exercised */
var T0 = Date.UTC(2026, 7, 5, 20, 42, 0);           // 2026-08-05 20:42 UTC → 8:42 PM
var geoA = { id: "a", lat: 40.611, lng: -75.379, ts: T0 + 2000, day: "2026-08-05", kind: "crowd", exif: true, url: "urlA" };
var geoB = { id: "b", lat: 40.612, lng: -75.377, ts: T0 + 0,    day: "2026-08-05", kind: "crowd", exif: true, url: "urlB" };
var noGeo = { id: "c", lat: null,  lng: null,     ts: T0 + 1000, day: "2026-08-05", kind: "crowd", exif: false, url: "urlC" };
var dupA  = { id: "d", lat: 40.611, lng: -75.379, ts: T0 + 3000, day: "2026-08-05", kind: "crowd", exif: true, url: "urlD" }; // same spot as geoA
var LIST  = [geoA, geoB, noGeo, dupA];

/* ── 1. hasGeo / photoToPin — missing-geo handled honestly ─────────────────── */
ok(IC.hasGeo(geoA) === true, "hasGeo true for a geotagged photo");
ok(IC.hasGeo(noGeo) === false, "hasGeo false when lat/lng are null");
ok(IC.hasGeo({ lat: 999, lng: 0 }) === false, "hasGeo false for out-of-range lat");
ok(IC.photoToPin(noGeo) === null, "photoToPin returns null (not a fake 0,0) for geo-less photo");
var pinA = IC.photoToPin(geoA);
ok(pinA && pinA.lat === 40.611 && pinA.lng === -75.379 && pinA.url === "urlA", "photoToPin projects lat/lng/url");

/* ── 2. projectPhotos — splits geo vs no-geo, time-ordered ─────────────────── */
var proj = IC.projectPhotos(LIST);
eq(proj.pins.length, 3, "projectPhotos keeps 3 geotagged photos as pins");
eq(proj.noGeo.length, 1, "projectPhotos routes the 1 geo-less photo to noGeo (not dropped)");
eq(proj.noGeo[0].id, "c", "the geo-less photo is the right one");

/* ── 3. orderByTime — oldest → newest, non-mutating ────────────────────────── */
var ord = IC.orderByTime(LIST);
eq(ord.map(function (p) { return p.id; }).join(""), "bcad", "orderByTime sorts by ts ascending (b,c,a,d)");
eq(LIST[0].id, "a", "orderByTime does not mutate the input array");
eq(IC.orderByTime(null).length, 0, "orderByTime tolerates non-array input");

/* ── 4. sliderToSize — monotonic non-decreasing + clamped ──────────────────── */
var sMin = IC.sliderToSize(0, { inMin: 0, inMax: 100 });
var sMid = IC.sliderToSize(50, { inMin: 0, inMax: 100 });
var sMax = IC.sliderToSize(100, { inMin: 0, inMax: 100 });
ok(sMin <= sMid && sMid <= sMax, "sliderToSize is monotonic non-decreasing across the range");
eq(sMin, 28, "sliderToSize min (Small) = 28px default floor");
eq(sMax, 64, "sliderToSize max (Big) = 64px default ceiling");
eq(IC.sliderToSize(-50, { inMin: 0, inMax: 100 }), 28, "sliderToSize clamps below-range input to the floor");
eq(IC.sliderToSize(9999, { inMin: 0, inMax: 100 }), 64, "sliderToSize clamps above-range input to the ceiling");
eq(IC.sliderToSize(NaN, { inMin: 0, inMax: 100 }), 28, "sliderToSize tolerates NaN → floor");

/* ── 5. caption formatting ─────────────────────────────────────────────────── */
eq(IC.formatClock(T0, 0), "8:42 PM", "formatClock renders 20:42 UTC as 8:42 PM");
eq(IC.formatClock(Date.UTC(2026, 0, 1, 0, 5, 0), 0), "12:05 AM", "formatClock renders midnight-05 as 12:05 AM");
eq(IC.formatDay("2026-08-05"), "Aug 5", "formatDay renders YYYY-MM-DD as 'Aug 5'");
eq(IC.formatDay("garbage"), "", "formatDay returns '' for malformed input");
var capGeo = IC.formatCaption(geoA, { tzOffsetMin: 0 });
eq(capGeo.title, "My photo", "caption title falls back to 'My photo' (no place field in dd_photos)");
eq(capGeo.subtitle, "Aug 5 · 8:42 PM", "caption subtitle = day + clock for a geotagged photo");
ok(capGeo.hasGeo === true, "caption flags hasGeo true for geotagged");
var capNo = IC.formatCaption(noGeo, { tzOffsetMin: 0 });
ok(/No location/.test(capNo.subtitle), "caption flags 'No location' when geo missing");
ok(capNo.hasGeo === false, "caption flags hasGeo false when geo missing");
eq(IC.formatCaption({ kind: "profile" }).title, "Profile photo", "caption title is kind-aware for profile photos");
eq(IC.formatCaption({ place: "Dutch Springs" }).title, "Dutch Springs", "caption honors a place field if one ever exists (future-proof)");

/* ── 6. activeState — pin/card sync + modal prev/next ──────────────────────── */
var a1 = IC.activeState(ord, "a");                 // ord = [b,c,a,d]
eq(a1.index, 2, "activeState finds the active index");
eq(a1.prevId, "c", "activeState prevId is the earlier neighbor");
eq(a1.nextId, "d", "activeState nextId is the later neighbor");
eq(IC.activeState(ord, "b").prevId, null, "activeState prevId null at the start");
eq(IC.activeState(ord, "d").nextId, null, "activeState nextId null at the end");
eq(IC.activeState(ord, "zzz").index, -1, "activeState returns -1 for an unknown id");

/* ── 7. clusterByProximity — de-stacks overlapping pins ────────────────────── */
var clusters = IC.clusterByProximity(proj.pins);
eq(clusters.length, 2, "clusterByProximity merges the two same-spot photos (a,d) → 2 clusters");
var big = clusters.filter(function (c) { return c.items.length > 1; })[0];
eq(big.items.length, 2, "the merged cluster holds both overlapping photos");

/* ── 8. boundsOf + composeAfterWalk — after-walk marker set + bounds ───────── */
eq(IC.boundsOf([]), null, "boundsOf returns null for no coords");
var b = IC.boundsOf([[40.611, -75.379], [40.612, -75.377]]);
ok(b.minLat === 40.611 && b.maxLat === 40.612 && b.minLng === -75.379 && b.maxLng === -75.377, "boundsOf computes min/max lat/lng");
var walk = [[40.6105, -75.3795], [40.6125, -75.3765]];
var comp = IC.composeAfterWalk(LIST, walk);
eq(comp.markers.length, 3, "composeAfterWalk includes only geotagged photos as markers");
eq(comp.noGeoCount, 1, "composeAfterWalk counts the geo-less photo separately (honest)");
eq(comp.path.length, 2, "composeAfterWalk carries the walk path");
ok(comp.bounds && comp.bounds.minLat <= 40.611 && comp.bounds.maxLat >= 40.612, "composeAfterWalk bounds envelop photos + path");
ok(comp.rendered === false, "composeAfterWalk is honest: rendered === false (nothing rasterised)");
ok(IC.renderAfterWalk(null, LIST, walk).stub === true, "renderAfterWalk is flagged a STUB, never a finished image");

/* ── 9. detectDoubleTap — double-tap timer ─────────────────────────────────── */
var st = { last: -Infinity };
var r1 = IC.detectDoubleTap(st, 1000, 320);
ok(r1.double === false, "detectDoubleTap: first tap is not a double");
var r2 = IC.detectDoubleTap(r1.state, 1200, 320);
ok(r2.double === true, "detectDoubleTap: second tap within threshold is a double");
var r3 = IC.detectDoubleTap(r2.state, 1300, 320);
ok(r3.double === false, "detectDoubleTap: consumes the double (third quick tap is not another double)");

/* ── 10. node no-op safety — mount returns a guarded no-op, never throws ────── */
var ctrl;
var threw = false;
try { ctrl = IC.mount({ getPhotos: function () { return LIST; } }); } catch (e) { threw = true; }
ok(!threw, "mount() does not throw in node (no DOM)");
ok(ctrl && ctrl.isNoop === true, "mount() returns a guarded no-op controller in node");
var threw2 = false;
try { ctrl.refresh(); ctrl.openModal("a"); ctrl.destroy(); } catch (e) { threw2 = true; }
ok(!threw2, "no-op controller methods are all safe to call in node");

/* ── summary ───────────────────────────────────────────────────────────────── */
console.log("\ndd_images_curtain.test.js — " + pass + " passed, " + fail + " failed  (" + (pass + fail) + " assertions)");
if (fail > 0) { process.exit(1); }
console.log("ALL GREEN ✅  (pure core proven; DOM/gesture feel is device-validated-later)");
