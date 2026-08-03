/* ============================================================================
 * dd_streetteam.js — the per-FESTIVAL STREET-TEAM brain.
 *
 * A head opts into a festival's Street Team, works the crowd, and earns COOKIES
 * (daily contest, top 3 each day). This module is the client nervous system:
 *   • a STABLE local member id (dd.st.me), minted like adopt_a_band's who()
 *   • local membership flags (dd.st.joined.<festival>)
 *   • guarded, .then/.catch-chained writes to the spine (18_streetteam.sql) so
 *     supabase-js v2 actually SENDS — join / log return the REAL server result.
 *   • a local de-dupe window so rapid identical (kind,ref) logs don't spam the spine.
 *
 * HOUSE LAW: every .rpc() is chained with .then/.catch (it actually fires). With
 * NO client the writes return false HONESTLY — they never fake a server save.
 * Pure helpers (member-id minting, isMember/setMember, de-dupe window) are testable
 * with no backend. Dual browser/node export.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  var LOG_WINDOW_MS = 15000;   // de-dupe: same (kind,ref) within 15s is dropped locally

  // ---- storage (browser localStorage, or a root-attached shim in node tests) ----
  function LS(){
    try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage; } catch (e) {}
    try { if (root && root.localStorage) return root.localStorage; } catch (e) {}
    return null;
  }
  function mint(){ return 'st-' + Math.random().toString(36).slice(2, 8); }

  // ---- stable local member id (node-safe fallback keeps it stable in-process) ----
  // OVERLOADED (per spec): me() → the stable local member id (string);
  //                        me(festival) → a guarded stats read (Promise) via sf_st_me.
  var _memCache = null;
  function me(fest){
    if (fest) return me_stats(fest);
    var ls = LS();
    if (ls) {
      try {
        var v = ls.getItem('dd.st.me');
        if (!v) { v = mint(); ls.setItem('dd.st.me', v); }
        return v;
      } catch (e) {}
    }
    if (!_memCache) _memCache = mint();   // no storage → one stable id per process
    return _memCache;
  }

  // ---- local membership flag per festival ---------------------------------------
  function joinedKey(fest){ return 'dd.st.joined.' + String(fest || ''); }
  function isMember(fest){
    var ls = LS(); if (!ls) return false;
    try { return ls.getItem(joinedKey(fest)) === '1'; } catch (e) { return false; }
  }
  function setMember(fest, bool){
    var ls = LS(); if (!ls) return false;
    try {
      if (bool) ls.setItem(joinedKey(fest), '1');
      else { if (ls.removeItem) ls.removeItem(joinedKey(fest)); else ls.setItem(joinedKey(fest), '0'); }
      return true;
    } catch (e) { return false; }
  }

  // ---- local de-dupe window (PURE, testable) ------------------------------------
  var _lastLog = {};
  function dedupeKey(kind, ref){ return String(kind || '') + '|' + String(ref == null ? '' : ref); }
  // returns true if this (kind,ref) is allowed to send now; false if it repeats within the window.
  function allowLog(kind, ref, now){
    now = now || Date.now();
    var k = dedupeKey(kind, ref), prev = _lastLog[k];
    if (prev != null && (now - prev) < LOG_WINDOW_MS) return false;
    _lastLog[k] = now;
    return true;
  }
  function _resetDedupe(){ _lastLog = {}; }

  // ---- guarded spine access -----------------------------------------------------
  function C(){ try { if (typeof root.ddClient === 'function') return root.ddClient(); } catch (e) {} return null; }
  function emit(evt, p){ try { if (root.DDTele && root.DDTele.event) root.DDTele.event('streetteam.' + evt, p || {}); } catch (e) {} }

  // join a festival's Street Team. Sets the local flag immediately (so the wiring
  // knows to start logging), then SENDS sf_st_join and resolves to the REAL result.
  // No client → resolves false, honestly (nothing reached the server).
  function join(fest){
    setMember(fest, true);
    var c = C();
    if (!c || !c.rpc) { emit('join', { fest: fest, saved: false }); return Promise.resolve(false); }
    try {
      return c.rpc('sf_st_join', { p_festival: fest, p_member: me() })
        .then(function (r){ var okv = !(r && r.error); emit('join', { fest: fest, saved: okv }); return okv; })
        .catch(function (){ emit('join', { fest: fest, saved: false }); return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  // log one activity row. De-duped locally per (kind,ref). Guarded + .then/.catch.
  // Returns Promise<bool> of the REAL server result; false without a client (honest no-op).
  function log(fest, kind, data){
    data = data || {};
    var ref = (data.ref != null ? data.ref : null);
    if (!allowLog(kind, ref)) return Promise.resolve(false);   // rapid identical repeat → dropped locally
    var c = C();
    if (!c || !c.rpc) { emit('log', { fest: fest, kind: kind, saved: false }); return Promise.resolve(false); }
    try {
      return c.rpc('sf_st_log', {
        p_festival: fest, p_member: me(), p_kind: kind, p_ref: ref,
        p_lat: (data.lat != null ? data.lat : null),
        p_lng: (data.lng != null ? data.lng : null),
        p_secs: (data.secs != null ? data.secs : null)
      })
      .then(function (r){ var okv = !(r && r.error); emit('log', { fest: fest, kind: kind, saved: okv }); return okv; })
      .catch(function (){ emit('log', { fest: fest, kind: kind, saved: false }); return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  // guarded reads → resolve null without a client (no fake data).
  function me_stats(fest){
    var c = C(); if (!c || !c.rpc) return Promise.resolve(null);
    try {
      return c.rpc('sf_st_me', { p_festival: fest, p_member: me() })
        .then(function (r){ return (r && r.data) || null; }).catch(function (){ return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function leaderboard(fest){
    var c = C(); if (!c || !c.rpc) return Promise.resolve(null);
    try {
      return c.rpc('sf_st_leaderboard', { p_festival: fest })
        .then(function (r){ return (r && r.data) || null; }).catch(function (){ return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  var api = {
    me: me, isMember: isMember, setMember: setMember,
    join: join, log: log,
    stats: me_stats, leaderboard: leaderboard,
    // pure helpers exposed for the harness:
    dedupeKey: dedupeKey, allowLog: allowLog, _resetDedupe: _resetDedupe,
    LOG_WINDOW_MS: LOG_WINDOW_MS
  };
  root.DDStreetTeam = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
