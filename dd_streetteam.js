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

  // ---- BONUS jobs → DOUBLE cookies (Feature 1) ------------------------------------
  // A small registry of task refs that are "bonus jobs" worth 2× cookies. isBonus is
  // prefix-aware ('proximity-accept:Rift' matches the 'proximity-accept' bonus).
  var BONUS = {
    'proximity-accept': true,   // a fan physically AT the stage accepting → bonus job
    'staff-accept':     true,   // proximity paid-staff accept
    'bonus-job':        true    // a designated bonus job in the curtain
  };
  function _refHead(ref){ var s = String(ref == null ? '' : ref); var i = s.indexOf(':'); return (i >= 0 ? s.slice(0, i) : s).toLowerCase().trim(); }
  function isBonus(ref){ if (ref == null) return false; return !!BONUS[_refHead(ref)] || !!BONUS[String(ref).toLowerCase().trim()]; }
  function cookiesFor(ref){ return isBonus(ref) ? 2 : 1; }

  // cookie(festival, amount, opts) — log a cookie earn worth `amount` (bonus job → 2,
  // normal → 1) through the SAME sf_st_log path (kind='cookie' increments by p_secs).
  // Guarded + .then/.catch INSIDE log() → false without a client (honest). When amount
  // is omitted it is derived from whether opts.ref is a bonus ref.
  function cookie(fest, amount, opts){
    opts = opts || {};
    var ref = (opts.ref != null ? opts.ref : null);
    var amt = (amount != null && amount > 0) ? Math.round(amount) : cookiesFor(ref);
    return log(fest, 'cookie', { ref: ref, secs: amt, lat: opts.lat, lng: opts.lng });
  }

  // ---- MUG CHALLENGE / PAYOUT (Feature 2) -----------------------------------------
  // Honest REFERRED-JOIN counting: a NEW device that landed on a member's share link
  // (?ref=st:<member>) logs ONE referral to that member. Dedupe is server-side (UNIQUE
  // (festival, member, device)) AND locally (one send per member from this device). A
  // member can NEVER count themselves. NO auto-payment — claimPayout only RECORDS a
  // pending claim for Michael to pay BY HAND.
  function refMemberFromUrl(){
    try {
      var s = (root.location && root.location.search) || '';
      var m = s.match(/[?&]ref=st:([^&]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }
  function refSentKey(fest, member){ return 'dd.st.refsent.' + String(fest || '') + '.' + String(member || ''); }
  // refer(festival, member?) — THIS device credits `member` (the sharer) once. Reads the
  // sharer from ?ref=st:<member> when not passed. Returns {ok, saved, ...} honestly.
  function refer(fest, member){
    member = member || refMemberFromUrl();
    if (!member) return Promise.resolve({ ok:false, reason:'no-ref' });
    var dev = me();
    if (String(dev) === String(member)) return Promise.resolve({ ok:false, reason:'self' });   // can't count yourself
    var ls = LS(), key = refSentKey(fest, member);
    try { if (ls && ls.getItem(key) === '1') return Promise.resolve({ ok:true, saved:false, deduped:true }); } catch (e) {}
    var c = C();
    if (!c || !c.rpc) { emit('refer', { fest:fest, saved:false }); return Promise.resolve({ ok:false, saved:false }); }
    try {
      return c.rpc('sf_st_refer', { p_festival: fest, p_member: member, p_device: dev })
        .then(function (r){
          var d = (r && r.data) || {};
          var okv = !(r && r.error) && d.ok !== false;
          if (okv) { try { if (ls) ls.setItem(key, '1'); } catch (e) {} }
          emit('refer', { fest:fest, saved:okv });
          return { ok:okv, saved:okv, count:(d.count != null ? d.count : null) };
        })
        .catch(function (){ emit('refer', { fest:fest, saved:false }); return { ok:false, saved:false }; });
    } catch (e) { return Promise.resolve({ ok:false, saved:false }); }
  }
  // phoneCount(festival, member?) — distinct referred devices for a member (self by default).
  // null without a client / on error (no fake number).
  function phoneCount(fest, member){
    var c = C(); if (!c || !c.rpc) return Promise.resolve(null);
    var mem = member || me();
    try {
      return c.rpc('sf_st_phone_count', { p_festival: fest, p_member: mem })
        .then(function (r){ var d = (r && r.data); if (d && d.count != null) return d.count; return (typeof d === 'number' ? d : null); })
        .catch(function (){ return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  // claimPayout(festival, handle, method, program?) — RECORD a pending claim. NEVER pays.
  // Passes through the server's honest {ok, eligible, count, needed, ...}. false w/o a client.
  function claimPayout(fest, handle, method, program){
    var c = C(); if (!c || !c.rpc) return Promise.resolve({ ok:false, saved:false });
    program = program || 'lehigh-mug';
    try {
      return c.rpc('sf_st_payout_claim', {
        p_festival: fest, p_member: me(), p_program: program, p_handle: handle, p_method: method
      })
      .then(function (r){ if (r && r.error) return { ok:false, saved:false, err:(r.error.message || 'error') };
                          return (r && r.data) || { ok:false, saved:false }; })
      .catch(function (){ return { ok:false, saved:false }; });
    } catch (e) { return Promise.resolve({ ok:false, saved:false }); }
  }

  var api = {
    me: me, isMember: isMember, setMember: setMember,
    join: join, log: log,
    stats: me_stats, leaderboard: leaderboard,
    // Feature 1 — bonus cookies:
    cookie: cookie, isBonus: isBonus, cookiesFor: cookiesFor, BONUS: BONUS,
    // Feature 2 — mug challenge / payout claim (never pays):
    refer: refer, phoneCount: phoneCount, claimPayout: claimPayout, refMemberFromUrl: refMemberFromUrl,
    // pure helpers exposed for the harness:
    dedupeKey: dedupeKey, allowLog: allowLog, _resetDedupe: _resetDedupe,
    LOG_WINDOW_MS: LOG_WINDOW_MS
  };
  root.DDStreetTeam = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
