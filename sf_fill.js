/* sf_fill.js — the CO-PROMOTION coach. Band and venue jointly fill the same event; StageFill keeps the
   single count (no oversell). This module: (1) attributed invite links (band=fans, venue=patrons),
   (2) a fill leaderboard for the owner, (3) a low-sales detector that drops an EXPIRING toast nudging a
   HyperPost. It does NOT rebuild the post flow — it hands off to the EXISTING setup/HyperPost agent
   (window.DDSetup / window.DDHyper / hyperpost_setup.html), whose DRUC consent makes posting recurring
   until the user turns it off ("never show again").

   Usage:  SFFill.mount({ slug:'my-show', side:'venue', isOwner:true });   // side: 'band' | 'venue'
*/
(function(){
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function origin(){ return location.origin || 'https://deaddance.app'; }
  function evURL(slug, ref){ return origin()+'/event_page.html?ev='+encodeURIComponent(slug)+(ref?('&ref='+ref):''); }
  function hidden(slug){ try{ return localStorage.getItem('dd.sf.fill.hide.'+slug)==='1'; }catch(e){ return false; } }
  function hide(slug){ try{ localStorage.setItem('dd.sf.fill.hide.'+slug,'1'); }catch(e){} }

  var CFG=null, ST=null, _t=null;

  function mount(cfg){
    CFG=Object.assign({slug:'', side:'venue', isOwner:false}, cfg||{});
    if(!CFG.slug) return; injectCSS();
    var cl=window.ddClient&&ddClient(); if(!(cl&&cl.rpc)){ setTimeout(function(){mount(cfg);},400); return; }
    cl.rpc('sf_fill_status',{p_slug:CFG.slug}).then(function(r){ ST=(r&&r.data)||null; if(!ST||ST.error) return;
      if(CFG.isOwner) strip();                              // owner sees the leaderboard + boost
      if(ST.behind && !hidden(CFG.slug)) toast();           // anyone driving the show gets the nudge (band or venue)
    }).catch(function(){});
  }

  /* the attributed link this side should share */
  function myLink(){ return evURL(CFG.slug, CFG.side==='band'?'band':'venue'); }

  /* hand off to the EXISTING HyperPost / setup agent — find it, use it */
  function boost(){
    var url=myLink(), line=fillLine();
    try{ window.inviteLink=function(){ return url; }; }catch(e){}                 // DDHyper.inviteURL() + setup reads this
    try{ window.__sfBoostURL=url; }catch(e){}
    if(window.DDSetup && DDSetup.open){ DDSetup.open('content'); return; }        // the 6-step agent (DRUC → first post → …)
    if(window.DDHyper && DDHyper.go){ DDHyper.go(line); return; }                 // one-click HyperPost (spread → send)
    if(window.DDHyper && DDHyper.post){ DDHyper.post(line); return; }
    location.href='hyperpost_setup.html';                                         // last resort: the setup page
  }
  function fillLine(){ var n=(ST&&ST.capacity&&ST.sold!=null)?(ST.capacity-ST.sold):null;
    return (CFG.side==='band'?'We need you in the room':'Tickets moving')+' — '+(n!=null?(n+' seats left. '):'')+'Grab yours: '+myLink(); }

  /* ---- owner leaderboard strip ---- */
  function strip(){
    var host=document.getElementById('sffill'); if(!host){ host=document.createElement('div'); host.id='sffill'; host.className='sff-strip';
      var anchor=document.getElementById('page')||document.body; anchor.appendChild(host); }
    var by=ST.by_ref||{}, cap=ST.capacity, sold=ST.sold||0;
    var band=by.band||0, ven=by.venue||0, door=by.door||0, dir=(by.direct||0);
    var pct=cap?Math.min(100,Math.round(100*sold/cap)):0;
    host.innerHTML=
      '<div class="sff-h">🎟️ Filling this show'+(cap?(' · <b>'+sold+'</b> / '+cap+' ('+pct+'%)'):(' · <b>'+sold+'</b> sold'))+
        (ST.days_left!=null?(' · '+ST.days_left+'d out'):'')+'</div>'+
      (cap?('<div class="sff-bar"><i style="width:'+pct+'%"></i></div>'):'')+
      '<div class="sff-legend"><span>🎸 Band '+band+'</span><span>🏛 Venue '+ven+'</span><span>🚪 Door '+door+'</span><span>🔗 Direct '+dir+'</span></div>'+
      '<div class="sff-actions"><button class="sff-boost" id="sffBoost">📡 Boost — HyperPost</button>'+
        '<button class="sff-copy" id="sffCopy">Copy my '+(CFG.side==='band'?'fan':'patron')+' link</button></div>'+
      (ST.behind?'<div class="sff-flag">⏳ Pacing behind — a HyperPost now moves the needle.</div>':'');
    document.getElementById('sffBoost').onclick=boost;
    document.getElementById('sffCopy').onclick=function(){ var u=myLink(); try{ navigator.clipboard.writeText(u); }catch(e){} this.textContent='Copied ✓'; var b=this; setTimeout(function(){ b.textContent='Copy my '+(CFG.side==='band'?'fan':'patron')+' link'; },1500); };
  }

  /* ---- expiring low-sales toast (to whichever side is viewing) ---- */
  function toast(){
    var t=document.createElement('div'); t.className='sff-toast'; t.id='sffToast';
    var left=(ST.capacity&&ST.sold!=null)?(ST.capacity-ST.sold):null;
    t.innerHTML='<div class="sff-cm">📡</div><div class="sff-body"><b>StageFill</b> — '+
      (left!=null?('<b>'+left+' seats</b> still open'):'this show is quiet')+(ST.days_left!=null?(', '+ST.days_left+' days out.'):'.')+
      ' Run a HyperPost to fill it.<div class="sff-tact"><a href="#" id="sffGo">Boost now →</a><a href="#" id="sffNo">Never show again</a></div></div>'+
      '<button class="sff-x" id="sffTx">✕</button>';
    document.body.appendChild(t); requestAnimationFrame(function(){ t.classList.add('in'); });
    document.getElementById('sffTx').onclick=drop;
    document.getElementById('sffGo').onclick=function(e){ e.preventDefault(); clearTimeout(_t); boost(); };
    document.getElementById('sffNo').onclick=function(e){ e.preventDefault(); hide(CFG.slug); drop(); };
    _t=setTimeout(drop, 16000);
  }
  function drop(){ clearTimeout(_t); var t=document.getElementById('sffToast'); if(t){ t.classList.remove('in'); setTimeout(function(){ t.remove(); },240); } }

  function injectCSS(){ if(document.getElementById('sffCSS'))return; var s=document.createElement('style'); s.id='sffCSS'; s.textContent=
    '.sff-strip{max-width:760px;margin:14px auto 0;background:#fff;border:1px solid #e7e9f0;border-radius:16px;padding:14px;box-shadow:0 6px 24px #0000000d}'+
    '.sff-h{font-size:13px;font-weight:800;color:#1f2430}.sff-h b{color:#6d28d9}'+
    '.sff-bar{height:8px;background:#eef0f5;border-radius:99px;margin:9px 0;overflow:hidden}.sff-bar i{display:block;height:100%;background:linear-gradient(90deg,#7c3aed,#6d28d9)}'+
    '.sff-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;font-weight:700;color:#8a92a6}'+
    '.sff-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}'+
    '.sff-boost{background:linear-gradient(180deg,#7c3aed,#6d28d9);color:#fff;border:0;border-radius:10px;font-weight:800;font-size:13px;padding:10px 14px;cursor:pointer}'+
    '.sff-copy{background:#eef2fb;color:#6d28d9;border:0;border-radius:10px;font-weight:800;font-size:13px;padding:10px 14px;cursor:pointer}'+
    '.sff-flag{margin-top:10px;font-size:12px;font-weight:700;color:#b8860b;background:#fdf7e7;border:1px solid #f0e3bd;border-radius:9px;padding:8px 10px}'+
    '.sff-toast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0));transform:translate(-50%,20px);z-index:9000;display:flex;gap:12px;align-items:flex-start;max-width:440px;width:calc(100% - 28px);background:#fff;color:#1f2430;border:1px solid #e7e9f0;border-radius:16px;box-shadow:0 12px 40px #0003;padding:13px 14px;opacity:0;transition:.24s}'+
    '.sff-toast.in{transform:translate(-50%,0);opacity:1}'+
    '.sff-cm{width:38px;height:38px;border-radius:50%;background:#6d28d9;color:#fff;display:flex;align-items:center;justify-content:center;font-size:19px;flex:0 0 auto}'+
    '.sff-body{flex:1;font-size:13.5px;line-height:1.45}.sff-body>b{color:#6d28d9}'+
    '.sff-tact{margin-top:6px;display:flex;gap:14px}.sff-tact a{font-weight:800;font-size:13px;text-decoration:none}.sff-tact #sffGo{color:#6d28d9}.sff-tact #sffNo{color:#9aa2b4}'+
    '.sff-x{background:0;border:0;color:#9aa2b4;font-size:16px;cursor:pointer;flex:0 0 auto}';
    document.head.appendChild(s); }

  window.SFFill={ mount:mount, boost:boost };
})();
