/* dd_stageboss.test.js — node harness for the Festival Stage-Manager Agent.
   Run:  node dd_stageboss.test.js   (exit 0 = all green)
   Uses the real DDActs pool from acts_seed.js. */
'use strict';
var assert = require('assert');
global.window = {};
require('./acts_seed.js');
var POOL = global.window.DDActs;
var SB = require('./dd_stageboss.js');

var pass=0, fail=0;
function ok(name, cond){ if(cond){ pass++; } else { fail++; console.log('  ✗ '+name); } }

// ---- a realistic festival spec ----
var SPEC = {
  name:'Test Fest', region:{state:'CA', city:'San Francisco'},
  budget: 5000, days:['2026-08-01','2026-08-02'],
  stages:[
    { id:'main', name:'Main Stage', cap:1200, lean:['Rock','Pop','Country'], vibe:'rowdy', slotsPerDay:3 },
    { id:'jazz', name:'Jazz Tent',  cap:180,  lean:['Jazz','Piano / Standards'], vibe:'upscale', slotsPerDay:3 }
  ]
};

// ---- pure-function sanity ----
(function(){
  var loud = SB.drawIndex({size:'Band',energy:'High',genre:'Rock'}, null);
  var quiet= SB.drawIndex({size:'Solo',energy:'Chill',genre:'Classical'}, null);
  ok('draw: loud rock band > quiet solo classical', loud > quiet);
  var local = SB.drawIndex({size:'Band',energy:'High',genre:'Rock',state:'CA'}, {state:'CA'});
  var away  = SB.drawIndex({size:'Band',energy:'High',genre:'Rock',state:'NY'}, {state:'CA'});
  ok('draw: local act gets a bounded bonus', local > away && (local-away) <= 15);
  ok('draw: clamped 0..100', loud<=100 && quiet>=0);

  var st={name:'Jazz Tent',cap:180,lean:['Jazz'],vibe:'upscale'};
  var fitJazz = SB.fitScore({genre:'Jazz',energy:'Chill',size:'Trio',fit:'Upscale'}, st, {part:'evening'});
  var fitRock = SB.fitScore({genre:'Rock',energy:'High',size:'Band',fit:'Rowdy'}, st, {part:'evening'});
  ok('fit: on-lean act fits the themed stage better', fitJazz > fitRock);
  ok('fit: bounded 0..1', fitJazz<=1 && fitRock>=0);
  ok('expFill: monotonic in draw', SB.expFill(80) > SB.expFill(20));
})();

// ---- the plan ----
var R = SB.plan(SPEC, POOL);

ok('plan returns stages', R && R.stages && R.stages.length===2);
ok('BUDGET HARD CAP — never overspends', R.actSpend <= SPEC.budget);
ok('budgetLeft == budget - spend', R.budgetLeft === (R.budget - R.actSpend));

// no double-booking across overlapping (same day+start) slots — REAL acts only
// (Karaoke is a parallel house format, legitimately running on many stages at once)
(function(){
  var seen={}, dbl=false;
  R.stages.forEach(function(s){ s.slots.forEach(function(sl){ if(!sl.act || sl.filler) return;
    var key = sl.act.name+'|'+sl.day+'|'+sl.start; if(seen[key]) dbl=true; seen[key]=1; }); });
  ok('NO DOUBLE-BOOK at the same time', !dbl);
})();

// VARIETY: no REAL act booked more than maxPerAct (default 1) times (Karaoke is exempt — it's the filler)
(function(){
  var cnt={}, over=false; R.stages.forEach(function(s){ s.slots.forEach(function(sl){ if(sl.act && !sl.filler){ cnt[sl.act.name]=(cnt[sl.act.name]||0)+1; if(cnt[sl.act.name]>1) over=true; } }); });
  ok('VARIETY — no act booked more than once by default', !over);
})();
(function(){
  var t=SB.plan(SPEC, POOL, {maxPerAct:2}); var cnt={}, mx=0;
  t.stages.forEach(function(s){ s.slots.forEach(function(sl){ if(sl.act && !sl.filler){ cnt[sl.act.name]=(cnt[sl.act.name]||0)+1; if(cnt[sl.act.name]>mx)mx=cnt[sl.act.name]; } }); });
  ok('maxPerAct:2 respected (allows up to twice)', mx<=2);
})();

// every filled slot's act fee is within budget individually and summed
(function(){
  var sum=0, allPos=true; R.stages.forEach(function(s){ s.slots.forEach(function(sl){ if(sl.act){ sum+=sl.fee; if(sl.fee<0)allPos=false; } }); });
  ok('sum of booked fees == actSpend', sum === R.actSpend);
  ok('no negative fees', allPos);
})();

// every booked act carries a "why" (explainability)
(function(){
  var missing=0; R.stages.forEach(function(s){ s.slots.forEach(function(sl){ if(sl.act && !sl.why) missing++; }); });
  ok('every booked act has a why-line', missing===0);
})();

// P&L identity: netToHouse === gate + bar - actCost - house
ok('P&L identity holds', R.pnl.netToHouse === (R.pnl.gate + R.pnl.bar - R.pnl.actCost - R.pnl.house));

// pricing: mgmt fee == perStageDay * stageDays
ok('pricing: mgmtFee == perStageDay*stageDays', R.price.mgmtFee === R.price.perStageDay * R.price.stageDays);
ok('pricing: total == mgmt + gateShare', R.price.total === (R.price.mgmtFee + R.price.gateShare));
ok('net after StageFill == houseNet - fee', R.netAfterStageFill === (R.pnl.netToHouse - R.price.total));

// determinism
(function(){
  var A=JSON.stringify(SB.plan(SPEC,POOL).stages), B=JSON.stringify(SB.plan(SPEC,POOL).stages);
  ok('deterministic — same inputs, same plan', A===B);
})();

// budget=0 → no PAID act booked, no crash (karaoke off = pure paid booker)
(function(){
  var z=SB.plan(Object.assign({},SPEC,{budget:0}), POOL, {karaoke:false});
  ok('zero budget → zero spend, zero booked', z.actSpend===0 && z.slotsFilled===0);
})();

// empty pool → no PAID bookings, still returns P&L (karaoke off)
(function(){
  var e=SB.plan(SPEC, [], {karaoke:false});
  ok('empty pool → 0 filled, still returns P&L', e.slotsFilled===0 && e.pnl && e.pnl.netToHouse!=null);
})();

// ---- KARAOKE — the house budget-act that fills every open slot ----
(function(){
  // default ON: an empty pool still yields a FULL festival of karaoke, at $0 spend
  var k=SB.plan(SPEC, []);
  ok('KARAOKE default ON → fills all open slots on empty pool', k.slotsFilled===k.slotsTotal);
  ok('KARAOKE is free → actSpend stays 0', k.actSpend===0);
  var allKar=true, claimed=true, filler=true;
  k.stages.forEach(function(s){ s.slots.forEach(function(sl){ if(!sl.act){allKar=false;return;}
    if(!sl.act.karaoke) allKar=false; if(sl.act.claimedBy!=='Michael Lukas') claimed=false; if(!sl.filler) filler=false; }); });
  ok('KARAOKE slots flagged karaoke + filler', allKar && filler);
  ok('KARAOKE claimed by the house (Michael)', claimed);
  // karaoke:false → open slots stay dark (pure paid booker)
  var off=SB.plan(SPEC, [], {karaoke:false});
  ok('karaoke:false → open slots stay empty', off.slotsFilled===0);
  // real acts get first pick; karaoke only mops up the leftovers
  var mix=SB.plan(SPEC, POOL);
  var real=0, kar=0; mix.stages.forEach(function(s){ s.slots.forEach(function(sl){ if(sl.act){ sl.filler?kar++:real++; } }); });
  ok('KARAOKE fills only leftover slots (real acts first)', real>0 && (real+kar)===mix.slotsTotal);
  // a host-fee karaoke still honors the HARD budget cap
  var hf=SB.plan(Object.assign({},SPEC,{budget:200}), [], {karaokeFee:150});
  ok('host-fee karaoke never overspends budget', hf.actSpend<=200);
})();

// gate-share pricing variant
(function(){
  var g=SB.plan(SPEC, POOL, { gateSharePct:3 });
  ok('gate-share adds to fee', g.price.gateShare === Math.round(g.pnl.gate*0.03) && g.price.total===g.price.mgmtFee+g.price.gateShare);
})();

// confirm is guarded + returns a stable id
(function(){
  var c=SB.confirm(R, 'org-test');
  ok('confirm ok + booked count', c.ok===true && c.booked===R.slotsFilled);
  var c2=SB.confirm(R, 'org-test');
  ok('confirm id stable for same plan', c.plan_id===c2.plan_id);
})();

// FREE festival honesty: cover=0 → no gate revenue (only bar), net must drop vs ticketed
(function(){
  var free=SB.plan(Object.assign({},SPEC,{cover:0}), POOL);
  var tick=SB.plan(Object.assign({},SPEC,{cover:20}), POOL);
  ok('free festival (cover 0) → gate is $0', free.pnl.gate === 0);
  ok('free festival net < ticketed net (honest economics)', free.pnl.netToHouse < tick.pnl.netToHouse);
  ok('ticketed festival → gate > 0', tick.pnl.gate > 0);
})();

// PER-STAGE ticketing: a FREE festival with one PAID area (MusikFest: 20 free platzes + Wind Creek)
(function(){
  var mf=SB.plan({ name:'MusikFest', region:{state:'PA'}, budget:8000, days:['Day 1','Day 2'],
    stages:[ { id:'platz', name:'Americaplatz', cap:800, cover:0, vibe:'any' },
             { id:'steel', name:'Wind Creek Steel Stage', cap:6500, cover:59, vibe:'rowdy' } ] }, POOL);
  var platz = mf.stages.filter(function(s){return s.id==='platz';})[0];
  var steel = mf.stages.filter(function(s){return s.id==='steel';})[0];
  ok('free platz → gate $0, not ticketed', platz.gate===0 && platz.ticketed===false);
  ok('paid Wind Creek → gate > 0, ticketed', steel.gate>0 && steel.ticketed===true && steel.cover===59);
  ok('festival mixes free + paid in one plan', mf.pnl.gate === (platz.gate+steel.gate));
})();

console.log('\n dd_stageboss harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' ❌ FAILURES ABOVE'); process.exit(1); } else { console.log(' ✅ all green'); }
