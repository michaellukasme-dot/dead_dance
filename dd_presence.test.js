/* Harness for dd_presence.js — run: node dd_presence.test.js
 * Covers: dwell accumulation, threshold fire, no-act gate, idempotency,
 * reset-on-leaving, dtMs clamp (background-resume guard), distance gate,
 * telemetry (NO PII), guarded no-op. Exit 0 = all green. */
'use strict';
var P = require('./dd_presence.js');
var pass=0, fail=0, fails=[];
function ok(n,c){ if(c)pass++; else {fail++; fails.push(n);} }
function eq(n,a,b){ ok(n+' ('+JSON.stringify(a)+'==='+JSON.stringify(b)+')', a===b); }

// two stages ~300m apart
var STAGES=[{id:'americaplatz',name:'Americaplatz',lat:40.6142,lng:-75.3675},
            {id:'volksplatz',  name:'Volksplatz',  lat:40.6169,lng:-75.3701}];
var AT_A={lat:40.6142,lng:-75.3675};   // standing at Americaplatz
var FAR ={lat:40.6300,lng:-75.4000};   // nowhere near

var grants=[];
function nowActA(stage){ return stage.id==='americaplatz' ? {event:'DSO-0808', name:'Dark Star Orchestra'} : null; }

P._reset();
P.configure({ dwellMs:8*60*1000, nearM:75, onGrant:function(t){ grants.push(t); }, nowActAt:nowActA });

// 1. distance gate — far away accrues nothing
P.tick(FAR, STAGES, 60000);
eq('far from stages → no dwell', P.dwellMs('americaplatz'), 0);

// 2. dwell accumulates while at the stage (7 min, not yet threshold)
for(var i=0;i<7;i++) P.tick(AT_A, STAGES, 60000);
eq('7 min dwell accrued', P.dwellMs('americaplatz'), 7*60000);
ok('no ticket yet (under threshold)', grants.length===0);

// 3. crossing the 8-min threshold WITH an act playing → grant
var r = P.tick(AT_A, STAGES, 60000);   // now 8 min
ok('grant fired at threshold', r && r.ok && r.already===false);
eq('granted event id', r.event, 'DSO-0808');
eq('onGrant delivered a ticket', grants.length, 1);
eq('ticket carries the act', grants[0].act, 'Dark Star Orchestra');
eq('ticket kind = presence', grants[0].kind, 'presence');

// 4. idempotent — staying longer does not grant again
var r2 = P.tick(AT_A, STAGES, 60000);
ok('second cross is idempotent', r2 && r2.already===true);
eq('still only one ticket', grants.length, 1);

// 5. no-act gate: dwell at a stage with NO act playing → NO grant
P._reset(); grants=[];
P.configure({ dwellMs:60000, nearM:75, onGrant:function(t){grants.push(t);}, nowActAt:nowActA });
var AT_B={lat:40.6169,lng:-75.3701};   // Volksplatz — nowActA returns null there
for(var j=0;j<3;j++) P.tick(AT_B, STAGES, 60000);
ok('dwell met at Volksplatz', P.dwellMs('volksplatz')>=60000);
eq('no act playing → no ticket', grants.length, 0);

// 6. reset on leaving — walk-through does not accumulate across a gap
P._reset(); grants=[];
P.configure({ dwellMs:120000, nearM:75, onGrant:function(t){grants.push(t);}, nowActAt:nowActA });
P.tick(AT_A, STAGES, 60000);      // 1 min at A
P.tick(FAR, STAGES, 60000);       // left → reset
eq('leaving resets dwell', P.dwellMs('americaplatz'), 0);
P.tick(AT_A, STAGES, 60000);      // back, 1 min again — still under 2-min threshold
eq('no false grant after a gap', grants.length, 0);

// 7. dtMs clamp — a backgrounded tab resuming with a huge dt can't teleport past threshold
P._reset(); grants=[];
P.configure({ dwellMs:8*60*1000, nearM:75, maxTickMs:120000, onGrant:function(t){grants.push(t);}, nowActAt:nowActA });
P.tick(AT_A, STAGES, 60*60*1000); // "1 hour" resume — must be clamped to 2 min
eq('huge dt clamped to maxTickMs', P.dwellMs('americaplatz'), 120000);
eq('no instant grant from a resume', grants.length, 0);

// 8. telemetry: guarded + NO PII
var captured=[];
global.ddEvent=function(name,payload){ captured.push({name:name,payload:payload}); };
P._reset();
P.configure({ dwellMs:1, nearM:75, onGrant:function(){}, nowActAt:nowActA });
P.tick(AT_A, STAGES, 10);   // trip a grant immediately
var PII=['holder','email','name','device','claimant','phone','act'];
var leaked=captured.some(function(e){ return Object.keys(e.payload||{}).some(function(k){ return PII.indexOf(k)>=0; }); });
ok('telemetry emitted', captured.length>0);
ok('NO PII / no act name in telemetry (ids only)', !leaked);
delete global.ddEvent;

// 9. guarded no-op — grant with no telemetry sink must not throw
var threw=false; try{ P._reset(); P.configure({dwellMs:1,nowActAt:nowActA,onGrant:function(){}}); P.tick(AT_A,STAGES,10); }catch(e){ threw=true; }
ok('no throw without telemetry sink', !threw);

// 10. Claudine fix — a short GPS jitter must NOT wipe accumulated dwell
P._reset(); grants=[];
P.configure({ dwellMs:8*60*1000, nearM:75, onGrant:function(t){grants.push(t);}, nowActAt:nowActA });
for(var q=0;q<7;q++) P.tick(AT_A, STAGES, 60000);   // 7 min at the stage
P.tick(FAR, STAGES, 3000);                          // 3-second GPS blip
ok('jitter only decays a little (not wiped)', P.dwellMs('americaplatz') >= 7*60000-4000);
P.tick(AT_A, STAGES, 60000);
P.tick(AT_A, STAGES, 60000);                         // back → crosses threshold
ok('dwell survived the jitter → ticket still granted', grants.length===1);

console.log('\n dd_presence harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' FAILURES:\n  - '+fails.join('\n  - ')); process.exit(1); }
console.log(' ✅ all green');
