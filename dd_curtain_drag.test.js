/* dd_curtain_drag.test.js — proves the PURE geometry of the shared curtain drag.
   Run: node dd_curtain_drag.test.js   (exit 0 = green). Zero deps. */
var D = require("./dd_curtain_drag.js");

var pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error("  ✗ " + name); } }
function near(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 0.001 : eps); }

/* ── clamp ───────────────────────────────────────────────────────────────── */
ok("clamp inside", D.clamp(5, 0, 10) === 5);
ok("clamp to min", D.clamp(-3, 0, 10) === 0);
ok("clamp to max", D.clamp(99, 0, 10) === 10);
ok("clamp tolerates swapped bounds", D.clamp(5, 10, 0) === 5);

/* ── dragPosition: sheet follows the thumb (delta sign) ──────────────────── */
// thumb DOWN (curPointer 300 > start 200) → top increases (sheet lowers)
ok("drag down lowers sheet", D.dragPosition(400, 200, 300, 0, 1000) === 500);
// thumb UP (curPointer 100 < start 200) → top decreases (sheet rises)
ok("drag up raises sheet", D.dragPosition(400, 200, 100, 0, 1000) === 300);
// clamped so it can never rise above min (never stuck off-screen at top)
ok("drag up clamps at min", D.dragPosition(100, 200, 0, 80, 1000) === 80);
// clamped so it can never fall below max (never disappears off the bottom)
ok("drag down clamps at max", D.dragPosition(900, 200, 900, 0, 950) === 950);

/* ── contentAnchors: max ADAPTS to content length ────────────────────────── */
var vp = 800;
var cfg = { peekVh: 78, midVh: 52, minTopVh: 8, handlePx: 0 };
var shortA = D.contentAnchors(vp, 250, cfg);   // tiny curtain
var longA = D.contentAnchors(vp, 4000, cfg);   // full Musikfest lineup
var medA = D.contentAnchors(vp, 500, cfg);     // medium
ok("short content: full does NOT exceed mid (no empty space)", near(shortA.full, medA.mid, 2) || shortA.full >= medA.mid - 2);
ok("long content: full rises to the min-top cap", near(longA.full, 8 * (vp / 100)));
ok("long full is higher (smaller top) than short full", longA.full < shortA.full);
ok("medium full sits between the two", medA.full > longA.full && medA.full <= shortA.full + 0.001);
ok("mid + peek are stable regardless of content", medA.mid === shortA.mid && medA.peek === longA.peek);
ok("unknown/zero content opens fully (never stuck)", near(D.contentAnchors(vp, 0, cfg).full, 8 * (vp / 100)));
ok("full <= mid <= peek always", longA.full <= longA.mid && longA.mid <= longA.peek);

/* ── dragBounds ──────────────────────────────────────────────────────────── */
var b = D.dragBounds(longA, vp, 88);
ok("drag min = full anchor", b.min === longA.full);
ok("drag max is at/below peek (grab-lip)", b.max >= longA.peek);

/* ── snapToNearest: correct anchor by POSITION ───────────────────────────── */
var anchors = D.anchorList(longA); // [full, mid, peek]
ok("snap near full picks full", D.snapToNearest(longA.full + 5, anchors) === longA.full);
ok("snap near mid picks mid", D.snapToNearest(longA.mid - 8, anchors) === longA.mid);
ok("snap near peek picks peek", D.snapToNearest(longA.peek + 12, anchors) === longA.peek);

/* ── snapByVelocity: momentum carries to the next anchor by RELEASE velocity ─ */
var mid = longA.mid;
ok("slow release snaps to nearest (mid)", D.snapByVelocity(mid + 4, 0.1, anchors, 0.5) === mid);
ok("fast flick DOWN carries to peek", D.snapByVelocity(mid, 1.2, anchors, 0.5) === longA.peek);
ok("fast flick UP carries to full", D.snapByVelocity(mid, -1.2, anchors, 0.5) === longA.full);
ok("flick down at peek stays at peek (no overshoot)", D.snapByVelocity(longA.peek, 2.0, anchors, 0.5) === longA.peek);
ok("flick up at full stays at full (no overshoot)", D.snapByVelocity(longA.full, -2.0, anchors, 0.5) === longA.full);

/* ── tapNext: handle tap → next anchor (bonus quick-action) ──────────────── */
ok("tap at peek opens to mid", D.tapNext(longA.peek, anchors) === longA.mid);
ok("tap at mid opens to full", D.tapNext(longA.mid, anchors) === longA.full);
ok("tap at full wraps to peek", D.tapNext(longA.full, anchors) === longA.peek);

/* ── velocityFrom ────────────────────────────────────────────────────────── */
ok("velocity down is positive", D.velocityFrom([{ t: 0, y: 100 }, { t: 100, y: 300 }]) === 2);
ok("velocity up is negative", D.velocityFrom([{ t: 0, y: 300 }, { t: 100, y: 100 }]) === -2);
ok("velocity safe with <2 samples", D.velocityFrom([{ t: 0, y: 100 }]) === 0);
ok("velocity safe with zero dt", D.velocityFrom([{ t: 5, y: 100 }, { t: 5, y: 300 }]) === 0);

/* ── reduced-motion + no-op safety in Node ───────────────────────────────── */
ok("prefersReducedMotion returns false in node (no matchMedia)", D.prefersReducedMotion() === false);
var ctrl = D.attach({ sheet: null });            // no DOM → must be a safe no-op controller
ok("attach() is no-op safe in node (returns controller)", ctrl && typeof ctrl.beginDrag === "function");
ok("no-op getTop returns 0", ctrl.getTop() === 0);
var didThrow = false;
try { ctrl.beginDrag({}); ctrl.snapTo("full"); ctrl.setTop(10); ctrl.refresh(); ctrl.destroy(); }
catch (e) { didThrow = true; }
ok("no-op controller methods never throw", didThrow === false);

/* ── summary ─────────────────────────────────────────────────────────────── */
console.log("\ndd_curtain_drag.test.js — " + pass + " passed, " + fail + " failed");
process.exit(fail === 0 ? 0 : 1);
