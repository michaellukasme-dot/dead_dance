/* ============================================================================
 * dd_cutesy.js — the Cutesy-map georeference brain.
 *
 * Each festival's illustrated ("cutesy") map is pinned to its FOUR real-world
 * corners so markers (which live at real lat/lng) land on the right illustrated
 * streets. This stores those corners per festival + side (N/S), local-first with
 * a guarded Supabase spine. Set once via the align UI; the fan view reads it.
 *
 * bounds format: [[swLat, swLng], [neLat, neLng]]  (axis-aligned, north-up)
 *
 * Guarded (no backend = local-first no-op), instrumented (ids only, NO PII),
 * node-safe (memory fallback when there's no localStorage). Dual export.
 * ==========================================================================*/
;(function (root) {
  'use strict';
  var LS = 'dd.cutesy.bounds';
  var _mem = {};

  function store(){ try{ if(root.localStorage){ return JSON.parse(root.localStorage.getItem(LS) || '{}'); } }catch(e){} return _mem; }
  function persist(o){ _mem = o; try{ if(root.localStorage){ root.localStorage.setItem(LS, JSON.stringify(o)); } }catch(e){} }

  function key(fest, side){ return String(fest||'') + '|' + String(side||'N'); }

  function valid(b){ return !!(b && b.length===2 && b[0] && b[1] && b[0].length===2 && b[1].length===2 &&
    isFinite(b[0][0]) && isFinite(b[0][1]) && isFinite(b[1][0]) && isFinite(b[1][1])); }

  // normalize so [0]=SW (min lat,min lng) and [1]=NE (max lat,max lng) — corner order can't be swapped
  function norm(b){ var la1=+b[0][0], ln1=+b[0][1], la2=+b[1][0], ln2=+b[1][1];
    return [[Math.min(la1,la2), Math.min(ln1,ln2)], [Math.max(la1,la2), Math.max(ln1,ln2)]]; }

  function get(fest, side){ var b = store()[key(fest, side)]; return valid(b) ? b : null; }

  function set(fest, side, bounds){
    if(!valid(bounds)) return null;
    var b = norm(bounds);
    var s = store(); s[key(fest, side)] = b; persist(s);
    guardSpine('sf_cutesy_set', { fest:String(fest||''), side:String(side||'N'),
      sw_lat:b[0][0], sw_lng:b[0][1], ne_lat:b[1][0], ne_lng:b[1][1] });   // consented festival config
    emit('cutesy_set', { fest:String(fest||''), side:String(side||'N') });  // telemetry — ids ONLY
    return b;
  }

  // pull from the backend (if up) into the local store — call on load; guarded
  function sync(fest, side){
    try{ if(typeof root.ddClient==='function'){ var c=root.ddClient();
      if(c && c.rpc){ var p=c.rpc('sf_cutesy_get', {fest:String(fest||''), side:String(side||'N')});
        if(p && p.then){ p.then(function(r){ try{ var d=r&&r.data; if(d && d.length){ var row=d[0]||d;
          var b=[[row.sw_lat,row.sw_lng],[row.ne_lat,row.ne_lng]]; if(valid(b)){ var st=store(); st[key(fest,side)]=norm(b); persist(st); } } }catch(e){} }); } } } }catch(e){}
  }

  function emit(evt, p){ p=p||{}; try{
    if(root.DDTele && typeof root.DDTele.event==='function'){ root.DDTele.event('cutesy.'+evt, p); return; }
    if(typeof root.ddEvent==='function'){ root.ddEvent('cutesy.'+evt, p); return; }
  }catch(e){} }
  function guardSpine(rpc, args){ try{ if(typeof root.ddClient==='function'){ var c=root.ddClient(); if(c && c.rpc){ c.rpc(rpc, args); return true; } } }catch(e){} return false; }

  var api = { get:get, set:set, sync:sync, key:key, valid:valid, norm:norm,
    _reset:function(){ _mem={}; try{ if(root.localStorage) root.localStorage.removeItem(LS); }catch(e){} } };
  root.ddCutesy = api;
  if(typeof module!=='undefined' && module.exports) module.exports = api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
