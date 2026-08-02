/* dd_datamodule.test.js — node harness for the Data Module brain.
   Run:  node dd_datamodule.test.js   (exit 0 = all green) */
'use strict';
global.window = {};
var DM = require('./dd_datamodule.js');

var pass=0, fail=0;
function ok(name, cond){ if(cond){ pass++; } else { fail++; console.log('  ✗ '+name); } }

// tiers
ok('four tiers, in order', JSON.stringify(DM.ORDER)===JSON.stringify(['less','more','most','city']));
ok('LESS is free', DM.tier('less').price===0 && /free/i.test(DM.priceLabel('less')));
ok('MORE priced', DM.tier('more').price===3500 && DM.tier('more').yr===6000);
ok('MOST is the enterprise floor', DM.tier('most').price===18000);
ok('CITY is the comprehensive umbrella', DM.tier('city').price===24000 && /farmers market/i.test(DM.tier('city').includes.join(' ').toLowerCase()) || /farmers market/i.test(JSON.stringify(DM.tier('city')).toLowerCase()));
ok('unknown tier → null', DM.tier('zzz')===null);
ok('priceLabel formats with $', /\$3,500/.test(DM.priceLabel('more')));

// locked teasers
ok('four locked teaser panels', DM.locked().length===4 && DM.locked().every(function(p){ return p.title && p.hint; }));

// quote recommender
ok('city scope → CITY', DM.quote({city:true}).tier==='city');
ok('multi-footprint → CITY', DM.quote({multiFootprint:true}).tier==='city');
ok('api/feed → MOST', DM.quote({api:true}).tier==='most' && DM.quote({feed:true}).tier==='most');
ok('single event dashboard → MORE (per event)', DM.quote({events:1}).tier==='more' && DM.quote({events:1}).price===3500);
ok('recurring event → MORE (annual)', DM.quote({events:1,recurring:true}).price===6000);
ok('nothing → LESS (free hook)', DM.quote({}).tier==='less' && DM.quote({}).price===0);

// TRUTHFUL lead capture (post silent-drop fix).
// The synchronous return is only a RECEIPT — captured:false = NOT yet confirmed. With NO client the RPC cannot
// reach the server, so the message must be HONEST (no false invoice promise) and cb must fire with null (offline).
(function(){
  var cbStatus='__none__', cbExtra=null;
  var r=DM.requestUnlock({tier:'more', email:'jared@example.org', festival:'PA Bacon Fest'},
    function(status, err, extra){ cbStatus=status; cbExtra=extra; });
  ok('requestUnlock ok, NOT captured without a client', r.ok===true && r.captured===false);
  ok('no client → HONEST offline message (no false invoice/"noted" promise)',
     /(reach|retry|email)/i.test(r.message) && !/invoice/i.test(r.message));
  ok('no client → cb reports null (offline), never a fake success', cbStatus===null);
  var f=DM.requestUnlock({tier:'less'});
  ok('free tier → "you already have this" message, captured:false', /free report/i.test(f.message) && f.captured===false);
  ok('unknown tier → error', DM.requestUnlock({tier:'nope'}).ok===false);
})();

// determinism
ok('deterministic quote', JSON.stringify(DM.quote({city:true}))===JSON.stringify(DM.quote({city:true})));

// SUCCESS/REJECT PATHS via a fake client — the invoice line appears ONLY on a real server-confirmed capture.
function fakeClient(result){ return { rpc:function(){ return Promise.resolve(result); } }; }
function fakeThrow(){ return { rpc:function(){ return Promise.reject(new Error('network')); } }; }
function run(client){ return new Promise(function(res){ global.window.ddClient=function(){ return client; };
  DM.requestUnlock({tier:'more', email:'x@y.z'}, function(status, err, extra){ res({status:status, extra:extra}); }); }); }

Promise.resolve()
 .then(function(){ return run(fakeClient({ error:null, data:{ ok:true, id:1 } })); })
 .then(function(o){ ok('server SUCCESS → cb(true) AND invoice line delivered', o.status===true && o.extra && /invoice/i.test(o.extra.message)); })
 .then(function(){ return run(fakeClient({ error:{ message:'denied' } })); })
 .then(function(o){ ok('server REJECT → cb(false), no invoice claim', o.status===false && !(o.extra&&/invoice/i.test(o.extra.message||''))); })
 .then(function(){ return run(fakeThrow()); })
 .then(function(o){ ok('network throw → cb(null) offline, no invoice claim', o.status===null && !(o.extra&&/invoice/i.test(o.extra.message||''))); })
 .then(function(){ global.window.ddClient=undefined;
   console.log('\n dd_datamodule harness: '+pass+' passed, '+fail+' failed');
   if(fail){ console.log(' ❌ FAILURES ABOVE'); process.exit(1); } else { console.log(' ✅ all green'); } });
