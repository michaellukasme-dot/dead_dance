/* sf_calendar_coach.js — the AUTONOMOUS VENUE CALENDAR MANAGER, surfaced.
   An expiring "Cookie Monster" toast suggests fill-nights to a venue owner (Tuesday Night Karaoke,
   Trivia, Open Mic…). A link on the toast opens a MODAL: a full sample MONTH with $$ revenue potential,
   computed from the same proforma the managed-booking product uses (venueNightPL: gate + bar − cost − house).
   Adding an idea deep-links to the Festival/Event Maker, prefilled. Owner-only — mount when is_owner.

   Usage:  SFCoach.mount({ venue:'Ardmore Music Hall', city:'Ardmore', state:'PA', cap:300, ticket:18 });
*/
(function(){
  var THEME = { cm:'#4aa3df', cmDark:'#2f6feb', ink:'#1f2430', gold:'#b8860b' };
  function money(n){ n=Math.round(n||0); return '$'+n.toLocaleString('en-US'); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  /* ---- the proforma (rules of thumb — NOT a forecast), matched to managed.html ---- */
  function nightPL(cap, cover, fill, cost, house){
    var att = Math.round(cap*fill);
    var gate = att*cover, bar = att*11;
    return { att:att, gate:gate, bar:bar, cost:cost, net: gate + bar - cost - house };
  }
  function touringCost(cap){ return Math.round((cap*8)/50)*50 + 250; }

  /* ---- recurring fill-night ideas. Self-run nights cost a host fee; band nights use the touring model ---- */
  function ideas(cap, ticket){
    return [
      { key:'karaoke', emoji:'🎤', name:'Tuesday Night Karaoke', dow:'Tue', cover:5,  fill:0.45, cost:150, house:200 },
      { key:'trivia',  emoji:'🧠', name:'Wednesday Trivia',      dow:'Wed', cover:5,  fill:0.42, cost:150, house:200 },
      { key:'openmic', emoji:'🎶', name:'Thursday Open Mic',     dow:'Thu', cover:0,  fill:0.38, cost:100, house:180 },
      { key:'band',    emoji:'🎸', name:'Friday Live Band',      dow:'Fri', cover:ticket, fill:0.60, cost:touringCost(cap), house:350 },
      { key:'headline',emoji:'⭐', name:'Saturday Headliner',    dow:'Sat', cover:Math.round(ticket*1.25), fill:0.68, cost:touringCost(cap), house:350 },
      { key:'brunch',  emoji:'🎷', name:'Sunday Jazz Brunch',    dow:'Sun', cover:10, fill:0.50, cost:400, house:250 }
    ].map(function(x){ var p=nightPL(cap,x.cover,x.fill,x.cost,x.house); x.pl=p; x.monthly=p.net*4; return x; });
  }

  var CFG=null, _timer=null;

  function mount(cfg){
    CFG = Object.assign({ venue:'your room', city:'', state:'', cap:300, ticket:18 }, cfg||{});
    injectCSS();
    // rotate a suggestion each mount; the strongest self-run idea leads.
    var list = ideas(CFG.cap, CFG.ticket);
    var pick = list.filter(function(x){ return x.key==='karaoke'; })[0] || list[0];
    showToast(pick, list);
  }

  function showToast(idea, list){
    dismiss();
    var t = document.createElement('div'); t.className='sfc-toast'; t.id='sfcToast';
    t.innerHTML =
      '<div class="sfc-cm">🍪</div>'+
      '<div class="sfc-body">'+
        '<b>Cookie Monster</b> — your <b>'+esc(idea.dow)+'s</b> look dark. '+
        'Add <b>'+esc(idea.emoji+' '+idea.name)+'</b> → about <b>'+money(idea.monthly)+'/mo</b>.'+
        '<div class="sfc-actions"><a href="#" id="sfcSee">See the whole month →</a></div>'+
      '</div>'+
      '<button class="sfc-x" id="sfcX" aria-label="dismiss">✕</button>';
    document.body.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add('in'); });
    document.getElementById('sfcX').onclick=function(){ dismiss(); };
    document.getElementById('sfcSee').onclick=function(e){ e.preventDefault(); clearTimeout(_timer); openMonth(list); };
    _timer = setTimeout(dismiss, 15000);           // expiring toast
  }
  function dismiss(){ clearTimeout(_timer); var t=document.getElementById('sfcToast'); if(t){ t.classList.remove('in'); setTimeout(function(){ t.remove(); },240); } }

  function openMonth(list){
    var cap=CFG.cap, ticket=CFG.ticket;
    var monthNet = list.reduce(function(s,x){ return s + x.monthly; }, 0);
    var rows = list.map(function(x){
      var mk = 'festival_event_maker.html?n='+encodeURIComponent(x.name)+'&v='+encodeURIComponent(CFG.venue||'')+'&c='+encodeURIComponent(CFG.city||'')+'&s='+encodeURIComponent(CFG.state||'');
      return '<div class="sfc-row">'+
        '<div class="sfc-em">'+esc(x.emoji)+'</div>'+
        '<div class="sfc-nm"><b>'+esc(x.name)+'</b>'+
          '<div class="sfc-sub">×4 / mo · ~'+x.pl.att+' in · '+money(x.pl.gate)+' cover · '+money(x.pl.bar)+' bar</div></div>'+
        '<div class="sfc-net">'+money(x.monthly)+'<span>/mo net</span></div>'+
        '<a class="sfc-add" href="'+mk+'">Add →</a>'+
      '</div>';
    }).join('');
    var back = document.createElement('div'); back.className='sfc-modal'; back.id='sfcModal';
    back.innerHTML =
      '<div class="sfc-card">'+
        '<button class="sfc-close" id="sfcClose">✕</button>'+
        '<div class="sfc-h">🍪 A full month for <b>'+esc(CFG.venue)+'</b></div>'+
        '<div class="sfc-tot"><div><div class="l">Est. net to the house</div><div class="big">'+money(monthNet)+'<span>/mo</span></div></div>'+
          '<div><div class="l">Annualized</div><div class="big">'+money(monthNet*12)+'<span>/yr</span></div></div></div>'+
        '<div class="sfc-tune">Room <input id="sfcCap" type="number" value="'+cap+'"> cap · ticket $<input id="sfcTix" type="number" value="'+ticket+'"> '+
          '<button id="sfcRe">recalc</button></div>'+
        rows+
        '<div class="sfc-disc">Illustrative estimate — not a forecast or guarantee. Modeled from comparable rooms (cover + bar, minus host/act cost and house). Tap <b>Add →</b> to drop any night onto your StageFill calendar with tickets live.</div>'+
      '</div>';
    document.body.appendChild(back);
    requestAnimationFrame(function(){ back.classList.add('in'); });
    document.getElementById('sfcClose').onclick=closeMonth;
    back.addEventListener('click',function(e){ if(e.target===back) closeMonth(); });
    document.getElementById('sfcRe').onclick=function(){
      CFG.cap = Math.max(20, Math.min(50000, parseInt(document.getElementById('sfcCap').value,10)||cap));
      CFG.ticket = Math.max(0, Math.min(500, parseInt(document.getElementById('sfcTix').value,10)||ticket));
      closeMonth(); openMonth(ideas(CFG.cap, CFG.ticket));
    };
  }
  function closeMonth(){ var m=document.getElementById('sfcModal'); if(m){ m.classList.remove('in'); setTimeout(function(){ m.remove(); },200); } }

  function injectCSS(){
    if(document.getElementById('sfcCSS')) return;
    var s=document.createElement('style'); s.id='sfcCSS'; s.textContent=
    '.sfc-toast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0));transform:translate(-50%,20px);z-index:9000;'+
      'display:flex;gap:12px;align-items:flex-start;max-width:440px;width:calc(100% - 28px);background:#fff;color:'+THEME.ink+';'+
      'border:1px solid #e7e9f0;border-radius:16px;box-shadow:0 12px 40px #0003;padding:13px 14px;opacity:0;transition:.24s}'+
    '.sfc-toast.in{transform:translate(-50%,0);opacity:1}'+
    '.sfc-cm{width:38px;height:38px;border-radius:50%;background:'+THEME.cm+';display:flex;align-items:center;justify-content:center;font-size:20px;flex:0 0 auto;box-shadow:inset 0 -3px 6px #0002}'+
    '.sfc-body{flex:1;font-size:13.5px;line-height:1.45}.sfc-body>b{color:'+THEME.cmDark+'}'+
    '.sfc-actions{margin-top:6px}.sfc-actions a{color:'+THEME.cmDark+';font-weight:800;text-decoration:none;font-size:13px}'+
    '.sfc-x{background:0;border:0;color:#9aa2b4;font-size:16px;cursor:pointer;flex:0 0 auto;padding:0 2px}'+
    '.sfc-modal{position:fixed;inset:0;background:#0009;z-index:9100;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:.2s;overflow:auto}'+
    '.sfc-modal.in{opacity:1}'+
    '.sfc-card{background:#fff;color:'+THEME.ink+';max-width:520px;width:100%;border-radius:20px;padding:20px;box-shadow:0 20px 60px #0006;position:relative;max-height:92vh;overflow:auto}'+
    '.sfc-close{position:absolute;top:12px;right:14px;background:0;border:0;font-size:20px;color:#9aa2b4;cursor:pointer}'+
    '.sfc-h{font-size:17px;font-weight:800;margin:2px 30px 12px 0}'+
    '.sfc-tot{display:flex;gap:12px;background:#f6f3fe;border:1px solid #e7ddfb;border-radius:14px;padding:12px 14px;margin-bottom:12px}'+
    '.sfc-tot .l{font-size:11px;font-weight:800;color:#8a92a6;text-transform:uppercase;letter-spacing:.04em}'+
    '.sfc-tot .big{font-size:24px;font-weight:800;color:'+THEME.cmDark+'}.sfc-tot .big span{font-size:12px;color:#8a92a6;font-weight:700}'+
    '.sfc-tune{font-size:12.5px;color:#5b6172;margin-bottom:10px}.sfc-tune input{width:64px;padding:5px 7px;border:1px solid #e7e9f0;border-radius:8px;font-weight:700;margin:0 2px}'+
    '.sfc-tune button{margin-left:6px;background:#eef2fb;border:0;color:'+THEME.cmDark+';font-weight:800;padding:6px 12px;border-radius:8px;cursor:pointer}'+
    '.sfc-row{display:flex;align-items:center;gap:11px;padding:10px 0;border-top:1px solid #eef0f5}'+
    '.sfc-em{width:34px;height:34px;border-radius:10px;background:#f4f6fa;display:flex;align-items:center;justify-content:center;font-size:18px;flex:0 0 auto}'+
    '.sfc-nm{flex:1;min-width:0}.sfc-nm b{font-size:14px}.sfc-sub{color:#8a92a6;font-size:11.5px;font-weight:600;margin-top:1px}'+
    '.sfc-net{font-weight:800;color:'+THEME.gold+';font-size:14px;text-align:right;white-space:nowrap}.sfc-net span{display:block;font-size:10px;color:#8a92a6;font-weight:700}'+
    '.sfc-add{flex:0 0 auto;background:'+THEME.cmDark+';color:#fff;font-weight:800;font-size:12.5px;text-decoration:none;padding:8px 12px;border-radius:999px}'+
    '.sfc-disc{margin-top:14px;font-size:11px;color:#9aa2b4;line-height:1.5}';
    document.head.appendChild(s);
  }

  window.SFCoach = { mount:mount };
})();
