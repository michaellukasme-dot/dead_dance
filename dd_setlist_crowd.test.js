// dd_setlist_crowd — node harness (post-Claudine: Cookie on CONSENSUS, not on submission).
global.window = global;
var _ls = {}; global.localStorage = { getItem:function(k){return (k in _ls)?_ls[k]:null;}, setItem:function(k,v){_ls[k]=String(v);}, removeItem:function(k){delete _ls[k];} };
var fed = []; global.DDCoins = { feed:function(t,k){ fed.push(k); }, pop:function(){} };
var assert = require('assert');
require('./dd_setlist_crowd.js');
var S = global.window.DDSetlistCrowd;
assert.ok(S, 'module attached');

// normalize + lock
assert.strictEqual(S._norm('Tweezer!'), 'tweezer');
assert.strictEqual(S.locked({songs:[{n:'x'}]}), true);
assert.strictEqual(S.locked({songs:[]}), false);

// band-locked add → refused, no cookie
var r0 = S.add('rift','d','Anything',{songs:[{n:'Y'}]},'fan-x');
assert.strictEqual(r0.locked, true); assert.strictEqual(fed.length, 0);

// LEAK FIX: first entry earns NOTHING (unverified)
var r1 = S.add('rift','2026-07-30','Tweezer',{songs:[]},'fan-1');
assert.strictEqual(r1.added, true); assert.strictEqual(r1.rewarded, false);
assert.strictEqual(fed.length, 0, 'lone first entry mints NO cookie (anti-farm)');

// junk from the SAME actor (new fanIds would be needed) → still no cookie
S.add('rift','2026-07-30','jjjunk one',{songs:[]},'fan-1');
S.add('rift','2026-07-30','jjjunk two',{songs:[]},'fan-1');
assert.strictEqual(fed.length, 0, 'a lone actor cannot farm cookies with junk');

// CONSENSUS: a 2nd distinct fan confirms Tweezer → ONE cookie
var r2 = S.add('rift','2026-07-30','tweezer!',{songs:[]},'fan-2');
assert.strictEqual(r2.rewarded, true); assert.strictEqual(fed.length, 1, 'consensus (2 fans) mints exactly 1 cookie');

// further confirmations do NOT re-mint
S.add('rift','2026-07-30','Tweezer',{songs:[]},'fan-3');
assert.strictEqual(fed.length, 1, 'already-confirmed song does not re-reward');

// dup by same fan → no-op
var r3 = S.add('rift','2026-07-30','Tweezer',{songs:[]},'fan-1');
assert.strictEqual(r3.already, true); assert.strictEqual(fed.length, 1);

// ordering: Tweezer (3 fans) before a solo add
S.add('rift','2026-07-30','Bathtub Gin',{songs:[]},'fan-1');
var list = S.get('rift','2026-07-30');
assert.strictEqual(list[0].n.toLowerCase().indexOf('tweezer')>=0, true, 'most-agreed first');

// pull no-op without spine
S.pull('rift','2026-07-30').then(function(v){ assert.strictEqual(v,false); console.log('ALL PASS — cookies minted: '+fed.length+' (only the consensus song). Junk earned 0.'); }).catch(function(e){ console.error('FAIL',e); process.exit(1); });
