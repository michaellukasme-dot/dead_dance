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
  var CONS={}, FILTER=null, STEP=0, ONEKEY=null, PICK=null, WORKS=null, NOTE='', SHOT=null, SHOTS=[], mounted=false;

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
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
  // ---- screenshots kept client-side (downscaled) so "Send to Claude" can re-download them in one click ----
  function loadShots(){ try{ return JSON.parse(localStorage.getItem('dd.qa.shots')||'[]'); }catch(e){ return []; } }
  function saveShots(a){ try{ localStorage.setItem('dd.qa.shots', JSON.stringify(a.slice(-8))); }catch(e){} }
  function toSmall(file, cb){ try{ var img=new Image(), u=URL.createObjectURL(file); img.onload=function(){ var m=1200, s=Math.min(1, m/Math.max(img.width,img.height)); var c=document.createElement('canvas'); c.width=Math.round(img.width*s); c.height=Math.round(img.height*s); c.getContext('2d').drawImage(img,0,0,c.width,c.height); var d=null; try{d=c.toDataURL('image/jpeg',0.72);}catch(e){} try{URL.revokeObjectURL(u);}catch(e){} cb(d); }; img.onerror=function(){cb(null);}; img.src=u; }catch(e){ cb(null); } }
  function stashShot(task, file){ toSmall(file, function(d){ if(!d)return; SHOTS.push({task:task||'',name:file.name,url:d}); if(SHOTS.length>8)SHOTS=SHOTS.slice(-8); saveShots(SHOTS); }); }

  /* ============================================================================
     ONE CLICK = SEND.  The user answers the questions, then taps 📸 once — that
     single tap captures THIS screen, bundles their answers, and ships it straight
     to the team/Claude. No Send button, no Save, no download, no email, no files.
     Honest: it is the user's OWN screen, they initiated the capture (consent), it
     goes only to the support ticket. Nothing runs in the background; nothing is
     captured until they tap. Offline-safe: queues locally and retries.
     ============================================================================ */
  var H2C_Q=null, SENDING=false, STUCKBUSY=false;
  function ensureH2C(cb){ if(root.html2canvas){cb(root.html2canvas);return;} if(H2C_Q){H2C_Q.push(cb);return;} H2C_Q=[cb];
    var s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.async=true;
    s.onload=function(){ var q2=H2C_Q; H2C_Q=null; (q2||[]).forEach(function(f){ try{f(root.html2canvas);}catch(e){} }); };
    s.onerror=function(){ var q2=H2C_Q; H2C_Q=null; (q2||[]).forEach(function(f){ try{f(null);}catch(e){} }); };
    document.head.appendChild(s); }
  function du2blob(d){ try{ var a=String(d).split(','), m=(a[0].match(/:(.*?);/)||[])[1]||'image/jpeg', b=atob(a[1]), n=b.length, u=new Uint8Array(n); while(n--)u[n]=b.charCodeAt(n); return new Blob([u],{type:m}); }catch(e){ return null; } }
  function captureScreen(cb){ // hide OUR panel + FAB so the shot shows the app, not our own chrome
    var ov=q('htov'), prev=ov?ov.style.visibility:'';
    var fab=document.querySelector('.htfab'), fprev=fab?fab.style.visibility:'';
    if(ov)ov.style.visibility='hidden'; if(fab)fab.style.visibility='hidden';
    var restore=function(){ if(ov)ov.style.visibility=prev; if(fab)fab.style.visibility=fprev; };
    var guard=setTimeout(function(){ restore(); cb(null); cb=function(){}; }, 12000); // never hang the UI
    ensureH2C(function(H){ if(!H){ clearTimeout(guard); restore(); cb(null); return; }
      try{
        H(document.body,{backgroundColor:'#140b22',logging:false,useCORS:true,scale:1,
          windowWidth:document.documentElement.clientWidth,windowHeight:document.documentElement.clientHeight})
        .then(function(cv){ clearTimeout(guard); restore();
          try{ var mx=1400, sc=Math.min(1,mx/Math.max(cv.width||1,cv.height||1)); var out=cv;
            if(sc<1){ out=document.createElement('canvas'); out.width=Math.round(cv.width*sc); out.height=Math.round(cv.height*sc); out.getContext('2d').drawImage(cv,0,0,out.width,out.height); }
            var d=null; try{ d=out.toDataURL('image/jpeg',0.7); }catch(e){ d=null; }
            cb(d);
          }catch(e){ cb(null); }
        })
        .catch(function(){ clearTimeout(guard); restore(); cb(null); });
      }catch(e){ clearTimeout(guard); restore(); cb(null); }
    }); }

  /* ---- the REQUEST DESK: every one-tap category the community can send us — all through the SAME loop.
     Each is tagged so Claude can triage/act on receipt. req:true = "make something FOR the user."
     "YOU DREAM IT UP" — add a row here and it becomes a real one-tap ask. ---- */
  var CATS={
    support:  {ic:'🛟', name:'Support',                tag:'[SUPPORT]',  label:'🛟 Send to support',       req:false, prompt:'What’s going wrong? Tell us what you were doing and what happened — a picture of this screen comes with it.'},
    contact:  {ic:'✉️', name:'Contact Us',             tag:'[CONTACT]',  label:'✉️ Send my message',       req:false, prompt:'Tell us your name and the best way to reach you — then what’s on your mind. We read every note.'},
    fb_post:  {ic:'📘', name:'Make me a Facebook post',tag:'[FB-POST]',  label:'📘 Make my Facebook post', req:true,  prompt:'What’s the show or the news? Add a line if you like, then tap — I’ll write you a Facebook post from this screen, ready to approve and drop on your page.'},
    spread:   {ic:'🎯', name:'Make me a Spread',       tag:'[SPREAD]',   label:'🎯 Make my full spread',   req:true,  prompt:'A full spread = one image per network (Facebook, Instagram, X, TikTok & more). Tap and I’ll build it from this screen — you approve before anything goes out.'},
    tiktok:   {ic:'🎵', name:'Make me a TikTok',       tag:'[TIKTOK]',   label:'🎵 Make my TikTok',        req:true,  prompt:'Tell me the vibe (or nothing). Tap and I’ll cut you a TikTok-ready caption + shot list from this screen.'},
    ig_story: {ic:'📸', name:'Make me an IG Story',    tag:'[IG-STORY]', label:'📸 Make my IG Story',      req:true,  prompt:'Tap and I’ll draft an Instagram Story frame + caption from this screen — your look, ready to post.'},
    poster:   {ic:'🖼️', name:'Make me a Show Poster',  tag:'[POSTER]',   label:'🖼️ Make my show poster',   req:true,  prompt:'Which show? Tap with this screen and I’ll draft a show poster in your look, QR baked in.'},
    hyperpost:{ic:'⚡', name:'Write my HyperPost',     tag:'[HYPERPOST]',label:'⚡ Write my HyperPost',    req:true,  prompt:'Tap and I’ll write your HyperPost — the differentiated, de-noised post — ready for you to approve and fire.'}
  };
  function catOf(){ return CATS[conKey()]||null; }
  function capTag(){ var c=catOf(); return c?c.tag:'[SCREEN]'; }
  function capLabel(){ var c=catOf(); return c?c.label:'📸 Screenshot & send'; }

  function sessionSummary(){ var arr=[]; try{arr=JSON.parse(localStorage.getItem('dd.qa.results')||'[]');}catch(e){}
    var con=conKey(); if(con){ arr=arr.filter(function(r){ return (r.console||'')===con; }); }   // scope this send to its own surface
    var who=tester()||'tester';
    var lines=arr.map(function(r){ return '• '+(r.task||'')+(r.console?(' ('+r.console+')'):'')+' — '+(r.works===true?'👍 worked':(r.works===false?'👎 broke':'—'))+(r.choice?(' ['+r.choice+']'):'')+(r.note?(' : '+r.note):''); });
    return { who:who, count:arr.length,
      text:'Shakedown Street — '+who+' · '+(location&&location.pathname||'')+'\n'+arr.length+' line'+(arr.length===1?'':'s')+'\n\n'+lines.join('\n') }; }

  /* ---- offline queue: cap by count, keep newest, and CHECK that the write actually succeeded (Claudine H1) ---- */
  function readQ(){ try{ return JSON.parse(localStorage.getItem('dd.qa.pending')||'[]'); }catch(e){ return []; } }
  function writeQ(a){ try{ localStorage.setItem('dd.qa.pending', JSON.stringify(a)); return true; }catch(e){ return false; } }
  function queuePending(rec){ var q2=readQ(); q2.push(rec);
    while(q2.length){ if(writeQ(q2.slice(-12))) return true; q2.shift(); }   // shed oldest until it fits; report REAL success
    return false; }
  function dropFromQ(rec){ writeQ(readQ().filter(function(r){ return !(r&&r.at===rec.at&&r.console===rec.console); })); }

  /* ---- one send. Always settles exactly once (Claudine C1): a hard timeout guarantees `done` fires,
     so a hung upload/RPC can never wedge the only button. ---- */
  function sendRec(c, rec, done){ var called=false; var fin=function(ok){ if(called)return; called=true; clearTimeout(t); done&&done(!!ok); };
    var t=setTimeout(function(){ fin(false); }, 15000);
    var rpc=function(shotPath){ try{ c.rpc('chat_qa_submit',{p_task:'__screen__',p_works:null,p_choice:null,p_note:rec.note,p_tester:(rec.who||null),p_console:(rec.console||null),p_shot:(shotPath||null)}).then(function(r){ fin(!(r&&r.error)); },function(){ fin(false); }); }catch(e){ fin(false); } };
    if(rec.screen && c.storage){ var blob=du2blob(rec.screen);
      if(blob){ var w=(rec.who||'anon').replace(/[^\w]/g,'_'); var path=w+'/'+(rec.at||Date.now())+'_'+Math.random().toString(36).slice(2,8)+'_screen.jpg';   // random suffix → no same-ms overwrite
        try{ c.storage.from('qa_shots').upload(path,blob,{upsert:false,contentType:'image/jpeg'}).then(function(r){ rpc(r&&!r.error?path:null); },function(){ rpc(null); }); }catch(e){ rpc(null); }
        return; } }
    rpc(null); }
  function flushPending(){ var c=client(); if(!c)return; var q2=readQ(); if(!q2.length)return;
    q2.forEach(function(rec){ sendRec(c, rec, function(ok){ if(ok) dropFromQ(rec); }); }); }   // remove ONLY after confirmed delivery (Claudine H2)

  /* ---- honest thank-you: tells the truth about whether it actually went out (Claudine C2/H3) ---- */
  function thanks(who, ok, queued){ var b=q('htbody'); if(!b)return; var nm=who?(', '+esc(String(who).split(' ')[0])):'';
    var body = ok ? '<p style="color:#6c6878;font-size:13px;margin-top:8px">Your screen and your note went straight to the team.<br>That’s all we needed. 💚</p>'
      : (queued ? '<p style="color:#6c6878;font-size:13px;margin-top:8px">Saved on your device — we’ll send it automatically the moment you’re back online.<br>Nothing was lost. 💚</p>'
                : '<p style="color:#a23;font-size:13px;margin-top:8px">We couldn’t send it just now and your device is low on space, so it may not have saved. Please try again in a moment. 🙏</p>');
    b.innerHTML='<div style="text-align:center;padding:28px 12px"><div style="font-size:42px">'+(ok?'🌹':(queued?'📩':'⚠️'))+'</div>'+
      '<b style="font-size:17px;display:block;margin-top:6px">Thank you'+nm+' — for your help.</b>'+body+
      '<button class="htsend" style="width:auto;padding:10px 20px;margin-top:6px" onclick="HelpTest.close()">Done</button></div>'; }

  function screenshotAndSend(){ if(SENDING) return; SENDING=true;
    var who=tester()||'';
    var nel=q('htnote'); if(nel){ NOTE=nel.value; autoSave(); }   // capture any open note first
    var s=sessionSummary();
    var b=q('htbody'); if(b){ b.innerHTML='<div style="text-align:center;padding:30px 12px"><div style="font-size:34px">📸</div><b>One moment'+(who?(', '+esc(String(who).split(' ')[0])):'')+'…</b><p style="color:#6c6878;font-size:13px;margin-top:6px">Capturing your screen and sending it to the team.</p></div>'; }
    captureScreen(function(dataURL){
      if(dataURL){ SHOTS.push({task:'__screen__',name:'screen.jpg',url:dataURL}); if(SHOTS.length>8)SHOTS=SHOTS.slice(-8); saveShots(SHOTS); }
      var rec={ who:who, console:conKey(), note:capTag()+' '+s.text, screen:dataURL||null, at:Date.now() };
      var c=client();
      var settle=function(ok){ SENDING=false; if(ok){ thanks(who,true,true); return; } var queued=queuePending(rec); thanks(who,false,queued); };
      if(c){ sendRec(c, rec, function(ok){ settle(ok); }); }
      else { settle(false); }   // offline: queue + honest message, never make the user fumble a file
    });
  }
  /* auto-save the current answer as the user toggles/notes — so ANSWERING never needs a Submit button */
  function autoSave(){ var C=CONS[conKey()]; if(!C)return; var set=C.tasks||[]; var t=set[STEP]; if(!t)return;
    var who=tester(), con=conKey();
    try{ var res=JSON.parse(localStorage.getItem('dd.qa.results')||'[]');
      res=res.filter(function(r){ return !(r.task===t.key && (r.console||'')===con); });
      res.push({tester:who||'',console:con,task:t.key,works:WORKS,choice:PICK,note:NOTE,shot:(SHOT&&(SHOT.path||SHOT.name))||'',at:Date.now()});
      if(res.length>300)res=res.slice(-300); localStorage.setItem('dd.qa.results',JSON.stringify(res));
    }catch(e){}
    markDone(t.key); }

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
  '.htcap{box-shadow:0 6px 16px #1f7a4d55;letter-spacing:.2px}.htcap:active{transform:translateY(1px)}'+
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
    ov.classList.toggle('dock', !!CONS[conKey()]); render(); try{ flushPending(); }catch(e){} }
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

  /* Contact Us / Support: a message goes through the SAME loop (capture → upload → chat_qa_submit),
     just tagged by console so Claude can triage it on receipt. No new plumbing. */
  function ensureMsgConsole(kind){ var def=CATS[kind]; if(!def)return; if(!CONS[kind]){ CONS[kind]={ic:def.ic,name:def.name,msg:true,req:!!def.req,prompt:def.prompt,tasks:[{key:kind+'_msg',ic:def.ic,title:def.name,prompt:def.prompt}]}; } }
  function openMsg(kind){ ensureMsgConsole(kind); FILTER=kind; STEP=0; ONEKEY=null; try{localStorage.setItem('dd.ht.introseen','1');}catch(e){}
    mount(); var ov=q('htov'); if(ov){ ov.classList.add('on'); ov.classList.remove('min'); ov.classList.add('dock'); } render(); try{flushPending();}catch(e){} }
  function renderMsg(C){ var b=q('htbody'); if(!b)return; var who=tester(); var t=(C.tasks&&C.tasks[0])||{};
    if(ONEKEY!==t.key){ ONEKEY=t.key; NOTE=''; WORKS=null; PICK=null; SHOT=null; }
    b.innerHTML='<div class="htq" style="margin-top:0">'+esc(C.ic)+' '+esc(C.name)+(who?(' · '+esc(who)):'')+'</div>'+
      '<div class="htstep"><div class="n">✍️</div><div>'+esc(t.prompt||'How can we help?')+'</div></div>'+
      '<textarea class="htnote" id="htnote" placeholder="Type your message here…" oninput="HelpTest._note(this.value)" style="min-height:120px">'+esc(NOTE)+'</textarea>'+
      '<button class="htsend htcap" style="width:100%;font-size:15px" onclick="HelpTest._cap()">'+esc(capLabel())+'</button>'+
      '<div style="font-size:11px;color:#9a95a6;text-align:center;margin-top:8px">Sends your message + a picture of this screen to the team. No email, nothing to attach. 🌹</div>';
  }
  function renderOne(C){ var b=q('htbody'); if(!b)return; if(C.msg){ renderMsg(C); return; } var set=C.tasks||[], n=set.length, who=tester();
    var head='<div class="htq" style="margin-top:0">'+esc(C.ic)+' HELP TEST'+(who?(' · '+esc(who)):'')+'</div>';
    if(!n){ b.innerHTML=head+'<div style="padding:18px 6px;color:#6c6878">No tasks are set here yet — check back soon. 🌹</div>'; return; }
    var done=doneList(), remaining=set.filter(function(t){return done.indexOf(t.key)<0;});
    if(!remaining.length){ b.innerHTML=head+'<div style="text-align:center;padding:22px 10px"><div style="font-size:34px">🌹</div><b>All done'+(who?(', '+esc(who)):'')+'!</b><p style="color:#6c6878;font-size:13px">One tap sends your screen <b>and</b> your notes straight to the team. No files, no email — just this:</p><button class="htsend htcap" style="width:100%;font-size:15px" onclick="HelpTest._cap()">📸 Screenshot &amp; send</button><div style="font-size:11px;color:#9a95a6;margin-top:8px">Sends a picture of this screen + your answers to the team.</div></div>'; return; }
    if(!seenIntro()){ b.innerHTML=head+
      '<div class="htq" style="margin-top:0">👋 How this works — 15 seconds</div>'+
      '<div class="htstep"><div class="n">1</div><div>I give you <b>one tiny task at a time.</b> Just do it.</div></div>'+
      '<div class="htstep"><div class="n">2</div><div>Tell me <b>👍 Worked</b> or <b>👎 Broke</b> — add a note if you like.</div></div>'+
      '<div class="htstep"><div class="n">3</div><div><b>Can’t find something? Tap “🤔 Stuck” and type what’s confusing.</b> That comes <b>straight to the team — you don’t need to ask Michael.</b></div></div>'+
      '<div class="htstep"><div class="n">4</div><div>You <b>can’t break anything.</b> Nothing here is real.</div></div>'+
      '<div class="htstep"><div class="n">5</div><div><b>When you’re done, tap 📸 “Screenshot &amp; send.”</b> One tap sends your screen and your notes straight to the team — <b>no files, no email, nothing to drag.</b></div></div>'+
      '<button class="htsend" style="width:100%;margin-top:12px" onclick="HelpTest._start()">Let’s go →</button>'; return; }
    if(STEP<0)STEP=0; if(STEP>=n)STEP=n-1;
    var t=set[STEP];
    if(ONEKEY!==t.key){ ONEKEY=t.key; PICK=null; WORKS=null; SHOT=null; NOTE='';
      try{ var _prev=(JSON.parse(localStorage.getItem('dd.qa.results')||'[]')).filter(function(r){ return r.task===t.key && (r.console||'')===conKey(); }).pop();
        if(_prev){ WORKS=(_prev.works===true||_prev.works===false)?_prev.works:null; PICK=_prev.choice||null; NOTE=_prev.note||''; if(_prev.shot)SHOT={name:_prev.shot}; } }catch(e){}   // rehydrate: reopening never looks like it "forgot"
    }
    var steps=(t.steps||[]).map(function(s,i){ return '<div class="htstep"><div class="n">'+(i+1)+'</div><div>'+esc(s.t||'')+'</div></div>'; }).join('');
    var opts=((t.q&&t.q.opts)||[]).map(function(o){var v=String(o).replace(/"/g,'');return '<button class="htopt'+(PICK===v?' sel':'')+'" onclick="HelpTest._opt(this)" data-v="'+esc(v)+'">'+esc(o)+'</button>';}).join('');
    var shot=SHOT?('📎 '+esc(SHOT.name)+(SHOT.path?' ✓':' · added')):'📸 Add a screenshot (optional)';
    b.innerHTML=head+
      '<div class="htprog">Task '+(STEP+1)+' of '+n+' · '+remaining.length+' left</div>'+
      '<div style="font-size:24px">'+esc(t.ic||'🧪')+'</div><div class="htq" style="margin-top:2px">'+esc(t.title||'')+'</div>'+steps+
      '<div class="htq">Did it work?</div><div class="htworks"><button'+(WORKS===true?' class="sel"':'')+' onclick="HelpTest._works(this,true)">👍 Worked</button><button'+(WORKS===false?' class="sel"':'')+' onclick="HelpTest._works(this,false)">👎 Broke</button></div>'+
      ((t.q&&t.q.prompt)?('<div class="htq">'+esc(t.q.prompt)+'</div>'+opts):'')+
      '<textarea class="htnote" id="htnote" placeholder="💡 What did you see? Confused? Type it here — don&#39;t ask Michael, tell us. (This is the gold.)" oninput="HelpTest._note(this.value)">'+esc(NOTE)+'</textarea>'+
      '<div class="htbtns">'+
        '<button class="htsend htcap" onclick="HelpTest._cap()">📸 Screenshot &amp; send</button>'+
        (STEP<n-1?'<button class="htskip" onclick="HelpTest._go(1)" title="Next question">next ›</button>':'')+
      '</div>'+
      '<div class="htbtns" style="margin-top:6px">'+
        '<button class="htskip" style="flex:1" onclick="HelpTest._stuck()" title="Confused? Log it — comes straight to the team">🤔 Stuck — I&#39;m confused</button>'+
        (STEP>0?'<button class="htskip" onclick="HelpTest._go(-1)">‹ prev</button>':'')+
      '</div>'+
      '<div style="font-size:11px;color:#9a95a6;text-align:center;margin-top:8px">📸 sends a picture of this screen + your answers to the team. No files, no email.</div>';
  }
  function pick(el){ PICK=el.getAttribute('data-v'); var p=el.parentNode; [].forEach.call(document.querySelectorAll('#htbody .htopt'),function(x){x.classList.remove('sel');}); el.classList.add('sel'); autoSave(); }
  function works(el,v){ WORKS=v; [].forEach.call(el.parentNode.querySelectorAll('button'),function(x){x.classList.remove('sel');}); el.classList.add('sel'); autoSave(); }
  function go(d){ STEP+=d; render(); }
  function shot(inp){ var f=inp.files&&inp.files[0]; if(!f)return; var nel=q('htnote'); if(nel)NOTE=nel.value; SHOT={name:f.name}; stashShot(ONEKEY, f); autoSave();
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
  function sendResults(){ var arr=[]; try{arr=JSON.parse(localStorage.getItem('dd.qa.results')||'[]');}catch(e){}
    if(!arr.length){ toast('Nothing to send yet — do a task first 🌹'); return; }
    var who=tester()||'tester';
    var lines=arr.map(function(r){ return '• '+(r.task||'')+(r.console?(' ('+r.console+')'):'')+' — '+(r.works===true?'👍 worked':(r.works===false?'👎 broke':'—'))+(r.choice?(' ['+r.choice+']'):'')+(r.note?(' : '+r.note):''); });
    var text='dead.dance Help Test — '+who+'\n'+arr.length+' answer'+(arr.length===1?'':'s')+'\n\n'+lines.join('\n');
    var copy=function(){ var done=function(){ toast('📋 Copied your results — paste them to the team.'); };
      if(root.navigator&&navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done).catch(function(){ try{var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);done();}catch(e){toast('Screenshot this and send it 🌹');} }); }
      else { try{var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);done();}catch(e){toast('Screenshot this and send it 🌹');} } };
    if(root.navigator&&navigator.share){ navigator.share({title:'dead.dance Help Test',text:text}).catch(copy); } else copy(); }
  function sendToClaude(){ var arr=[]; try{arr=JSON.parse(localStorage.getItem('dd.qa.results')||'[]');}catch(e){}
    if(!arr.length){ toast('Nothing yet — do a task first 🌹'); return; }
    var who=tester()||'tester';
    var lines=arr.map(function(r){ return '• '+(r.task||'')+(r.console?(' ('+r.console+')'):'')+' — '+(r.works===true?'👍 worked':(r.works===false?'👎 broke':'—'))+(r.choice?(' ['+r.choice+']'):'')+(r.note?(' : '+r.note):''); });
    var text='Shakedown Street Help Test — '+who+'\n'+arr.length+' answer'+(arr.length===1?'':'s')+'\n\n'+lines.join('\n');
    try{ if(root.navigator&&navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text); } else { var ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } }catch(e){}
    var shots=(SHOTS&&SHOTS.length)?SHOTS:loadShots(); var n=0;
    shots.forEach(function(s,i){ if(!s||!s.url)return; n++; setTimeout(function(){ try{ var a=document.createElement('a'); a.href=s.url; a.download='qa_'+(i+1)+'_'+((s.task||'shot').replace(/[^\w]/g,'_'))+'.jpg'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(e){} }, i*400); });
    toast('📋 Notes copied — paste into Claude. '+(n?('📸 '+n+' screenshot'+(n===1?'':'s')+' downloading — drag them into the chat.'):'(no screenshots this time)')+' No email needed. 🌹'); }
  function seenIntro(){ try{return localStorage.getItem('dd.ht.introseen')==='1';}catch(e){return false;} }
  function startTasks(){ try{localStorage.setItem('dd.ht.introseen','1');}catch(e){} render(); }
  function stuck(){ if(STUCKBUSY)return; STUCKBUSY=true; setTimeout(function(){STUCKBUSY=false;},1500);   // de-dupe rapid taps
    var C=CONS[conKey()]; if(!C)return; var set=C.tasks||[]; var t=set[STEP]; if(!t)return;
    var who=tester(), con=conKey(); var nel=q('htnote'); var note='🤔 STUCK: '+((nel?nel.value:NOTE)||'(no detail)');
    var tagged='['+(who||'tester')+(con?(' · '+con):'')+'] '+note;
    try{ var res=JSON.parse(localStorage.getItem('dd.qa.results')||'[]'); res.push({tester:who||'',console:con,task:t.key,works:false,choice:'STUCK',note:note,shot:'',at:Date.now()}); if(res.length>300)res=res.slice(-300); localStorage.setItem('dd.qa.results',JSON.stringify(res)); }catch(e){}
    var c=client(); if(c){ try{ c.rpc('chat_qa_submit',{p_task:t.key,p_works:false,p_choice:'STUCK',p_note:tagged,p_tester:(who||null),p_console:(con||null),p_shot:null}).catch(function(){}); }catch(e){} }
    toast('🙏 Got it — being stuck IS the test. Logged. Next one…'); STEP+=1; render(); }

  // ---- init: read ?ht + ?tester, auto-open docked (reliable across load timing) ----
  try{ var p=new URLSearchParams(location.search); var tv=p.get('tester'); if(tv){ try{localStorage.setItem('dd.tester',tv);}catch(e){} }
    var ht=p.get('ht'); if(ht){ FILTER=ht;
      var goOpen=function(){ var tries=0,fire=function(){ tries++; if(document.body){ try{open();}catch(e){} } else if(tries<40){ setTimeout(fire,150); } }; fire(); };
      if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',function(){ setTimeout(goOpen,300); }); } else { setTimeout(goOpen,300); }
    } else {
      // still mount the FAB so any page with tasks can open Help Test manually —
      // but NOT on a page that already has its own help affordance (e.g. index's qaOpen), to avoid a duplicate button.
      var autoMount=function(){ if(root.qaOpen) return; mount(); };
      if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',function(){ setTimeout(autoMount,400); }); } else { setTimeout(autoMount,400); }
    }
    setTimeout(function(){ try{ flushPending(); }catch(e){} }, 3500); // retry any send that was queued while offline
  }catch(e){}

  root.HelpTest={ set:function(k,def){ CONS[k]=def; if(FILTER&&conKey()===k&&mounted){ render(); } },
    open:open, close:close, min:min, unmin:unmin, _m:isMin,
    _pick:pickConsole, _opt:pick, _works:works, _go:go, _shot:shot, _submit:submit, _note:function(v){NOTE=v; autoSave();}, _start:startTasks, _stuck:stuck,
    _cap:screenshotAndSend, _send:sendResults, _claude:sendToClaude,
    ask:function(k){ openMsg(k); },                                  // one-tap request desk: HelpTest.ask('fb_post'|'spread'|'tiktok'|…)
    cats:function(){ var o=[]; for(var k in CATS){ if(CATS.hasOwnProperty(k)) o.push({key:k,ic:CATS[k].ic,name:CATS[k].name,req:!!CATS[k].req}); } return o; },
    contact:function(){ openMsg('contact'); }, support:function(){ openMsg('support'); } };
})(window);
