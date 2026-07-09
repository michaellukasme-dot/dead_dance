/* dead.dance — universal Back control for console/sub-pages.
   PWA standalone has no browser chrome, so every sub-page must carry its own way back.
   Drop <script src="dd_back.js"></script> into any sub-page (NOT index/app/welcome).
   Logic: if we're inside the ddSheet iframe -> close the sheet; else history.back(); else -> index.html. */
(function(){
  if(window.__ddBack) return; window.__ddBack=1;
  function inSheet(){ try{ return window.parent && window.parent!==window && typeof window.parent.ddSheetClose==='function'; }catch(e){ return false; } }
  function go(){
    if(inSheet()){ try{ window.parent.ddSheetClose(); return; }catch(e){} }
    if(window.history && history.length>1){ history.back(); }
    else{ location.href='index.html'; }
  }
  function mkbtn(id,label,aria,right){
    var b=document.createElement('button');
    b.id=id; b.type='button'; b.setAttribute('aria-label',aria); b.textContent=label;
    b.style.cssText='position:fixed;top:max(8px,env(safe-area-inset-top));'+(right?'right:8px;':'left:8px;')+
      'z-index:2147483000;background:rgba(20,11,34,.86);color:#fff;border:1px solid #ffffff2e;border-radius:999px;'+
      (right?'width:38px;height:38px;padding:0;line-height:1;font:800 18px':'padding:8px 15px;font:800 13px')+
      ' -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer;box-shadow:0 3px 12px #0007;'+
      '-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)';
    b.onmouseenter=function(){ b.style.background='rgba(40,22,64,.95)'; };
    b.onmouseleave=function(){ b.style.background='rgba(20,11,34,.86)'; };
    b.onclick=go; return b;
  }
  function mount(){
    if(document.getElementById('ddback')) return;
    /* leverage the conventions everyone knows: Back (left) + ✕ (right). */
    document.body.appendChild(mkbtn('ddback','‹ Back','Back to app',false));
    /* the ddSheet iframe already shows a ✕ up top — only add our own ✕ on standalone/full-screen pages */
    if(!inSheet()) document.body.appendChild(mkbtn('ddx','✕','Close',true));
  }
  if(document.readyState!=='loading') mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
