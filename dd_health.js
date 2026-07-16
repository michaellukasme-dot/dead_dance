/* dd_health.js — fleet health beacon + self-heal. Drop-in: <script src="dd_health.js" defer></script>.
   Does three things, all best-effort and PII-free:
     1) HEARTBEAT — posts a tiny beat (sw version, load ms, error counts) every ~60s to dd_health_beat.
     2) OBEYS FLAGS — reads dd_flags on load + each beat:
          • kill_switch → calm "back in a few minutes" card (no crash, no blank screen).
          • min_version → force-updates a phone stuck on an old broken build (skipWaiting + one reload).
          • load_level → sets window.DD_LOAD_LEVEL so heavy features throttle themselves under load.
     3) COUNTS TROUBLE — window.onerror → js_err; exposes DDHealth.rpcErr()/tileErr()/gpsLowConf() so
        other code reports failures. This is what the dashboard + the scheduled monitor watch.
   Requires window.ddClient() (Supabase). Safe if it's absent (just no-ops the network). */
(function (w, d) {
  "use strict";
  if (w.DDHealth) return;
  var C = { rpc_err: 0, tile_err: 0, gps_lowconf: 0, js_err: 0 };
  var SWVER = 0, SWSTR = "";

  function num(s){ var m=/-v(\d+)-/.exec(s||""); return m?+m[1]:0; }
  function sb(){ try { return w.ddClient && w.ddClient(); } catch(e){ return null; } }

  // best-effort read of the shipped SW version (so min_version can compare)
  function readVersion(cb){
    try{
      fetch("sw.js", { cache: "no-store" }).then(function(r){ return r.text(); }).then(function(t){
        var m=/deaddance-v(\d+)-[0-9-]+/.exec(t); SWSTR = m?m[0]:""; SWVER = m?+m[1]:0; cb&&cb();
      }).catch(function(){ cb&&cb(); });
    }catch(e){ cb&&cb(); }
  }

  function killCard(msg){
    if (d.getElementById("ddKill")) return;
    var el=d.createElement("div"); el.id="ddKill";
    el.style.cssText="position:fixed;inset:0;z-index:2147483640;background:#150c22;color:#f3ecff;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font:600 16px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif";
    el.innerHTML='<div><div style="font-size:44px">🌹</div><div style="font-size:20px;font-weight:900;margin:8px 0">Back in a few minutes</div><div style="color:#a996c9;max-width:320px">'+
      (msg?String(msg).replace(/[<>]/g,''):'DeadDance is catching its breath — the crowd showed up all at once. Hang tight and refresh in a moment.')+
      '</div><button onclick="location.reload()" style="margin-top:16px;border:0;border-radius:12px;padding:12px 20px;font-weight:800;background:#f0b429;color:#3a1d00;cursor:pointer">Try again</button></div>';
    d.body.appendChild(el);
  }

  function applyFlags(f){
    if(!f) return;
    if (f.kill_switch) { killCard(f.message); return; }
    w.DD_LOAD_LEVEL = f.load_level || 0;      // heavy features read this (throttle ping rate, drop thumbnails…)
    if (f.min_version && SWVER && f.min_version > SWVER) {   // stuck on an old/broken build → force it forward
      var key="dd.forced."+f.min_version;
      try{ if(!sessionStorage.getItem(key)){ sessionStorage.setItem(key,"1");
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
          navigator.serviceWorker.getRegistration().then(function(reg){ try{ if(reg&&reg.waiting) reg.waiting.postMessage({type:"SKIP_WAITING"}); if(reg) reg.update(); }catch(e){} setTimeout(function(){ location.reload(); }, 800); });
        } else { setTimeout(function(){ location.reload(); }, 800); }
      } }catch(e){}
    }
  }

  function readFlags(){ var c=sb(); if(!(c&&c.rpc)) return; c.rpc("dd_flags_get").then(function(r){ if(r&&r.data&&r.data[0]) applyFlags(r.data[0]); }).catch(function(){}); }

  function loadMs(){ try{ var n=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0]; if(n&&n.duration) return Math.round(n.duration); var t=performance.timing; if(t&&t.loadEventEnd&&t.navigationStart) return Math.max(0,t.loadEventEnd-t.navigationStart); }catch(e){} return Math.round((w.performance&&performance.now)?performance.now():0); }

  function beat(){ var c=sb(); if(!(c&&c.rpc)) return;
    var payload={ p_sw:SWSTR||("v"+SWVER), p_load_ms:loadMs(), p_rpc_err:C.rpc_err, p_tile_err:C.tile_err, p_gps_lowconf:C.gps_lowconf, p_js_err:C.js_err };
    C.rpc_err=C.tile_err=C.gps_lowconf=C.js_err=0;                     // reset the window
    try{ c.rpc("dd_health_beat", payload).then(function(){},function(){}); }catch(e){}
    readFlags();
  }

  try{ w.addEventListener("error", function(){ C.js_err++; }); }catch(e){}
  try{ w.addEventListener("unhandledrejection", function(){ C.js_err++; }); }catch(e){}

  w.DDHealth = {
    rpcErr:   function(){ C.rpc_err++; },
    tileErr:  function(){ C.tile_err++; },
    gpsLowConf:function(){ C.gps_lowconf++; },
    jsErr:    function(){ C.js_err++; },
    beatNow:  beat,
    version:  function(){ return SWVER; }
  };

  function start(){ readVersion(function(){ readFlags(); setTimeout(beat, 5000); setInterval(beat, 60000); }); }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start); else start();
})(window, document);
