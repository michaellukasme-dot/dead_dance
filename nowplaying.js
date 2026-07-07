/* nowplaying.js — "The Archive, baked in."
   A self-mounting, persistent Now-Playing bar: Shuffle a Song / Shuffle a Show,
   background-music-on-while-you-browse, Hanz & Franz as your DJs, and a
   "Get it on vinyl" tap on every listen (→ records sold).
   HONEST-STATE: no audio actually plays yet — the recordings are a licensed right
   (see ARCHIVE_baked_in_doctrine.md). This is the experience, gated until cleared.
   Mount: include <script src="nowplaying.js"></script>. Skips itself on the coming-soon page. */
(function () {
  if (window.__np_mounted) return; window.__np_mounted = true;

  var SONGS = ["Scarlet Begonias","Eyes of the World","Franklin's Tower","Standing on the Moon",
    "Sugar Magnolia","Bird Song","Fire on the Mountain","Ripple","Bertha","Terrapin Station",
    "Catalina — Zero","Chance in a Million — Zero","Cats Under the Stars — JGB","Deal — JGB"];
  var SHOWS = ["Cornell · 5/8/77","Veneta · 8/27/72","Barton Hall · '77","Winterland · '74",
    "Englishtown · 9/3/77","Radio City · '80","Fillmore East · '70","Capitol Theatre · '71"];
  var DJ = [
    "🎩 Hanz: Put one on and let it riiide! &nbsp;🌶️ Franz: He means press shuffle, sweetheart.",
    "🌶️ Franz: THIS version is the one. &nbsp;🎩 Hanz: Every version is the one, that's the whole point!",
    "🎩 Hanz: Crank it. &nbsp;🌶️ Franz: It's a browser tab, Hanz, there's no knob.",
    "🌶️ Franz: Veneta smokes Cornell. &nbsp;🎩 Hanz: Here we go again, folks.",
    "🎩 Hanz &amp; 🌶️ Franz: Loving it? Take it home on vinyl. 🌹"
  ];
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }

  var css = ""
   + "#npbar{position:fixed;left:0;right:0;bottom:61px;z-index:54;background:linear-gradient(120deg,#160c28,#2a1650 70%,#3a1d5e);"
   + "border-top:1px solid #4a2f6f;box-shadow:0 -6px 24px #0007;color:#f3ecff;"
   + "font:14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:8px 12px calc(8px + env(safe-area-inset-bottom))}"
   + "#npbar .row{display:flex;align-items:center;gap:9px;max-width:720px;margin:0 auto}"
   + "#npbar .disc{width:30px;height:30px;border-radius:50%;flex:none;background:conic-gradient(from 0deg,#0e0716,#5a2e86,#0e0716);box-shadow:inset 0 0 0 4px #201233,0 0 0 1px #ffffff22}"
   + "#npbar .disc.spin{animation:npspin 3s linear infinite}@keyframes npspin{to{transform:rotate(360deg)}}"
   + "#npbar .meta{flex:1;min-width:0}#npbar .t{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
   + "#npbar .s{font-size:11px;color:#b7a9d6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
   + "#npbar button{border:0;border-radius:10px;padding:8px 11px;font-weight:800;cursor:pointer;font-size:13px;white-space:nowrap}"
   + "#npbar .sh{background:#241638;color:#e9d8ff}#npbar .pp{background:#5a2e86;color:#fff;width:38px}"
   + "#npbar .vinyl{background:#ffd76a;color:#3a1d00;text-decoration:none;display:inline-flex;align-items:center;padding:8px 11px;border-radius:10px;font-weight:900}"
   + "#npbar .dj{max-width:720px;margin:6px auto 0;font-size:11.5px;color:#d7c9ef;text-align:center}"
   + "#npbar .x{background:none!important;color:#9a8fb0;width:auto;padding:6px}"
   + "#npbar .hide2{display:none}@media(max-width:520px){#npbar .hide2{display:none}#npbar .lbl{display:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var bar = document.createElement("div"); bar.id = "npbar";
  bar.innerHTML =
    '<div class="row">'
    + '<div class="disc" id="npDisc"></div>'
    + '<div class="meta"><div class="t" id="npT">🎲 Tap Shuffle — put the Dead on</div><div class="s" id="npS">the Archive, baked in · background music while you browse</div></div>'
    + '<button class="sh" onclick="npShuffle(\'song\')">🎲<span class="lbl"> Song</span></button>'
    + '<button class="sh hide2" onclick="npShuffle(\'show\')">📻<span class="lbl"> Show</span></button>'
    + '<button class="pp" id="npPP" onclick="npToggle()">▶︎</button>'
    + '<a class="vinyl" id="npVinyl" href="record_store.html" title="Get it on vinyl">💿</a>'
    + '<button class="x" onclick="npClose()" title="hide">✕</button>'
    + '</div><div class="dj" id="npDJ"></div>';

  function mount(){ if(document.getElementById("npbar")) return; document.body.appendChild(bar); rollDJ(); setInterval(rollDJ, 6000); }
  function rollDJ(){ var e=document.getElementById("npDJ"); if(e) e.innerHTML = pick(DJ); }

  window.npShuffle = function(kind){
    var playing = true; setPlay(true);
    if(kind==="show"){ var sh=pick(SHOWS); set("📻 "+sh, "Shuffled show · full set · Grateful Dead"); toast("📻 “"+sh+"” — a whole show, on shuffle. (Audio lights up once the songbook's licensed.)"); }
    else { var sg=pick(SONGS); set("🎵 "+sg, "Shuffled version · tap 💿 to own it on vinyl"); toast("🎲 “"+sg+"” — great version. (Preview: audio turns on once licensed.) Loving it? 💿 Get it on vinyl."); }
  };
  window.npToggle = function(){ var b=document.getElementById("npPP"); var on=b.textContent.indexOf("❚")<0? false : true; setPlay(b.textContent==="▶︎"); };
  function setPlay(on){ var b=document.getElementById("npPP"), d=document.getElementById("npDisc"); if(!b)return; b.textContent = on? "❚❚":"▶︎"; if(d) d.className = "disc"+(on?" spin":""); }
  function set(t,s){ var T=document.getElementById("npT"), S=document.getElementById("npS"); if(T)T.textContent=t; if(S)S.textContent=s; }
  window.npClose = function(){ var e=document.getElementById("npbar"); if(e)e.style.display="none"; };

  function toast(m){
    var t=document.getElementById("np_toast");
    if(!t){ t=document.createElement("div"); t.id="np_toast";
      t.style.cssText="position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:#000d;color:#fff;padding:11px 16px;border-radius:999px;font:13px/1.4 -apple-system,sans-serif;z-index:90;max-width:90%;text-align:center;opacity:0;transition:.2s"; document.body.appendChild(t); }
    t.textContent=m; t.style.opacity="1"; clearTimeout(t._h); t._h=setTimeout(function(){ t.style.opacity="0"; }, 3800);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
