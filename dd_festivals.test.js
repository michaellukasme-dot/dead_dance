/* dd_festivals.test.js — node harness for the multi-festival registry.
   Run: node dd_festivals.test.js  (exit 0 = green) */
'use strict';
global.window = {};
require('./dd_countryfest.js');                 // real CountryFest seed
var F = require('./dd_festivals.js');
var CF = global.window.DD_COUNTRYFEST;

var pass=0, fail=0; function ok(n,c){ if(c){pass++;} else {fail++; console.log('  ✗ '+n);} }

// a synthetic MusikFest lineup + full STAGES (includes the 2 CountryFest stages + extras)
var MF_LINEUP = [
  {d:'2026-07-31',t:'6:00 PM',st:'Americaplatz',b:'A',sc:'sf'},
  {d:'2026-08-01',t:'7:00 PM',st:'Highmark Blue Shield Community Stage',b:'B',sc:'sf'},
  {d:'2026-08-02',t:'8:00 PM',st:'Wind Creek Steel Stage',b:'C',sc:'sf'}
];
var ALLSTAGES = [
  {n:'Americaplatz'}, {n:'Highmark Blue Shield Community Stage'},
  {n:'Air Products Americaplatz at Levitt Pavilion'}, {n:'Wind Creek Steel Stage at PNC Plaza'},
  {n:'Matchplatz at The Wooden Match'}
];

F._reset();
F.register('musikfest', { name:'MusikFest', lineup:MF_LINEUP, stages:[] });   // no stages = ALL
F.register('countryfest', { name:CF.name, lineup:CF.lineup, stages:CF.stages, dates:CF.dates });

// ---- pick: default + reject unknown ----
ok('pick() no param → musikfest',        F.pick('') === 'musikfest');
ok('pick(?fest=countryfest) → countryfest', F.pick('?x=1&fest=countryfest') === 'countryfest');
ok('pick(unknown) → musikfest (safe)',   F.pick('?fest=bogus') === 'musikfest');
ok('pick handles CASE/space',            F.pick('?fest=CountryFest') === 'countryfest');

// ---- resolve ----
var mf = F.resolve('musikfest'), cf = F.resolve('countryfest');
ok('musikfest lineup intact',            mf.lineup.length === MF_LINEUP.length);
ok('countryfest lineup = 9 sets',        cf.lineup.length === 9);
ok('countryfest dates = 2 days',         cf.dates.length === 2 && cf.dates[0] === '2026-08-21');
ok('musikfest dates auto-derived (3)',   mf.dates.length === 3);

// ---- stageFilter: the core safety ----
var mfStages = F.stageFilter(ALLSTAGES, 'musikfest');
var cfStages = F.stageFilter(ALLSTAGES, 'countryfest');
ok('MUSIKFEST → ALL stages unchanged',   mfStages.length === ALLSTAGES.length);
ok('CountryFest → only its 2 stages',    cfStages.length === 2);
ok('CountryFest stages are the right ones',
   cfStages.some(function(s){return /community stage/i.test(s.n);}) &&
   cfStages.some(function(s){return /levitt/i.test(s.n);}));
ok('unknown key → ALL (safe fallback)',  F.stageFilter(ALLSTAGES,'bogus').length === ALLSTAGES.length);
ok('stageFilter returns a COPY (no mutate)', F.stageFilter(ALLSTAGES,'musikfest') !== ALLSTAGES);

// ---- THE BIG ONE: MusikFest default is byte-identical to no-registry behavior ----
(function(){
  var resolvedLineup = F.resolve('musikfest').lineup;
  ok('MusikFest lineup === the array we registered (same ref, untouched)', resolvedLineup === MF_LINEUP);
  var stagesOut = F.stageFilter(ALLSTAGES,'musikfest');
  var sameOrder = stagesOut.every(function(s,i){ return s === ALLSTAGES[i]; });
  ok('MusikFest stages same set + order', sameOrder);
})();

// ---- active/setActive + idempotent register ----
ok('default active is musikfest', F.active() === 'musikfest');
ok('setActive(countryfest) works', F.setActive('countryfest') === 'countryfest' && F.active() === 'countryfest');
ok('setActive(unknown) keeps current', F.setActive('nope') === 'countryfest');
(function(){ var before=F.count(); F.register('countryfest',{name:'CountryFest',lineup:CF.lineup,stages:CF.stages}); ok('re-register does not duplicate', F.count() === before); })();

// ---- empty / junk safety ----
ok('register(empty key) ignored', F.register('', {}) === null);
ok('resolve(unknown) → null', F.resolve('ghost') === null);
ok('count = 2 festivals', F.count() === 2);

// ---- OWN-footprint festival (BaconFest / Allentown Fair) brings its OWN stages+coords+center ----
(function(){
  F.register('baconfest', { name:'PA Bacon Fest', ownStages:true, center:{lat:40.6917,lng:-75.2199},
    stages:[{n:'IBEW Local 102 Stage',lat:40.6896,lng:-75.2201,corner:'S 3rd & Ferry St'},
            {n:"Tito's Vodka Stage",lat:40.6918,lng:-75.2179,where:'Northampton & Larry Holmes'}],
    lineup:[{d:'2026-11-07',t:'10:00 AM',st:'IBEW Local 102 Stage',b:'X',sc:'sf'}] });
  var s = F.stagesFor(ALLSTAGES, 'baconfest');
  ok('own-festival → its OWN stages, not the host', s.length === 2 && /IBEW/.test(s[0].n));
  ok('own stages carry coords', isFinite(s[0].lat) && isFinite(s[0].lng));
  ok('own stage where ← corner fallback', /ferry/i.test(s[0].where));
  ok('center() returns festival center', F.center('baconfest') && Math.abs(F.center('baconfest').lat-40.6917)<1e-6);
  ok('own-fest does NOT leak host stages', !s.some(function(x){return /musikfest café|wind creek/i.test(x.n);}));
  // regressions after adding an own-fest:
  ok('stagesFor(musikfest) STILL all host', F.stagesFor(ALLSTAGES,'musikfest').length === ALLSTAGES.length);
  ok('stagesFor(countryfest) STILL subset(2)', F.stagesFor(ALLSTAGES,'countryfest').length === 2);
  ok('musikfest center() is null (uses host default)', F.center('musikfest') === null);
})();

console.log('\n dd_festivals harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' ❌ FAILURES'); process.exit(1); } else { console.log(' ✅ all green'); }
