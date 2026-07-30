global.window = global;
var _ls={}; global.localStorage={getItem:function(k){return k in _ls?_ls[k]:null;},setItem:function(k,v){_ls[k]=String(v);},removeItem:function(k){delete _ls[k];}};
var fed=[]; global.DDCoins={feed:function(t,k){fed.push(k);},pop:function(){}};
var assert=require('assert');
require('./dd_festguide.js');
var G=global.window.DDFestGuide;
function fresh(){ for(var k in _ls) delete _ls[k]; fed.length=0; }

// ---------- HAPPY PATH ----------
assert.strictEqual(G.category('misting'),'comfort');
assert.strictEqual(G.category('alert'),'safety');
assert.strictEqual(G.crowdStatus(30,100).level,'promote');
assert.strictEqual(G.crowdStatus(75,100).level,'approaching');
assert.strictEqual(G.crowdStatus(95,100).level,'over');
assert.strictEqual(G.alertReward(1),5); assert.strictEqual(G.alertReward(2),2); assert.strictEqual(G.alertReward(3),1); assert.strictEqual(G.alertReward(5),0);
assert.strictEqual(G.alertStatus({noLonger:2}),'cleared');
assert.strictEqual(G.alertStatus({police:1}),'police_on_scene');
assert.strictEqual(G.alertStatus({stillGoing:1}),'active');
assert.strictEqual(G.escalates('fire'),true); assert.strictEqual(G.escalates('spill'),false);
fresh();
var n=G.nudge({lat:40.0,lng:-75.0},[{id:'m1',type:'misting',lat:40.0003,lng:-75.0}],{noCooldown:true});
assert.ok(n && n.type==='misting' && /Misting/.test(n.message),'nudge near misting');
assert.strictEqual(G.nudge({lat:41,lng:-76},[{id:'m1',type:'misting',lat:40,lng:-75}],{noCooldown:true}),null,'out of range null');
fresh();
var r=G.raise('rift-fest','medical',{lat:40,lng:-75},'fan-1');
assert.ok(r.id && r.status==='active' && r.escalate===true,'medical raise escalates'); assert.strictEqual(fed.length,1);
G.raise('rift-fest','medical',{lat:40.0001,lng:-75},'fan-1');
assert.strictEqual(G.active('rift-fest').length,1,'dedupe raise->confirm keeps 1 incident');
console.log('HAPPY PATH: all pass');

// ---------- CLAUDINE ADVERSARIAL ----------
var fails=[]; function check(nm,c){ if(!c){ fails.push(nm); console.log('  ✗ '+nm);} else console.log('  ✓ '+nm); }
fresh();
var p1=G.pulse([{stage:'Big',count:500,capacity:0},{stage:'Small',count:20,capacity:100}]);
check('A1 SAFETY: unknown-capacity stage NOT promoted', !(p1.flash && p1.flash.stage==='Big'));
fresh();
var p2=G.pulse([{stage:'Packed',count:900,capacity:1000},{stage:'Room',count:100,capacity:1000}]);
check('A2: over-capacity stage never flashed', p2.flash && p2.flash.stage==='Room');
check('A2b: over-capacity stage warned', p2.warnings.some(function(w){return w.stage==='Packed';}));
fresh();
G.raise('f','spill',{lat:40,lng:-75},'a');
var id=G.active('f')[0].id; G.confirm('f',id,'stillGoing','a');
check('A3: same fan not double-rewarded', fed.length===1);
G.confirm('f',id,'stillGoing','b'); G.confirm('f',id,'stillGoing','c'); G.confirm('f',id,'stillGoing','d'); G.confirm('f',id,'stillGoing','e');
check('A3b: 5th distinct confirmer earns 0 cookies', fed.length===4);
if(fails.length){ console.log('CLAUDINE FOUND '+fails.length+' GAP(S)'); process.exit(2);} console.log('CLAUDINE: all clear');
