/* ============================================================================
 * dd_genrepack.js — the GENRE CONTENT-PACK layer.
 *
 * One doctrine: the app is the ENGINE, the genre is a CONTENT PACK. Same games,
 * same karaoke tent, same app shell — you swap the DECK, not the code.
 *   • theme(key)     → re-skin colors + label per genre (the app "switches colors")
 *   • karaoke(key,n) → the night's songbook (titles + artists; no lyrics)
 *   • trivia(key,n)  → the genre's question deck for the SAME trivia game
 *   • rotate()/nightGenre() → the KARAOKEPLATZ schedule: every night a genre
 *
 * Pure, deterministic, guarded (no backend = no-op), instrumented (ids/counts, NO PII).
 * Dual browser/node export; the pure core is unit-testable.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  function nrm(s){ return String(s==null?'':s).toLowerCase().replace(/\s+/g,' ').trim(); }
  function cap(s){ s=String(s||''); return s.charAt(0).toUpperCase()+s.slice(1); }

  // ---- the packs. Song TITLES + artists only (titles aren't copyrightable; no lyrics).
  //      Trivia = factual Q with 4 choices and the answer index. ---------------
  var REG = {};
  function register(key, spec){
    key = nrm(key); if(!key) return;
    spec = spec||{};
    REG[key] = {
      key: key,
      label: spec.label || cap(key),
      color: spec.color || '#7c3aed',
      ink:   spec.ink   || '#ffffff',
      icon:  spec.icon  || '🎤',
      karaoke: (spec.karaoke||[]).map(function(s){ return { title:String(s.title||s[0]||''), artist:String(s.artist||s[1]||'') }; })
                                 .filter(function(s){ return s.title; }),
      trivia:  (spec.trivia||[]).map(function(t){ return { q:String(t.q||''), choices:(t.choices||[]).map(String), a:(t.a|0) }; })
                                .filter(function(t){ return t.q && t.choices.length>=2 && t.a>=0 && t.a<t.choices.length; }),
      gameTag: spec.gameTag || key
    };
    return REG[key];
  }

  // ---- seed genres (color palette matches the genre-factory diagram) ---------
  register('dead',   { label:'Dead', color:'#8b5cf6', icon:'🌹',
    karaoke:[['Ripple','Grateful Dead'],['Friend of the Devil','Grateful Dead'],['Casey Jones','Grateful Dead'],
             ['Sugar Magnolia','Grateful Dead'],['Touch of Grey','Grateful Dead'],['Fire on the Mountain','Grateful Dead'],
             ['Uncle John’s Band','Grateful Dead'],['Truckin’','Grateful Dead']],
    trivia:[
      {q:'Who was the Grateful Dead’s primary lead guitarist?',choices:['Bob Weir','Jerry Garcia','Phil Lesh','Pigpen'],a:1},
      {q:'What are devoted Grateful Dead fans commonly called?',choices:['Parrotheads','Deadheads','Beliebers','Swifties'],a:1},
      {q:'Which city is the Grateful Dead most associated with forming in?',choices:['Los Angeles','Seattle','San Francisco','Austin'],a:2},
      {q:'“Touch of Grey” gave the Dead their first Top 10 hit in which decade?',choices:['1970s','1980s','1990s','2000s'],a:1}
    ]});
  register('country',{ label:'Country', color:'#f0a83c', icon:'🤠',
    karaoke:[['Friends in Low Places','Garth Brooks'],['Jolene','Dolly Parton'],['Wagon Wheel','Old Crow / Darius Rucker'],
             ['Take Me Home, Country Roads','John Denver'],['Ring of Fire','Johnny Cash'],['Before He Cheats','Carrie Underwood'],
             ['Chicken Fried','Zac Brown Band'],['9 to 5','Dolly Parton']],
    trivia:[
      {q:'Who recorded “9 to 5”?',choices:['Reba McEntire','Dolly Parton','Loretta Lynn','Shania Twain'],a:1},
      {q:'“Ring of Fire” is a signature song of which artist?',choices:['Willie Nelson','Hank Williams','Johnny Cash','Merle Haggard'],a:2},
      {q:'“Friends in Low Places” is most associated with which star?',choices:['Garth Brooks','Alan Jackson','George Strait','Tim McGraw'],a:0},
      {q:'Nashville, home of country music, is in which U.S. state?',choices:['Texas','Kentucky','Georgia','Tennessee'],a:3}
    ]});
  register('hiphop', { label:'HipHop', color:'#f472b6', icon:'🎤',
    karaoke:[['Juicy','The Notorious B.I.G.'],['California Love','2Pac'],['Hey Ya!','OutKast'],
             ['Lose Yourself','Eminem'],['Gold Digger','Kanye West'],['Jump Around','House of Pain'],
             ['It Was a Good Day','Ice Cube'],['Empire State of Mind','Jay-Z']],
    trivia:[
      {q:'Which rapper released “Lose Yourself” from the film 8 Mile?',choices:['Jay-Z','Eminem','Nas','50 Cent'],a:1},
      {q:'OutKast’s “Hey Ya!” came from which double album?',choices:['Stankonia','Aquemini','Speakerboxxx/The Love Below','ATLiens'],a:2},
      {q:'“Juicy” is a classic by which artist?',choices:['The Notorious B.I.G.','Tupac','Snoop Dogg','LL Cool J'],a:0},
      {q:'Hip-hop is widely credited with originating in which NYC borough?',choices:['Brooklyn','The Bronx','Queens','Harlem'],a:1}
    ]});
  register('latin',  { label:'Latin', color:'#34d399', icon:'💃',
    karaoke:[['Despacito','Luis Fonsi'],['La Bamba','Ritchie Valens'],['Bailando','Enrique Iglesias'],
             ['Vivir Mi Vida','Marc Anthony'],['Gasolina','Daddy Yankee'],['Oye Como Va','Santana'],
             ['La Vida Es Un Carnaval','Celia Cruz'],['Suavemente','Elvis Crespo']],
    trivia:[
      {q:'Who performs the record-breaking hit “Despacito”?',choices:['Ricky Martin','Luis Fonsi','J Balvin','Bad Bunny'],a:1},
      {q:'Celia Cruz is celebrated as the Queen of which genre?',choices:['Bachata','Salsa','Reggaeton','Merengue'],a:1},
      {q:'“Oye Como Va” was popularized by which guitarist’s band?',choices:['Santana','Los Lobos','Mana','Gipsy Kings'],a:0},
      {q:'“Gasolina” helped globalize which genre in the 2000s?',choices:['Cumbia','Tango','Reggaeton','Flamenco'],a:2}
    ]});
  register('rock',   { label:'Rock', color:'#ef4444', icon:'🎸',
    karaoke:[['Bohemian Rhapsody','Queen'],['Don’t Stop Believin’','Journey'],['Sweet Child O’ Mine','Guns N’ Roses'],
             ['Livin’ on a Prayer','Bon Jovi'],['Mr. Brightside','The Killers'],['Sweet Home Alabama','Lynyrd Skynyrd']],
    trivia:[
      {q:'Which band recorded “Bohemian Rhapsody”?',choices:['Led Zeppelin','Queen','The Who','Pink Floyd'],a:1},
      {q:'“Don’t Stop Believin’” is by which band?',choices:['Foreigner','Journey','Boston','Kansas'],a:1},
      {q:'“Sweet Child O’ Mine” features which guitarist?',choices:['Slash','Eddie Van Halen','Angus Young','Jimmy Page'],a:0}
    ]});
  register('pop',    { label:'Pop', color:'#38bdf8', icon:'✨',
    karaoke:[['Dancing Queen','ABBA'],['I Wanna Dance with Somebody','Whitney Houston'],['Shake It Off','Taylor Swift'],
             ['Uptown Funk','Bruno Mars'],['Since U Been Gone','Kelly Clarkson'],['Wannabe','Spice Girls']],
    trivia:[
      {q:'“Dancing Queen” is a signature song of which group?',choices:['ABBA','Bee Gees','Fleetwood Mac','Eagles'],a:0},
      {q:'Who released “Shake It Off” in 2014?',choices:['Katy Perry','Taylor Swift','Ariana Grande','Adele'],a:1},
      {q:'“Uptown Funk” features which artist on vocals?',choices:['Bruno Mars','Justin Timberlake','Pharrell','Usher'],a:0}
    ]});

  // ---- readers --------------------------------------------------------------
  function has(key){ return !!REG[nrm(key)]; }
  function get(key){ return REG[nrm(key)] || null; }
  function keys(){ return Object.keys(REG); }
  function count(){ return keys().length; }
  function theme(key){ var p=get(key); return p ? { key:p.key, label:p.label, color:p.color, ink:p.ink, icon:p.icon }
                                                : { key:null, label:'Open Mic', color:'#7c3aed', ink:'#ffffff', icon:'🎤' }; }
  function take(arr, n){ if(n==null) return arr.slice(); n=Math.max(0, n|0); return arr.slice(0, n); }   // deterministic head-n
  function karaoke(key, n){ var p=get(key); return p ? take(p.karaoke, n) : []; }
  function trivia(key, n){ var p=get(key); return p ? take(p.trivia, n) : []; }
  function pack(key){ var p=get(key); return p ? JSON.parse(JSON.stringify(p)) : null; }

  // ---- KARAOKEPLATZ schedule: every night a different genre ------------------
  function addDaysISO(iso, k){ var d=new Date(iso+'T00:00:00Z'); if(isNaN(d)) return iso;
    d.setUTCDate(d.getUTCDate()+k); return d.toISOString().slice(0,10); }
  // rotate a genre list across nDays starting at startISO → [{date, genre, label}]
  function rotate(genres, startISO, nDays){
    genres = (genres||[]).map(nrm).filter(function(g){ return g; });
    nDays = Math.max(0, nDays|0); var out=[];
    if(!genres.length || !nDays) return out;
    for(var i=0;i<nDays;i++){ var g=genres[i%genres.length]; var p=get(g);
      out.push({ date:addDaysISO(startISO, i), genre:g, label:(p?p.label:cap(g)) }); }
    return out;
  }
  // resolve the genre scheduled for a given date (null if none)
  function nightGenre(schedule, dateISO){
    var s = schedule||[]; for(var i=0;i<s.length;i++){ if(s[i] && s[i].date===dateISO) return s[i].genre; }
    return null;
  }
  // pick tonight from a schedule using a supplied "today" (defaults to now, UTC date)
  function tonight(schedule, todayISO){
    todayISO = todayISO || new Date().toISOString().slice(0,10);
    var g = nightGenre(schedule, todayISO);
    if(!g && (schedule||[]).length) g = schedule[0].genre;   // fall to opening night if before/after run
    return { date:todayISO, genre:g, theme:theme(g), pack:g?pack(g):null };
  }

  // ---- guarded spine + telemetry (ids/counts only; no PII) -------------------
  function C(){ try{ return root.ddClient && root.ddClient(); }catch(e){ return null; } }
  function emit(evt, payload){ try{ if(root.DDTele && root.DDTele.event) root.DDTele.event('genrepack.'+evt, payload||{}); }catch(e){} }
  // TRUTHFUL WRITE: no client → false (guarded no-op). With a client, every night's RPC is actually SENT
  // (v2 fires only on .then/.catch) and we return a Promise that resolves to the REAL result — true only when
  // EVERY night saved server-side, false if any rejected/offline. Never return true before the writes resolve.
  function saveSchedule(festival, stage, schedule){ var c=C(); if(!c||!c.rpc) return false;
    try{ var nights=(schedule||[]);
      var ps=nights.map(function(n){ return c.rpc('sf_genre_schedule_set',{ p_festival:festival||null, p_stage:stage||null, p_date:n.date, p_genre:n.genre })
        .then(function(r){ return !(r&&r.error); }).catch(function(){ return false; }); });
      return Promise.all(ps).then(function(res){ var okv=res.every(function(x){return x;}); emit('schedule', {nights:nights.length, saved:okv}); return okv; });
    }catch(e){ return false; } }
  function getSchedule(festival, stage){ var c=C(); if(!c||!c.rpc) return Promise.resolve([]);
    try{ return c.rpc('sf_genre_schedule_get',{ p_festival:festival||null, p_stage:stage||null }).then(function(r){ return (r&&r.data)||[]; }).catch(function(){ return []; }); }catch(e){ return Promise.resolve([]); } }
  // TRUTHFUL WRITE: no client → false (guarded no-op). With a client the RPC is actually SENT and we return a
  // Promise that resolves to the REAL result. Callers (karaokeplatz) ignore the return; the fix is that it fires.
  function logPlay(fanId, genre, game){ var c=C(); if(!c||!c.rpc) return false;
    try{ return c.rpc('sf_genre_play_log',{ p_fan:fanId||null, p_genre:nrm(genre)||null, p_game:game||null })
      .then(function(r){ var okv=!(r&&r.error); emit('play',{game:game, saved:okv}); return okv; })
      .catch(function(){ return false; }); }catch(e){ return false; } }

  var api = { register:register, has:has, get:get, keys:keys, count:count,
    theme:theme, karaoke:karaoke, trivia:trivia, pack:pack,
    rotate:rotate, nightGenre:nightGenre, tonight:tonight,
    saveSchedule:saveSchedule, getSchedule:getSchedule, logPlay:logPlay, _reg:REG };
  root.DDGenrePack = api;
  if (typeof module!=='undefined' && module.exports) module.exports = api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
