/* ============================================================================
   dead.dance — Help Test (Crowd-QA) : a self-mounting, reusable testing surface.
   Drop one <script src="helptest.js"></script> onto any page, then register that
   page's console + tasks:  HelpTest.set('sales', {ic:'🗂', name:'Sales / CRM', tasks:[...]});
   A ?ht=<console>&tester=<name> link auto-opens a DOCKED, non-blocking, one-at-a-time
   card — the app behind stays fully usable. Records locally (dd.qa.results) and
   best-effort pushes to chat_qa_submit if a Supabase client (window.ddClient) exists.
   Hardened per Claudine review: readyState auto-open + retry, null guards, HTML-escape,
   no-wrap clamp, quota cap, honest screenshot, structured tester+console.
   ============================================================================ */
(function(root){
  var CONS={}, FILTER=null, STEP=0, ONEKEY=null, PICK=null, WORKS=null, NOTE='', SHOT=null, mounted=false;

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function q(id){ return document.getElementById(id); }
  function tester(){ try{return localStorage.getItem('dd.tester')||'';}catch(e){return '';} }
  function client(){ // works across pages: main app (ddClient), hostaband (hbClient), or LukasChat
    try{ if(root.ddClient){var a=root.ddClient(); if(a)return a;} }catch(e){}
    try{ if(root.hbClient){var b=root.hbClient(); if(b)return b;} }catch(e){}
    try{ if(root.LukasChat&&root.LukasChat.getClient){var d=root.LukasChat.getClient(); if(d)return d;} }catch(e){}
    return null; }
  function toast(m){ if(root.toast){try{root.toast(m);return;}catch(e){}} var t=q('ht-toast'); if(!t){t=document.createElement('div');t.id='ht-toast';document.body.appendChild(t);} t.textContent=m; t.className='on'; setTimeout(function(){t.className='';},2600); }
  function doneList(){ try{return JSON.parse(localStorage.getItem('dd.qa.done')||'[]');}catch(e){return [];} }
  function markDone(k){ var d=doneList(); if(d.indexOf(k)<0){d.push(k); try{localStorage.setItem('dd.qa.done',JSON.stringify(d));}catch(e){}} }

  var CSS=''+
  '.htfab{position:fixed;left:14px;bottom:16px;z-index:2147483000;border:0;border-radius:999px;background:#1f7a4d;color:#fff;font-weight:800;font-size:13px;padding:11px 15px;display:flex;align-items:center;gap:7px;box-shadow:0 6px 18px #1f7a4d66;cursor:pointer;font-family:-apple-system,Segoe UI,Roboto,sans-serif}'+
  '.htov{position:fixed;inset:0;background:#0007;display:none;align-items:flex-end;justify-content:center;z-index:2147483001;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif}'+
  '.htov.on{display:flex}'+
  '.htov.dock{background:transparent;pointer-events:none;align-items:flex-end;justify-content:flex-end}'+
  '.htov.dock .htpanel{pointer-events:auto;position:fixed;right:14px;bottom:14px;left:auto;width:min(400px,94vw);max-height:82vh;border-radius:16px;box-shadow:0 18px 50px #0007}'+
  '@media(max-width:560px){.htov.dock .htpanel{right:8px;left:8px;bottom:8px;width:auto}}'+
  '.htpanel{background:#faf7f2;color:#23202a;width:100%;max-width:460px;max-height:86vh;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden}'+
  '.hthead{background:#1f7a4d;color:#fff;padding:13px 16px;position:relative}'+
  '.hthead b{font-size:16px;display:block}.hthead span{font-size:11.5px;color:#cdedd9}'+
  '.hthead .htmin{position:absolute;right:44px;top:10px;background:none;border:0;color:#fff;font-size:20px;cursor:pointer}'+
  '.hthead .htx{position:absolute;right:12px;top:10px;background:none;border:0;color:#fff;font-size:22px;cursor:pointer}'+
  '.htov.dock.min .htpanel{max-height:none}.htov.min .htbody{display:none}.htov.min .hthead span{display:none}'+
  '.htov.min .hthead::after{content:"▴ tap to open your tasks";display:block;font-size:11px;color:#cdedd9;margin-top:2px}.htov.min .htmin{display:none}'+
  '.htbody{padding:12px 14px;overflow:auto}'+
  '.htq{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#6c6878;margin:12px 0 4px}'+
  '.htprog{font-size:12px;font-weight:700;color:#6c6878;margin:2px 0 8px}'+
  '.htstep{display:flex;gap:9px;margin:6px 0;font-size:13.5px;color:#3d3a47}.htstep .n{flex:none;width:22px;height:22px;border-radius:50%;background:#5a2e86;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:800}'+
  '.htworks{display:flex;gap:8px;margin:4px 0}.htworks button{flex:1;background:#fff;border:1px solid #e7e0d2;border-radius:10px;padding:9px;font-weight:800;cursor:pointer;color:#23202a}.htworks button.sel{background:#1f7a4d;color:#fff;border-color:#1f7a4d}'+
  '.htopt{display:block;width:100%;text-align:left;background:#fff;border:1px solid #e7e0d2;border-radius:10px;padding:10px 12px;margin:6px 0;cursor:pointer;font-size:14px;color:#23202a}.htopt.sel{background:#5a2e86;color:#fff;border-color:#5a2e86}'+
  '.htnote{width:100%;border:1px solid #e7e0d2;border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;min-height:56px;resize:vertical;margin:6px 0}'+
  '.htshot{display:block;text-align:center;border:1.5px dashed #1f7a4d;color:#1f7a4d;border-radius:12px;padding:13px;font-weight:800;margin:8px 0;cursor:pointer}'+
  '.htbtns{display:flex;gap:8px;margin-top:4px}.htsend{flex:1;background:#1f7a4d;color:#fff;border:0;border-radius:12px;padding:13px;font-weight:800;cursor:pointer}.htskip{background:#ece7db;color:#555;border:0;border-radius:12px;padding:0 16px;font-weight:800;cursor:pointer}'+
  '.htback{background:none;border:0;color:#5a2e86;font-weight:800;font-size:13px;cursor:pointer;margin-top:8px;padding:4px 0}'+
  '.qgo{display:inline-block;background:#5a2e86;color:#fff;text-decoration:none;font-weight:800;font-size:13px;padding:7px 12px;border-radius:9px;margin:2px 0}'+
  '#ht-toast{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#23202a;color:#fff;padding:10px 16px;border-radius:999px;font-size:13px;z-index:2147483002;opacity:0;transition:.2s;pointer-events:none;font-family:-apple-system,sans-serif}#ht-toast.on{opacity:1}';

  function mount(){ if(mounted)return; mounted=true;
    var st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
    var fab=document.createElement('button'); fab.className='htfab'; fab.innerHTML='🧪 <span>Help test</span>'; fab.onclick=open; document.body.appendChild(fab);
    var ov=document.createElement('div'); ov.className='htov'; ov.id='htov';
    ov.innerHTML='<div class="htpanel"><div class="hthead" onclick="if(HelpTest._m())HelpTest.unmin()"><b>🧪 Help Test</b><span>Do the task, tell us how it went.</span>'+
      '<button class="htmin" onclick="event.stopPropagation();HelpTest.min()" title="Tuck aside">▾</button>'+
      '<button class="htx" onclick="event.stopPropagation();HelpTest.close()">×</button></div>'+
      '<div class="htbody" id="htbody"></div></div>';
    ov.onclick=function(e){ if(e.target===ov && !ov.classList.contains('dock')) close(); };
    document.body.appendChild(ov);
  }
  function conKey(){ return FILTER&&(FILTER==='musician'?'band':FILTER)||''; }
  function open(){ mount(); var ov=q('htov'); if(!ov)return; ov.classList.add('on'); ov.classList.remove('min');
    ov.classList.toggle('dock', !!CONS[conKey()]); render(); }
  function close(){ var ov=q('htov'); if(!ov)return; ov.classList.remove('on'); ov.classList.remove('min'); }
  function min(){ var ov=q('htov'); if(ov)ov.classList.add('min'); }
  function unmin(){ var ov=q('htov'); if(ov)ov.classList.remove('min'); }
  function isMin(){ var ov=q('htov'); return !!(ov&&ov.classList.contains('min')); }

  function render(){ var b=q('htbody'); if(!b)return; var ck=conKey(), C=CONS[ck];
    if(C){ renderOne(C); return; }
    // no console filter → list whatever consoles are registered on this page
    var keys=Object.keys(CONS); if(!keys.length){ b.innerHTML='<div class="htq" style="margin-top:0">🧪 Help Test</div><div style="font-size:13px;color:#6c6878">No tests are set for this page yet — thank you for checking. 🌹</div>'; return; }
    var h='<div class="htq" style="margin-top:0">🧪 Help Test</div>';
    keys.forEach(function(k){ var c=CONS[k]; h+='<button class="htopt" data-k="'+esc(k)+'" onclick="HelpTest._pick(this.getAttribute(\'data-k\'))">'+esc(c.ic+' '+c.name)+'</button>'; });
    b.innerHTML=h;
  }
  function pickConsole(k){ FILTER=k; STEP=0; ONEKEY=null; var ov=q('htov'); if(ov)ov.classList.add('dock'); render(); }

  function renderOne(C){ var b=q('htbody'); if(!b)return; var set=C.tasks||[], n=set.length, who=tester();
    var head='<div class="htq" style="margin-top:0">'+esc(C.ic)+' HELP TEST'+(who?(' · '+esc(who)):'')+'</div>';
    if(!n){ b.innerHTML=head+'<div style="padding:18px 6px;color:#6c6878">No tasks are set here yet — check back soon. 🌹</div>'; return; }
    var done=doneList(), remaining=set.filter(function(t){return done.indexOf(t.key)<0;});
    if(!remaining.length){ b.innerHTML=head+'<div style="text-align:center;padding:26px 10px"><div style="font-size:34px">🌹</div><b>All done'+(who?(', '+esc(who)):'')+' — thank you!</b><p style="color:#6c6878;font-size:13px">Every answer went to the team. You can close this.</p></div>'; return; }
    if(STEP<0)STEP=0; if(STEP>=n)STEP=n-1;
    var t=set[STEP];
    if(ONEKEY!==t.key){ ONEKEY=t.key; PICK=null; WORKS=null; SHOT=null; NOTE=''; }
    var steps=(t.steps||[]).map(function(s,i){ return '<div class="htstep"><div class="n">'+(i+1)+'</div><div>'+(s.t||'')+'</div></div>'; }).join('');
    var opts=((t.q&&t.q.opts)||[]).map(function(o){var v=String(o).replace(/"/g,'');return '<button class="htopt'+(PICK===v?' sel':'')+'" onclick="HelpTest._opt(this)" data-v="'+esc(v)+'">'+esc(o)+'</button>';}).join('');
    var shot=SHOT?('📎 '+esc(SHOT.name)+(SHOT.path?' ✓':' · added')):'📸 Add a screenshot (optional)';
    b.innerHTML=head+
      '<div class="htprog">Task '+(STEP+1)+' of '+n+' · '+remaining.length+' left</div>'+
      '<div style="font-size:24px">'+esc(t.ic||'🧪')+'</div><div class="htq" style="margin-top:2px">'+esc(t.title||'')+'</div>'+steps+
      '<div class="htq">Did it work?</div><div class="htworks"><button'+(WORKS===true?' class="sel"':'')+' onclick="HelpTest._works(this,true)">👍 Worked</button><button'+(WORKS===false?' class="sel"':'')+' onclick="HelpTest._works(this,false)">👎 Broke</button></div>'+
      ((t.q&&t.q.prompt)?('<div class="htq">'+esc(t.q.prompt)+'</div>'+opts):'')+
      '<textarea class="htnote" id="htnote" placeholder="💡 Anything to add or improve? (optional)" oninput="HelpTest._note(this.value)">'+esc(NOTE)+'</textarea>'+
      '<label class="htshot">'+shot+'<input type="file" accept="image/*" capture="environment" style="display:none" onchange="HelpTest._shot(this)"></label>'+
      '<div class="htbtns"><button class="htsend" onclick="HelpTest._submit()">Submit &amp; next ›</button><button class="htskip" onclick="HelpTest._go(1)">Skip ›</button></div>'+
      (STEP>0?'<button class="htback" onclick="HelpTest._go(-1)">‹ previous</button>':'');
  }
  function pick(el){ PICK=el.getAttribute('data-v'); var p=el.parentNode; [].forEach.call(document.querySelectorAll('#htbody .htopt'),function(x){x.classList.remove('sel');}); el.classList.add('sel'); }
  function works(el,v){ WORKS=v; [].forEach.call(el.parentNode.querySelectorAll('button'),function(x){x.classList.remove('sel');}); el.classList.add('sel'); }
  function go(d){ STEP+=d; render(); }
  function shot(inp){ var f=inp.files&&inp.files[0]; if(!f)return; var nel=q('htnote'); if(nel)NOTE=nel.value; SHOT={name:f.name};
    var c=client(); if(c&&c.storage){ try{ var w=(tester()||'anon').replace(/[^\w]/g,'_'); var path=w+'/'+Date.now()+'_'+f.name.replace(/[^\w.\-]/g,'_');
      c.storage.from('qa_shots').upload(path,f,{upsert:true}).then(function(r){ if(r&&!r.error){ SHOT.path=path; render(); } }).catch(function(){}); }catch(e){} }
    toast('📸 Got your screenshot — it goes with your notes.'); render(); }
  function submit(){ var C=CONS[conKey()]; if(!C)return; var set=C.tasks||[]; var t=set[STEP]; if(!t)return;
    var who=tester(), con=conKey(); var nel=q('htnote'); var note=nel?nel.value:NOTE;
    var tagged='['+(who||'tester')+(con?(' · '+con):'')+'] '+note+(SHOT?(' [screenshot: '+SHOT.name+(SHOT.path?' @'+SHOT.path:'')+']'):'');
    try{ var res=JSON.parse(localStorage.getItem('dd.qa.results')||'[]'); res.push({tester:who||'',console:con,task:t.key,works:WORKS,choice:PICK,note:note,shot:(SHOT&&(SHOT.path||SHOT.name))||'',at:Date.now()}); if(res.length>300)res=res.slice(-300); localStorage.setItem('dd.qa.results',JSON.stringify(res)); }catch(e){}
    var c=client(); if(c){ try{ c.rpc('chat_qa_submit',{p_task:t.key,p_works:WORKS,p_choice:PICK,p_note:tagged,p_tester:(who||null),p_console:(con||null),p_shot:((SHOT&&SHOT.path)||null)}).catch(function(){}); }catch(e){} }
    markDone(t.key); toast('🙏 Thank you'+(who?(' '+who.split(' ')[0]):'')+' — logged.'); STEP+=1; render();
  }

  // ---- init: read ?ht + ?tester, auto-open docked (reliable across load timing) ----
  try{ var p=new URLSearchParams(location.search); var tv=p.get('tester'); if(tv){ try{localStorage.setItem('dd.tester',tv);}catch(e){} }
    var ht=p.get('ht'); if(ht){ FILTER=ht;
      var goOpen=function(){ var tries=0,fire=function(){ tries++; if(document.body){ try{open();}catch(e){} } else if(tries<40){ setTimeout(fire,150); } }; fire(); };
      if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',function(){ setTimeout(goOpen,300); }); } else { setTimeout(goOpen,300); }
    } else {
      // still mount the FAB so any page with tasks can open Help Test manually
      if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',function(){ setTimeout(mount,400); }); } else { setTimeout(mount,400); }
    }
  }catch(e){}

  root.HelpTest={ set:function(k,def){ CONS[k]=def; if(FILTER&&conKey()===k&&mounted){ render(); } },
    open:open, close:close, min:min, unmin:unmin, _m:isMin,
    _pick:pickConsole, _opt:pick, _works:works, _go:go, _shot:shot, _submit:submit, _note:function(v){NOTE=v;} };
})(window);
