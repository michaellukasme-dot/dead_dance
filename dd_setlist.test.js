// dd_setlist.test.js — pure-math harness for the setlist timeline + crowd estimator.
// Proves: cumulative elapsed sums, break insertion at set boundaries, mm:ss formatting,
// wall-clock tease scheduling, and the crowd ESTIMATED timeline (first=00:00, monotonic,
// outlier clamp). No network, no DOM — just the brain. Run: `node dd_setlist.test.js`.
global.window = global;
var assert = require('assert');

// stub localStorage so dd_setlist_crowd.js loads in node
var _ls = {}; global.localStorage = { getItem: function (k) { return (k in _ls) ? _ls[k] : null; },
  setItem: function (k, v) { _ls[k] = String(v); }, removeItem: function (k) { delete _ls[k]; } };

require('./dd_setlist.js');
require('./dd_setlist_crowd.js');
var D = global.window.DDSetlist;
var C = global.window.DDSetlistCrowd;
var n = 0; function ok(c, m) { assert.ok(c, m); n++; }
function eq(a, b, m) { assert.strictEqual(a, b, m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); n++; }

ok(D && D.timeline, 'DDSetlist.timeline attached');
ok(C && C.estimateTimeline, 'DDSetlistCrowd.estimateTimeline attached');

// ---- parseLen ----
eq(D.parseLen('4:53'), 293, 'parseLen m:ss');
eq(D.parseLen('2:30'), 150, 'parseLen m:ss #2');
eq(D.parseLen(150), 150, 'parseLen bare number');
eq(D.parseLen('1:02:03'), 3723, 'parseLen h:mm:ss');
eq(D.parseLen('garbage'), 0, 'parseLen bad → 0');

// ---- fmtClock (mm:ss, mm may exceed 59) ----
eq(D.fmtClock(0), '00:00', 'fmtClock 0');
eq(D.fmtClock(293), '04:53', 'fmtClock 293');
eq(D.fmtClock(439), '07:19', 'fmtClock 439');
eq(D.fmtClock(754), '12:34', 'fmtClock 754');
eq(D.fmtClock(3723), '62:03', 'fmtClock over an hour stays mm:ss');

// ---- timeline: cumulative sums (00:00 → +len → +len) ----
// lengths: 4:53 (293), 2:26 (146), 5:15 (315)
var tl = D.timeline([{ n: 'A', len: '4:53' }, { n: 'B', len: '2:26' }, { n: 'C', len: '5:15' }], {});
eq(tl[0].start, 0, 'song1 starts at 00:00');
eq(tl[0].startLabel, '00:00', 'song1 label');
eq(tl[1].start, 293, 'song2 start = len(song1)');
eq(tl[1].startLabel, '04:53', 'song2 label 04:53');
eq(tl[2].start, 439, 'song3 start = len1+len2');
eq(tl[2].startLabel, '07:19', 'song3 label 07:19');
eq(tl[2].n, 'C', 'timeline preserves song fields');

// ---- break insertion at a set boundary ----
// setBreaks=[2] means song index 2 begins set 2 → a 15-min (900s) break precedes it.
var tlb = D.timeline([{ n: 'A', len: '4:53' }, { n: 'B', len: '2:26' }, { n: 'C', len: '5:15' }],
  { breakMin: 15, setBreaks: [2] });
eq(tlb[1].start, 293, 'pre-break song unaffected');
eq(tlb[2].start, 293 + 146 + 900, 'break added at set boundary (len1+len2+15min)');
eq(tlb[2].startLabel, '22:19', 'post-break label');

// ---- clockAdd / schedule: wall-clock tease times ----
eq(D.clockAdd('9:00', 293), '9:04', 'clockAdd floors elapsed to the minute');
eq(D.clockAdd('9:00', 0), '9:00', 'clockAdd zero elapsed');
eq(D.clockAdd('9:58', 300), '10:03', 'clockAdd rolls the hour');
var sch = D.schedule([{ n: 'A', len: '4:53' }, { n: 'B', len: '2:26' }], '9:00', {});
eq(sch[0].teaseAt, '9:00', 'song1 teaseAt = set start');
eq(sch[1].teaseAt, '9:04', 'song2 teaseAt = set start + elapsed');

// ---- crowd estimator: first=00:00, monotonic, outlier clamp ----
var base = 1700000000000; // arbitrary ms epoch
// fed OUT OF ORDER on purpose → estimator must sort by report time
var est = C.estimateTimeline([
  { n: 'Third', t: base + 439000 },
  { n: 'First', t: base + 0 },
  { n: 'Second', t: base + 293000 }
]);
eq(est[0].n, 'First', 'estimator orders by report time');
eq(est[0].start, 0, 'earliest report anchored to 00:00');
eq(est[0].startLabel, '00:00', 'est first label');
eq(est[0].est, true, 'estimator flags est:true (honest)');
eq(est[1].start, 293, 'second est elapsed = report delta');
eq(est[2].start, 439, 'third est elapsed = report delta');
// monotonic non-decreasing across the whole list
var mono = true; for (var i = 1; i < est.length; i++) if (est[i].start < est[i - 1].start) mono = false;
ok(mono, 'estimated timeline is monotonic non-decreasing');

// outlier clamp: a wild future timestamp cannot blow up the clock (cap gap at maxGapSec)
var estO = C.estimateTimeline([
  { n: 'A', t: base + 0 },
  { n: 'B', t: base + 60000 },        // +60s
  { n: 'C', t: base + 999999000 }     // absurd → gap capped
], { maxGapSec: 600 });
eq(estO[1].start, 60, 'normal gap kept');
eq(estO[2].start, 60 + 600, 'outlier gap clamped to maxGapSec');

// median path: {n, times:[...]} uses the median report time
var estM = C.estimateTimeline([
  { n: 'A', times: [base, base + 10000, base + 20000] },   // median = base+10s → anchor
  { n: 'B', times: [base + 40000, base + 60000, base + 200000] } // median = base+60s
]);
eq(estM[0].start, 0, 'median anchor first=0');
eq(estM[1].start, 50, 'median delta 60s-10s = 50s');

// empty input → empty timeline (no throw)
eq(C.estimateTimeline([]).length, 0, 'empty reports → empty');
eq(D.timeline([]).length, 0, 'empty songs → empty');

// ============================================================================
// NEW: COMPLETENESS truth table + archived-lock + crowd→band "lift into editor"
// ============================================================================
ok(D.isComplete, 'DDSetlist.isComplete attached');
ok(D.canEdit, 'DDSetlist.canEdit attached');
ok(C.liftToEditable, 'DDSetlistCrowd.liftToEditable attached');

// ---- isComplete() truth table ----
eq(D.isComplete({ songs: [{ n: 'A' }], archived: true }), true, 'band-confirmed + archived = COMPLETE');
eq(D.isComplete({ songs: [{ n: 'A' }, { n: 'B' }], archived: false }), false, 'band songs but NOT archived = not complete');
eq(D.isComplete({ songs: [], archived: true }), false, 'crowd-only/empty + archived = NOT complete');
eq(D.isComplete({ songs: [], archived: false }), false, 'empty + not archived = NOT complete');
eq(D.isComplete({ songs: [{ _h: 1, eventLen: '2h' }], archived: true }), false, 'header sentinel only = NOT complete');
eq(D.isComplete({ songs: [{ n: 'A' }], archived: true, crowdEstimated: true }), false, 'still crowd-estimated = NOT complete even if archived');
eq(D.isComplete(null), false, 'null setlist = not complete');
eq(D.isComplete({}), false, 'no songs field = not complete');
eq(D.isBandConfirmed({ songs: [{ n: 'A' }] }), true, 'isBandConfirmed true with real song');
eq(D.isBandConfirmed({ songs: [] }), false, 'isBandConfirmed false when empty');

// ---- canEdit(): archived = LOCKED (no edit) ----
eq(D.canEdit({ songs: [{ n: 'A' }] }), true, 'unarchived → editable');
eq(D.canEdit({ songs: [{ n: 'A' }], archived: true }), false, 'archived → LOCKED (no edit)');
eq(D.canEdit({ archived: true }), false, 'archived empty → locked');
eq(D.canEdit(null), true, 'no setlist → editable (nothing to lock)');

// ---- crowd → band "lift into editor": crowd songs become editable band songs ----
var b2 = 1700000000000;
var lifted = C.liftToEditable([
  { n: 'Bertha', t: b2 + 0 },
  { n: 'Sugaree', t: b2 + 293000 },                 // +4:53 after Bertha
  { n: 'The Music Never Stopped', t: b2 + 293000 + 315000 } // +5:15 after Sugaree
]);
eq(lifted.songs.length, 3, 'lift produced 3 editable songs');
eq(lifted.songs[0].n, 'Bertha', 'lift preserves first song name');
eq(lifted.songs[0].startLabel, '00:00', 'lift carries est. start 00:00 as the starting value');
eq(lifted.songs[0].est, true, 'lifted song still flagged est: true (pre-confirm)');
eq(lifted.songs[0].lenLabel, '04:53', 'lift infers song1 LENGTH from est. gap #1');
eq(lifted.songs[1].lenLabel, '05:15', 'lift infers song2 LENGTH from est. gap #2');
eq(lifted.songs[1].startLabel, '04:53', 'lift carries est. start for song2');
eq(lifted.songs[2].lenLabel, '', 'last lifted song has no next gap → blank length for band to fill');
eq(lifted.text.split('\n')[0], 'Bertha  04:53', 'lift textarea line = "Name  m:ss" (editable band format)');
eq(lifted.text.split('\n').length, 3, 'lift text carries one line per song');
// once the band SAVES the lifted list, it reads band-confirmed → COMPLETE when archived (est. labels drop)
var confirmed = lifted.songs.map(function (s) { return { n: s.n, len: s.len }; });
eq(D.isComplete({ songs: confirmed, archived: true }), true, 'lifted → confirmed → archived = COMPLETE');
eq(C.liftToEditable([]).songs.length, 0, 'empty crowd reports → empty lift (no throw)');

console.log('ALL PASS — ' + n + ' assertions GREEN (timeline sums, break insertion, mm:ss, tease clock, crowd estimator, completeness truth table, archived-lock, crowd→band lift).');
