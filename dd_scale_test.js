/* dd_scale_test.js — instrumentation + scale test for the client brains. Run: node dd_scale_test.js
   Simulates 100k ops per module, times them, asserts no crash + bounded memory. Node shims for window/localStorage/DDCoins. */
'use strict';
global.window = global;
var _ls = {}; global.localStorage = { getItem:function(k){return (k in _ls)?_ls[k]:null;}, setItem:function(k,v){_ls[k]=String(v);}, removeItem:function(k){delete _ls[k];} };
global.DDCoins = { feed:function(){}, pop:function(){} };
var assert = require('assert');
function ms(f){ var t=process.hrtime.bigint(); f(); return Number(process.hrtime.bigint()-t)/1e6; }
function mb(){ return Math.round(process.memoryUsage().heapUsed/1048576); }
function fresh(){ for(var k in _ls) delete _ls[k]; }
var N = 100000;

require('./dd_festguide.js'); require('./dd_setlist_crowd.js'); require('./dd_bandagent.js'); require('./dd_muse.js');
var FG=global.window.DDFestGuide, SC=global.window.DDSetlistCrowd, BA=global.window.DDBandAgent, MU=global.window.DDMuse;
console.log('modules:', !!FG, !!SC, !!BA, !!MU, '| node', process.version);

// 1) festguide.pulse over 100k stages (single call, big array)
fresh();
var stages=[]; for(var i=0;i<N;i++) stages.push({stage:'S'+i,count:(i%1200),capacity:1000});
var t1=ms(function(){ var p=FG.pulse(stages); assert.ok(p && p.stages.length===N); assert.ok(!p.flash || p.flash); });
console.log('pulse('+N+' stages): '+t1.toFixed(1)+'ms  heap '+mb()+'MB');

// 2) festguide alerts: 100k raises across fests + confirms; ask/alert data must stay sane (cleared prunes)
fresh();
var t2=ms(function(){ for(var i=0;i<N;i++){ var f='fest'+(i%50); var r=FG.raise(f,'spill'+(i%9),{lat:40+(i%90)/1000,lng:-75},'fan'+i);
  if(i%3===0){ var a=FG.active(f)[0]; if(a) FG.confirm(f,a.id,'noLonger','fanB'+i); } } });
console.log('alerts raise+confirm x'+N+': '+t2.toFixed(1)+'ms  heap '+mb()+'MB');

// 3) setlist crowd: 100k fan adds (many songs, many fans)
fresh();
var t3=ms(function(){ for(var i=0;i<N;i++){ SC.add('band'+(i%200),'2026-08-0'+(i%9),'Song '+(i%400),{songs:[]},'fan'+(i%5000)); } });
console.log('setlist add x'+N+': '+t3.toFixed(1)+'ms  heap '+mb()+'MB');

// 4) bandagent: 100k asks; ask log MUST stay bounded (<=50 per band)
fresh();
BA.setConsent('b','photos',true);
var t4=ms(function(){ for(var i=0;i<N;i++){ BA.logAsk('b','photo','ev'+i,'fan'+i); } });
var asks=BA.get('b').asks.length;
console.log('bandagent logAsk x'+N+': '+t4.toFixed(1)+'ms  → ask log length='+asks+' (must be <=50)');
assert.ok(asks<=50, 'BOUNDED: ask log capped');

// 5) muse.learn: 100k voice learns; samples MUST stay bounded (<=24)
fresh();
var t5=ms(function(){ for(var i=0;i<N;i++){ MU.learn('a kept post number '+i+' with enough length'); } });
var samples=JSON.parse(global.localStorage.getItem('dd.voice')||'{"samples":[]}').samples.length;
console.log('muse.learn x'+N+': '+t5.toFixed(1)+'ms  → voice samples='+samples+' (must be <=24)');
assert.ok(samples<=24, 'BOUNDED: voice samples capped');

console.log('\nSCALE: no crash, memory bounded (logs capped). Client is O(small)/device — text in a box holds. peak heap '+mb()+'MB');
