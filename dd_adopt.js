/* ============================================================================
 * dd_adopt.js — the ADOPT-A-BAND engine, extracted from adopt_a_band.html so the
 * SAME renderer runs standalone AND natively inside the unified Street-Team shell
 * (no iframe, no duplicate hero). It mounts its band list into a target container
 * and behaves EXACTLY like the working page: same differentiated posts, the REAL
 * dd_bandadopt_claim spine write (chained .then/.catch), flushMine retroactive
 * sync, the shared-list pull, and the honest saved / failed / offline states.
 *
 * HOUSE LAW: every .rpc() is chained with .then/.catch (supabase-js v2 only SENDS
 * when chained). No client → the claim reports "offline" honestly, never a fake
 * "saved". Pure helpers (lineup / cardHTML / msg builders / _pick / tixUrl /
 * slugify) are testable with no DOM and no backend. Dual browser/node export.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  // ---- storage shim (browser localStorage, or a root-attached shim in node) ----
  function LS(){
    try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage; } catch (e) {}
    try { if (root && root.localStorage) return root.localStorage; } catch (e) {}
    return null;
  }

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function todayISO(){ try{ return new Date().toISOString().slice(0,10); }catch(e){ return '2026-07-31'; } }
  function slugify(n){ return String(n).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function dayLabel(d){ try{ return new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}); }catch(e){ return d; } }
  function who(){ try{ var ls=LS(); var k='dd.adopter',v=ls&&ls.getItem(k); if(!v){ v='fan-'+Math.random().toString(36).slice(2,8); if(ls) ls.setItem(k,v); } return v; }catch(e){ return 'anon'; } }
  function claims(){ try{ var ls=LS(); return JSON.parse((ls&&ls.getItem('dd.adopt'))||'{}'); }catch(e){ return {}; } }

  // report the REAL server result back via cb(status, err):
  //   true  = saved to server, false = server rejected, null = no server reachable.
  function saveClaim(slug, cb){ var ls=LS(); var c=claims(); c[slug]={by:who(),ts:Date.now()}; try{ if(ls) ls.setItem('dd.adopt',JSON.stringify(c)); }catch(e){}
    try{ var cl=root.ddClient && root.ddClient();
      if(cl&&cl.rpc){ cl.rpc('dd_bandadopt_claim',{p_slug:slug,p_by:who()})
        .then(function(r){ if(cb) cb(r&&r.error?false:true, r&&r.error); })
        .catch(function(e){ if(cb) cb(false, e); });
        return; } }catch(e){}
    if(cb) cb(null); }

  var TICKET='https://deaddance.app/ticket.html?price=FREE&band=';
  function tixUrl(name){ return TICKET+encodeURIComponent(name); }
  function cp(t){ try{ navigator.clipboard.writeText(t); }catch(e){ try{ var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove(); }catch(_){} } }
  function find(slug){ return (_LU||[]).filter(function(x){return x.slug===slug;})[0]; }
  // pick a variant deterministically from the slug so each band's post says the same thing, differently
  function _pick(seed, arr){ var h=0,s=String(seed); for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return arr[h%arr.length]; }
  function bandDate(b){ return (b&&b.next)? (' ('+dayLabel(b.next)+')') : ''; }

  // THE GOAL: the post to the BAND. Differentiated per band + carries that band's UNIQUE ticket link.
  var BAND_MSGS=[
    function(n,d,u){ return 'Hey '+n+' 🌹 — this is YOUR free MusikFest ticket'+d+'. Fans keep it forever: it walks them to your stage, texts them your setlist as you play it, and every fan who grabs it becomes one on your list. Share it with the crowd by touching phones.\n\nYour ticket: '+u; },
    function(n,d,u){ return n+', we built you a ticket 🌹 — free for you and every fan'+d+'. A living memento that collects your fans at the show and grows your list. Post it, share it, pass it phone-to-phone.\n\n'+u; },
    function(n,d,u){ return 'Fans miss paper tickets, '+n+' 🌹 — the setlist on the back, the memento of the night. This one does that AND collects your fans for you'+d+'. Free to you and everyone:\n\n'+u; },
    function(n,d,u){ return n+' fans 🌹 — here is the band\'s free MusikFest ticket'+d+'. It guides you to the stage and texts you the setlist as they play it. Grab it, keep it forever, pass it on:\n\n'+u; },
    function(n,d,u){ return 'This is '+n+'\'s ticket 🌹 — free for the band and every fan'+d+'. Setlist texted live, audio you can add later, every attendee on your list. Touch phones to share it with the crowd:\n\n'+u; },
    function(n,d,u){ return n+' 🌹 your MusikFest ticket is ready'+d+' — a keepsake for fans and a fan-list for you. Free, forever, and it spreads by touching phones. Here it is:\n\n'+u; }
  ];
  function msgBand(b){ var n=(b&&b.name)||'this act'; return _pick((b&&b.slug)||n, BAND_MSGS)(n, bandDate(b), tixUrl(n)); }
  // BONUS: the post to YOUR wall. Also carries the band's ticket link.
  var OWN_MSGS=[
    function(n,u){ return 'MusikFest people 🌹 I adopted '+n+' — grab their FREE ticket. It walks you to the stage and texts you the setlist as they play. Keep it forever:\n\n'+u; },
    function(n,u){ return 'Grabbed '+n+'\'s free MusikFest ticket 🌹 — setlist texted live, yours to keep. Get yours:\n\n'+u; },
    function(n,u){ return 'At MusikFest? 🌹 Get '+n+'\'s free ticket — it guides you to the stage and texts the setlist as it happens:\n\n'+u; }
  ];
  function msgOwn(b){ var n=(b&&b.name)||'this act'; return _pick(((b&&b.slug)||n)+'own', OWN_MSGS)(n, tixUrl(n)); }

  // ---- build the full lineup from the SCHEDULE, phased by day ----
  function curated(){ var B=root.DD_MF_BANDS||{}, m={}; for(var s in B){ if(!Object.prototype.hasOwnProperty.call(B,s))continue; var e=B[s]||{};
    m[(e.name||s).toLowerCase()]={slug:s, kind:e.kind||'', fb:e.Facebook||(e.links&&e.links.Facebook)||''}; } return m; }
  function lineup(){ var S=root.DD_MUSIKFEST||[], cur=curated(), map={};
    S.forEach(function(r){ if(!r||!r.b)return; var key=String(r.b).toLowerCase();
      if(!map[key]) map[key]={name:r.b, days:{}, meta:cur[key]||null}; if(r.d) map[key].days[r.d]=true; });
    var today=todayISO();
    return Object.keys(map).map(function(k){ var m=map[k], ds=Object.keys(m.days).sort();
      var next=ds.filter(function(d){return d>=today;})[0]||null;
      return { name:m.name, slug:(m.meta&&m.meta.slug)||slugify(m.name), kind:(m.meta&&m.meta.kind)||'',
        fb:(m.meta&&m.meta.fb)||'', next:next, first:ds[0]||'', bucket: next || 'zzz' }; })
      .sort(function(a,b){ if(a.bucket!==b.bucket) return a.bucket<b.bucket?-1:1; return a.name.localeCompare(b.name); });
  }
  function fbLink(b){ return b.fb || ('https://www.facebook.com/search/top?q='+encodeURIComponent(b.name+' band')); }

  function cardHTML(b, claimed){
    return '<div class="card'+(claimed?' claimed':'')+'" id="c_'+esc(b.slug)+'">'
      +'<div class="bn">'+(claimed?'<s>'+esc(b.name)+'</s>':esc(b.name))+'</div>'
      +(b.kind?('<div class="bk">'+esc(b.kind)+'</div>'):'')
      +(claimed?'<div class="badge">✓ Adopted — thank you 🌹</div>'
        :'<div style="display:flex;gap:10px;flex-wrap:wrap">'
           +'<div style="flex:1 1 240px;border:1.5px solid var(--acc);border-radius:12px;padding:10px">'
             +'<div style="font-size:11px;font-weight:800;color:var(--acc);letter-spacing:.4px">① POST TO THE BAND · THE GOAL 🌹</div>'
             +'<div style="font-size:12px;color:#555;margin:6px 0 8px">A ready-made message + '+esc(b.name)+'\'s ticket link. Paste it on the band\'s Facebook.</div>'
             +'<div class="row">'
               +'<button class="btn p" onclick="ADOPT.copyBand(\''+esc(b.slug)+'\')">📋 Copy this</button>'
               +'<a class="btn g" href="'+fbLink(b)+'" target="_blank" rel="noopener">Open band\'s FB ↗</a>'
             +'</div>'
           +'</div>'
           +'<div style="flex:1 1 240px;border:1px solid #ddd;border-radius:12px;padding:10px">'
             +'<div style="font-size:11px;font-weight:800;color:#888;letter-spacing:.4px">② POST TO YOUR WALL · BONUS</div>'
             +'<a href="'+tixUrl(b.name)+'" target="_blank" rel="noopener" style="display:block;font-size:12px;margin:6px 0 8px;color:var(--acc)">🎟️ See '+esc(b.name)+'\'s ticket — front &amp; back ↗</a>'
             +'<div class="row">'
               +'<button class="btn p" onclick="ADOPT.copyOwn(\''+esc(b.slug)+'\')">📋 Copy this</button>'
               +'<button class="btn rose" onclick="ADOPT.claim(\''+esc(b.slug)+'\')">🌹 Done</button>'
             +'</div>'
           +'</div>'
         +'</div>')
      +'</div>';
  }

  // ---- DOM render (scoped to a host element) --------------------------------------
  var _LU=null, _host=null;
  function $(sel){ return _host ? _host.querySelector(sel) : null; }
  function render(){
    if(!_host) return;
    var all=_LU||(_LU=lineup()), c=claims();
    var host=$('.dd-adopt-list'), bar=$('.dd-adopt-bar'), pnum=$('.dd-adopt-pnum');
    if(!host) return;
    if(!all.length){ host.innerHTML='<div class="card"><b>The lineup is loading…</b></div>'; if(pnum) pnum.textContent=''; return; }
    var done=all.filter(function(b){return c[b.slug];}).length, total=all.length, left=total-done;
    if(bar) bar.style.width=Math.round(done/total*100)+'%';
    if(pnum) pnum.textContent=done+' of '+total+' acts adopted — '+left+' to go 🌹';
    if(left===0){ host.innerHTML='<div class="card" style="text-align:center;padding:22px"><div style="font-size:34px">🎉</div><b style="font-size:16px">Every act is adopted!</b><div class="note">All '+total+' covered — you did it. Thank you. 🌹</div></div>'; return; }
    var today=todayISO(), groups={}, order=[];
    all.forEach(function(b){ if(c[b.slug]) return;   // adopted bands DROP OFF the list — you only ever see what's left
      var g=b.next||'played'; if(!groups[g]){ groups[g]=[]; order.push(g); } groups[g].push(b); });
    var html=order.map(function(g){ var isToday=(g===today), label=(g==='played')?'Already played · still make a fan':dayLabel(g);
      var tag=(g==='played')?'ENCORE':(isToday?'Today':'Upcoming');
      return '<div class="dayhdr'+(isToday?' today':'')+'"><span class="tag">'+tag+'</span> '+esc(label)
        +'<span class="daycount">'+groups[g].length+' left</span></div>'
        + groups[g].map(function(b){ return cardHTML(b, false); }).join('');
    }).join('');
    host.innerHTML=html;
  }

  var ADOPT={
    copyBand:function(slug){ var b=find(slug); if(!b)return; cp(msgBand(b)); try{ alert('📋 Copied '+b.name+'’s post + ticket link.\nOpen the band’s Facebook → paste → Post. That’s the goal. 🌹'); }catch(e){} },
    copyOwn:function(slug){ var b=find(slug); if(!b)return; cp(msgOwn(b)); try{ alert('📋 Copied (bonus). Open YOUR Facebook → paste → Post.\nThen tap 🌹 Done.'); }catch(e){} },
    claim:function(slug){ var b=find(slug), nm=((b&&b.name)||'That act');
      saveClaim(slug, function(status, err){ render();
        try{
          if(status===true){ alert('✅ '+nm+' is covered — saved to the server. Grab one more, then send this page to a friend. 🌹'); }
          else if(status===false){ var msg=(err&&(err.message||err.hint||err.code))||'unknown error';
            alert('⚠️ '+nm+' saved on THIS phone but did NOT reach the server.\n\nPlease screenshot this and send it to Michael:\n'+msg); }
          else { alert('📴 '+nm+' saved on this phone (no server connection right now). It will not sync to the shared count.'); }
        }catch(e){}
      });
      render(); },
    share:function(){ var u='https://deaddance.app/adopt_a_band.html', t='Help cover every MusikFest act — pick one or two bands and post their free ticket. 🌹';
      if(navigator.share){ navigator.share({title:'Adopt a Band · MusikFest',text:t,url:u}).catch(function(){}); }
      else { try{ navigator.clipboard.writeText(t+' '+u); alert('🔗 Link copied — paste it to a few friends.'); }catch(e){ alert(u); } } }
  };

  // On load: (1) RETROACTIVELY push any of THIS person's own past taps up to the server — recovers
  //   claims made before the write was fixed, with ZERO action from the user (just re-open the page);
  //   then (2) pull the shared list so friends don't double-adopt. Both idempotent + guarded.
  function flushMine(cl){ try{ var c=claims(), me=who(); Object.keys(c).forEach(function(slug){ var e=c[slug];
    if(e && e.by===me){ try{ cl.rpc('dd_bandadopt_claim',{p_slug:slug,p_by:me}).then(function(){}).catch(function(){}); }catch(_){} } }); }catch(e){} }
  function syncAndRender(){
    try{ var cl=root.ddClient && root.ddClient();
      if(cl&&cl.rpc){
        flushMine(cl);
        cl.rpc('dd_bandadopt_list',{}).then(function(r){ try{ var ls=LS(); var rows=(r&&r.data)||[]; var c=claims(); rows.forEach(function(x){ if(x&&x.slug&&!c[x.slug]) c[x.slug]={by:x.by||'someone',ts:Date.now()}; }); if(ls) ls.setItem('dd.adopt',JSON.stringify(c)); render(); }catch(e){} }).catch(function(){});
      } }catch(e){}
    render();
  }

  // ---- MOUNT: render the whole Adopt experience into a target container -----------
  function injectCSS(){
    if(document.getElementById('dd-adopt-css')) return;
    var st=document.createElement('style'); st.id='dd-adopt-css';
    st.textContent =
      '.ddadopt{--acc:#5a2e86;--rose:#b8002e;--gold:#f0a500;--muted:#7a7285;--line:#ece7f2;--ink:#1a1320}'
      +'.ddadopt .prog{margin:4px 2px 4px}.ddadopt .bar{height:12px;background:#eee7f6;border-radius:8px;overflow:hidden}.ddadopt .bar i{display:block;height:100%;background:linear-gradient(90deg,#b8002e,#f0a500);width:0%;transition:width .4s}'
      +'.ddadopt .pnum{font-size:12.5px;color:var(--muted);font-weight:700;margin-top:6px;text-align:center}'
      +'.ddadopt .steps{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-top:12px;font-size:13px;line-height:1.65;box-shadow:0 5px 14px rgba(42,27,61,.05)}'
      +'.ddadopt .dayhdr{font-weight:900;font-size:14px;margin:22px 2px 4px;display:flex;align-items:center;gap:8px;color:var(--ink)}'
      +'.ddadopt .dayhdr .tag{font-size:10.5px;font-weight:800;color:#fff;background:var(--rose);border-radius:999px;padding:3px 9px;text-transform:uppercase;letter-spacing:.04em}'
      +'.ddadopt .dayhdr.today .tag{background:#12854f}'
      +'.ddadopt .daycount{font-size:11.5px;color:var(--muted);font-weight:700;margin-left:auto}'
      +'.ddadopt .card{border:1px solid var(--line);border-radius:14px;padding:12px 13px;background:#fff;margin-top:10px;box-shadow:0 5px 14px rgba(42,27,61,.05);color:var(--ink)}'
      +'.ddadopt .card.claimed{opacity:.55;background:#f7f4fb}'
      +'.ddadopt .bn{font-weight:900;font-size:16.5px}.ddadopt .bn s{color:var(--muted)}'
      +'.ddadopt .bk{color:var(--muted);font-size:12px;margin-top:1px}'
      +'.ddadopt .row{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}'
      +'.ddadopt .btn{border:0;border-radius:10px;padding:8px 12px;font-weight:800;font-size:12.5px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:5px}'
      +'.ddadopt .btn.p{background:var(--acc);color:#fff}.ddadopt .btn.g{background:#f1eef7;color:var(--acc)}.ddadopt .btn.rose{background:var(--rose);color:#fff}'
      +'.ddadopt .badge{display:inline-block;background:#eef7f2;color:#12854f;font-weight:800;font-size:11px;padding:4px 10px;border-radius:999px;margin-top:9px}'
      +'.ddadopt .pass{text-align:center;background:#fff;border:1px dashed var(--line);border-radius:14px;padding:14px;margin-top:22px;color:var(--ink)}'
      +'.ddadopt .pass a{color:var(--acc);font-weight:800;text-decoration:none}';
    document.head.appendChild(st);
  }
  function mount(target, opts){
    opts = opts || {};
    _host = (typeof target === 'string') ? document.getElementById(target) : target;
    if(!_host) return null;
    injectCSS();
    _host.classList.add('ddadopt');
    _host.innerHTML =
      '<div class="prog"><div class="bar"><i class="dd-adopt-bar"></i></div><div class="pnum dd-adopt-pnum">Loading the lineup…</div></div>'
      +'<div class="steps">'
        +'<b style="font-size:13.5px">How it works — 2 minutes, no typing. The buttons copy a ready-made message; you just paste it into Facebook:</b>'
        +'<div style="margin-top:5px"><b>1.</b> Tap <b style="color:var(--acc)">📋 Copy the post for the band</b> → open the band\'s Facebook → <b>paste</b> → Post</div>'
        +'<div><b>2.</b> Tap <b style="color:var(--acc)">📋 Copy the post for your wall</b> → open <b>your</b> Facebook → <b>paste</b> → Post</div>'
        +'<div><b>3.</b> Tap <b style="color:var(--rose)">🌹 Done</b></div>'
        +'<div><b>4.</b> Send this page to <b>2 friends</b> 🌹</div>'
      +'</div>'
      +'<div class="dd-adopt-list"></div>'
      +'<div class="pass">Took one or two? 🌹 <b>Now send this page to 2–3 friends</b> — that\'s how we get to zero.<br><a href="#" onclick="ADOPT.share();return false;">📲 Share this page ↗</a></div>';
    _LU=null;
    syncAndRender();
    return { render:render };
  }

  var api = {
    // pure / testable:
    slugify:slugify, tixUrl:tixUrl, _pick:_pick,
    BAND_MSGS:BAND_MSGS, OWN_MSGS:OWN_MSGS, msgBand:msgBand, msgOwn:msgOwn,
    curated:curated, lineup:lineup, fbLink:fbLink, cardHTML:cardHTML,
    // guarded spine:
    saveClaim:saveClaim, flushMine:flushMine, claims:claims, who:who,
    // DOM:
    mount:mount, render:render, ADOPT:ADOPT
  };
  root.DDAdopt = api;
  root.ADOPT = ADOPT;   // keep the global the card buttons call (onclick="ADOPT.claim(...)")
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
