/* dd_legal_footer.js — a small Terms · Privacy · Refunds footer for commerce pages. Self-contained. */
(function(){
  function boot(){ if(!document.body){ setTimeout(boot,300); return; }
    if(document.getElementById('ddLegalFoot')) return;
    var f=document.createElement('div'); f.id='ddLegalFoot';
    f.style.cssText='text-align:center;padding:24px 16px calc(22px + env(safe-area-inset-bottom,0));'
      +'font:600 11.5px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#9aa2b4';
    var a='color:#8a83a0;text-decoration:none;margin:0 7px';
    f.innerHTML='<a style="'+a+'" href="terms.html">Terms</a>·'
      +'<a style="'+a+'" href="privacy_policy.html">Privacy</a>·'
      +'<a style="'+a+'" href="refunds.html">Refunds</a>';
    document.body.appendChild(f);
  }
  boot();
})();
