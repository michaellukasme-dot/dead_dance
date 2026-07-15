/* dd_bandtoast.js — the BAND TOAST: a hover/tap preview card for any band or act,
   modeled on Facebook's name-hover card. Hover (desktop) or tap (touch) any element
   tagged with data-bt and a compact card pops: the band's OWN logo (from dd_logoguess),
   name, type, bio, site, fan pulse, and one-tap actions (View page · QR · Follow).
   Same construct for both worlds — data-bt-kind="band" (deaddance) | "act" (stagefill).

   Tag a trigger like:
     <span class="btname" data-bt="sages-and-spirits" data-bt-name="Sages And Spirits"
           data-bt-about="…" data-bt-link="sagesandspirits.com" data-bt-kind="band">Sages And Spirits</span>
   Everything but data-bt + data-bt-name is optional. One delegated listener handles all. */
(function (root) {
  var TIP=null, HIDE=null, TOUCH=('ontouchstart' in root);
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function mono(n){return String(n||'').replace(/[^A-Za-z ]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w[0].toUpperCase();}).join('')||'🌹';}
  function logoFor(id){ try{ return (root.DDLogoGuess&&root.DDLogoGuess[id])||''; }catch(e){ return ''; } }
  function follows(){ try{ return JSON.parse(localStorage.getItem('dd.follows')||'[]'); }catch(e){ return []; } }
  function isFollowing(id){ return follows().indexOf(id)>=0; }
  function toggleFollow(id){ var a=follows(),i=a.indexOf(id); if(i>=0)a.splice(i,1); else a.push(id); try{localStorage.setItem('dd.follows',JSON.stringify(a));}catch(e){} return a.indexOf(id)>=0; }

  function css(){ if(document.getElementById('btcss'))return; var s=document.createElement('style'); s.id='btcss';
    s.textContent=
    '.bt-card{position:fixed;z-index:9999;width:290px;max-width:92vw;background:#fff;border:1px solid #ece7f2;border-radius:16px;box-shadow:0 16px 44px rgba(20,10,30,.28);padding:15px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1a1320;opacity:0;transform:translateY(6px);transition:.14s;pointer-events:none}'+
    '.bt-card.on{opacity:1;transform:translateY(0);pointer-events:auto}'+
    '.bt-hd{display:flex;gap:11px;align-items:center}'+
    '.bt-lg{width:54px;height:54px;border-radius:13px;flex:0 0 54px;object-fit:cover;background:#f1eef7;display:flex;align-items:center;justify-content:center;font-weight:900;color:#5a2e86;font-size:19px;overflow:hidden}'+
    '.bt-lg img{width:100%;height:100%;object-fit:cover}'+
    '.bt-nm{font-weight:900;font-size:16px;line-height:1.15}'+
    '.bt-ty{color:#7a7285;font-size:11.5px;font-weight:700;margin-top:1px}'+
    '.bt-ab{font-size:12.5px;color:#4a4356;line-height:1.4;margin:9px 0 0;max-height:4.3em;overflow:hidden}'+
    '.bt-ln{display:block;color:#2f6fe0;font-size:12.5px;font-weight:700;text-decoration:none;margin-top:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
    '.bt-ac{display:flex;gap:7px;margin-top:11px}'+
    '.bt-ac button,.bt-ac a{flex:1;border:0;border-radius:10px;padding:9px 6px;font-weight:800;font-size:12px;cursor:pointer;text-align:center;text-decoration:none}'+
    '.bt-view{background:linear-gradient(135deg,#7a3cc0,#b8002e);color:#fff}'+
    '.bt-qr{background:#f1eef7;color:#5a2e86}'+
    '.bt-fo{background:#eef7f0;color:#1f9e6b}.bt-fo.on{background:#1f9e6b;color:#fff}';
    document.head.appendChild(s); }

  function build(){ css(); if(TIP)return TIP; TIP=document.createElement('div'); TIP.className='bt-card';
    TIP.addEventListener('mouseenter',function(){ clearTimeout(HIDE); });
    TIP.addEventListener('mouseleave',hideSoon); document.body.appendChild(TIP); return TIP; }

  function data(el){ return {
    id:el.getAttribute('data-bt'), name:el.getAttribute('data-bt-name')||el.textContent||'Band',
    about:el.getAttribute('data-bt-about')||'', link:el.getAttribute('data-bt-link')||'',
    kind:(el.getAttribute('data-bt-kind')||'band'), fans:el.getAttribute('data-bt-fans')||'' }; }

  function render(d){ var t=build(); var lg=logoFor(d.id);
    var host=(d.kind==='act')?'stagefill.app':'deaddance.app';
    var page='card.html?t=band&id='+encodeURIComponent(d.id||'');
    var typ=(d.kind==='act')?'Act · StageFill':'Musician / band';
    t.innerHTML=
      '<div class="bt-hd"><div class="bt-lg">'+(lg?('<img src="'+esc(lg)+'" alt="" onerror="this.parentNode.textContent=\''+esc(mono(d.name))+'\'">'):esc(mono(d.name)))+'</div>'+
        '<div><div class="bt-nm">'+esc(d.name)+'</div><div class="bt-ty">'+esc(typ)+(d.fans?(' · '+esc(d.fans)+' fans'):'')+'</div></div></div>'+
      (d.about?'<div class="bt-ab">'+esc(d.about)+'</div>':'')+
      (d.link?'<a class="bt-ln" href="'+(d.link.indexOf('http')===0?esc(d.link):'https://'+esc(d.link))+'" target="_blank" rel="noopener">🔗 '+esc(d.link.replace(/^https?:\/\//,''))+'</a>':'')+
      '<div class="bt-ac">'+
        '<a class="bt-view" href="'+page+'">View page</a>'+
        '<button class="bt-qr" onclick="DDBandToast.qr(\''+esc(d.id)+'\',\''+d.kind+'\')">◈ QR</button>'+
        '<button class="bt-fo'+(isFollowing(d.id)?' on':'')+'" onclick="DDBandToast.follow(this,\''+esc(d.id)+'\')">'+(isFollowing(d.id)?'Following':'＋ Follow')+'</button>'+
      '</div>';
    return t; }

  function place(t, el){ var r=el.getBoundingClientRect(), vw=innerWidth, vh=innerHeight;
    t.style.visibility='hidden'; t.classList.add('on'); var w=t.offsetWidth, h=t.offsetHeight; t.classList.remove('on'); t.style.visibility='';
    var left=Math.min(Math.max(8, r.left), vw-w-8);
    var top=r.bottom+8; if(top+h>vh-8) top=Math.max(8, r.top-h-8);
    t.style.left=left+'px'; t.style.top=top+'px'; }

  function show(el){ clearTimeout(HIDE); var d=data(el); if(!d.id&&!d.name)return; var t=render(d); place(t,el); t.classList.add('on'); }
  function hideSoon(){ clearTimeout(HIDE); HIDE=setTimeout(function(){ if(TIP)TIP.classList.remove('on'); },160); }

  // delegated: hover on desktop, tap on touch
  document.addEventListener('mouseover',function(e){ var el=e.target.closest&&e.target.closest('[data-bt]'); if(el&&!TOUCH) show(el); });
  document.addEventListener('mouseout',function(e){ var el=e.target.closest&&e.target.closest('[data-bt]'); if(el&&!TOUCH) hideSoon(); });
  document.addEventListener('click',function(e){ var el=e.target.closest&&e.target.closest('[data-bt]');
    if(el && TOUCH){ e.preventDefault(); if(TIP&&TIP.classList.contains('on')) TIP.classList.remove('on'); else show(el); } });
  document.addEventListener('scroll',function(){ if(TIP)TIP.classList.remove('on'); },true);

  root.DDBandToast={ show:show, hide:function(){ if(TIP)TIP.classList.remove('on'); },
    follow:function(btn,id){ var on=toggleFollow(id); btn.className='bt-fo'+(on?' on':''); btn.textContent=on?'Following':'＋ Follow'; if(typeof toast==='function')toast(on?'🌹 Following — more of their shows will surface for you.':'Unfollowed.'); },
    qr:function(id,kind){ try{ var host=(kind==='act')?'stagefill.app':'deaddance.app'; if(root.DDQR)DDQR.save('https://'+host+'/'+id,{mark:(kind==='act'?'sf':'dd')}, id+'-QR.png'); }catch(e){} } };
})(typeof window!=='undefined'?window:this);
