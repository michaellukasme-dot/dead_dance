/* dd_stcurtain.test.js — node harness for the Street-Team CURTAIN brain.
   Run:  node dd_stcurtain.test.js   (exit 0 = all green) */
'use strict';
global.window = {};
var SC = require('./dd_stcurtain.js');

var pass=0, fail=0;
function ok(name, cond){ if(cond){ pass++; } else { fail++; console.log('  ✗ '+name); } }

// ---- fixtures (real shapes: DD_MUSIKFEST rows, DD_MF_BANDS, STAGES) ----
var LINEUP = [
  { d:'2026-08-02', t:'12:00 PM', st:'Americaplatz', b:'Life After Dead', sc:'dd' },
  { d:'2026-08-02', t:'2:00 PM',  st:'Volksplatz',   b:'Rift',            sc:'dd' },
  { d:'2026-08-03', t:'6:00 PM',  st:'Steel Stage',  b:'Train',           sc:'sf' }
];
var BANDS = {
  'rift': { name:'Rift', members:[{ n:'Sean Coyne', r:'Guitar' }, { n:'Matt Agostini', r:'Bass' }] },
  'life-after-dead': { name:'Life After Dead', members:[{ n:'Rich Jeffreys', r:'Vocals' }] },
  'demo': { name:'Your Band', members:[{ n:'— your lineup —', r:'appears here' }] }
};
var STAGES = [
  { n:'Air Products Americaplatz at Levitt Pavilion', side:'S', free:1, lat:40.61479, lng:-75.36829 },
  { n:'Wind Creek Steel Stage at PNC Plaza',          side:'S', free:0, lat:40.61450, lng:-75.37147 },
  { n:'IBEW Local 375 Liederplatz',                   side:'N', free:1, lat:40.62165, lng:-75.38135 }
];

// ---- ticketUrl(act) : the canonical FREE ticket URL ----
ok('ticketUrl builds ticket.html?band=…&price=FREE',
   SC.ticketUrl('Rift')==='ticket.html?band=Rift&price=FREE');
ok('ticketUrl encodes spaces/ampersands',
   SC.ticketUrl('Life After Dead')==='ticket.html?band=Life%20After%20Dead&price=FREE');
ok('ticketUrl honors a base',
   SC.ticketUrl('Rift','https://deaddance.app/')==='https://deaddance.app/ticket.html?band=Rift&price=FREE');

// ---- buildIndex : acts + stages + member names ----
var idx = SC.buildIndex(BANDS, LINEUP);
ok('index has act rows', idx.some(function(e){return e.type==='act'&&e.label==='Rift';}));
ok('index has stage rows', idx.some(function(e){return e.type==='stage'&&e.label==='Steel Stage';}));
ok('index has member rows mapped to their act',
   idx.some(function(e){return e.type==='member'&&e.label==='Sean Coyne'&&e.act==='Rift';}));
ok('index skips placeholder member (— your lineup —)',
   !idx.some(function(e){return /your lineup/i.test(e.label);}));

// ---- search : real substring, acts first ----
ok('search finds an act by substring', SC.search('rif', idx).some(function(e){return e.act==='Rift';}));
ok('search finds an act via a MEMBER name', SC.search('coyne', idx).some(function(e){return e.act==='Rift';}));
ok('search finds a STAGE by name', SC.search('steel', idx).some(function(e){return e.type==='stage';}));
ok('empty query → no hits', SC.search('', idx).length===0);
ok('miss → empty', SC.search('zzzznothere', idx).length===0);

// ---- resolveAct : a query → the act whose ticket to share ----
ok('resolveAct(act name) → act', SC.resolveAct('Life After', idx)==='Life After Dead');
ok('resolveAct(member name) → their act', SC.resolveAct('Agostini', idx)==='Rift');
ok('resolveAct(miss) → null', SC.resolveAct('nobody', idx)===null);

// ---- stage → coords (short lineup name → long STAGES row) ----
var c = SC.stageCoords('Americaplatz', STAGES);
ok('stageCoords bridges short→long (Americaplatz)', c && Math.abs(c.lat-40.61479)<1e-4 && Math.abs(c.lng+75.36829)<1e-4);
ok('stageCoords Steel Stage → Wind Creek row', (function(){ var s=SC.stageCoords('Steel Stage',STAGES); return s && Math.abs(s.lat-40.61450)<1e-4; })());
ok('stageCoords miss → null', SC.stageCoords('Nowhereplatz', STAGES)===null);

// ---- nearestStage : pure haversine ----
var near = SC.nearestStage([40.6147,-75.3683], STAGES);   // right at Americaplatz
ok('nearestStage picks the closest', near && /Americaplatz/.test(near.stage.n) && near.km<0.1);
ok('nearestStage null with no fix', SC.nearestStage(null, STAGES)===null);

// ---- %VENUE% + the paid-door GATE (the honest one) ----
var mf = SC.venue('musikfest-2026');
ok('musikfest venue exists', !!mf && mf.name==='MusikFest 2026');
ok('MusikFest is NOT approved for paid door-verify (free fest)', SC.approvedForPaid('musikfest-2026')===false);
ok('doorUrl is null when not approved (no fake verify)', SC.doorUrl('musikfest-2026')===null);
ok('a venue with approval+slug DOES get a door link', (function(){
     var v={ paidSalesApproved:true, doorSlug:'lost-tavern-0919' };
     return SC.approvedForPaid(v)===true && SC.doorUrl(v)==='door.html?ev=lost-tavern-0919';
   })());
ok('approved flag alone (no slug) is NOT wired → false', SC.approvedForPaid({ paidSalesApproved:true, doorSlug:null })===false);

// ---- PROXIMITY-ACCEPT eligibility (free-event counterpart to paid door-verify) ----
var AMER = SC.stageCoords('Americaplatz', STAGES);   // { lat, lng }
// within radius → eligible (standing right at the stage)
var pIn = SC.proximity([AMER.lat, AMER.lng], AMER, { radiusM:100 });
ok('proximity: at the stage → eligible', pIn.ok===true && pIn.eligible===true && pIn.reason==='in-range');
ok('proximity: in-range distance is ~0 m', pIn.distanceM < 5);
// outside radius → NOT eligible + honest live distance
var FARPT = [40.6300, -75.4000];
var pOut = SC.proximity(FARPT, AMER, { radiusM:100 });
ok('proximity: far away → NOT eligible', pOut.eligible===false && pOut.reason==='too-far');
ok('proximity: far away reports a real distance (m)', pOut.distanceM > 100);
// radius boundary: the SAME point flips eligible↔not as the radius changes (honest cutoff)
var NEARISH = SC.stageCoords('Steel Stage', STAGES);   // ~280 m from Americaplatz
var pTight = SC.proximity([AMER.lat, AMER.lng], NEARISH, { radiusM:100 });
var pWide  = SC.proximity([AMER.lat, AMER.lng], NEARISH, { radiusM:500 });
ok('proximity: same distance NOT eligible at 100 m but eligible at 500 m (real cutoff)',
   pTight.eligible===false && pWide.eligible===true && pTight.distanceM===pWide.distanceM);
// idempotent: once granted, never eligible again (one accept per event)
var pGrant = SC.proximity([AMER.lat, AMER.lng], AMER, { radiusM:100, granted:true });
ok('proximity: already granted → not eligible again (idempotent)', pGrant.already===true && pGrant.eligible===false);
// honest no-GPS path — no fix means we CANNOT claim proximity (never faked)
var pNoGps = SC.proximity(null, AMER, { radiusM:100 });
ok('proximity: no GPS fix → honest not-eligible, reason no-gps', pNoGps.ok===false && pNoGps.eligible===false && pNoGps.reason==='no-gps');
var pNoCoord = SC.proximity([AMER.lat, AMER.lng], null, { radiusM:100 });
ok('proximity: no target coords → not eligible, reason no-coords', pNoCoord.ok===false && pNoCoord.reason==='no-coords');
// default radius applies when unspecified
var pDef = SC.proximity([AMER.lat, AMER.lng], AMER);
ok('proximity: default radius (100 m) → eligible at the stage', pDef.eligible===true && pDef.radiusM===100);

console.log('\n dd_stcurtain harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' ❌ FAILURES ABOVE'); process.exit(1); } else { console.log(' ✅ all green'); }
