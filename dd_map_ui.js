/* dd_map_ui.js — shared StageFill map UI. Two reusable pieces, one standard everywhere:
   1) DDMapUI.pillArrows(el)  — adds ‹ › scroll arrows to a horizontal pill bar (persists across rebuilds).
   2) DDMapUI.filterModal(opts) — a filter TOGGLE that opens a modal (distance slider + tag chips + Cancel/Apply),
      toggling on/off per click — the Little-Free-Library pattern, ours. Filters live behind the toggle when a
      layer's set is long; small sets stay as on-map pills. */
(function (root) {
  "use strict";
  var CSS = ''
    + '.ddp-nav{position:fixed;width:28px;height:28px;border-radius:50%;background:#fff;border:1px solid #e0e6ec;box-shadow:0 2px 9px rgba(20,26,34,.24);display:none;align-items:center;justify-content:center;cursor:pointer;font:900 15px/1 -apple-system,system-ui,sans-serif;color:#33404e;z-index:1500;user-select:none}'
    + '.ddp-nav.on{display:flex}.ddp-nav:hover{background:#f3f6f9}'
    + '.ddf-toggle{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#5b21b6;color:#fff;border:0;cursor:pointer;box-shadow:0 3px 10px rgba(91,33,182,.35);font-size:16px}'
    + '.ddf-toggle.on{background:#0f1620}'
    + '.ddf-scrim{position:fixed;inset:0;background:rgba(10,14,20,.30);z-index:3000;display:none}'
    + '.ddf-scrim.open{display:block}'
    + '.ddf-modal{position:absolute;left:50%;top:64px;transform:translateX(-50%);width:min(560px,calc(100vw - 28px));max-height:calc(100vh - 96px);overflow:auto;background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(10,14,20,.4);padding:18px 20px 14px;font:15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#141a22}'
    + '.ddf-h{font-weight:900;font-size:16px;margin:0 0 10px}'
    + '.ddf-slab{display:flex;justify-content:space-between;align-items:baseline;font-weight:800;font-size:13px;margin:4px 0 4px}'
    + '.ddf-slab .v{font-size:18px;color:#5b21b6}'
    + '.ddf-range{width:100%;accent-color:#5b21b6}'
    + '.ddf-tagh{font-weight:900;font-size:14px;margin:16px 0 8px}'
    + '.ddf-tags{display:grid;grid-template-columns:1fr 1fr;gap:9px}'
    + '@media(max-width:520px){.ddf-tags{grid-template-columns:1fr}}'
    + '.ddf-tag{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1.5px solid #d9d2ec;border-radius:999px;padding:9px 15px;font-weight:800;font-size:13px;color:#3a2b5e;cursor:pointer;background:#fff}'
    + '.ddf-tag .pm{font-size:16px;color:#5b21b6}'
    + '.ddf-tag.on{background:#5b21b6;color:#fff;border-color:#5b21b6}.ddf-tag.on .pm{color:#fff}'
    + '.ddf-foot{display:flex;justify-content:flex-end;align-items:center;gap:18px;border-top:1px solid #eef0f3;margin-top:14px;padding-top:12px}'
    + '.ddf-cancel{background:0;border:0;color:#6b7684;font-weight:700;font-size:14px;cursor:pointer}'
    + '.ddf-apply{background:0;border:0;color:#5b21b6;font-weight:900;font-size:15px;text-decoration:underline;cursor:pointer}'
    + '.ddfs-btn{position:fixed;width:34px;height:34px;border-radius:8px;background:#fff;border:1px solid #e0e6ec;box-shadow:0 2px 9px rgba(20,26,34,.24);display:grid;place-items:center;cursor:pointer;font-size:15px;color:#33404e;z-index:1500}'
    + '.ddfs-btn:hover{background:#f3f6f9}';
  function injectCSS(){ if(document.getElementById('ddmapui-css')) return; var s=document.createElement('style'); s.id='ddmapui-css'; s.textContent=CSS; (document.head||document.body).appendChild(s); }

  function resolve(el){ return typeof el==='string' ? document.getElementById(el) : el; }

  // ── 1) pill-bar scroll arrows ──────────────────────────────────────────────
  function pillArrows(el){
    el = resolve(el); if(!el || el.__ddArrows) return; el.__ddArrows = true; injectCSS();
    function mk(cls,ch){ var b=document.createElement('div'); b.className='ddp-nav '+cls; b.textContent=ch; document.body.appendChild(b); return b; }
    var L = mk('l','‹'), R = mk('r','›');
    function place(){
      var r = el.getBoundingClientRect();
      if(!r.width){ L.classList.remove('on'); R.classList.remove('on'); return; }
      var mid = r.top + r.height/2 - 14;
      L.style.top = mid+'px'; L.style.left = (r.left - 6)+'px';
      R.style.top = mid+'px'; R.style.left = (r.right - 22)+'px';
      var max = el.scrollWidth - el.clientWidth - 2, scrollable = el.scrollWidth > el.clientWidth + 4;
      L.classList.toggle('on', scrollable && el.scrollLeft > 4);
      R.classList.toggle('on', scrollable && el.scrollLeft < max);
    }
    L.onclick = function(){ el.scrollBy({left:-220, behavior:'smooth'}); };
    R.onclick = function(){ el.scrollBy({left: 220, behavior:'smooth'}); };
    el.addEventListener('scroll', place); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    try{ new MutationObserver(place).observe(el, {childList:true}); }catch(e){}
    setTimeout(place,80); setTimeout(place,450);
    el.__ddPlace = place;
  }

  // ── 2) filter toggle → modal ───────────────────────────────────────────────
  // opts: { toggle:<button el>, title, slider:{label,min,max,value,suffix}, tags:[{id,label}], selected:[ids], onApply(state), onChange(state) }
  function filterModal(opts){
    injectCSS();
    var toggle = resolve(opts.toggle); if(!toggle) return;
    toggle.classList.add('ddf-toggle'); if(!toggle.innerHTML.trim()) toggle.innerHTML = '&#9776;';
    var sel = {}; (opts.selected||[]).forEach(function(id){ sel[id]=true; });
    var dist = opts.slider ? +opts.slider.value : null;
    var scrim = document.createElement('div'); scrim.className='ddf-scrim';
    var modal = document.createElement('div'); modal.className='ddf-modal';
    scrim.appendChild(modal); document.body.appendChild(scrim);
    function state(){ return { distance: dist, tags: Object.keys(sel).filter(function(k){return sel[k];}) }; }
    function render(){
      var h = '<div class="ddf-h">'+(opts.title||'Filters')+'</div>';
      if(opts.slider){
        h += '<div class="ddf-slab"><span>'+opts.slider.label+'</span><span class="v"><span id="ddf-sv">'+dist+'</span> '+(opts.slider.suffix||'')+'</span></div>'
           + '<input class="ddf-range" type="range" id="ddf-range" min="'+opts.slider.min+'" max="'+opts.slider.max+'" value="'+dist+'">';
      }
      if(opts.tags && opts.tags.length){
        h += '<div class="ddf-tagh">Choose Tags</div><div class="ddf-tags">'
           + opts.tags.map(function(t){ return '<div class="ddf-tag'+(sel[t.id]?' on':'')+'" data-id="'+t.id+'">'+t.label+'<span class="pm">'+(sel[t.id]?'✓':'+')+'</span></div>'; }).join('')
           + '</div>';
      }
      h += '<div class="ddf-foot"><button class="ddf-cancel">Cancel</button><button class="ddf-apply">Apply</button></div>';
      modal.innerHTML = h;
      var rng = modal.querySelector('#ddf-range');
      if(rng) rng.oninput = function(){ dist=+this.value; modal.querySelector('#ddf-sv').textContent = dist; if(opts.onChange) opts.onChange(state()); };
      Array.prototype.forEach.call(modal.querySelectorAll('.ddf-tag'), function(chip){
        chip.onclick = function(){ var id=chip.getAttribute('data-id'); sel[id]=!sel[id]; render(); if(opts.onChange) opts.onChange(state()); };
      });
      modal.querySelector('.ddf-cancel').onclick = close;
      modal.querySelector('.ddf-apply').onclick = function(){ if(opts.onApply) opts.onApply(state()); close(); };
    }
    function open(){ render(); scrim.classList.add('open'); toggle.classList.add('on'); }
    function close(){ scrim.classList.remove('open'); toggle.classList.remove('on'); }
    toggle.onclick = function(){ scrim.classList.contains('open') ? close() : open(); };
    scrim.onclick = function(e){ if(e.target===scrim) close(); };
    return { open:open, close:close, state:state };
  }

  // ── 3) fullscreen toggle ───────────────────────────────────────────────────
  // opts: { target:<el to fullscreen, default documentElement>, style:'top:12px;right:12px', onChange }
  function fullscreen(opts){
    opts = opts || {}; injectCSS();
    var target = resolve(opts.target) || document.documentElement;
    var btn = document.createElement('button'); btn.className='ddfs-btn'; btn.title='Toggle fullscreen view'; btn.innerHTML='⛶';
    btn.style.cssText += ';'+(opts.style || 'top:12px;right:12px');
    document.body.appendChild(btn);
    function isFs(){ return document.fullscreenElement || document.webkitFullscreenElement; }
    btn.onclick = function(){
      try{
        if(isFs()){ (document.exitFullscreen||document.webkitExitFullscreen).call(document); }
        else { (target.requestFullscreen||target.webkitRequestFullscreen).call(target); }
      }catch(e){}
    };
    document.addEventListener('fullscreenchange', function(){ btn.innerHTML = isFs()?'🡼':'⛶'; if(opts.onChange) setTimeout(opts.onChange,140); });
    return btn;
  }

  root.DDMapUI = { pillArrows: pillArrows, filterModal: filterModal, fullscreen: fullscreen };
})(window);
