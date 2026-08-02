/* dd_recurring.test.js — node harness for the recurring-event container.
   Run:  node dd_recurring.test.js   (exit 0 = all green) */
'use strict';
global.window = {};
var R = require('./dd_recurring.js');

var pass=0, fail=0;
function ok(name, cond){ if(cond){ pass++; } else { fail++; console.log('  ✗ '+name); } }
function dow(iso){ return new Date(iso+'T00:00:00Z').getUTCDay(); }

// ---- WEEKLY — Joe's Tuesday Karaoke ----
(function(){
  var joes={ venue:"Joe's Bar", city:'Bethlehem', cadence:'weekly', weekday:'tue', kind:'karaoke', title:'Karaoke Night' };
  var occ=R.occurrences(joes, '2026-08-03', 4);
  ok('weekly → 4 instances', occ.length===4);
  ok('weekly → every instance is a Tuesday', occ.every(function(o){ return dow(o.date)===2; }));
  ok('weekly → instances are 7 days apart', occ[1].date===addDays(occ[0].date,7) && occ[3].date===addDays(occ[0].date,21));
  ok('weekly → stable eventId = series|date', occ[0].eventId===occ[0].seriesId+'|'+occ[0].date);
  ok('weekly → each instance carries a ticket + roster + winners key', !!occ[0].ticket && /^dd\.roster\|/.test(occ[0].rosterKey) && /^dd\.winners\|/.test(occ[0].winnersKey));
})();

// ---- ANNUAL — MusikFest (and every one of the 800) ----
(function(){
  var mf={ title:'MusikFest', city:'Bethlehem', cadence:'annual', anchor:'08-07', days:10, kind:'festival' };
  var after=R.occurrences(mf, '2026-09-01', 3);      // Sept 1 is past Aug 7 → next edition is 2027
  ok('annual → first edition rolls to next year when past the anchor', after[0].date==='2027-08-07');
  ok('annual → editions are one year apart', after[1].date==='2028-08-07' && after[2].date==='2029-08-07');
  ok('annual → multi-day span sets endDate (+9)', after[0].endDate==='2027-08-16');
  var before=R.occurrences(mf, '2026-01-01', 1);     // Jan 1 is before Aug 7 → this year's edition
  ok('annual → uses THIS year when before the anchor', before[0].date==='2026-08-07');
  ok('annual → the 800 are annual series too (same machinery)', R.next({title:'PA Bacon Fest',cadence:'annual',anchor:'11-07'},'2026-08-02')==='2026-11-07');
})();

// ---- MONTHLY — a monthly market / trivia night ----
(function(){
  var m={ venue:'The Public Market', cadence:'monthly', dayOfMonth:15, kind:'trivia', title:'Trivia Night' };
  var occ=R.occurrences(m, '2026-08-20', 3);          // past the 15th → next is Sept 15
  ok('monthly → rolls to next month when past the day', occ[0].date==='2026-09-15');
  ok('monthly → one month apart', occ[1].date==='2026-10-15' && occ[2].date==='2026-11-15');
})();

// ---- ticket URL + pricing ----
(function(){
  var free=R.occurrences({ venue:"Joe's", cadence:'weekly', weekday:'tue', title:'Karaoke Night' }, '2026-08-03', 1)[0];
  ok('free night → ticket price FREE', /price=FREE/.test(free.ticket) && /band=Karaoke/.test(free.ticket));
  var paid=R.occurrences({ venue:'Club X', cadence:'weekly', weekday:'fri', title:'Live Band', cover:10 }, '2026-08-03', 1)[0];
  ok('cover>0 → ticket price shows $', /price=%2410/.test(paid.ticket));
})();

// ---- determinism + guards ----
(function(){
  var spec={ venue:"Joe's", cadence:'weekly', weekday:'tue' };
  ok('deterministic — same inputs, same instances', JSON.stringify(R.occurrences(spec,'2026-08-03',4))===JSON.stringify(R.occurrences(spec,'2026-08-03',4)));
  ok('count 0 → []', R.occurrences(spec,'2026-08-03',0).length===0);
  ok('guarded save no-ops without a client', R.save(spec)===false);
  ok('bad cadence falls back to weekly', R.norm({cadence:'nonsense'}).cadence==='weekly');
})();

function addDays(iso,k){ var d=new Date(iso+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+k); return d.toISOString().slice(0,10); }

console.log('\n dd_recurring harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' ❌ FAILURES ABOVE'); process.exit(1); } else { console.log(' ✅ all green'); }
