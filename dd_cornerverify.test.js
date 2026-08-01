/* dd_cornerverify.test.js — node harness for the 4-corner GPS verify routine.
   Run:  node dd_cornerverify.test.js   (exit 0 = all green) */
'use strict';
global.window = {};
var V = require('./dd_cornerverify.js');
var pass=0, fail=0;
function ok(n,c){ if(c){pass++;} else {fail++; console.log('  ✗ '+n);} }

// Michael's REAL Matchplatz corners (2026-07-31) — centroid should be ~40.61661179,-75.38226258, spread ~5.9m
var MP = [
  {corner:'NW',lat:40.61660440466464, lng:-75.38229677657193, dwellMs:11*60000},
  {corner:'SW',lat:40.616588116515715,lng:-75.3822672722731,  dwellMs:11*60000},
  {corner:'NE',lat:40.61661763878273, lng:-75.38228470663151, dwellMs:11*60000},
  {corner:'SE',lat:40.616636980950595,lng:-75.38220155815294, dwellMs:11*60000}
];

// ---- pure compute ----
(function(){
  var c=V.compute(MP);
  ok('4 corners counted', c.corners===4);
  ok('centroid ~ Matchplatz center', Math.abs(c.centroid.lat-40.61661179)<1e-4 && Math.abs(c.centroid.lng+75.38226258)<1e-4);
  ok('spread is small (tight box ~6m)', c.spreadM>0 && c.spreadM<12);
  ok('quality tight', c.quality==='tight');
  ok('no outlier dropped on clean data', c.outlierDropped===false);
})();

// ---- outlier rejection: one corner 150m off ----
(function(){
  var bad = MP.slice(0,3).concat([{corner:'SE',lat:40.6180,lng:-75.3840,dwellMs:11*60000}]);
  var c=V.compute(bad);
  ok('outlier dropped', c.outlierDropped===true);
  ok('outlier drop tightens spread', c.spreadM < 60);
  ok('used only 3 after drop', c.used===3);
})();

// ---- 3-corner quorum still verifies (default minCorners=3) ----
(function(){
  var c=V.compute(MP.slice(0,3));
  ok('3 corners → centroid computed', c.centroid!=null && c.corners===3);
})();

// ---- empty / bad ----
ok('empty readings → none', V.compute([]).quality==='none');
ok('bad coords filtered', V.compute([{lat:'x',lng:null}]).corners===0);

// ---- session flow: submit → status → finalize + notify ----
(function(){
  V.reset(); var notified=null;
  V.configure({ onComplete:function(r){ notified=r; } });
  V.open('stage:main');
  ok('open → 0 corners', V.status('stage:main').corners===0);
  var badsub = V.submit('stage:main','NW','oops',null,11*60000);
  ok('bad gps submit rejected', badsub.ok===false);
  MP.forEach(function(m){ V.submit('stage:main', m.corner, m.lat, m.lng, m.dwellMs, 'crew1'); });
  var st=V.status('stage:main');
  ok('4 corners in → complete', st.complete===true && st.corners===4);
  ok('dwell met (11 min each)', st.dwellMet===true);
  var fin=V.finalize('stage:main');
  ok('finalize ok + centroid returned', fin.ok===true && fin.centroid && fin.centroid.lat>40);
  ok('onComplete fired VERIFICATION COMPLETE', notified && notified.pin==='stage:main' && notified.centroid!=null);
})();

// ---- resubmit a corner updates (no double count) ----
(function(){
  V.reset(); V.configure({onComplete:null});
  V.submit('p','A',40.6,-75.3,60000); V.submit('p','A',40.61,-75.31,60000);
  ok('resubmit same corner → still 1 reading', V.status('p').corners===1);
})();

// ---- finalize before quorum fails cleanly ----
(function(){
  V.reset();
  V.submit('q','A',40.6,-75.3, 60000); V.submit('q','B',40.6001,-75.3001, 60000);  // only 2, need 3
  var f=V.finalize('q');
  ok('finalize <3 corners → ok:false', f.ok===false);
})();

// ---- dwell gate: quick fixes verify coord but flag low confidence ----
(function(){
  V.reset();
  ['A','B','C'].forEach(function(c,i){ V.submit('r',c,40.6+i*1e-5,-75.3+i*1e-5, 30*1000); }); // 30s each
  var st=V.status('r');
  ok('quorum met with quick fixes', st.complete===true);
  ok('dwell NOT met flagged', st.dwellMet===false);
})();

console.log('\n dd_cornerverify harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' ❌ FAILURES ABOVE'); process.exit(1); } else { console.log(' ✅ all green'); }
