/* dd_games.js — Shakedown Games hub + the reusable Game Shell, with the first playable game
   (Dead Song-Title Word Scramble). Self-contained: injects its own styles + overlay, overrides
   the footnav's openGame() to open the hub. Points (Rose Points 🌹) bank locally → Shakedown discounts.
   One-tap Share via FFShare. Hanz & Franz emcee. Honest-state: leaderboard is local/demo until backend. */
(function(){
  'use strict';
  var HF=[ "🎩 Hanz: Put your knowledge on and let it riiide!",
    "🌶️ Franz: He means show us what you got, sweetheart.",
    "🎩 Hanz: Streak’s heating up — don’t you dare cool it now!",
    "🌶️ Franz: Points on the line — that’s discount money, baby." ];
  // Catalog — every game pours into the same shell. status: 'play' | 'soon'
  var CATALOG=[
    {id:'scramble', type:'Wordplay', ic:'🔤', name:'Song-Title Scramble', blurb:'Unscramble the title before the clock runs out.', status:'play'},
    {id:'nametune', type:'Audio', ic:'🎧', name:'Name That Tune', blurb:'A clip drops — race to name it.', status:'soon'},
    {id:'tapers', type:'Audio', ic:'📼', name:'Taper’s Ear', blurb:'Call the year from the mix. AUD or SBD?', status:'soon'},
    {id:'guessshow', type:'Visual', ic:'🖼️', name:'Guess the Show', blurb:'Clues reveal until you nail the date.', status:'soon'},
    {id:'trivia', type:'Knowledge', ic:'🧠', name:'GD Trivia Night', blurb:'Hosted on the Karaoke Machine. Buzz in!', status:'play'},
    {id:'setlist', type:'Knowledge', ic:'📝', name:'Setlist Showdown', blurb:'Predict/order the setlist. Closest wins.', status:'soon'},
    {id:'segue', type:'Knowledge', ic:'➡️', name:'Segue Chain', blurb:'Name what comes next. Scarlet → ___', status:'soon'}
  ];
  var TITLES=["Scarlet Begonias","Fire on the Mountain","Ripple","Sugar Magnolia","Truckin","Casey Jones","Uncle John's Band","Friend of the Devil","Box of Rain","Touch of Grey","Franklin's Tower","Eyes of the World","Bertha","Sugaree","Tennessee Jed","Jack Straw","Ramble On Rose","Brown Eyed Women","Deal","Loser","Wharf Rat","Estimated Prophet","Terrapin Station","Playing in the Band","China Cat Sunflower","I Know You Rider","Dark Star","St Stephen","The Other One","Cassidy","Row Jimmy","Shakedown Street","Althea","Bird Song","Cumberland Blues","Black Peter","He's Gone","Stella Blue","Ship of Fools","US Blues","Help on the Way","Bertha","Cold Rain and Snow"];

  var TRIVIA=[
    {q:"The band became 'the Grateful Dead' in what year?",c:["1963","1965","1967","1971"],a:1},
    {q:"Who wrote the lyrics to most of Jerry Garcia's songs?",c:["Robert Hunter","John Barlow","Bob Weir","Phil Lesh"],a:0},
    {q:"'Ripple' appears on which 1970 album?",c:["Workingman's Dead","American Beauty","Aoxomoxoa","Blues for Allah"],a:1},
    {q:"What instrument did Phil Lesh play?",c:["Bass","Drums","Rhythm guitar","Organ"],a:0},
    {q:"'Pigpen' was the nickname of which founding member?",c:["Ron McKernan","Brent Mydland","Keith Godchaux","Tom Constanten"],a:0},
    {q:"Scarlet Begonias famously segues into…",c:["Fire on the Mountain","Playing in the Band","Eyes of the World","Franklin's Tower"],a:0},
    {q:"The skull-and-lightning-bolt logo is called…",c:["Steal Your Face","Dancing Bear","Terrapin","Sunshine Daydream"],a:0},
    {q:"Which album title is a palindrome?",c:["Aoxomoxoa","Anthem of the Sun","Wake of the Flood","Terrapin Station"],a:0},
    {q:"Where did the Grateful Dead form?",c:["SF Bay Area","Los Angeles","New York","Seattle"],a:0},
    {q:"Jerry Garcia passed away in what year?",c:["1995","1990","1998","2001"],a:0},
    {q:"'Truckin'': what a long, strange ___ it's been.",c:["trip","road","night","ride"],a:0},
    {q:"The band's devoted fans are known as…",c:["Deadheads","Phans","Parrotheads","Junkies"],a:0},
    {q:"'Casey Jones': you better watch your ___.",c:["speed","step","back","time"],a:0},
    {q:"'Dark Star' was a vehicle for extended ___.",c:["improvisation","vocals","drum solos","silence"],a:0},
    {q:"Which two were Dead keyboard players?",c:["Brent Mydland & Keith Godchaux","Bob Weir & Phil Lesh","Mickey Hart & Bill Kreutzmann","Pigpen & Bobby"],a:0},
    {q:"'American Beauty' can also be read as American…",c:["Reality","Dreamer","Rose","Highway"],a:0}
  ];
  var S={score:0,streak:0,round:0,rounds:5,answer:'',timer:null,left:0,gameName:'Shakedown Games'};

  function css(){ if(document.getElementById('ddg-css')) return; var s=document.createElement('style'); s.id='ddg-css';
    s.textContent=
    '.ddgov{position:fixed;inset:0;z-index:140;display:none;background:linear-gradient(160deg,#160c28,#2a1650 70%,#3a1d5e);color:#f3ecff;overflow-y:auto}'+
    '.ddgov.on{display:block}'+
    '.ddg-wrap{max-width:520px;margin:0 auto;padding:16px 16px calc(24px + env(safe-area-inset-bottom));min-height:100%}'+
    '.ddg-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}'+
    '.ddg-title{font-weight:900;font-size:20px;letter-spacing:.3px}'+
    '.ddg-x{border:0;background:#ffffff22;color:#fff;width:36px;height:36px;border-radius:18px;font-size:17px;cursor:pointer}'+
    '.ddg-hf{font-size:12.5px;color:#d7c9ef;background:#ffffff14;border-radius:12px;padding:9px 11px;margin-bottom:12px}'+
    '.ddg-typ{font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#c79a3a;margin:14px 0 6px}'+
    '.ddg-card{display:flex;align-items:center;gap:11px;background:#ffffff10;border:1px solid #ffffff22;border-radius:14px;padding:11px 12px;margin-bottom:8px;cursor:pointer}'+
    '.ddg-card .ic{font-size:22px}.ddg-card b{font-size:15px}.ddg-card .bl{display:block;font-size:12px;color:#bfb2df}'+
    '.ddg-card .go{margin-left:auto;font-weight:800;font-size:12px;background:#c79a3a;color:#2a1650;border-radius:999px;padding:5px 11px}'+
    '.ddg-card.soon{opacity:.6}.ddg-card.soon .go{background:#ffffff26;color:#e9d8ff}'+
    '.ddg-hud{display:flex;gap:8px;justify-content:space-between;background:#ffffff12;border-radius:12px;padding:10px;margin:6px 0 14px}'+
    '.ddg-hud div{text-align:center;flex:1}.ddg-hud .n{font-weight:900;font-size:18px}.ddg-hud .l{font-size:10px;color:#bfb2df;text-transform:uppercase;letter-spacing:.4px}'+
    '.ddg-scr{font-family:ui-monospace,Menlo,monospace;font-weight:900;font-size:26px;letter-spacing:3px;text-align:center;background:#0e0716;border-radius:14px;padding:18px 10px;margin:6px 0 12px;word-break:break-word}'+
    '.ddg-in{width:100%;border:0;border-radius:12px;padding:13px;font-size:16px;text-align:center;margin-bottom:8px}'+
    '.ddg-btns{display:flex;gap:8px}.ddg-btn{flex:1;border:0;border-radius:12px;padding:13px;font-weight:800;font-size:15px;cursor:pointer;background:#c79a3a;color:#2a1650}'+
    '.ddg-btn.alt{background:#ffffff1f;color:#f3ecff}'+
    '.ddg-reveal{text-align:center;font-size:15px;margin:10px 0;min-height:22px}'+
    '.ddg-end{text-align:center}.ddg-end .big{font-size:40px;font-weight:900;color:#c79a3a}'+
    '.ffsh-btn{border:0;background:#c79a3a;color:#2a1650;border-radius:999px;padding:11px 16px;font-weight:800;cursor:pointer;margin-top:8px}';
    document.head.appendChild(s);
  }
  function ov(){ var o=document.getElementById('ddgov'); if(!o){ o=document.createElement('div'); o.id='ddgov'; o.className='ddgov'; document.body.appendChild(o); } return o; }
  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
  function norm(s){ return (s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim(); }
  function points(){ try{ return parseInt(localStorage.getItem('dd.points')||'0',10)||0; }catch(e){ return 0; } }
  function addPoints(n){ try{ localStorage.setItem('dd.points', String(points()+n)); }catch(e){} }

  function open(){ css(); render(lobby()); ov().classList.add('on'); }
  function close(){ clearInterval(S.timer); var o=document.getElementById('ddgov'); if(o) o.classList.remove('on'); }
  function render(body){ ov().innerHTML='<div class="ddg-wrap"><div class="ddg-top"><div class="ddg-title">🎮 Shakedown Games</div><button class="ddg-x" onclick="DDGames.close()">✕</button></div>'+body+'</div>';
    if(window.FFShare&&FFShare.wire) FFShare.wire(document.getElementById('ddgov')); }

  function lobby(){
    var types={}; CATALOG.forEach(function(g){ (types[g.type]=types[g.type]||[]).push(g); });
    var order=['Wordplay','Knowledge','Audio','Visual'];
    var h='<div class="ddg-hf">'+esc(pick(HF))+'</div>'+
      '<div class="ddg-hud" style="margin-top:0"><div><div class="n">🌹 '+points()+'</div><div class="l">your points → discounts</div></div></div>';
    order.forEach(function(t){ if(!types[t])return;
      h+='<div class="ddg-typ">'+t+'</div>';
      types[t].forEach(function(g){ h+='<div class="ddg-card'+(g.status==='play'?'':' soon')+'"'+(g.status==='play'?' onclick="DDGames.play(\''+g.id+'\')"':'')+'>'+
        '<span class="ic">'+g.ic+'</span><div><b>'+esc(g.name)+'</b><span class="bl">'+esc(g.blurb)+'</span></div>'+
        '<span class="go">'+(g.status==='play'?'Play':'Soon')+'</span></div>'; });
    });
    return h;
  }
  window.DDGames={ open:open, close:close, play:function(id){ if(id==='scramble') startScramble(); else if(id==='trivia') startTrivia(); else open(); } };
  // Games button opens the hub.
  window.openGame=open;

  /* ---------- Game #1: Word Scramble (in the shell) ---------- */
  function scramble(t){ return t.split(' ').map(function(w){ if(w.length<3) return w; var a=w.split(''); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var x=a[i];a[i]=a[j];a[j]=x; } var s=a.join(''); return (s.toLowerCase()===w.toLowerCase())?scramble1(w):s; }).join('  '); }
  function scramble1(w){ return w.split('').reverse().join(''); }
  function startScramble(){ S.score=0; S.streak=0; S.round=0; S.gameName='Song-Title Scramble'; nextScramble(); }
  function nextScramble(){
    clearInterval(S.timer); S.round++;
    if(S.round>S.rounds){ return endGame(); }
    S.answer=pick(TITLES); S.left=30;
    render(hud()+
      '<div class="ddg-scr">'+esc(scramble(S.answer))+'</div>'+
      '<input class="ddg-in" id="ddgIn" placeholder="type the song title…" autocomplete="off" autocapitalize="off">'+
      '<div class="ddg-reveal" id="ddgRev"></div>'+
      '<div class="ddg-btns"><button class="ddg-btn" onclick="DDGames.guess()">Guess</button><button class="ddg-btn alt" onclick="DDGames.skip()">Skip</button></div>');
    var inp=document.getElementById('ddgIn'); if(inp){ inp.focus(); inp.onkeydown=function(e){ if(e.key==='Enter') DDGames.guess(); }; }
    S.timer=setInterval(function(){ S.left--; var t=document.getElementById('ddgT'); if(t) t.textContent=S.left; if(S.left<=0){ clearInterval(S.timer); reveal(false); } },1000);
  }
  function hud(){ return '<div class="ddg-hud">'+
    '<div><div class="n" id="ddgSc">'+S.score+'</div><div class="l">score</div></div>'+
    '<div><div class="n">🔥 '+S.streak+'</div><div class="l">streak</div></div>'+
    '<div><div class="n" id="ddgT">'+S.left+'</div><div class="l">seconds</div></div>'+
    '<div><div class="n">'+S.round+'/'+S.rounds+'</div><div class="l">round</div></div></div>'; }
  window.DDGames.guess=function(){ var v=document.getElementById('ddgIn'); if(!v) return; reveal(norm(v.value)===norm(S.answer)); };
  window.DDGames.skip=function(){ reveal(false); };
  function reveal(ok){
    clearInterval(S.timer); var rev=document.getElementById('ddgRev'); var gain=0;
    if(ok){ S.streak++; gain=100+S.left*3+(S.streak>=3?50:0); S.score+=gain; if(rev) rev.innerHTML='✅ <b>'+esc(S.answer)+'</b> — +'+gain+(S.streak>=3?' 🔥 streak!':''); }
    else { S.streak=0; if(rev) rev.innerHTML='⏱️ It was <b>'+esc(S.answer)+'</b>'; }
    var sc=document.getElementById('ddgSc'); if(sc) sc.textContent=S.score;
    var b=document.querySelector('.ddg-btns'); if(b) b.innerHTML='<button class="ddg-btn" onclick="DDGames.next()">'+(S.round>=S.rounds?'See results →':'Next →')+'</button>';
  }
  window.DDGames.next=function(){ nextScramble(); };
  /* ---------- Game #2: GD Trivia Night (same shell; Karaoke-Machine ready) ---------- */
  function startTrivia(){ S.score=0; S.streak=0; S.round=0; S.gameName='GD Trivia'; S.tq=TRIVIA.slice().sort(function(){return Math.random()-0.5;}); nextTrivia(); }
  function nextTrivia(){
    clearInterval(S.timer); S.round++;
    if(S.round>S.rounds){ return endGame(); }
    S.q=S.tq[(S.round-1)%S.tq.length]; S.left=15;
    var choices=S.q.c.map(function(t,i){ return '<button class="ddg-btn alt" style="margin-bottom:8px;width:100%;text-align:left" data-i="'+i+'" onclick="DDGames.answer('+i+')">'+esc(t)+'</button>'; }).join('');
    render(hud()+
      '<div class="ddg-scr" style="font-size:17px;letter-spacing:normal;font-family:inherit;font-weight:800">'+esc(S.q.q)+'</div>'+
      '<div id="ddgChoices">'+choices+'</div>'+
      '<div class="ddg-reveal" id="ddgRev"></div>');
    S.timer=setInterval(function(){ S.left--; var t=document.getElementById('ddgT'); if(t) t.textContent=S.left; if(S.left<=0){ clearInterval(S.timer); DDGames.answer(-1); } },1000);
  }
  window.DDGames.answer=function(i){
    if(!S.q) return; clearInterval(S.timer);
    var ok=(i===S.q.a), gain=0;
    document.querySelectorAll('#ddgChoices .ddg-btn').forEach(function(b){ var bi=+b.dataset.i; b.onclick=null;
      if(bi===S.q.a){ b.style.background='#2a8a4a'; b.style.color='#fff'; } else if(bi===i){ b.style.background='#b8002e'; b.style.color='#fff'; } });
    var rev=document.getElementById('ddgRev');
    if(ok){ S.streak++; gain=100+S.left*4+(S.streak>=3?50:0); S.score+=gain; if(rev) rev.innerHTML='✅ +'+gain+(S.streak>=3?' 🔥 streak!':' — buzz-in bonus'); }
    else { S.streak=0; if(rev) rev.innerHTML=(i<0?'⏱️ Time! ':'❌ ')+'Answer: <b>'+esc(S.q.c[S.q.a])+'</b>'; }
    var sc=document.getElementById('ddgSc'); if(sc) sc.textContent=S.score;
    var ch=document.getElementById('ddgChoices'); if(ch) ch.insertAdjacentHTML('afterend','<button class="ddg-btn" style="margin-top:6px" onclick="DDGames.nextT()">'+(S.round>=S.rounds?'See results →':'Next →')+'</button>');
  };
  window.DDGames.nextT=function(){ nextTrivia(); };

  function endGame(){
    var earned=Math.round(S.score/10); addPoints(earned);
    var share=(window.FFShare&&FFShare.button)?FFShare.button({title:'I scored '+S.score+' on Shakedown '+S.gameName+' 🌹', text:'Think you know your Dead? Beat me.', tags:'#GratefulDead #deaddance'}):'';
    render('<div class="ddg-end"><div class="ddg-hf">'+esc(pick(HF))+'</div>'+
      '<div class="big">'+S.score+'</div><div>final score</div>'+
      '<div style="margin:10px 0">🌹 <b>+'+earned+'</b> Rose Points banked → Shakedown discounts <span style="opacity:.7">(total '+points()+')</span></div>'+
      share+
      '<div class="ddg-btns" style="margin-top:12px"><button class="ddg-btn" onclick="DDGames.play(\'scramble\')">Play again</button><button class="ddg-btn alt" onclick="DDGames.open()">More games</button></div>'+
      '<div style="font-size:11px;color:#bfb2df;margin-top:12px">Leaderboard + live rooms turn on with the backend. Points bank now; redeem for discounts once the store is live.</div></div>');
  }
})();
