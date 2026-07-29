global.window = global;
var _ls = {}; global.localStorage = { getItem:function(k){return (k in _ls)?_ls[k]:null;}, setItem:function(k,v){_ls[k]=String(v);}, removeItem:function(k){delete _ls[k];} };
var assert = require('assert');
require('./dd_bandagent.js');
var A = global.window.DDBandAgent;
function fresh(){ _ls = {}; global.localStorage.getItem=function(k){return (k in _ls)?_ls[k]:null;}; global.localStorage.setItem=function(k,v){_ls[k]=String(v);}; }

// ---------- HAPPY PATH (hard asserts) ----------
fresh();
// consent gate: audio needs explicit taping consent
assert.strictEqual(A.whoToAsk('rift','audio',['fan-1']).target, null, 'audio blocked without consent');
A.setConsent('rift','taping', true);
A.learnRole('rift','taper','fan-9');
assert.strictEqual(A.whoToAsk('rift','audio',['fan-9','fan-1']).target, 'fan-9', 'known taper present → asked');
assert.strictEqual(A.whoToAsk('rift','audio',['fan-1']).target, 'fan-1', 'taper absent → crowd fallback');
// self-provide → no crowd ask
A.learnSelfProvide('rift','setlist');
assert.strictEqual(A.whoToAsk('rift','setlist',['fan-1']).target, null, 'band self-provides setlist → no ask');
// dedupe asks
assert.strictEqual(A.shouldAsk('rift','photo','2026-07-30'), true);
A.setConsent('rift','photos', true); A.logAsk('rift','photo','2026-07-30','fan-1');
assert.strictEqual(A.shouldAsk('rift','photo','2026-07-30'), false, 'no re-ask same task/event');
console.log('HAPPY PATH: all pass');

// ---------- CLAUDINE ADVERSARIAL (soft — record pass/fail) ----------
var fails = [];
function check(name, cond){ if(!cond){ fails.push(name); console.log('  ✗ '+name); } else console.log('  ✓ '+name); }

// A1 — never ask a PERFORMING member to capture
fresh(); A.setConsent('gd','photos', true); A.learnMember('gd','Drummer','drums','m-drums');
check('A1a: lone performing member is NOT asked for a photo', A.whoToAsk('gd','photo',['m-drums']).target === null);
check('A1b: with a fan present, the FAN is asked, not the member', A.whoToAsk('gd','photo',['m-drums','fan-1']).target === 'fan-1');

// A2 — ask log must be bounded
fresh(); for(var i=0;i<60;i++){ A.logAsk('gd','photo','ev-'+i,'fan-'+i); }
check('A2: ask log is bounded (<=50)', A.get('gd').asks.length <= 50);

// A3 — post credits deduped
fresh(); A.setConsent('gd','posts', true);
var spec = A.composePostSpec('gd','ev', { photos:[{by:'fan-1'},{by:'fan-1'},{by:'fan-2'}] });
check('A3: post credits are unique', spec && spec.credits.length === 2);

if(fails.length){ console.log('CLAUDINE FOUND '+fails.length+' GAP(S): '+fails.join(', ')); process.exit(2); }
console.log('CLAUDINE: all clear');
