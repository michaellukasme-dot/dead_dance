/* dd_geo_analytics.test.js — node harness for the Phase-2 geo-analytics brain.
   Run: node dd_geo_analytics.test.js   (expects "ALL GREEN").
   Covers: geofence hit/miss (circle + polygon), time-bucketing, the ≥20
   cohort-suppression floor (19 suppress / 20 pass), dwell math, O/D flow-matrix
   formatting, defense-in-depth normalize, guarded fetch honesty (mock client),
   and the labeled-synthetic demo contract the House Law requires. */
'use strict';
var G = require('./dd_geo_analytics.js');
var pass=0, fail=0;
function ok(name, cond){ if(cond){ pass++; console.log('  ok  '+name); } else { fail++; console.log(' FAIL '+name); } }
function eq(name, a, b){ ok(name+'  ('+JSON.stringify(a)+' === '+JSON.stringify(b)+')', a===b); }

// ---- constants ----
eq('K_PRESENCE floor is 20', G.K_PRESENCE, 20);

// ---- geo math: haversine ----
ok('haversine same point = 0', G.haversineM(40.6,-75.4,40.6,-75.4) === 0);
ok('haversine ~111m per 0.001 lat', Math.abs(G.haversineM(40.0,-75.0,40.001,-75.0) - 111) < 3);
ok('haversine null-safe', G.haversineM(null,1,2,3) === null);

// ---- geofence: circle hit/miss ----
var stage = { center_lat:40.6000, center_lon:-75.4000, radius_m:50, polygon:[] };
ok('circle HIT: point 10m away is inside', G.inFence(40.60005,-75.4000, stage) === true);
ok('circle MISS: point ~200m away is outside', G.inFence(40.6018,-75.4000, stage) === false);
ok('pointInCircle direct hit', G.pointInCircle(40.6000,-75.4000, stage) === true);

// ---- geofence: polygon ray-cast hit/miss ----
var zone = { polygon:[[40.60,-75.40],[40.60,-75.39],[40.61,-75.39],[40.61,-75.40]] };
ok('polygon HIT: interior point inside', G.pointInPolygon(40.605,-75.395, zone.polygon) === true);
ok('polygon MISS: exterior point outside', G.pointInPolygon(40.62,-75.395, zone.polygon) === false);
ok('inFence prefers polygon when ring present', G.inFence(40.605,-75.395, zone) === true);

// ---- time bucketing ----
var base = Date.UTC(2026,7,4,17,7,30); // 17:07:30
ok('timeBucket 15m floors to :00', new Date(G.timeBucket(base,15)).getUTCMinutes() === 0);
var base2 = Date.UTC(2026,7,4,17,22,0);
ok('timeBucket 15m floors 17:22 to 17:15', new Date(G.timeBucket(base2,15)).getUTCMinutes() === 15);
ok('bucketISO is ISO string', /T.*Z$/.test(G.bucketISO(base,30)));

// ---- SUPPRESSION FLOOR: 19 suppresses, 20 passes ----
ok('passesFloor 19 → false (suppressed)', G.passesFloor(19) === false);
ok('passesFloor 20 → true (published)', G.passesFloor(20) === true);
var supp = G.suppressRows([
  { zone:'A', cohort_n:19 },   // suppress
  { zone:'B', cohort_n:20 },   // pass
  { zone:'C', cohort_n:1 },    // suppress (cohort of one!)
  { zone:'D', cohort_n:500 }   // pass
]);
eq('suppressRows keeps only >=20', supp.rows.length, 2);
eq('suppressRows counts withheld', supp.suppressed, 2);
ok('suppressRows never emits a sub-floor row', supp.rows.every(function(r){ return r.cohort_n>=20; }));
ok('cohort of 1 is DROPPED (no re-identification)', !supp.rows.some(function(r){ return r.zone==='C'; }));
var suppH = G.suppressRows([{stage:'S',headcount:19},{stage:'T',headcount:20}], { field:'headcount' });
eq('suppressRows honors custom field (headcount)', suppH.rows.length, 1);

// ---- dwell math ----
eq('dwellMinutes single point = 0', G.dwellMinutes([{t:base}]), 0);
var pts = [{t:base},{t:base+5*60000},{t:base+20*60000}];
eq('dwellMinutes = (last-first)/60000', G.dwellMinutes(pts), 20);
eq('median odd', G.median([10,30,20]), 20);
eq('median even', G.median([10,20,30,40]), 25);
var cd = G.cohortDwell([[{t:base},{t:base+10*60000}], [{t:base},{t:base+30*60000}], [{t:base},{t:base+20*60000}]]);
eq('cohortDwell cohort_n counts tokens', cd.cohort_n, 3);
eq('cohortDwell median minutes', cd.median_dwell_min, 20);

// ---- O/D flow-matrix formatting ----
var fm = G.buildFlowMatrix([
  { origin:'Gate', dest:'Main', cohort_n:120 },
  { origin:'Main', dest:'River', cohort_n:80 },
  { origin:'Main', dest:'River', cohort_n:20 }  // same cell → sums
]);
ok('flow matrix nodes sorted unique', JSON.stringify(fm.nodes)===JSON.stringify(['Gate','Main','River']));
eq('flow matrix cell Gate>Main', fm.cells['Gate>Main'], 120);
eq('flow matrix sums duplicate O/D', fm.cells['Main>River'], 100);
ok('flow matrix is dense NxN', fm.matrix.length===3 && fm.matrix[0].length===3);

// ---- normalize: defense-in-depth (drops a sub-floor row even if server slipped) ----
var norm = G.normalizeMetric({ ok:true, metric:'flow', coverage:'opt-in-sample', threshold:20,
  suppressed_rows:1, rows:[ {origin:'A',dest:'B',cohort_n:50}, {origin:'C',dest:'D',cohort_n:5} ] });
eq('normalize drops the leaked sub-floor row', norm.rows.length, 1);
eq('normalize adds its own drop to suppressedRows', norm.suppressedRows, 2);
ok('normalize marks not-demo', norm.isDemo === false);
ok('normalize keeps coverage opt-in-sample', norm.coverage === 'opt-in-sample');

// ---- guarded fetch: OFFLINE (no client) → 📴, never throws, never fabricates ----
(function(){
  var got=null; G.fetchGeoMetric('dd_geo_flow', { p_venue:'x' }, function(r){ got=r; }); // no client
  ok('fetch offline → 📴 status', got && got.status===G.STATUS.OFFLINE);
  ok('fetch offline → empty rows (no fabrication)', got && got.rows.length===0 && got.ok===false);
})();

// ---- guarded fetch: LIVE mock returns cohort-suppressed rows ----
function mockClient(byName){ return { rpc:function(name){ return Promise.resolve({ data: byName[name]!==undefined?byName[name]:null, error:null }); } }; }
function mockErr(){ return { rpc:function(){ return Promise.resolve({ data:null, error:{ message:'boom' } }); } }; }
function mockThrow(){ return { rpc:function(){ return Promise.reject(new Error('network')); } }; }

var liveClient = mockClient({ 'dd_geo_dwell':{ ok:true, metric:'dwell', coverage:'opt-in-sample', threshold:20,
  suppressed_rows:1, rows:[ {zone:'Beer Garden', window_start:'2026-08-04T17:00:00Z', median_dwell_min:24.5, cohort_n:220} ] } });
G.fetchGeoMetric('dd_geo_dwell', { p_venue:'v' }, function(r){
  ok('fetch live → ✅ status', r.status===G.STATUS.LIVE);
  ok('fetch live → parsed suppressed rows', r.rows.length===1 && r.rows[0].zone==='Beer Garden');
  ok('fetch live → not demo', r.isDemo===false);

  // error path → ⚠️, no rows
  G.fetchGeoMetric('dd_geo_dwell', { p_venue:'v' }, function(e){
    ok('fetch server-error → ⚠️, no rows', e.status===G.STATUS.ERR && e.rows.length===0);
    // reject path → ⚠️
    G.fetchGeoMetric('dd_geo_dwell', { p_venue:'v' }, function(t){
      ok('fetch reject → ⚠️, no rows', t.status===G.STATUS.ERR && t.rows.length===0);
      demoTests();
    }, mockThrow());
  }, mockErr());
}, liveClient);

// ---- DEMO dataset: deterministic, labeled synthetic, self-suppressing ----
function demoTests(){
  var d1 = G.buildDemoDataset('musikfest-2026');
  var d2 = G.buildDemoDataset('musikfest-2026');
  ok('demo deterministic per slug', JSON.stringify(d1)===JSON.stringify(d2));
  ok('demo differs by slug', JSON.stringify(d1)!==JSON.stringify(G.buildDemoDataset('baconfest')));
  ok('demo carries isDemo:true + label', d1.isDemo===true && /DEMO DATA/.test(d1.demoLabel));
  ['attendance','dwell','flow','attribution','heat'].forEach(function(k){
    ok('demo.'+k+' every published cohort >= 20', d1[k].rows.every(function(r){
      var n = (k==='attendance') ? r.headcount : r.cohort_n; return (+n||0) >= 20;
    }));
    ok('demo.'+k+' labeled isDemo:true', d1[k].isDemo===true);
  });
  ok('demo intentionally suppressed some cohorts (proves the floor visibly)',
     (d1.attendance.suppressedRows + d1.dwell.suppressedRows + d1.flow.suppressedRows + d1.attribution.suppressedRows + d1.heat.suppressedRows) > 0);
  ok('demo heat has relative density 0..1', d1.heat.rows.every(function(r){ return r.density>=0 && r.density<=1; }));
  ok('demo never claims coverage:full', d1.attendance.coverage==='opt-in-sample');
  finish();
}

function finish(){
  console.log('\n'+(fail===0?'ALL GREEN':'RED')+' — '+pass+' passed, '+fail+' failed  ('+(pass+fail)+' assertions)');
  process.exit(fail===0?0:1);
}
