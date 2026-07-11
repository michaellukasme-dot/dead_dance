/* dd_hyperpost.js — "It feels like Facebook."
   1) PRE-FILLS the composer in the user's own voice (Claude Gaude — honest-state: heuristic now, gets
      more "you" as it learns each post you send; upgrades to the real voice model when the backend is in).
   2) One press → the post goes to FACEBOOK via the profile's default Coms (FFShare), so the user forgets
      it isn't FB — they just see their post land on Facebook, from shakedownstreet, right where it belongs.
   No cursing, all legal. Learns + stores each voice sample locally in the profile. */
(function(){
  'use strict';
  var PREFILLED=false;
  function me(){ try{ return (window.ME&&ME.name&&ME.name!=='You')?ME.name : (JSON.parse(localStorage.getItem('dd.profile')||'{}').name||'friend'); }catch(e){ return 'friend'; } }
  function voice(){ try{ return JSON.parse(localStorage.getItem('dd.voice')||'{"samples":[]}'); }catch(e){ return {samples:[]}; } }
  function learn(text){ if(!text||text.length<4) return; try{ var v=voice(); v.samples=(v.samples||[]); v.samples.unshift(text.slice(0,280)); v.samples=v.samples.slice(0,25); localStorage.setItem('dd.voice', JSON.stringify(v)); }catch(e){} }
  function nowSong(){ var t=document.getElementById('npT'); var s=t?t.textContent.replace(/^🎵\s*/,'').trim():''; return s&&!/Tap|ambient/i.test(s)?s:''; }

  // Compose a starter draft that leans on the user's own past phrasings when we have them.
  function draft(){
    var v=voice(), song=nowSong();
    var mine=(v.samples&&v.samples.length)? v.samples[Math.floor(Math.random()*Math.min(v.samples.length,5))] : '';
    var opener = mine ? mine.split(/[.!?\n]/)[0].slice(0,60) : '';   // echo a phrase they actually use
    var songBit = song ? ('Shuffle just served up '+song+' 🌹 — this version gets me every time. ')
                        : ('The bus is rolling and the family’s all here. 🌹 ');
    var tail = 'Who else is on this one? 🌹';
    return (opener ? (opener+' … ') : '') + songBit + tail;
  }

  function prefill(el, force){
    if(!el) return; if(el.value && !force) return;
    el.value = draft(); PREFILLED=true;
    try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
  }
  // ---- THE SPREAD lives behind HyperPost. One press → the post goes out AND, if there's an image,
  //      we build a native-styled variant for every network (TikTok/IG/FB/X/Reddit/YT/Snap), rose-QR baked in. ----
  function firstLine(t){ return (String(t||'').split(/[\n.!?]/)[0]||'').trim().slice(0,60) || 'Live this weekend'; }
  function inviteURL(){ try{ if(window.inviteLink) return inviteLink(); }catch(e){} return (location.origin||'https://deaddance.app')+'/'; }
  function currentImage(){ if(window.__hpImage) return window.__hpImage;
    try{ var a=document.querySelector('#npArt img,.np-art img,#ddHero img,#poster img'); if(a&&a.complete&&(a.naturalWidth||a.width)) return a; }catch(e){} return null; }
  function currentImages(){ if(window.__hpImages&&window.__hpImages.length) return window.__hpImages.slice(); var one=currentImage(); return one?[one]:[]; }
  function loadImg(f, cb){ try{
      if(/^video\//.test(f.type)){ var v=document.createElement('video'); v.muted=true; v.playsInline=true; v.src=URL.createObjectURL(f);
        v.onloadeddata=function(){ try{ v.currentTime=Math.min(1,(v.duration||2)/3); }catch(e){} };
        v.onseeked=function(){ var c=document.createElement('canvas'); c.width=v.videoWidth||1080; c.height=v.videoHeight||1920; try{c.getContext('2d').drawImage(v,0,0,c.width,c.height);}catch(e){} var i=new Image(); i.onload=function(){cb(i);}; i.src=c.toDataURL('image/png'); };
      } else { var im=new Image(); im.onload=function(){cb(im);}; im.onerror=function(){cb(null);}; im.src=URL.createObjectURL(f); }
    }catch(e){ cb(null); } }
  // The spread appears like a HAND OF CARDS (the iMessage fanned-stack look). The user FLIPS THROUGH to
  // review each network's variant, THEN one tap sends them all. Splay to a grid; tap a card to flip it big.
  function showOverlay(set, text){
    var old=document.getElementById('hpSpreadOv'); if(old)old.remove();
    var items=(set||[]).filter(function(v){return v.dataURL;}); if(!items.length) return;
    var ov=document.createElement('div'); ov.id='hpSpreadOv';
    ov.style.cssText='position:fixed;inset:0;background:#0b0616f6;z-index:2147483400;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#f3eefc';
    var n=items.length, mid=(n-1)/2, step=Math.min(13, 150/Math.max(1,n)), gapx=Math.min(52, 520/Math.max(1,n));
    var cards=items.map(function(v,i){ var ang=(i-mid)*step, lift=Math.abs(i-mid)*Math.abs(i-mid)*3.2;
      return '<div class="hpcard" data-i="'+i+'" style="transform:translateX('+((i-mid)*gapx)+'px) translateY('+lift+'px) rotate('+ang+'deg);z-index:'+(100-Math.abs(i-mid))+'">'+
        '<img src="'+v.dataURL+'" alt="'+v.name+'"><span class="hpc-lab">'+v.name+'</span></div>'; }).join('');
    ov.innerHTML='<style>'+
      '#hpSpreadOv .fan{position:relative;width:100%;max-width:740px;height:44vh;min-height:280px;display:flex;align-items:center;justify-content:center}'+
      '#hpSpreadOv .hpcard{position:absolute;width:150px;height:200px;border-radius:14px;overflow:hidden;box-shadow:0 12px 34px #000b;border:2px solid #ffffff33;transform-origin:bottom center;transition:transform .38s cubic-bezier(.2,.8,.2,1);cursor:pointer;background:#000}'+
      '#hpSpreadOv .hpcard img{width:100%;height:100%;object-fit:cover;display:block}'+
      '#hpSpreadOv .hpc-lab{position:absolute;left:0;right:0;bottom:0;font:800 10px sans-serif;text-align:center;background:#000a;color:#fff;padding:3px}'+
      '#hpSpreadOv .hpcard:hover,#hpSpreadOv .hpcard:focus{transform:translateY(-30px) rotate(0deg) scale(1.06)!important;z-index:200}'+
      '#hpSpreadOv.grid .fan{height:auto;min-height:0;flex-wrap:wrap;gap:12px;max-width:720px}'+
      '#hpSpreadOv.grid .hpcard{position:relative;transform:none!important}'+
      '#hpSpreadOv .light{position:fixed;inset:0;background:#000d;display:none;align-items:center;justify-content:center;z-index:5}'+
      '#hpSpreadOv .light.on{display:flex}#hpSpreadOv .light img{max-width:82vw;max-height:70vh;border-radius:12px;box-shadow:0 20px 60px #000}'+
      '#hpSpreadOv .lbtn{background:#ffffff22;color:#fff;border:0;border-radius:999px;width:46px;height:46px;font-size:22px;cursor:pointer;margin:0 8px}'+
      '#hpSpreadOv .send{background:linear-gradient(90deg,#5a2e86,#c9a5ff);color:#fff;border:0;border-radius:14px;padding:14px 26px;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 8px 22px #5a2e8688}'+
      '</style>'+
      '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px"><b style="font-size:17px">🎯 Flip through your spread</b>'+
      '<button id="hpFanToggle" style="background:#2a1c44;color:#cbb9ee;border:0;border-radius:9px;padding:7px 12px;font-weight:800;cursor:pointer">splay ▦</button>'+
      '<button id="hpCancel" style="background:#2a1c44;color:#cbb9ee;border:0;border-radius:9px;padding:7px 12px;font-weight:800;cursor:pointer">Cancel</button></div>'+
      '<div class="fan">'+cards+'</div>'+
      '<div style="font-size:12px;color:#9a86c4;margin:14px 0;text-align:center;max-width:640px">Tap a card to flip it big and review. Each is native to its network; the rose-QR is baked in. Happy? Send them all.</div>'+
      '<button class="send" id="hpSendAll">🚀 Send all — one tap</button>'+
      '<div class="light" id="hpLight"><button class="lbtn" id="hpPrev">‹</button><img id="hpLightImg" alt=""><button class="lbtn" id="hpNext">›</button></div>';
    var cur=0, light=ov.querySelector('#hpLight'), limg=ov.querySelector('#hpLightImg');
    function openL(i){ cur=(i+items.length)%items.length; limg.src=items[cur].dataURL; light.classList.add('on'); }
    ov.querySelector('#hpFanToggle').onclick=function(){ ov.classList.toggle('grid'); this.textContent=ov.classList.contains('grid')?'fan ♠':'splay ▦'; };
    ov.querySelector('#hpCancel').onclick=function(){ ov.remove(); };
    ov.querySelector('#hpSendAll').onclick=function(){ finalize(text, items); };
    ov.querySelector('#hpPrev').onclick=function(){ openL(cur-1); };
    ov.querySelector('#hpNext').onclick=function(){ openL(cur+1); };
    light.onclick=function(e){ if(e.target===light) light.classList.remove('on'); };
    ov.addEventListener('click', function(e){ var c=e.target.closest&&e.target.closest('.hpcard'); if(c) openL(+c.getAttribute('data-i')); });
    document.body.appendChild(ov);
  }
  function spread(image, text, url){
    if(!window.DDSpread){ if(window.toast) toast('Spread engine still loading — try once more.'); return null; }
    var set=DDSpread.spread(image, { headline:firstLine(text), sub:'', url:url||inviteURL() });
    showOverlay(set, text); return set;   // REVIEW deck first — the user flips through, then one-tap sends
  }
  function downloadAll(set){ (set||[]).forEach(function(v,i){ if(!v.dataURL)return; setTimeout(function(){ try{ var a=document.createElement('a'); a.href=v.dataURL; a.download='spread_'+v.id+'.png'; document.body.appendChild(a); a.click(); a.remove(); }catch(e){} }, i*300); }); }
  function finalize(text, set){ var ov=document.getElementById('hpSpreadOv'); if(ov)ov.remove(); post(text); downloadAll(set); if(window.toast) toast('🚀 Sent — your spread is saving; drop each card where it goes. 🌹'); }
  function composerText(){ var t=document.getElementById('cmpText')||document.getElementById('ddfText'); return t?t.value:''; }
  function pickThenSpread(text){ var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*,video/*'; inp.multiple=true; inp.style.display='none';
    inp.onchange=function(){ var fs=inp.files; if(!fs||!fs.length)return; var imgs=[], pending=fs.length;
      [].forEach.call(fs,function(f){ loadImg(f,function(img){ if(img)imgs.push(img); if(--pending===0 && imgs.length){ window.__hpImages=imgs; spread(imgs,text); } }); }); };
    document.body.appendChild(inp); inp.click(); setTimeout(function(){ try{inp.remove();}catch(e){} },120000); }

  // the actual SEND (text → Facebook / the profile's Coms). Called by the deck's "Send all" after review.
  function post(text){
    text = (text||'').trim(); if(!text){ if(window.toast) toast('Add a couple words — or let the box pre-fill.'); return; }
    learn(text);
    if(window.FFShare&&FFShare.share){ FFShare.share({title:'', text:text, url:location.origin+'/', tags:'#GratefulDead #deaddance'}); }
    else { try{ if(navigator.clipboard) navigator.clipboard.writeText(text); }catch(e){} window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(location.origin+'/'),'_blank','noopener'); }
    if(window.toast) toast('📡 HyperPosted — landing on your Facebook. 🌹');
  }
  // the ONE-CLICK HyperPost entry: build the spread → REVIEW deck (flip through) → the deck's Send fires post().
  function go(text, images){
    text=(text||composerText()||'').trim();
    var imgs=(images&&images.length)?images:currentImages();
    if(imgs.length && window.DDSpread){ spread(imgs, text); return true; }   // photos → review deck, then send
    if(window.DDSpread){ pickThenSpread(text); return true; }                // no photos yet → pick, then review
    post(text); return true;                                                 // no engine → plain text send
  }

  window.DDHyper = { prefill:prefill, draft:draft, learn:learn, post:post, go:go, spread:spread, voice:voice, _firstLine:firstLine, setImage:function(i){ window.__hpImage=i; } };

  function wire(){
    var t=document.getElementById('cmpText');
    if(t && !t.__hp){ t.__hp=1;
      t.addEventListener('focus', function(){ if(!t.value) prefill(t); }, {once:false});
      var hp=t.closest('.card'); if(hp){ hp.querySelectorAll('.hpbtn,[onclick*="hpComposer"]').forEach(function(b){ b.addEventListener('click', function(){ learn(t.value); }); }); }
    }
    // capture EVERY photo the user attaches in a composer → feeds the spread behind HyperPost ("give it 10 photos")
    try{ document.querySelectorAll('input[type=file][accept*=image]:not([data-hpwatch])').forEach(function(inp){ inp.setAttribute('data-hpwatch','1'); try{ inp.multiple=true; }catch(e){}
      inp.addEventListener('change', function(){ var fs=inp.files; if(!fs||!fs.length) return; window.__hpImages=window.__hpImages||[];
        [].forEach.call(fs, function(f){ if(/^(image|video)\//.test(f.type)) loadImg(f, function(img){ if(img) window.__hpImages.push(img); }); }); }); }); }catch(e){}
  }
  if(document.readyState!=='loading') wire(); else document.addEventListener('DOMContentLoaded', wire);
  try{ new MutationObserver(wire).observe(document.body,{childList:true,subtree:true}); }catch(e){}
})();
