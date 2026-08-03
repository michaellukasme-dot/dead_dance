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

// 11. guardSpine TRULY FIRES — the fix. supabase-js v2 is lazy: a bare c.rpc() never
//     sends. Prove the grant path now actually invokes rpc AND chains .then (async result).
//     We install a fake ddClient whose rpc() returns a real thenable, and confirm it fires.
(function(){
  var done=false;
  var calls=[];
  global.ddClient=function(){ return { rpc:function(name,args){ calls.push({name:name,args:args});
    return Promise.resolve({ data:[{event_id:args.event, already:false}], error:null }); } }; };
  P._reset(); P.configure({ dwellMs:1, nearM:75, onGrant:function(){}, nowActAt:nowActA });
  P.tick(AT_A, STAGES, 10);   // trips grant() → guardSpine('sf_presence_grant',...)
  ok('grant() actually calls rpc (no fire-and-forget void)', calls.length===1 && calls[0].name==='sf_presence_grant');
  ok('rpc args carry the event id', calls[0].args && typeof calls[0].args.event==='string' && calls[0].args.event.length>0);
  delete global.ddClient;
})();

// 12. accept() — the proximity-accept round trip. Returns a PROMISE reflecting the REAL
//     server result: synced ONLY on confirm; offline when no backend; error on failure.
(function(){
  var results=[];
  function run(label){
    // 12a — server confirms → synced:true
    global.ddClient=function(){ return { rpc:function(){ return Promise.resolve({ data:[{}], error:null }); } }; };
    P._reset(); P.configure({ dwellMs:1, nowActAt:nowActA });
    P.accept('EV-1', {id:'americaplatz'}).then(function(r){
      ok('accept: server confirm → synced:true', r.ok===true && r.synced===true && !r.offline && !r.error);
      // 12b — idempotent: same event again is flagged already
      P.accept('EV-1', {id:'americaplatz'}).then(function(r2){
        ok('accept: idempotent → already:true (one per event)', r2.already===true);
        delete global.ddClient;
        // 12c — no backend → honest offline (local-first), NOT a fake "synced"
        P._reset(); P.configure({ dwellMs:1, nowActAt:nowActA });
        P.accept('EV-2', {id:'americaplatz'}).then(function(r3){
          ok('accept: no backend → offline:true, synced:false (honest, not faked)', r3.offline===true && r3.synced===false);
          // 12d — server refuses (error object) → NOT synced, error surfaced
          global.ddClient=function(){ return { rpc:function(){ return Promise.resolve({ data:null, error:{message:'denied'} }); } }; };
          P._reset(); P.configure({ dwellMs:1, nowActAt:nowActA });
          P.accept('EV-3', {id:'americaplatz'}).then(function(r4){
            ok('accept: server error → synced:false + error (truthful didn\'t-verify)', r4.synced===false && !!r4.error);
            delete global.ddClient;
            finishReport();
          });
        });
      });
    });
  }
  run();
})();

function finishReport(){
console.log('\n dd_presence harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' FAILURES:\n  - '+fails.join('\n  - ')); process.exit(1); }
console.log(' ✅ all green');
}
