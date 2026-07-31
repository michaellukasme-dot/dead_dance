/* Harness for dd_cutesy.js — run: node dd_cutesy.test.js
 * Covers: set/get roundtrip, null when unset, per-side keys distinct, corner
 * normalization (SW/NE can't be swapped), invalid rejected, telemetry no-PII. */
'use strict';
var C = require('./dd_cutesy.js');
var pass=0, fail=0, fails=[];
function ok(n,c){ if(c)pass++; else {fail++; fails.push(n);} }
function eq(n,a,b){ ok(n+' ('+JSON.stringify(a)+'==='+JSON.stringify(b)+')', a===b); }

C._reset();
var N=[[40.6140,-75.3850],[40.6260,-75.3640]];
var S=[[40.6050,-75.3850],[40.6150,-75.3640]];

// 1. unset → null
eq('unset returns null', C.get('musikfest','N'), null);

// 2. set/get roundtrip
C.set('musikfest','N', N);
var g=C.get('musikfest','N');
ok('roundtrip north', g && g[0][0]===40.6140 && g[1][1]===-75.3640);

// 3. per-side distinct
C.set('musikfest','S', S);
ok('south stored separately', C.get('musikfest','S')[0][0]===40.6050);
ok('north unchanged by south write', C.get('musikfest','N')[0][0]===40.6140);

// 4. per-festival distinct
eq('different festival still null', C.get('baconfest','N'), null);

// 5. corner order normalized (pass NE first, SW second → still stored SW,NE)
C.set('musikfest','N', [[40.6260,-75.3640],[40.6140,-75.3850]]);   // swapped
var n2=C.get('musikfest','N');
ok('SW is the min corner after swap', n2[0][0]===40.6140 && n2[0][1]===-75.3850);
ok('NE is the max corner after swap', n2[1][0]===40.6260 && n2[1][1]===-75.3640);

// 6. invalid rejected
eq('invalid (short) rejected', C.set('musikfest','N', [[1,2]]), null);
eq('invalid (NaN) rejected', C.set('musikfest','N', [[NaN,2],[3,4]]), null);
ok('north survived the invalid writes', C.get('musikfest','N')[0][0]===40.6140);

// 7. telemetry: guarded + NO PII (only fest/side ids)
var captured=[];
global.ddEvent=function(name,payload){ captured.push({name:name,payload:payload}); };
C.set('musikfest','S', S);
var PII=['lat','lng','sw_lat','sw_lng','ne_lat','ne_lng','holder','email','user','device'];
var leaked=captured.some(function(e){ return Object.keys(e.payload||{}).some(function(k){ return PII.indexOf(k)>=0; }); });
ok('telemetry emitted', captured.length>0);
ok('NO coords/PII in telemetry (ids only)', !leaked);
delete global.ddEvent;

// 8. guarded no-op — set without any sink must not throw
var threw=false; try{ C._reset(); C.set('x','N',N); }catch(e){ threw=true; }
ok('no throw without backend/telemetry', !threw);

console.log('\n dd_cutesy harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' FAILURES:\n  - '+fails.join('\n  - ')); process.exit(1); }
console.log(' ✅ all green');
