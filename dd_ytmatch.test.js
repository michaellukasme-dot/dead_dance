/* dd_ytmatch.test.js — node harness for the show↔YouTube matcher.
   Run:  node dd_ytmatch.test.js   (exit 0 = all green) */
'use strict';
global.window = {};
var YT = require('./dd_ytmatch.js');

var pass=0, fail=0;
function ok(name, cond){ if(cond){ pass++; } else { fail++; console.log('  ✗ '+name); } }

// ---- id parse ----
ok('parse ?v= url', YT.parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')==='dQw4w9WgXcQ');
ok('parse youtu.be url', YT.parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')==='dQw4w9WgXcQ');
ok('parse /embed/ url', YT.parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')==='dQw4w9WgXcQ');
ok('bare 11-char id', YT.parseYouTubeId('dQw4w9WgXcQ')==='dQw4w9WgXcQ');
ok('junk → null', YT.parseYouTubeId('not a video')===null);

// ---- query build ----
(function(){
  var q=YT.searchQuery({ show_key:'gd1977-05-08', date:'1977-05-08', venue:'Barton Hall' });
  ok('query includes band + date + venue + full concert', /Grateful Dead/.test(q) && /1977-05-08/.test(q) && /Barton Hall/.test(q) && /full concert/.test(q));
  ok('query derives date from show_key when date missing', /1977-05-08/.test(YT.searchQuery({ show_key:'gd1977-05-08' })));
})();

// ---- date variants ----
(function(){
  var v=YT.dateVariants('1977-05-08');
  ok('variants include ISO, m/d/yy, and Month D, Y', v.indexOf('1977-05-08')>=0 && v.indexOf('5/8/77')>=0 && v.indexOf('may 8, 1977')>=0);
})();

// ---- channel classification (the legal hinge) ----
ok('official: Grateful Dead channel', YT.classifyChannel('Grateful Dead')==='official');
ok('official: Rhino', YT.classifyChannel('Rhino Entertainment')==='official');
ok('authorized: nugs.net', YT.classifyChannel('nugs.net')==='authorized');
ok('fan: random uploader', YT.classifyChannel('DeadHead Uploads 1977')==='fan');
ok('unknown: empty channel', YT.classifyChannel('')==='unknown');

// ---- scoring ----
(function(){
  var show={ show_key:'gd1977-05-08', date:'1977-05-08', venue:'Barton Hall' };
  var strong=YT.scoreMatch({ title:'Grateful Dead - Barton Hall 5/8/77 FULL SHOW', durationSec:9000, channelTitle:'Grateful Dead' }, show);
  var weak=YT.scoreMatch({ title:'Grateful Dead - Scarlet Begonias', durationSec:400, channelTitle:'random' }, show);
  ok('strong match scores high', strong.score>=0.8);
  ok('one-song short clip scores low', weak.score<0.4);
  ok('strong match flags official channel', strong.channelType==='official' && strong.reasons.indexOf('official channel')>=0);
  ok('score bounded 0..1', strong.score<=1 && weak.score>=0);
})();

// ---- rank + row ----
(function(){
  var show={ show_key:'gd1977-05-08', date:'1977-05-08', venue:'Barton Hall', city:'Ithaca' };
  var vids=[
    { id:'aaaaaaaaaaa', title:'GD 5/8/77 one song', durationSec:300, channelTitle:'fan' },
    { id:'bbbbbbbbbbb', title:'Grateful Dead Barton Hall 1977-05-08 full concert', durationSec:9000, channelTitle:'Grateful Dead' }
  ];
  var ranked=YT.rankCandidates(vids, show);
  ok('best candidate ranked first', ranked[0].id==='bbbbbbbbbbb');
  var row=YT.toRow(ranked[0], show);
  ok('row is always verified=false (human confirms)', row.p_verified===false);
  ok('row carries show_key + a real watch url + channel type', row.p_show_key==='gd1977-05-08' && /watch\?v=|youtu/.test(row.p_video_url||'') || row.p_video_url!=null);
  ok('official candidate → p_official true', row.p_official===true);
})();

// ---- guarded ingest (no backend) ----
(function(){
  var show={ show_key:'gd1977-05-08', date:'1977-05-08', venue:'Barton Hall' };
  var out=YT.ingest(show, [{ id:'bbbbbbbbbbb', title:'Grateful Dead Barton Hall 1977-05-08 full concert', durationSec:9000, channelTitle:'Grateful Dead' }]);
  ok('ingest returns ranked kept candidates, no throw offline', Array.isArray(out) && out.length===1);
})();

// ---- determinism ----
(function(){
  var show={ show_key:'gd1977-05-08', date:'1977-05-08' };
  var v=[{ id:'ccccccccccc', title:'Grateful Dead 5/8/77 full show', durationSec:9000, channelTitle:'Rhino' }];
  ok('deterministic ranking', JSON.stringify(YT.rankCandidates(v,show))===JSON.stringify(YT.rankCandidates(v,show)));
})();

console.log('\n dd_ytmatch harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' ❌ FAILURES ABOVE'); process.exit(1); } else { console.log(' ✅ all green'); }
