/* nowplaying.js — "The Archive, baked in."  (Shuffle Bar / Hanz & Franz bar)
   A self-mounting, persistent Now-Playing bar: Shuffle a Song / Shuffle a Show,
   background-music-on-while-you-browse (house-made ambient bed — HONEST-STATE, no licensed
   song audio), Hanz & Franz as your DJs riffing FRESH facts per shuffle (facts/lore only —
   NO verbatim lyrics, same gate as the karaoke songbook), reactions + a skinny reply bar.
   The recordings themselves are a licensed right (see ARCHIVE_baked_in_doctrine.md); the real
   Dead songbook lights up once cleared. This is the experience, gated until then.
   Mount: include <script src="nowplaying.js"></script>. Skips itself on the coming-soon page. */
(function () {
  if (window.__np_mounted) return; window.__np_mounted = true;

  // ── SONG-FACTS bank (facts/lore/trivia ONLY — NO lyrics). Drives H&F's fresh riff each shuffle. ──
  var SONGFACTS = [
    {t:"Scarlet Begonias", w:"Garcia / Hunter", al:"From the Mars Hotel", y:1974, f:"From 1977 on it was almost always welded to 'Fire on the Mountain' — the Scarlet>Fire is one of the band's signature jams."},
    {t:"Fire on the Mountain", w:"Hart / Hunter", al:"Shakedown Street", y:1978, f:"The music started life as a Mickey Hart instrumental called 'Happiness Is Drumming' before Hunter added words."},
    {t:"Eyes of the World", w:"Garcia / Hunter", al:"Wake of the Flood", y:1973, f:"The early-'70s versions had a jazzy coda the band eventually dropped in later years."},
    {t:"Franklin's Tower", w:"Garcia / Kreutzmann / Hunter", al:"Blues for Allah", y:1975, f:"Built on a hypnotic circular chord roll, it often spilled out of 'Help on the Way' via the instrumental 'Slipknot!'"},
    {t:"Sugar Magnolia", w:"Weir / Hunter", al:"American Beauty", y:1970, f:"Its 'Sunshine Daydream' coda was often split off and used to slam a show shut on its own."},
    {t:"Bird Song", w:"Garcia / Hunter", al:"Garcia", y:1972, f:"Hunter wrote it as an elegy for Janis Joplin after her death in 1970."},
    {t:"Ripple", w:"Garcia / Hunter", al:"American Beauty", y:1970, f:"Rare live and usually a gentle acoustic encore — David Grisman plays mandolin on the studio cut."},
    {t:"Terrapin Station", w:"Garcia / Hunter", al:"Terrapin Station", y:1977, f:"Hunter said he wrote the words in one burst during a storm — the same night Garcia independently wrote the music."},
    {t:"Bertha", w:"Garcia / Hunter", al:"Grateful Dead (Skull & Roses)", y:1971, f:"Named after an office fan at HQ that shook so hard it seemed to walk across the floor."},
    {t:"Standing on the Moon", w:"Garcia / Hunter", al:"Built to Last", y:1989, f:"One of Garcia's most tender late-era ballads — a gut-punch highlight of the final years."},
    {t:"Uncle John's Band", w:"Garcia / Hunter", al:"Workingman's Dead", y:1970, f:"Its acoustic, folk-rooted sound marked the deliberate pivot away from psychedelic sprawl toward tight songcraft."},
    {t:"Truckin'", w:"Garcia / Weir / Lesh / Hunter", al:"American Beauty", y:1970, f:"The New Orleans bust in it references a real 1970 drug raid on the band in the French Quarter."},
    {t:"Casey Jones", w:"Garcia / Hunter", al:"Workingman's Dead", y:1970, f:"Hunter always insisted the cocaine-and-a-train imagery was a cautionary tale, not an endorsement."},
    {t:"China Cat Sunflower", w:"Garcia / Hunter", al:"Aoxomoxoa", y:1969, f:"Nearly always segued into 'I Know You Rider' — the beloved China>Rider pairing."},
    {t:"St. Stephen", w:"Garcia / Lesh / Hunter", al:"Aoxomoxoa", y:1969, f:"A psychedelic-era staple retired for years; its rare late-'70s revivals were cause for celebration."},
    {t:"Dark Star", w:"Garcia / Lesh / Hart / Kreutzmann / McKernan / Weir / Hunter", al:"Live/Dead", y:1969, f:"The 23-minute Live/Dead version is often cited as THE document of the band's improvisational powers."},
    {t:"Playing in the Band", w:"Weir / Hart / Hunter", al:"Grateful Dead (Skull & Roses)", y:1971, f:"Built on an odd 10/4 feel, its open jam could sprawl 20+ minutes and reconnect much later in the show."},
    {t:"Estimated Prophet", w:"Weir / Barlow", al:"Terrapin Station", y:1977, f:"Rolling along in 7/4, Barlow based its megalomaniac narrator on the wild-eyed self-proclaimed prophets who haunted backstage."},
    {t:"Jack Straw", w:"Weir / Hunter", al:"Grateful Dead (Skull & Roses)", y:1971, f:"Originally all Weir, it later became a trading-verses duet between Weir and Garcia."},
    {t:"Box of Rain", w:"Lesh / Hunter", al:"American Beauty", y:1970, f:"Phil wrote the music for his dying father — and it was the very last song the band ever played, at the final show in July 1995."},
    {t:"He's Gone", w:"Garcia / Hunter", al:"Europe '72", y:1972, f:"Originally aimed at a manager who allegedly robbed the band, it grew into a communal elegy for departed friends."},
    {t:"Cats Under the Stars", w:"Garcia / Hunter", al:"Cats Under the Stars", y:1978, f:"Garcia called this JGB album his personal favorite — even though it sold poorly on release."},
    {t:"Deal", w:"Garcia / Hunter", al:"Garcia", y:1972, f:"A gambling-themed rocker that became a JGB set-closer showcase for Garcia's long, building solos."},
    {t:"Mission in the Rain", w:"Garcia / Hunter", al:"Reflections", y:1976, f:"Set in SF's Mission District, the Dead played it only a handful of times — it lived mostly in the JGB book."},
    {t:"Catalina", w:"Steve Kimock / John Cipollina", al:"Zero (live staple)", y:1987, f:"A Zero instrumental showcase for the twin-guitar interplay between Steve Kimock and Quicksilver legend John Cipollina."},
    {t:"Chance in a Million", w:"Steve Kimock / Robert Hunter", al:"Chance in a Million", y:1994, f:"Robert Hunter lent his pen to Zero, extending the Dead songwriting lineage into the Bay Area jam scene."}
  ];
  var SHOWS = ["Cornell · 5/8/77","Veneta · 8/27/72","Barton Hall · '77","Winterland · '74",
    "Englishtown · 9/3/77","Radio City · '80","Fillmore East · '70","Capitol Theatre · '71"];

  // ── Hanz & Franz personas: Hanz is the loud bickerer, Franz is the softy who knows the facts. ──
  // Each shuffle pulls a FRESH exchange keyed off the song's real facts — funny + knowledgeable, no lyrics.
  var HANZ = "🎩 Hanz", FRANZ = "🌶️ Franz";
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
  // Hanz's hot-take openers (bickerer). Franz answers with the actual fact (softy/knower).
  function hfExchange(rec){
    var openers = [
      "THIS is the version, don't @ me.",
      "Crank it — oh wait, it's a browser tab.",
      "Skip the intro, get to the jam!",
      "Nobody plays it like the '77 boys.",
      "I could listen to this on a loop forever.",
      "Best song they ever wrote, case closed.",
      "Put it ON, let it RIDE!",
      "See? THIS is why I bring the vinyl money."
    ];
    var softyLeadins = ["Actually, sweetheart —","Easy, Hanz —","Here's the thing —","Ooh, fun one —","Facts first, love —","Breathe, and know this —"];
    var open = pick(openers);
    var fact = pick(softyLeadins) + " '" + rec.t + "' (" + rec.w + ", " + rec.al + ", " + rec.y + "). " + rec.f;
    // ~25% of the time they just agree, softy-style.
    if(Math.random() < 0.25){
      var agree = pick([
        "no notes — just dance. 🌹",
        "okay okay… we both love this one.",
        "chills. every. time.",
        "unimpeachable. take it home on vinyl. 💿"
      ]);
      return { h: HANZ+" & "+FRANZ+": "+agree, f:"", fact:fact };
    }
    return { h: HANZ+": "+open, f: FRANZ+": "+esc(fact), fact:fact };
  }
  function esc(s){ return (s==null?'':String(s)).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }

  var css = ""
   + "#npbar{position:fixed;left:0;right:0;bottom:61px;z-index:54;transform:translateY(0);transition:transform .3s cubic-bezier(.4,0,.2,1);"
   + "background:linear-gradient(120deg,#160c28,#2a1650 70%,#3a1d5e);"
   + "border-top:1px solid #4a2f6f;box-shadow:0 -6px 24px #0007;color:#f3ecff;"
   + "font:14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:8px 12px calc(8px + env(safe-area-inset-bottom))}"
   // TUCKED: slide the whole bar down behind the footnav, leaving only the handle strip visible (~75% hidden).
   + "#npbar.tucked{transform:translateY(calc(100% - 20px))}"
   + "#npbar .np-tuck{position:absolute;top:-15px;left:50%;transform:translateX(-50%);width:56px;height:19px;border-radius:10px 10px 0 0;border:0;background:#3a1d5e;color:#f3ecff;font-size:12px;line-height:19px;padding:0;cursor:pointer;box-shadow:0 -2px 6px #0004;z-index:2}"
   + "#npbar .row{display:flex;align-items:center;gap:9px;max-width:720px;margin:0 auto}"
   + "#npbar .disc{width:30px;height:30px;border-radius:50%;flex:none;background:conic-gradient(from 0deg,#0e0716,#5a2e86,#0e0716);box-shadow:inset 0 0 0 4px #201233,0 0 0 1px #ffffff22}"
   + "#npbar .disc.spin{animation:npspin 3s linear infinite}@keyframes npspin{to{transform:rotate(360deg)}}"
   + "#npbar .meta{flex:1;min-width:0}#npbar .t{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
   + "#npbar .s{font-size:11px;color:#b7a9d6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
   + "#npbar button{border:0;border-radius:10px;padding:8px 11px;font-weight:800;cursor:pointer;font-size:13px;white-space:nowrap}"
   + "#npbar .sh{background:#241638;color:#e9d8ff}#npbar .pp{background:#5a2e86;color:#fff;width:38px}"
   + "#npbar .vinyl{background:#ffd76a;color:#3a1d00;text-decoration:none;display:inline-flex;align-items:center;gap:6px;padding:8px 11px;border-radius:10px;font-weight:900;cursor:pointer;border:0;font-size:13px}"
   + "#npbar .vinyl svg{display:block;flex:none}"
   // ── dice tooltip ──
   + "#npbar .sh[data-tip]{position:relative}"
   + "#npbar .sh[data-tip]:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#0e0716;color:#f3ecff;font-size:11px;font-weight:700;padding:5px 9px;border-radius:7px;white-space:nowrap;box-shadow:0 4px 12px #0007;pointer-events:none}"
   + "#npbar .sh[data-tip]:hover::before{content:'';position:absolute;bottom:calc(100% + 3px);left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:#0e0716}"
   // ── controls row (sits BELOW the shuffled-version text) ──
   + "#npbar .ctl{display:flex;align-items:center;gap:8px;max-width:720px;margin:7px auto 0;justify-content:flex-end}"
   + "#npbar .dj{max-width:720px;margin:7px auto 0;font-size:11.5px;color:#d7c9ef;line-height:1.5}"
   + "#npbar .dj .hf{display:flex;align-items:flex-start;gap:5px;flex-wrap:wrap}"
   + "#npbar .dj .hfline{flex:1;min-width:60%}"
   // ── H&F reactions ──
   + "#npbar .rx{display:inline-flex;align-items:center;gap:2px;position:relative}"
   + "#npbar .rxbtn{background:#241638;border:0;color:#e9d8ff;border-radius:999px;padding:2px 8px;font-size:12px;cursor:pointer}"
   + "#npbar .rxbtn:hover{background:#3a1d5e}"
   + "#npbar .rxpop{position:absolute;bottom:calc(100% + 6px);left:0;background:#0e0716;border:1px solid #4a2f6f;border-radius:999px;padding:4px 7px;display:none;gap:5px;z-index:5;box-shadow:0 6px 18px #0008}"
   + "#npbar .rx:hover .rxpop,#npbar .rxpop.on{display:flex}"
   + "#npbar .rxpop span{cursor:pointer;font-size:17px;transition:.1s}#npbar .rxpop span:hover{transform:scale(1.35)}"
   + "#npbar .rxcount{font-size:10.5px;color:#b7a9d6;margin-left:2px}"
   // ── skinny engagement bar ──
   + "#npbar .eng{max-width:720px;margin:7px auto 0;position:relative}"
   + "#npbar .eng .box{width:100%;box-sizing:border-box;background:#0e0716;border:1px solid #4a2f6f;border-radius:999px;color:#f3ecff;font:12.5px/1.4 inherit;padding:8px 44px 8px 13px;outline:none}"
   + "#npbar .eng .box:focus{border-color:#c79a3a}"
   + "#npbar .eng .box::placeholder{color:#8a7ca8}"
   // radiating HyperPost send button INSIDE the box (sonar rings)
   + "#npbar .eng .hp{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:50%;border:0;background:#b8002e;color:#fff;font-size:14px;cursor:pointer;display:grid;place-items:center;z-index:2}"
   + "#npbar .eng .hp::before,#npbar .eng .hp::after{content:'';position:absolute;inset:0;border-radius:50%;border:2px solid #b8002e;animation:npsonar 2.2s ease-out infinite;pointer-events:none}"
   + "#npbar .eng .hp::after{animation-delay:1.1s}"
   + "@keyframes npsonar{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.1);opacity:0}}"
   + "#npbar .eng .voicelbl{font-size:9.5px;color:#8a7ca8;margin:3px 0 0 13px}"
   // ── persistent, dismissible license notice ──
   + "#np_lic{position:fixed;left:50%;transform:translateX(-50%);bottom:150px;z-index:92;max-width:min(94vw,440px);background:#160c28;border:1px solid #c79a3a;border-radius:14px;color:#f3ecff;padding:13px 40px 13px 15px;box-shadow:0 14px 40px #0009;font:13px/1.5 -apple-system,sans-serif;display:none}"
   + "#np_lic.on{display:block}"
   + "#np_lic b{color:#ffd76a}"
   + "#np_lic .go{display:inline-block;margin-top:9px;background:#ffd76a;color:#3a1d00;font-weight:800;border:0;border-radius:9px;padding:8px 13px;cursor:pointer;font-size:12.5px}"
   + "#np_lic .licx{position:absolute;top:8px;right:9px;background:#ffffff18;border:0;color:#f3ecff;width:26px;height:26px;border-radius:13px;font-size:15px;cursor:pointer}"
   + "#npbar .x{background:none!important;color:#9a8fb0;width:auto;padding:6px}"
   + "#npbar .hide2{display:none}@media(max-width:520px){#npbar .hide2{display:none}#npbar .lbl{display:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var bar = document.createElement("div"); bar.id = "npbar";
  bar.innerHTML =
    '<div class="row">'
    + '<div class="disc" id="npDisc"></div>'
    + '<div class="meta"><div class="t" id="npT">🎲 Tap ▶ — ambient bed while you browse</div><div class="s" id="npS">🎶 house-made loop · the Dead songbook lights up once licensed</div></div>'
    + '</div>'
    // controls row — sits BELOW the "Shuffled version" text (per spec #6)
    + '<div class="ctl">'
    +   '<button class="sh" data-tip="Shuffle play" onclick="npShuffle(\'song\')">🎲<span class="lbl"> Song</span></button>'
    +   '<button class="sh hide2" data-tip="Shuffle a show" onclick="npShuffle(\'show\')">📻<span class="lbl"> Show</span></button>'
    +   '<button class="pp" id="npPP" onclick="npPreview()" title="Play the house-made ambient bed (the real songbook once licensed)">▶︎</button>'
    +   '<button class="vinyl" id="npVinyl" onclick="npOwnIt()" title="Tap vinyl to own it — opens the Record Store">'
    +     '<svg width="20" height="20" viewBox="0 0 24 24" aria-label="Records"><circle cx="12" cy="12" r="11" fill="#1a1030"/><circle cx="12" cy="12" r="8.4" fill="none" stroke="#c79a3a" stroke-width=".8" opacity=".5"/><circle cx="12" cy="12" r="5.2" fill="#e6b23c"/><circle cx="12" cy="12" r="1.2" fill="#1a1030"/></svg>'
    +     '<span>Own it</span></button>'
    + '</div>'
    + '<div class="dj" id="npDJ"></div>'
    // reactions on Hanz & Franz
    + '<div class="dj" id="npReact" style="margin-top:5px"></div>'
    // skinny engagement bar (reply box + radiating HyperPost button inside it)
    + '<div class="eng">'
    +   '<input class="box" id="npReply" type="text" placeholder="Reply to the family… (a human always clicks)" autocomplete="off">'
    +   '<button class="hp" id="npHP" onclick="npHyper()" title="HyperPost — send to your Coms in one click">📡</button>'
    +   '<div class="voicelbl" id="npVoiceLbl">Claude-Gaude pre-fill · learns your voice · live per-voice generation activates at Step 2</div>'
    + '</div>'
    // tuck handle
    + '<button class="np-tuck" id="npTuck" onclick="npTuck()" title="tuck / raise the bar">▼</button>';

  function mount(){ if(document.getElementById("npbar")) return; document.body.appendChild(bar);
    rollDJ(); paintReact(); prefillReply();
    // persist + restore tuck state (measured, so it restores fully tucked)
    try{ if(localStorage.getItem("dd.np.tuck")==="1"){ applyTuck(true); } }catch(e){}
  }

  // ── H&F: fresh riff each shuffle, drawn from the SONGFACTS bank (facts only) ──
  var curRec = null;
  function rollDJ(rec){
    var e=document.getElementById("npDJ"); if(!e) return;
    rec = rec || curRec || pick(SONGFACTS); curRec = rec;
    var ex, lore = [];
    // H&F also riff on Jerry's guitars + his bands (guitar_facts.js / band_facts.js)
    if (window.GDGuitars && GDGuitars.HF) lore = lore.concat(GDGuitars.HF);
    if (window.GDBands && GDBands.HF) lore = lore.concat(GDBands.HF);
    if (lore.length && Math.random() < 0.35) {
      var g = pick(lore);
      ex = { h: HANZ + ": " + esc(g.h), f: FRANZ + ": " + esc(g.f) };
    } else { ex = hfExchange(rec); }
    e.innerHTML = '<div class="hf"><span class="hfline">'+ex.h+'</span></div>'
      + (ex.f ? '<div class="hf" style="margin-top:3px"><span class="hfline">'+ex.f+'</span></div>' : '');
  }

  // ── Reactions on Hanz & Franz — hover popup, local tally in dd.hf.react ──
  var EMO = [["🌹","rose"],["🔥","fire"],["😂","laugh"],["🎸","axe"],["👍","like"]];
  function reactState(){ try{ return JSON.parse(localStorage.getItem("dd.hf.react")||"{}"); }catch(e){ return {}; } }
  function reactSave(o){ try{ localStorage.setItem("dd.hf.react", JSON.stringify(o)); }catch(e){} }
  window.npReactVote = function(who,key){
    var s=reactState(); s[who]=s[who]||{}; s[who][key]=(s[who][key]||0)+1; reactSave(s); paintReact();
    if(window.toast) toast("Reacted to "+(who==="H"?"Hanz":"Franz")+" "+key+" — tallied locally 🌹");
  };
  function reactCell(who,label){
    var s=reactState()[who]||{}; var total=0; for(var k in s) total+=s[k];
    var pop=EMO.map(function(p){ return '<span onclick="npReactVote(\''+who+'\',\''+p[0]+'\')">'+p[0]+'</span>'; }).join('');
    return '<span class="rx"><button class="rxbtn">'+label+' 😊</button>'
      + '<span class="rxpop">'+pop+'</span></span>'
      + '<span class="rxcount">'+(total?('· '+total):'')+'</span>';
  }
  function paintReact(){ var e=document.getElementById("npReact"); if(!e) return;
    e.innerHTML = 'React: &nbsp;'+reactCell("H","🎩 Hanz")+' &nbsp;&nbsp; '+reactCell("F","🌶️ Franz"); }

  window.npShuffle = function(kind){
    // Auto-play on shuffle: default audio state = playing (house-made ambient bed, honest-state).
    if(!AUD.on) ambientStart();
    setPlay(true); var b=document.getElementById("npPP"); if(b)b.textContent="❚❚";
    if(kind==="show"){
      var sh=pick(SHOWS); set("📻 "+sh, "Shuffled show · full set · Grateful Dead");
      curRec = pick(SONGFACTS); rollDJ(curRec);
      if(window.toast) toast("📻 “"+sh+"” — a whole show, on shuffle. (Audio lights up once the songbook's licensed.)");
    } else {
      var rec=pick(SONGFACTS); curRec=rec;
      set("🎵 "+rec.t, "Shuffled version · 💿 tap Own it for the Record Store");
      rollDJ(rec);
      if(window.toast) toast("🎲 “"+rec.t+"” — great version. Ambient bed on. 💿 Own it on vinyl.");
    }
    paintReact(); prefillReply(true);
  };

  // ── house-made ambient bed (Web Audio, zero copyright — real Dead songbook lights up once licensed) ──
  var AUD={ctx:null,on:false,gain:null,nodes:[]};
  function ambientStart(){ try{
    if(!AUD.ctx) AUD.ctx=new (window.AudioContext||window.webkitAudioContext)();
    var c=AUD.ctx; if(c.state==='suspended') c.resume();
    if(AUD.on) return;
    var g=c.createGain(); g.gain.value=0; g.connect(c.destination);
    var lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=650; lp.connect(g);
    [110,164.81,220].forEach(function(f,i){ var o=c.createOscillator(); o.type=(i===2?'triangle':'sine'); o.frequency.value=f; o.detune.value=(i-1)*5; o.connect(lp); o.start(); AUD.nodes.push(o); });
    var lfo=c.createOscillator(); lfo.frequency.value=0.07; var lg=c.createGain(); lg.gain.value=0.025; lfo.connect(lg); lg.connect(g.gain); lfo.start(); AUD.nodes.push(lfo);
    g.gain.setTargetAtTime(0.055, c.currentTime, 1.3); AUD.gain=g; AUD.on=true;
  }catch(e){ AUD.on=false; } }
  function ambientStop(){ try{ if(AUD.gain&&AUD.ctx) AUD.gain.gain.setTargetAtTime(0, AUD.ctx.currentTime, 0.4);
    var ns=AUD.nodes; AUD.nodes=[]; setTimeout(function(){ ns.forEach(function(o){try{o.stop()}catch(e){}}); },700); AUD.on=false; }catch(e){} }
  window.npPreview = function(){ var b=document.getElementById("npPP");
    if(AUD.on){ ambientStop(); setPlay(false); if(b)b.textContent="▶︎"; if(window.toast) toast("⏸ Paused the ambient bed."); }
    else { ambientStart(); setPlay(true); if(b)b.textContent="❚❚"; if(window.toast) toast("🎶 Ambient bed on — a house-made loop while you browse. The real Dead songbook lights up once licensed. 💿"); } };
  window.npToggle = window.npPreview;
  function setPlay(on){ var d=document.getElementById("npDisc"); if(d) d.className = "disc"+(on?" spin":""); }

  // ── "Tap vinyl to own it" → OPEN the Record Store (ddSheet modal) + persistent license notice ──
  window.npOwnIt = function(){
    // 1) open the Record Store in the app's in-app sheet modal (same pattern as footnav)
    if(window.ddSheet){ ddSheet('record_store.html','💿 Shakedown Records'); }
    else { window.open('record_store.html','_blank','noopener'); }
    // 2) show the PERSISTENT, dismissible license notice (NOT a fast toast)
    showLicense();
  };
  function showLicense(){
    var n=document.getElementById("np_lic");
    if(!n){ n=document.createElement("div"); n.id="np_lic";
      n.innerHTML = '<button class="licx" onclick="npLicClose()" aria-label="Dismiss">✕</button>'
        + '<b>Honest-state notice.</b> No licensed song audio plays here yet — what you hear is a '
        + 'house-made ambient bed. The real Grateful Dead songbook lights up once the recordings are '
        + 'cleared (a licensed right). Loving a version? <b>Own it on vinyl</b> in the Record Store — '
        + 'that\'s a real purchase, and it supports getting the catalogue licensed. 🌹'
        + '<br><button class="go" onclick="npLicStore()">💿 Browse the Record Store</button>';
      document.body.appendChild(n);
    }
    n.classList.add("on");
  }
  window.npLicClose = function(){ var n=document.getElementById("np_lic"); if(n) n.classList.remove("on"); };
  window.npLicStore = function(){ npLicClose(); if(window.ddSheet) ddSheet('record_store.html','💿 Shakedown Records'); };

  // ── skinny engagement bar: Claude-Gaude pre-fill + radiating HyperPost send ──
  // STUB (honest): live per-user voice GENERATION activates at Step 2 (needs the backend/AI call).
  // Now: we save a per-user voice sample locally in dd.voice and echo a simple honest-state placeholder.
  function prefillReply(force){
    var el=document.getElementById("npReply"); if(!el) return;
    if(el.value && !force) return;
    // Prefer the site's Claude-Gaude drafter if present (dd_hyperpost.js), else an honest stub.
    if(window.DDHyper && DDHyper.draft){ el.value = DDHyper.draft(); }
    else {
      var song = curRec ? curRec.t : "this one";
      el.value = "Shuffle served up “"+song+"” 🌹 — who else is on this one?";
    }
  }
  function saveVoiceSample(text){
    if(!text || text.length<4) return;
    if(window.DDHyper && DDHyper.learn){ DDHyper.learn(text); return; }
    try{ var v=JSON.parse(localStorage.getItem("dd.voice")||'{"samples":[]}');
      v.samples=(v.samples||[]); v.samples.unshift(text.slice(0,280)); v.samples=v.samples.slice(0,25);
      localStorage.setItem("dd.voice", JSON.stringify(v)); }catch(e){}
  }
  window.npHyper = function(){
    var el=document.getElementById("npReply"); var text=el? el.value.trim() : "";
    if(!text){ if(window.toast) toast("Add a couple words — or let the box pre-fill."); return; }
    saveVoiceSample(text);
    // Wire "send" to the existing HyperPost / FFShare flow if present.
    if(window.DDHyper && DDHyper.post){ DDHyper.post(text); }
    else if(window.FFShare && FFShare.share){ FFShare.share({title:'', text:text, url:location.origin+'/', tags:'#GratefulDead #deaddance'});
      if(window.toast) toast("📡 HyperPosted to your Coms. 🌹"); }
    else { if(window.toast) toast("📡 HyperPost is honest-state here — saved your voice sample; the send flow wires up at Step 2. 🌹"); }
    // NOTE (stub, honest): cross-user reply RANKING + the daily top-3 auto-post need the backend +
    // a scheduled job. No fake rankings are shown. Placeholder only — activates at Step 2.
    if(el) el.value="";
  };

  // ── tuck / raise the bar — REAL accordion. Measured in PIXELS (not %), so it always
  //    slides fully down behind the footnav leaving a fixed ~22px handle, regardless of
  //    content height or the iOS safe-area inset. Inline transform overrides the CSS fallback. ──
  var TUCK_PEEK = 22; // px of handle strip left visible above the footnav
  function applyTuck(tucked){
    var e=document.getElementById("npbar"), b=document.getElementById("npTuck"); if(!e) return;
    if(tucked){
      e.classList.add("tucked");
      var h = e.offsetHeight || 200;                 // force reflow → real height
      e.style.transform = "translateY(" + (h - TUCK_PEEK) + "px)";
      if(b){ b.textContent="▲"; b.title="raise the shuffle bar"; }
    } else {
      e.classList.remove("tucked");
      e.style.transform = "translateY(0)";
      if(b){ b.textContent="▼"; b.title="tuck the shuffle bar"; }
    }
  }
  window.npTuck = function(){
    var e=document.getElementById("npbar"); if(!e) return;
    var tucked = !e.classList.contains("tucked");   // toggle
    applyTuck(tucked);
    try{ localStorage.setItem("dd.np.tuck", tucked?"1":"0"); }catch(x){}
  };

  function set(t,s){ var T=document.getElementById("npT"), S=document.getElementById("npS"); if(T)T.textContent=t; if(S)S.textContent=s; }
  window.npClose = function(){ var e=document.getElementById("npbar"); if(e)e.style.display="none"; };

  // Local fallback toast (host page's toast() wins if present).
  function toast(m){
    if(window.toast && window.toast!==toast){ return window.toast(m); }
    var t=document.getElementById("np_toast");
    if(!t){ t=document.createElement("div"); t.id="np_toast";
      t.style.cssText="position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:#000d;color:#fff;padding:11px 16px;border-radius:999px;font:13px/1.4 -apple-system,sans-serif;z-index:90;max-width:90%;text-align:center;opacity:0;transition:.2s"; document.body.appendChild(t); }
    t.textContent=m; t.style.opacity="1"; clearTimeout(t._h); t._h=setTimeout(function(){ t.style.opacity="0"; }, 3800);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
