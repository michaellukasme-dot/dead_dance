/* dd_learn.js — the Migration of Knowledge engine (see DESIGN_migration_of_knowledge.md).
   Teaches the app by EARNED REVEAL: one concept at a time, unlocked by what the user has
   actually done — never front-loaded, never a tour. Two jobs:
     1) a milestone LEDGER + a reveal GATE (hide advanced UI until its rung),
     2) the contextual OFFER — one well-timed, previewable, one-tap-yes card at a time.
   On-device only (localStorage 'dd.learn'); nothing server-side, nothing scraped. */
(function (root) {
  var KEY = 'dd.learn';
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } }
  function save(s){ try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){} }
  function state(){ var s=load(); s.m=s.m||{}; s.seen=s.seen||{}; s.declined=s.declined||{}; return s; }

  // ---- ledger ----
  function did(m){ var s=state(); if(!s.m[m]){ s.m[m]=Date.now(); save(s); } return stage(); }
  function has(m){ return !!state().m[m]; }
  // rung 0..6 derived from milestones
  function stage(){ var m=state().m;
    if(m.invited) return 6;
    if(m.posted && m.savedShow && m.forwarded) return 5;
    if(m.attended || m.savedShow) return m.savedShow?4:3;
    if(m.hyperposted) return 2;
    if(m.posted) return 1;
    return 0; }

  // ---- reveal gate: is an advanced feature allowed to show yet? ----
  var MIN = { networks:1, radiate:2, map:3, pymk:4, garden:5, invite:5 };
  function gate(feature){ if(eased(feature)) return false;   // dropped back down until they've got it
    return stage() >= (MIN[feature]==null?0:MIN[feature]); }
  // convenience: hide an element until its rung
  function reveal(feature, el){ if(typeof el==='string') el=document.getElementById(el);
    if(el) el.style.display = gate(feature) ? '' : 'none'; }

  // ---- the contextual offer: one at a time, previewable, one-tap yes, never nags ----
  var ACTIVE=false;
  function css(){ if(document.getElementById('learncss'))return; var s=document.createElement('style'); s.id='learncss';
    s.textContent=
     '.lrn{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(24px);z-index:9997;'+
     'background:#fff;border:1px solid #ece7f2;border-radius:16px;box-shadow:0 16px 44px rgba(20,10,30,.28);'+
     'width:340px;max-width:92vw;padding:14px 15px;opacity:0;transition:.2s}'+
     '.lrn.on{opacity:1;transform:translateX(-50%) translateY(0)}'+
     '.lrn .q{display:flex;gap:9px;align-items:flex-start;font-size:14px;font-weight:700;line-height:1.35}'+
     '.lrn .q img{width:22px;height:22px;flex:0 0 22px}'+
     '.lrn .pv{margin:9px 0 2px;border:1px solid #f0ecf6;border-radius:11px;background:#faf8fd;padding:10px 11px;font-size:12.5px;color:#4a4356;line-height:1.45;max-height:150px;overflow:auto}'+
     '.lrn .row{display:flex;gap:8px;margin-top:11px}'+
     '.lrn .row button{flex:1;border:0;border-radius:11px;padding:11px;font-weight:800;font-size:13.5px;cursor:pointer}'+
     '.lrn .yes{background:linear-gradient(135deg,#7a3cc0,#b8002e);color:#fff}'+
     '.lrn .no{background:#f1eef7;color:#6a5f86}';
    document.head.appendChild(s); }

  // offer(key, {q, preview, yes, no, onYes}) — shows once; remembers a decline; one at a time
  function offer(key, o){
    o=o||{}; var s=state();
    if(s.seen[key] || s.declined[key] || ACTIVE) return false;
    css(); ACTIVE=true;
    var el=document.createElement('div'); el.className='lrn';
    var mark='<img src="claude-mark.svg" alt="Claude">';
    el.innerHTML='<div class="q">'+mark+'<span>'+(o.q||'Want a hand with this?')+'</span></div>'+
      (o.preview?('<div class="pv">'+o.preview+'</div>'):'')+
      '<div class="row"><button class="no">'+(o.no||'Not now')+'</button><button class="yes">'+(o.yes||'Yes, do it')+'</button></div>';
    document.body.appendChild(el); setTimeout(function(){ el.classList.add('on'); },30);
    function close(dismiss){ el.classList.remove('on'); setTimeout(function(){ try{el.remove();}catch(e){} },220); ACTIVE=false;
      var st=state(); if(dismiss) st.declined[key]=1; else st.seen[key]=1; save(st); }
    el.querySelector('.yes').onclick=function(){ try{ o.onYes&&o.onYes(); }catch(e){} close(false); };
    el.querySelector('.no').onclick=function(){ close(true); };
    return true;
  }
  function markSeen(key){ var s=state(); s.seen[key]=1; save(s); }

  // ---- adaptive drop-back: climb on success, RETREAT on confusion ----
  // snag(feature) records a confusion signal; two snags → ease off (hide it again) and help.
  function snag(feature){ var s=state(); s.snag=s.snag||{}; s.snag[feature]=(s.snag[feature]||0)+1; save(s);
    if(s.snag[feature] >= 2){ ease(feature, true); return true; } return false; }
  function ease(feature, on){ var s=state(); s.ease=s.ease||{}; if(on) s.ease[feature]=1; else delete s.ease[feature]; save(s); }
  function eased(feature){ var s=state(); return !!(s.ease && s.ease[feature]); }
  // a success at a feature clears its confusion + un-eases it (they've got it now)
  function ok(feature){ var s=state(); if(s.snag)delete s.snag[feature]; if(s.ease)delete s.ease[feature]; save(s); }

  // remediate → educate → illustrate: one calm explainer card with a picture.
  function illustrate(key, o){ o=o||{}; if(ACTIVE) return false; css(); ACTIVE=true;
    var el=document.createElement('div'); el.className='lrn';
    el.innerHTML='<div class="q"><img src="claude-mark.svg" alt="Claude"><span>'+(o.title||'Here—let me show you')+'</span></div>'+
      (o.svg?('<div class="pv" style="text-align:center;background:#fff">'+o.svg+'</div>'):'')+
      (o.body?('<div style="font-size:13px;color:#4a4356;line-height:1.45;margin-top:9px">'+o.body+'</div>'):'')+
      '<div class="row"><button class="yes" style="flex:1">Got it 🌹</button></div>';
    document.body.appendChild(el); setTimeout(function(){ el.classList.add('on'); },30);
    el.querySelector('.yes').onclick=function(){ el.classList.remove('on'); setTimeout(function(){ try{el.remove();}catch(e){} },220); ACTIVE=false; markSeen('illus:'+key); };
    return true; }

  // ---- ONE how-to bubble a day, in the blog, Claude-voiced, user closes it ----
  // A gentle daily drip — the whole app taught one bite at a time, never a barrage.
  var TIPS = [
    "👋 Welcome to the family. Easiest first step: tap the box up top and just say hi.",
    "See the orange mark in the post box? That's me — Claude. Tap it any time you'd like a hand writing something. Your words always stay yours.",
    "🗓️ Your shows live on the calendar. The <b>My Calendar</b> pill shows just your nights — nothing else.",
    "📡 <b>HyperPost</b> is simple: one post, sent to more than one place. Try it when you've got news worth spreading.",
    "🌹 Tap <b>Going</b> on a show and you'll start seeing folks who were there too — that's how you find your people.",
    "🎤 <b>Dead Karaoke</b>: sing the songbook, quiz the show, and climb one board with rooms across the country.",
    "🖼️ In a band? DeadDance can make you a poster in your own style — free to start.",
    "🌿 That's <b>tending the garden</b>: post a show, forward a gem, welcome a newcomer. Small things, whole family.",
    "🍪 Meet <b>Cookie</b>: hand him a crumb — a show, a gem, a welcome — and he pays you <b>Cookies</b> that pop like magic. Find him in the menu → The Cookie Jar.",
    "🏡 Know someone who'd love it here? Your own <b>QR</b> brings them home — and when they stick around, you earn cookies. Menu → Bring 'em home."
  ];
  function today(){ return new Date().toISOString().slice(0,10); }
  // returns { ix, html } for today's bubble, or null if none/closed-today
  function howto(){ var s=state(); s.ht=s.ht||{ix:0,closed:''};
    if(s.ht.closed===today()) return null;         // they closed it already today
    var ix=s.ht.ix||0; if(ix>=TIPS.length) return null;   // curriculum complete
    return { ix:ix, html:TIPS[ix] };
  }
  function howtoClose(){ var s=state(); s.ht=s.ht||{ix:0,closed:''}; s.ht.closed=today(); s.ht.ix=(s.ht.ix||0)+1; save(s); }

  root.DDLearn = { did:did, has:has, stage:stage, gate:gate, reveal:reveal, offer:offer, seen:markSeen,
    snag:snag, ease:ease, eased:eased, ok:ok, illustrate:illustrate, howto:howto, howtoClose:howtoClose };
})(typeof window !== 'undefined' ? window : this);
