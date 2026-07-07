/* dd_share.js — one-click "Share result" for Shakedown (dead.dance). Mirror of the Falcon module.
   NO per-post editing. The networks ("Coms") are set ONCE in the user profile (localStorage 'dd.coms').
   Every Share button reads those; Claude pre-composes DIFFERENTIATED copy per channel (long post vs
   short blurb vs email subject/body vs SMS); one tap fans it out. Honest: native share sheet reaches
   any app in one tap; enabled direct channels (Facebook/X/WhatsApp/Email/SMS) also fire. Auto-wires
   any .ffsh-btn. */
(function(){
  'use strict';
  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function coms(){
    // Converge with Shakedown's existing "⚙ Networks" defaults (dd.hpdef) — set once, no new setup.
    try{ var d=JSON.parse(localStorage.getItem('dd.hpdef')||'null');
      if(Array.isArray(d)){ var m={native:true}; d.forEach(function(id){ id=(''+id).toLowerCase();
        if(/fb|face/.test(id))m.facebook=true; else if(/^x$|twit/.test(id))m.x=true; else if(/wa|whats/.test(id))m.whatsapp=true; else if(/mail|email/.test(id))m.email=true; else if(/sms|text/.test(id))m.sms=true; });
        return m; } }catch(e){}
    try{ return JSON.parse(localStorage.getItem('dd.coms')||'null') || {native:true,facebook:true,email:true,sms:false,x:false,whatsapp:false}; }catch(e){ return {native:true,facebook:true}; }
  }
  function setComs(o){ try{ localStorage.setItem('dd.coms', JSON.stringify(o)); }catch(e){} }
  function variants(p){
    var t=p.title||'dead.dance', b=(p.text||'').trim(), url=p.url||location.href, tags=(p.tags||'#GratefulDead #deaddance');
    return { full: t + (b?('\n\n'+b):'') + '\n\n' + url, short: (t + (b?(' — '+b):'')).slice(0,170) + ' ' + tags, subject:t, url:url };
  }
  function share(p){
    p=p||{}; var v=variants(p), c=coms(), any=false;
    if(c.native && navigator.share){ navigator.share({title:p.title||'',text:v.full,url:v.url}).catch(function(){}); any=true; }
    if(c.facebook){ op('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(v.url)); any=true; }
    if(c.x){ op('https://twitter.com/intent/tweet?text='+encodeURIComponent(v.short)+'&url='+encodeURIComponent(v.url)); any=true; }
    if(c.whatsapp){ op('https://wa.me/?text='+encodeURIComponent(v.short+' '+v.url)); any=true; }
    if(c.email){ location.href='mailto:?subject='+encodeURIComponent(v.subject)+'&body='+encodeURIComponent(v.full); any=true; }
    if(c.sms){ location.href='sms:?&body='+encodeURIComponent(v.short+' '+v.url); any=true; }
    if(!any || (!navigator.share && !c.facebook)){ try{ if(navigator.clipboard) navigator.clipboard.writeText(v.full); }catch(e){} }
    if(window.toast) toast('↗ Shared to your Coms — one tap, differentiated per channel.');
  }
  function op(u){ try{ window.open(u,'_blank','noopener'); }catch(e){} }
  function button(p){ var enc=encodeURIComponent(JSON.stringify(p||{})); return '<button class="ffsh-btn" data-share="'+esc(enc)+'">↗ Share result</button>'; }
  function wire(scope){ (scope||document).querySelectorAll('.ffsh-btn[data-share]').forEach(function(b){ if(b.__w) return; b.__w=1; b.onclick=function(){ var p={}; try{ p=JSON.parse(decodeURIComponent(b.dataset.share)); }catch(e){} share(p); }; }); }
  function autoWire(){ wire(document); }
  window.FFShare={ share:share, button:button, wire:wire, coms:coms, setComs:setComs };
  if(document.readyState!=='loading') autoWire(); else document.addEventListener('DOMContentLoaded', autoWire);
  try{ new MutationObserver(autoWire).observe(document.body,{childList:true,subtree:true}); }catch(e){}
})();
