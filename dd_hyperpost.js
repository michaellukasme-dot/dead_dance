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
  // one press → to Facebook (and the rest of the profile's Coms), via the shared one-click sender
  function post(text){
    text = (text||'').trim(); if(!text){ if(window.toast) toast('Add a couple words — or let the box pre-fill.'); return; }
    learn(text);
    if(window.FFShare&&FFShare.share){ FFShare.share({title:'', text:text, url:location.origin+'/', tags:'#GratefulDead #deaddance'}); }
    else { try{ if(navigator.clipboard) navigator.clipboard.writeText(text); }catch(e){} window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(location.origin+'/'),'_blank','noopener'); }
    if(window.toast) toast('📡 HyperPosted — landing on your Facebook now. Real human content, right where it belongs. 🌹');
  }

  window.DDHyper = { prefill:prefill, draft:draft, learn:learn, post:post, voice:voice };

  function wire(){
    var t=document.getElementById('cmpText');
    if(t && !t.__hp){ t.__hp=1;
      t.addEventListener('focus', function(){ if(!t.value) prefill(t); }, {once:false});
      // learn what they actually send (existing HyperPost button)
      var hp=t.closest('.card'); if(hp){ hp.querySelectorAll('.hpbtn,[onclick*="hpComposer"]').forEach(function(b){ b.addEventListener('click', function(){ learn(t.value); }); }); }
    }
  }
  if(document.readyState!=='loading') wire(); else document.addEventListener('DOMContentLoaded', wire);
  try{ new MutationObserver(wire).observe(document.body,{childList:true,subtree:true}); }catch(e){}
})();
