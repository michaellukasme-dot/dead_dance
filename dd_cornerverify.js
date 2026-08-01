/* ============================================================================
 * dd_cornerverify.js — the 4-CORNER GPS VERIFICATION ROUTINE.
 *
 * The standard way any pin (stage, gate, first-aid, POI) gets its EXACT
 * location confirmed: the set-up crew places phones on the corners (4 ideal,
 * 3 accepted) and holds each for ~10 minutes so the fix settles. The routine
 * averages the corners into the true center, REJECTS a single wild reading,
 * grades the tightness, and fires "VERIFICATION COMPLETE".
 *
 *   open(pin) · submit(pin,corner,lat,lng,dwellMs,by) · status(pin) · finalize(pin)
 *
 * Guarded + local-first (no backend = it still computes, just doesn't persist).
 * Instrumented (ids/counts, NO PII). onComplete notify hook. Dual browser/node.
 * The math (compute) is pure and unit-tested.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  var DWELL_MS = 10*60*1000;   // 10 min on a corner = a settled, averaged fix
  var MIN_CORNERS = 3;         // 4 ideal; 3 acceptable (lower confidence)
  var TIGHT_M = 15, OK_M = 40, OUTLIER_M = 45;

  function num(x){ x=Number(x); return isFinite(x)?x:0; }
  function distM(a,b){
    if(!a||!b||a.lat==null||b.lat==null) return Infinity;
    var R=6371000, t=Math.PI/180;
    var dLa=(b.lat-a.lat)*t, dLn=(b.lng-a.lng)*t, la1=a.lat*t, la2=b.lat*t;
    var x=Math.sin(dLa/2)*Math.sin(dLa/2) + Math.sin(dLn/2)*Math.sin(dLn/2)*Math.cos(la1)*Math.cos(la2);
    return 2*R*Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function mean(rs){ var la=0,ln=0; rs.forEach(function(r){ la+=r.lat; ln+=r.lng; }); return {lat:la/rs.length, lng:ln/rs.length}; }

  // ---- PURE: corners → centroid + spread + quality (drops one wild outlier) ----
  function compute(readings){
    var rs=(readings||[]).filter(function(r){ return r && isFinite(r.lat) && isFinite(r.lng); });
    if(!rs.length) return { corners:0, used:0, centroid:null, spreadM:null, quality:'none', outlierDropped:false };
    var c=mean(rs);
    var dists=rs.map(function(r){ return distM(r,c); });
    var spread=Math.max.apply(0,dists), used=rs, filtered=false;
    if(rs.length>=4 && spread>OUTLIER_M){                    // one corner far off → drop it, recompute (>=3 remain)
      var worst=dists.indexOf(spread);
      var kept=rs.filter(function(_,i){ return i!==worst; });
      var c2=mean(kept), sp2=Math.max.apply(0,kept.map(function(r){ return distM(r,c2); }));
      if(sp2 < spread){ c=c2; spread=sp2; used=kept; filtered=true; }
    }
    var quality = spread<=TIGHT_M ? 'tight' : (spread<=OK_M ? 'ok' : 'loose');
    return { corners:rs.length, used:used.length, centroid:{lat:c.lat, lng:c.lng},
             spreadM:Math.round(spread*10)/10, quality:quality, outlierDropped:filtered };
  }
  function dwellOk(r, need){ return num(r&&r.dwellMs) >= (need||DWELL_MS); }

  // ---- session store (keyed by pin) ----
  var S={}; var cfg={ minCorners:MIN_CORNERS, dwellMs:DWELL_MS, onComplete:null };
  function configure(o){ o=o||{};
    if(o.minCorners>0) cfg.minCorners=o.minCorners;
    if(o.dwellMs>0)    cfg.dwellMs=o.dwellMs;
    if(typeof o.onComplete==='function') cfg.onComplete=o.onComplete;
    return cfg; }

  function open(pin){ pin=String(pin||'pin'); if(!S[pin]) S[pin]={pin:pin, readings:[], done:false}; return status(pin); }

  function submit(pin, corner, lat, lng, dwellMs, by){
    pin=String(pin||'pin'); open(pin);
    var r={ corner:String(corner||('c'+(S[pin].readings.length+1))), lat:Number(lat), lng:Number(lng),
            dwellMs:num(dwellMs), by:by||null, ts:Date.now() };
    if(!isFinite(r.lat)||!isFinite(r.lng)) return { ok:false, err:'bad gps' };
    S[pin].readings = S[pin].readings.filter(function(x){ return x.corner!==r.corner; }); // one per corner label — resubmit updates
    S[pin].readings.push(r);
    guardSpine('sf_verify_submit', { p_pin:pin, p_corner:r.corner, p_lat:r.lat, p_lng:r.lng, p_dwell:r.dwellMs, p_by:r.by });
    emit('corner', { pin:pin, corners:S[pin].readings.length });
    return status(pin);
  }

  function status(pin){ pin=String(pin||'pin'); var s=S[pin]||{readings:[]};
    var c=compute(s.readings);
    var quorum = c.corners>=cfg.minCorners;
    var dwellMet = s.readings.length>0 && s.readings.every(function(r){ return dwellOk(r,cfg.dwellMs); });
    return { pin:pin, corners:c.corners, need:cfg.minCorners, centroid:c.centroid, spreadM:c.spreadM,
             quality:c.quality, outlierDropped:c.outlierDropped, dwellMet:!!dwellMet, complete:!!quorum, done:!!s.done };
  }

  function finalize(pin){ pin=String(pin||'pin'); var st=status(pin);
    if(!st.complete||!st.centroid) return { ok:false, err:'need '+cfg.minCorners+' corners', status:st };
    if(S[pin]) S[pin].done=true;
    guardSpine('sf_verify_set', { p_pin:pin, p_lat:st.centroid.lat, p_lng:st.centroid.lng, p_spread:st.spreadM, p_quality:st.quality });
    emit('complete', { pin:pin, corners:st.corners, spreadM:st.spreadM, quality:st.quality });
    try{ if(cfg.onComplete) cfg.onComplete({ pin:pin, centroid:st.centroid, spreadM:st.spreadM, quality:st.quality, dwellMet:st.dwellMet }); }catch(e){}
    return { ok:true, pin:pin, centroid:st.centroid, spreadM:st.spreadM, quality:st.quality, dwellMet:st.dwellMet };
  }
  function reset(pin){ if(pin) delete S[pin]; else S={}; }

  function emit(evt,p){ p=p||{}; try{ if(root.DDTele&&root.DDTele.event){ root.DDTele.event('verify.'+evt,p); return; }
    if(typeof root.ddEvent==='function'){ root.ddEvent('verify.'+evt,p); } }catch(e){} }
  function guardSpine(rpc,args){ try{ if(typeof root.ddClient==='function'){ var c=root.ddClient(); if(c&&c.rpc){ c.rpc(rpc,args); return true; } } }catch(e){} return false; }

  var api={ configure:configure, open:open, submit:submit, status:status, finalize:finalize, reset:reset,
            distM:distM, compute:compute, _cfg:cfg, DWELL_MS:DWELL_MS };
  root.ddCornerVerify=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
