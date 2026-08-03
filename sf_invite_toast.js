/* sf_invite_toast.js — a once-a-day TOP nudge on the MusikFest maps into the Street Team.
   Crowdsourced recruiting — so it shows AT MOST ONCE PER DAY (localStorage date stamp) and
   never again for the rest of that day once shown or dismissed. No T-shirt (that's a separate
   thing) — this is the DAILY COOKIE CONTEST: invite 10 people → 10 Cookies, top 3 each day win. */
(function(){
  var KEY='dd.sf.invitetoast.day';
  function today(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  try{ if(localStorage.getItem(KEY)===today()) return; }catch(e){}          // already shown/dismissed today → stay quiet
  function seen(){ try{ localStorage.setItem(KEY, today()); }catch(e){} }    // stamp the day the moment we show it
  function show(){
    if(document.getElementById('sfInvT')) return;
    seen();                                                                  // one per day — count it as spent on first show
    var t=document.createElement('div'); t.id='sfInvT';
    t.style.cssText='position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top,0));transform:translate(-50%,-22px);'
      +'z-index:9500;display:flex;gap:11px;align-items:flex-start;max-width:420px;width:calc(100% - 26px);'
      +'background:#2a1b3d;color:#fff;border:1px solid #ffffff26;border-radius:15px;box-shadow:0 12px 40px #0006;'
      +'padding:12px 14px;opacity:0;transition:.24s;font:600 13.5px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif';
    t.innerHTML='<span style="font-size:22px;line-height:1.1">🍪</span>'
      +'<div style="flex:1">Invite <b>10 people</b> to MusikFest → earn <b>10 Cookies</b> 🍪<br>'
      +'<span style="color:#c8bce2;font-weight:600;font-size:12.5px">Daily Cookie Contest — prizes for the top 3 each day.</span> '
      +'<a href="street_academy.html?festival=musikfest-2026" style="color:#e0b94a;font-weight:800;text-decoration:none;white-space:nowrap">Join the Street Team →</a></div>'
      +'<button aria-label="dismiss" style="background:0;border:0;color:#b6a9d6;font-size:16px;cursor:pointer;flex:0 0 auto">✕</button>';
    document.body.appendChild(t);
    requestAnimationFrame(function(){ t.style.transform='translate(-50%,0)'; t.style.opacity='1'; });
    function close(){ t.style.opacity='0'; t.style.transform='translate(-50%,-22px)'; setTimeout(function(){ if(t.parentNode) t.remove(); },240); seen(); }
    t.querySelector('button').onclick=close;
    setTimeout(close, 14000);
  }
  function boot(){ if(document.body){ setTimeout(show, 3500); } else { setTimeout(boot, 300); } }
  boot();
})();
