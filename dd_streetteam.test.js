/* dd_streetteam.test.js — node harness for the Street-Team brain.
   Run:  node dd_streetteam.test.js   (exit 0 = all green)
   Covers WITHOUT a backend: member-id minting + stability, isMember/setMember
   round-trip, the local de-dupe window, and that join/log are HONEST (false) with
   no client. Then, with a FAKE client, proves join/log fire and return the real
   server result and that reads pass through. */
'use strict';
global.window = global;
var _ls = {};
global.localStorage = {
  getItem:function(k){ return (k in _ls) ? _ls[k] : null; },
  setItem:function(k,v){ _ls[k] = String(v); },
  removeItem:function(k){ delete _ls[k]; }
};

var ST = require('./dd_streetteam.js');

var pass=0, fail=0, fails=[];
function ok(name, cond){ if(cond){ pass++; } else { fail++; fails.push(name); console.log('  ✗ '+name); } }

// ---- member id: minting + stability + shape ----
(function(){
  var a = ST.me();
  ok('me() mints an id', typeof a === 'string' && a.length > 3);
  ok('me() id is prefixed st-', /^st-/.test(a));
  var b = ST.me();
  ok('me() is stable across calls', a === b);
  ok('me() persisted to dd.st.me', _ls['dd.st.me'] === a);
})();

// ---- isMember / setMember round-trip ----
(function(){
  ok('not a member before join', ST.isMember('musikfest-2026') === false);
  ok('setMember true returns true', ST.setMember('musikfest-2026', true) === true);
  ok('isMember true after set', ST.isMember('musikfest-2026') === true);
  ok('per-festival isolation (other fest still false)', ST.isMember('baconfest-2026') === false);
  ST.setMember('musikfest-2026', false);
  ok('setMember false clears membership', ST.isMember('musikfest-2026') === false);
})();

// ---- de-dupe window (PURE) ----
(function(){
  ST._resetDedupe();
  ok('dedupeKey combines kind+ref', ST.dedupeKey('stage','Volksplatz') === 'stage|Volksplatz');
  ok('dedupeKey null ref → empty', ST.dedupeKey('cookie', null) === 'cookie|');
  var t = 1000000;
  ok('first log allowed', ST.allowLog('stage','Volksplatz', t) === true);
  ok('immediate repeat blocked', ST.allowLog('stage','Volksplatz', t+500) === false);
  ok('repeat inside window blocked', ST.allowLog('stage','Volksplatz', t+ST.LOG_WINDOW_MS-1) === false);
  ok('after window allowed again', ST.allowLog('stage','Volksplatz', t+ST.LOG_WINDOW_MS+1) === true);
  ok('different ref not blocked', ST.allowLog('stage','Americaplatz', t+600) === true);
  ok('different kind not blocked', ST.allowLog('dwell','Volksplatz', t+600) === true);
})();

// ---- HONEST no-client behavior ----
(function(){
  ST._resetDedupe();
  return Promise.all([ ST.join('musikfest-2026'), ST.log('musikfest-2026','stage',{ref:'X'}) ])
    .then(function(res){
      ok('join() → false with no client (honest)', res[0] === false);
      ok('log() → false with no client (honest)', res[1] === false);
    })
    .then(function(){ return Promise.all([ ST.stats('musikfest-2026'), ST.leaderboard('musikfest-2026') ]); })
    .then(function(r2){
      ok('stats() → null with no client (no fake data)', r2[0] === null);
      ok('leaderboard() → null with no client (no fake data)', r2[1] === null);
    });
})()
// ---- WITH a fake client: writes actually FIRE and return the real result ----
.then(function(){
  var calls = [];
  function fakeClient(result){ return { rpc:function(name, args){ calls.push({name:name, args:args}); return Promise.resolve(result); } }; }
  function fakeThrow(){ return { rpc:function(){ return Promise.reject(new Error('network')); } }; }

  ST._resetDedupe();
  global.window.ddClient = function(){ return fakeClient({ error:null, data:{ ok:true, cookies:10 } }); };
  return ST.join('musikfest-2026').then(function(v){
    ok('join() → true on server success', v === true);
    ok('join() actually SENT sf_st_join', calls.some(function(c){ return c.name === 'sf_st_join'; }));
    ok('join() passed member id, no PII', calls[0].args.p_member === ST.me() && /^st-/.test(calls[0].args.p_member));
  })
  .then(function(){
    ST._resetDedupe(); calls.length = 0;
    return ST.log('musikfest-2026','cookie',{ref:'seed', secs:10}).then(function(v){
      ok('log() → true on server success', v === true);
      ok('log() SENT sf_st_log with kind+secs', calls[0].name === 'sf_st_log' && calls[0].args.p_kind === 'cookie' && calls[0].args.p_secs === 10);
    });
  })
  .then(function(){
    global.window.ddClient = function(){ return fakeClient({ error:{ message:'denied' } }); };
    ST._resetDedupe();
    return ST.log('musikfest-2026','stage',{ref:'Volksplatz'}).then(function(v){
      ok('log() → false when server rejects (truthful)', v === false);
    });
  })
  .then(function(){
    global.window.ddClient = function(){ return fakeThrow(); };
    ST._resetDedupe();
    return ST.join('musikfest-2026').then(function(v){
      ok('join() → false on network throw (never throws, honest)', v === false);
    });
  })
  .then(function(){
    global.window.ddClient = function(){ return fakeClient({ error:null, data:[{member:'st-x', cookies:5}] }); };
    return ST.leaderboard('musikfest-2026').then(function(rows){
      ok('leaderboard() passes server rows through', Array.isArray(rows) && rows[0].member === 'st-x');
    });
  });
})
.then(function(){
  console.log('\n dd_streetteam harness: '+pass+' passed, '+fail+' failed');
  if(fail){ console.log(' ❌ FAILURES ABOVE: '+fails.join('; ')); process.exit(1); }
  else { console.log(' ✅ all green'); }
})
.catch(function(e){ console.log(' ❌ harness threw: '+(e&&e.stack||e)); process.exit(1); });
