/* dd_tees_cta.js — DeadDance sells 100% of the tees. Drop this on any band merch page and it adds a
   persistent pill routing shirt sales into the DeadDance band-tee flow (band_shirts.html), which routes
   each order to the chapter's local print partner. Self-contained, dismissible, no dependencies. */
(function(){
  function boot(){
    if(!document.body){ setTimeout(boot, 300); return; }
    if(document.getElementById('ddTeesCta')) return;
    if(location.pathname.indexOf('band_shirts') >= 0) return;      // don't show on the order page itself
    try{ if(sessionStorage.getItem('dd.tees.cta.x')==='1') return; }catch(e){}
    var b=document.createElement('div'); b.id='ddTeesCta';
    b.style.cssText='position:fixed;left:12px;bottom:12px;z-index:9400;display:flex;align-items:center;gap:8px;'
      +'background:linear-gradient(180deg,#e0b94a,#c79a3a);color:#3a2400;font:800 13px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;'
      +'padding:10px 12px;border-radius:999px;box-shadow:0 6px 20px #0005;max-width:calc(100% - 24px)';
    b.innerHTML='<a href="band_shirts.html" style="color:#3a2400;text-decoration:none;white-space:nowrap">👕 Sell your tees — printed by DeadDance ›</a>'
      +'<button aria-label="dismiss" style="background:#3a240022;border:0;color:#3a2400;font-size:14px;line-height:1;cursor:pointer;border-radius:50%;width:20px;height:20px">✕</button>';
    b.querySelector('button').onclick=function(){ b.remove(); try{ sessionStorage.setItem('dd.tees.cta.x','1'); }catch(e){} };
    document.body.appendChild(b);
  }
  boot();
})();
