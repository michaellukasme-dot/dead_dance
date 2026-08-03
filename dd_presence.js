/* ============================================================================
 * dd_presence.js — presence → ticket.
 *
 * The flywheel closing on itself: if a fan PERSISTS at a stage while an act is
 * playing, they've truly been there — so hand them the ticket to that event and
 * seat them in the verified at-show subgroup (see DATA_what_the_band_needs_to_know).
 *
 *   tick(pos, stages, dtMs)  — call on every GPS fix.
 *     • accumulates dwell for the nearest stage within nearM
 *     • resets dwell when the fan leaves (nearest changes / out of radius)
 *     • clamps dtMs so a backgrounded tab can't "teleport" past the threshold
 *     • at dwellMs AND an act is playing there (nowActAt gate) → grant() the ticket
 *
 * Guarded + local-first (no backend = no-op). Instrumented (ids/counts, NO PII).
 * Idempotent: one presence-ticket per event. Dual browser/node export.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  var DEFAULTS = {
    dwellMs: 8 * 60 * 1000,   // 8 min of persistence = "you're really here"
    nearM:   75,              // within 75 m of the stage counts as "at" it
    maxTickMs: 120 * 1000     // clamp: never credit more than 2 min from one tick (background-resume guard)
  };

  var cfg = { dwellMs:DEFAULTS.dwellMs, nearM:DEFAULTS.nearM, maxTickMs:DEFAULTS.maxTickMs, onGrant:null, nowActAt:null };
  var state = { dwell:{}, granted:{} };   // dwell[stageId] = accumulated ms ; granted[eventId] = true

  function configure(opts){ opts=opts||{};
    if (opts.dwellMs>0)   cfg.dwellMs   = opts.dwellMs;
    if (opts.nearM>0)     cfg.nearM     = opts.nearM;
    if (opts.maxTickMs>0) cfg.maxTickMs = opts.maxTickMs;
    if (typeof opts.onGrant==='function')  cfg.onGrant  = opts.onGrant;   // host: notify + attach the ticket
    if (typeof opts.nowActAt==='function') cfg.nowActAt = opts.nowActAt;  // host: which act is playing at a stage right now
    return cfg;
  }

  // ---- geo (haversine, meters) --------------------------------------------
  function distM(a, b){
    if (!a || !b || a.lat==null || a.lng==null || b.lat==null || b.lng==null) return Infinity;
    var R=6371000, toR=Math.PI/180;
    var dLat=(b.lat-a.lat)*toR, dLng=(b.lng-a.lng)*toR, la1=a.lat*toR, la2=b.lat*toR;
    var x=Math.sin(dLat/2)*Math.sin(dLat/2) + Math.sin(dLng/2)*Math.sin(dLng/2)*Math.cos(la1)*Math.cos(la2);
    return 2*R*Math.asin(Math.min(1, Math.sqrt(x)));
  }

  // ---- the tick -----------------------------------------------------------
  function tick(pos, stages, dtMs){
    if (!pos || pos.lat==null) return null;
    dtMs = Math.max(0, Math.min(Number(dtMs)||0, cfg.maxTickMs));   // clamp — a resumed background tab can't jump the threshold
    // nearest stage
    var nearest=null, nd=Infinity;
    (stages||[]).forEach(function(s){ var d=distM(pos, {lat:s.lat, lng:s.lng}); if (d<nd){ nd=d; nearest=s; } });
    var nearId = (nearest && nd<=cfg.nearM) ? String(nearest.id) : null;
    // leaving DECAYS dwell by dt (not a hard reset): a brief GPS jitter can't wipe real persistence,
    // but a sustained departure still drains it to zero — so a walk-through never gets credited.
    for (var k in state.dwell){ if (k!==nearId) state.dwell[k]=Math.max(0, (state.dwell[k]||0) - dtMs); }
    if (!nearId) return null;
    state.dwell[nearId] = (state.dwell[nearId]||0) + dtMs;
    if (state.dwell[nearId] < cfg.dwellMs) return { dwelling:nearId, ms:state.dwell[nearId] };
    // dwell met — but an act must be PLAYING here right now
    var act = cfg.nowActAt ? cfg.nowActAt(nearest) : null;
    if (!act || !act.event) return { dwelling:nearId, ms:state.dwell[nearId], noAct:true };
    return grant(act, nearest);
  }

  function grant(act, stage){
    var ev = String(act.event);
    if (state.granted[ev]) return { ok:true, already:true, event:ev };   // idempotent — one ticket per event
    state.granted[ev] = true;
    guardSpine('sf_presence_grant', { event:ev, stage: stage && stage.id });   // verified at-show → backend (consented)
    emit('presence_ticket', { event:ev, stage: stage && stage.id });           // telemetry — ids ONLY
    var ticket = { event:ev, act: act.name||null, stage: stage && stage.name, kind:'presence' };
    try { if (cfg.onGrant) cfg.onGrant(ticket); } catch(e){}   // host fires the notification + attaches the ticket
    return { ok:true, already:false, event:ev, ticket:ticket };
  }

  // ---- instrumentation (guarded; NO PII — ids & counts only) --------------
  function emit(evt, payload){
    payload = payload || {};
    try{
      if (root.DDTele && typeof root.DDTele.event==='function'){ root.DDTele.event('presence.'+evt, payload); return; }
      if (typeof root.ddEvent==='function'){ root.ddEvent('presence.'+evt, payload); return; }
    }catch(e){}
  }
  // Truly FIRES the write. supabase-js v2 is LAZY — a bare c.rpc(...) with no
  // .then/.catch/await NEVER SENDS, so the grant would be a lie. We chain .then/.catch
  // (guarded, no-throw) so it actually goes to the server, tap telemetry on the result,
  // and RETURN the promise so callers can reflect the REAL outcome (synced vs not).
  function guardSpine(rpc, args){
    try{
      if (typeof root.ddClient==='function'){
        var c=root.ddClient();
        if (c && c.rpc){
          var p = c.rpc(rpc, args);
          if (p && typeof p.then==='function'){
            try{ p.then(function(){ emit('spine_ok', { rpc:rpc }); },
                        function(){ emit('spine_err', { rpc:rpc }); }); }catch(e){}  // telemetry tap (also marks p handled → no unhandledRejection)
            return p;                                     // hand the REAL promise back to the caller
          }
          return true;                                    // non-thenable client (test double) — treat as fired
        }
      }
    }catch(e){}
    return false;   // no backend reachable → local-first no-op
  }

  // Explicit FAN action — proximity ACCEPT of a FREE ticket, or any host-driven grant.
  // Idempotent (shares state.granted → one per event). Returns a PROMISE resolving to
  // the REAL result: {synced:true} only on server confirm; {offline:true} when there is
  // no backend; {error} when the write could not reach the server. Never a blanket "saved".
  function accept(event, stage){
    var ev = String(event);
    var already = !!state.granted[ev];
    state.granted[ev] = true;                                   // idempotent local mark
    var sid = (stage && stage.id!=null) ? stage.id : (stage||null);
    emit('presence_accept', { event:ev, stage:sid });           // telemetry — ids ONLY, no PII
    var res = { ok:true, already:already, event:ev, synced:false, offline:false };
    var p; try{ p = guardSpine('sf_presence_grant', { event:ev, stage:sid }); }catch(e){ p=false; }
    if (p && typeof p.then==='function'){
      return p.then(function(r){
        if (r && r.error){ res.error = String((r.error && r.error.message) || r.error); return res; }  // server reachable but refused
        res.synced = true; res.server = (r && ('data' in r)) ? r.data : (r||null); return res;          // real confirmation
      }, function(e){ res.error = String((e && e.message) || e || 'unreachable'); return res; });        // could not reach server
    }
    if (p === true){ res.synced = true; return _resolved(res); }  // non-thenable fired client
    res.offline = true;                                           // no backend → local-first, honest
    return _resolved(res);
  }
  function _resolved(v){ return (typeof Promise!=='undefined') ? Promise.resolve(v)
                          : { then:function(cb){ try{ cb(v); }catch(e){} return this; }, catch:function(){ return this; } }; }

  var api = {
    configure: configure, tick: tick, distM: distM, grant: grant, accept: accept,
    granted: function(ev){ return !!state.granted[String(ev)]; },
    dwellMs: function(stageId){ return state.dwell[String(stageId)]||0; },
    _reset: function(){ state={dwell:{},granted:{}}; cfg={dwellMs:DEFAULTS.dwellMs,nearM:DEFAULTS.nearM,maxTickMs:DEFAULTS.maxTickMs,onGrant:null,nowActAt:null}; }
  };
  root.ddPresence = api;
  if (typeof module!=='undefined' && module.exports) module.exports = api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
