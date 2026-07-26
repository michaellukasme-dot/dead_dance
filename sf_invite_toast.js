/* sf_invite_toast.js — an expiring toast on the MusikFest maps nudging users into the Street Team.
   "Invite 10 heads → earn a free shirt in Cookies." Shows once per session, auto-dismisses, has an X. */
(function(){
  try{ if(sessionStorage.getItem('dd.sf.invitetoast')==='1') return; }catch(e){}
  function seen(){ try{ sessionStorage.setItem('dd.sf.invitetoast','1'); }catch(e){} }
  function show(){
    if(document.getElementById('sfInvT')) return;
    var t=document.createElement('div'); t.id='sfInvT';
    t.style.cssText='position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0));transform:translate(-50%,22px);'
      +'z-index:9500;display:flex;gap:11px;align-items:center;max-width:420px;width:calc(100% - 26px);'
      +'background:#2a1b3d;color:#fff;border:1px solid #ffffff26;border-radius:15px;box-shadow:0 12px 40px #0006;'
      +'padding:12px 14px;opacity:0;transition:.24s;font:600 13.5px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif';
    t.innerHTML='<span style="font-size:22px">🍪</span>'
      +'<div style="flex:1">Invite <b>10 heads</b> to MusikFest → earn a <b>free T-shirt</b> in Cookies. '
      +'<a href="street.html" style="color:#e0b94a;font-weight:800;text-decoration:none;white-space:nowrap">Join the Street Team →</a></div>'
      +'<button aria-label="dismiss" style="background:0;border:0;color:#b6a9d6;font-size:16px;cursor:pointer;flex:0 0 auto">✕</button>';
    document.body.appendChild(t);
    requestAnimationFrame(function(){ t.style.transform='translate(-50%,0)'; t.style.opacity='1'; });
    function close(){ t.style.opacity='0'; t.style.transform='translate(-50%,22px)'; setTimeout(function(){ if(t.parentNode) t.remove(); },240); seen(); }
    t.querySelector('button').onclick=close;
    setTimeout(close, 14000);
  }
  function boot(){ if(document.body){ setTimeout(show, 3500); } else { setTimeout(boot, 300); } }
  boot();
})();
