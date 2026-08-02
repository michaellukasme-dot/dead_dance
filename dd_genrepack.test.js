/* dd_genrepack.test.js — node harness for the genre content-pack layer.
   Run:  node dd_genrepack.test.js   (exit 0 = all green) */
'use strict';
global.window = {};
var GP = require('./dd_genrepack.js');

var pass=0, fail=0;
function ok(name, cond){ if(cond){ pass++; } else { fail++; console.log('  ✗ '+name); } }

// registry
ok('seeds at least 6 genres', GP.count() >= 6);
ok('has(dead) / has(country) / has(hiphop)', GP.has('dead') && GP.has('country') && GP.has('hiphop'));
ok('has() case/space-insensitive', GP.has('  DEAD ') && GP.has('HipHop'));
ok('unknown genre → has=false, get=null', !GP.has('polka') && GP.get('polka')===null);

// theme — distinct colors per genre, safe default for unknown
(function(){
  var colors = GP.keys().map(function(k){ return GP.theme(k).color; });
  var uniq = colors.filter(function(c,i){ return colors.indexOf(c)===i; });
  ok('theme colors are distinct per genre', uniq.length === colors.length);
  ok('theme(dead) carries a label + color', GP.theme('dead').label==='Dead' && /^#/.test(GP.theme('dead').color));
  var d = GP.theme('nope');
  ok('unknown theme → safe Open-Mic default', d.key===null && /^#/.test(d.color));
})();

// karaoke — deterministic head-n, within pack, never empty for a seeded genre
(function(){
  var three = GP.karaoke('country', 3);
  ok('karaoke(country,3) returns 3', three.length===3);
  ok('karaoke deterministic (same n → same list)', JSON.stringify(three)===JSON.stringify(GP.karaoke('country',3)));
  ok('every song has a title', three.every(function(s){ return s.title && s.title.length; }));
  ok('every seeded genre has a non-empty songbook', GP.keys().every(function(k){ return GP.karaoke(k).length>0; }));
  ok('karaoke(unknown) → []', GP.karaoke('polka').length===0);
})();

// trivia — same game, genre deck; integrity: answer index resolves to a real choice
(function(){
  var bad=0, empty=0;
  GP.keys().forEach(function(k){
    var deck = GP.trivia(k);
    if(!deck.length) empty++;
    deck.forEach(function(t){
      if(!(t.a>=0 && t.a<t.choices.length)) bad++;        // answer must index a choice
      if(t.choices.length<2) bad++;
      if(!t.q) bad++;
    });
  });
  ok('every seeded genre has a trivia deck', empty===0);
  ok('every trivia answer indexes a real choice', bad===0);
  var two = GP.trivia('hiphop', 2);
  ok('trivia(hiphop,2) returns 2, deterministic', two.length===2 && JSON.stringify(two)===JSON.stringify(GP.trivia('hiphop',2)));
})();

// SAME GAME / DIFFERENT CONTENT — decks differ across genres
(function(){
  ok('dead deck !== country deck (content pack, not code)',
     JSON.stringify(GP.trivia('dead')) !== JSON.stringify(GP.trivia('country')));
})();

// Karaokeplatz rotation — every night a different genre
(function(){
  var sched = GP.rotate(['dead','country','hiphop','latin'], '2026-08-06', 6);
  ok('rotate builds nDays nights', sched.length===6);
  ok('rotate cycles genres', sched[0].genre==='dead' && sched[4].genre==='dead' && sched[1].genre==='country');
  ok('rotate advances the date by one day each night', sched[0].date==='2026-08-06' && sched[1].date==='2026-08-07' && sched[5].date==='2026-08-11');
  ok('nightGenre resolves a scheduled date', GP.nightGenre(sched,'2026-08-08')==='hiphop');
  ok('nightGenre unknown date → null', GP.nightGenre(sched,'2020-01-01')===null);
  ok('rotate with empty genres → []', GP.rotate([], '2026-08-06', 6).length===0);
  ok('rotate ignores unknown-but-tolerated genres safely', GP.rotate(['dead','zzz'],'2026-08-06',2).length===2);
})();

// tonight() — picks the scheduled genre, falls to opening night out of range
(function(){
  var sched = GP.rotate(['dead','country'], '2026-08-06', 2);
  var t = GP.tonight(sched, '2026-08-07');
  ok('tonight resolves the right genre + theme', t.genre==='country' && t.theme.color===GP.theme('country').color);
  var pre = GP.tonight(sched, '2020-01-01');
  ok('tonight before/after run → opening night', pre.genre==='dead');
})();

// guarded — no backend → no throw, falsy returns
(function(){
  ok('saveSchedule no-ops without a client', GP.saveSchedule('f','s', GP.rotate(['dead'],'2026-08-06',1))===false);
  ok('logPlay no-ops without a client', GP.logPlay('fan','dead','trivia')===false);
})();

console.log('\n dd_genrepack harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' ❌ FAILURES ABOVE'); process.exit(1); } else { console.log(' ✅ all green'); }
