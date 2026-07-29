// dd_setlist_crowd — node harness. Shims window/localStorage/DDCoins; ddClient absent (spine no-op).
global.window = global;
var _ls = {}; global.localStorage = { getItem:function(k){return (k in _ls)?_ls[k]:null;}, setItem:function(k,v){_ls[k]=String(v);}, removeItem:function(k){delete _ls[k];} };
var fed = []; global.DDCoins = { feed:function(t,k){ fed.push(k); }, pop:function(){} };
var assert = require('assert');
require('./dd_setlist_crowd.js');
var S = global.window.DDSetlistCrowd;
assert.ok(S, 'module attached');

// 1) normalize
assert.strictEqual(S._norm('Tweezer!'), 'tweezer');
assert.strictEqual(S._norm('Wolfman’s Brother'), 'wolfman s brother');

// 2) band authority lock
assert.strictEqual(S.locked({songs:[{n:'x'}]}), true, 'band songs → locked');
assert.strictEqual(S.locked({songs:[]}), false, 'no band songs → open');
assert.strictEqual(S.locked({bandSet:true,songs:[]}), true, 'bandSet flag → locked');

// 3) band-locked add → refused, NO cookie
var before = fed.length;
var r0 = S.add('rift','d','Anything',{songs:[{n:'Y'}]},'fan-x');
assert.strictEqual(r0.locked, true, 'locked add refused');
assert.strictEqual(fed.length, before, 'locked add awards NO cookie (band entered = no Cookie)');

// 4) fan add new → added + 1 cookie
var r1 = S.add('rift','2026-07-30','Tweezer',{songs:[]},'fan-1');
assert.strictEqual(r1.added, true); assert.strictEqual(fed.length, 1, 'first add → 1 cookie');

// 5) second fan, same song (fuzzy) → consensus 2
var r2 = S.add('rift','2026-07-30','tweezer!',{songs:[]},'fan-2');
assert.strictEqual(r2.added, true); assert.strictEqual(fed.length, 2);
var tw = S.get('rift','2026-07-30').filter(function(s){return s.n.toLowerCase().indexOf('tweezer')>=0;})[0];
assert.strictEqual(tw.fans, 2, 'two distinct fans → consensus 2');

// 6) same fan, same song again → already, no double cookie
var r3 = S.add('rift','2026-07-30','Tweezer',{songs:[]},'fan-1');
assert.strictEqual(r3.already, true); assert.strictEqual(r3.added, false); assert.strictEqual(fed.length, 2, 'dup add → no extra cookie');

// 7) consensus ordering: add a 1-fan song, Tweezer(2) still first
S.add('rift','2026-07-30','Bathtub Gin',{songs:[]},'fan-1');
var list = S.get('rift','2026-07-30');
assert.strictEqual(list[0].n.toLowerCase().indexOf('tweezer')>=0, true, 'most-agreed first');
assert.strictEqual(fed.length, 3, 'third distinct add → 3 cookies total');

// 8) status
var st = S.status('rift','2026-07-30');
assert.strictEqual(st.songs, 2); assert.strictEqual(st.fans, 2);

// 9) pull no-throw without ddClient
S.pull('rift','2026-07-30').then(function(v){ assert.strictEqual(v,false,'pull no-op without spine'); console.log('ALL PASS ('+fed.length+' cookies fed, '+st.songs+' songs, '+st.fans+' fans)'); }).catch(function(e){ console.error('FAIL',e); process.exit(1); });
