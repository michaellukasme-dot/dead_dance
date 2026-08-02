/* dd_citymap.test.js — node harness for the City Walking Map brain.
   Run:  node dd_citymap.test.js   (exit 0 = all green) */
'use strict';
global.window = {};
var CM = require('./dd_citymap.js');

var pass=0, fail=0;
function ok(name, cond){ if(cond){ pass++; } else { fail++; console.log('  ✗ '+name); } }

// ---- norm + defaults ----
(function(){
  var c=CM.norm({ name:'Bethlehem', state:'PA', corridor:[[40.579,-75.339],[40.582,-75.341],[40.585,-75.343]] });
  ok('slug from name', c.slug==='bethlehem');
  ok('defaults 9:00–23:00, all week', c.hours.openLabel==='09:00' && c.hours.closeLabel==='23:00' && c.hours.days.length===7);
  ok('corridor kept + centroid computed', c.corridor.length===3 && c.center && c.center.length===2);
  ok('ads on by default (the proximity network)', c.ads.enabled===true);
  var custom=CM.norm({ name:'Easton', hours:{open:'11:00', close:'22:00', days:[4,5,6]} });
  ok('custom hours + days honored', custom.hours.open===660 && custom.hours.close===1320 && custom.hours.days.join(',')==='4,5,6');
})();

// ---- corridor length ----
ok('corridor length ~ a few hundred m for a short line', (function(){ var m=CM.lengthMeters([[40.58,-75.34],[40.585,-75.34]]); return m>400 && m<700; })());

// ---- THE ACTIVE-HOURS ENGINE ----
(function(){
  var city={ name:'X', hours:{open:'09:00', close:'23:00', days:[0,1,2,3,4,5,6]} };
  ok('open at noon', CM.isActive(city, {day:3, min:12*60}).active===true);
  ok('closed at 2am', CM.isActive(city, {day:3, min:2*60}).active===false);
  ok('closed at exactly close time (23:00)', CM.isActive(city, {day:3, min:23*60}).active===false);
  var wed={ name:'Y', hours:{open:'17:00', close:'21:00', days:[3]} };   // Wednesdays only, 5–9pm
  ok('day-gated: active Wed 7pm', CM.isActive(wed, {day:3, min:19*60}).active===true);
  ok('day-gated: NOT active Thu 7pm', CM.isActive(wed, {day:4, min:19*60}).active===false);
  var late={ name:'Z', hours:{open:'18:00', close:'02:00', days:[5,6]} };  // overnight window
  ok('overnight: active Fri 11pm', CM.isActive(late, {day:5, min:23*60}).active===true);
  ok('overnight: active Sat 1am', CM.isActive(late, {day:6, min:1*60}).active===true);
  ok('overnight: NOT active Fri 3pm', CM.isActive(late, {day:5, min:15*60}).active===false);
  ok('overnight() detects the wrap', CM.overnight(late)===true && CM.overnight(city)===false);
})();

// ---- links + embed ----
(function(){
  ok('mapUrl points at city.html?city=', CM.mapUrl('Bethlehem, PA').indexOf('city.html?city=bethlehem-pa')>=0);
  ok('claimUrl points at claim_city.html', CM.claimUrl().indexOf('claim_city.html')>=0);
  var snip=CM.embedSnippet('bethlehem','Bethlehem');
  ok('embed snippet is an anchor to the map', /<a href=/.test(snip) && /city\.html\?city=bethlehem/.test(snip) && /Walking Map/.test(snip));
})();

// ---- time helpers ----
ok('hhmmToMin / minToHhmm round-trip', CM.minToHhmm(CM.hhmmToMin('21:30'))==='21:30');
ok('bad time → null', CM.hhmmToMin('99:99')===null);

// ---- guarded (no backend) ----
ok('save no-ops without a client', CM.save({name:'Nowhere'})===false);

// ---- determinism ----
ok('deterministic norm', JSON.stringify(CM.norm({name:'A',hours:{open:'10:00',close:'20:00'}}))===JSON.stringify(CM.norm({name:'A',hours:{open:'10:00',close:'20:00'}})));

console.log('\n dd_citymap harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' ❌ FAILURES ABOVE'); process.exit(1); } else { console.log(' ✅ all green'); }
