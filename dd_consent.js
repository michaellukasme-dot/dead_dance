/* ============================================================================
 * dd_consent.js — the LESS / MORE / MOST consent ladder (the RUNTIME gate).
 *
 * Enforces STAGEFILL_PRIVACY_CHARTER_v2 at the point of collection:
 *   • Default OFF. A fan who grants nothing gets the full app and contributes nothing.
 *   • Each scope is its OWN affirmative opt-in, asked just-in-time. Non-cascading:
 *     declining a higher rung never revokes a lower one already granted.
 *   • Withdrawal is instant and clears local contribution.
 *
 * SCOPES (the ladder):
 *   'contribute' = MORE  → anonymous AGGREGATE presence/geometry (no retained trace of the fan)
 *   'safety'     = MOST  → the fan's OWN safety, fan-controlled (share w/ their people; SOS)
 *   'mesh'               → opt-in device relay (separate)
 *
 * A grant is the ONLY key that lets the (dormant) uploader run. No grant → no collection.
 * Nothing here transmits unless BOTH a grant exists AND window.SF_CROWD_ENABLED === true
 * (the org/P0 flag Michael flips only after counsel). Dark by default.
 * Pure-ish + guarded. Dual browser/node export.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  var KEY = 'dd_consent_v1';
  var SCOPES = ['contribute', 'safety', 'mesh'];
  var DISCLOSURE_VERSION = '2026-08-08.1';   // bump when the just-in-time copy changes

  function _load() { try { return JSON.parse((root.localStorage && localStorage.getItem(KEY)) || '{}'); } catch (e) { return {}; } }
  function _save(o) { try { if (root.localStorage) localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  function has(scope) {
    if (SCOPES.indexOf(scope) < 0) return false;
    var o = _load(); var r = o[scope];
    return !!(r && r.granted && !r.withdrawn_at);
  }

  // grant/deny a scope. Records {granted, ts, version, withdrawn_at}. Independent + non-cascading.
  function set(scope, granted, opts) {
    if (SCOPES.indexOf(scope) < 0) return false;
    opts = opts || {};
    var o = _load();
    if (granted) {
      o[scope] = { granted: true, ts: Date.now(), version: opts.version || DISCLOSURE_VERSION, withdrawn_at: null };
    } else {
      o[scope] = { granted: false, ts: (o[scope] && o[scope].ts) || Date.now(), version: (o[scope] && o[scope].version) || DISCLOSURE_VERSION, withdrawn_at: Date.now() };
    }
    _save(o);
    _mirror(scope, granted);          // dormant unless SF_CROWD_ENABLED (see below)
    if (!granted) _forget(scope);     // withdrawal clears local contribution immediately
    return true;
  }
  function withdraw(scope) { return set(scope, false); }
  function withdrawAll() { SCOPES.forEach(function (s) { set(s, false); }); return true; }

  // the RUNTIME GATE the uploader must pass. Also requires the org enable-flag to be truly live.
  function gate(scope) { return has(scope) && root.SF_CROWD_ENABLED === true; }

  function record() { return _load(); }

  // clear any locally buffered contribution for a withdrawn scope (deletion is instant + local-first).
  function _forget(scope) {
    try {
      if (scope === 'contribute') {
        if (root.DDNetGPS && root.DDNetGPS.buffer) root.DDNetGPS.buffer.clear();
        if (root.DDCrowdUploader && root.DDCrowdUploader.stop) root.DDCrowdUploader.stop();   // hard-stop the timer, not just the per-tick gate
      }
    } catch (e) {}
  }

  // mirror consent to the server consent table — DORMANT: only if the org flag is on AND a client exists.
  // (Server row carries a non-identifying subject_hash, per the charter — never email/name.)
  function _mirror(scope, granted) {
    try {
      if (root.SF_CROWD_ENABLED !== true) return;                 // dark until counsel-ratified go-live
      var c = (typeof root.ddClient === 'function') ? root.ddClient() : null;
      if (!c || !c.rpc) return;
      c.rpc('sf_consent_set', { p_scope: scope, p_granted: !!granted, p_version: DISCLOSURE_VERSION })
        .then(function () {}).catch(function () {});
    } catch (e) {}
  }

  // ask just-in-time. The APP supplies the UI (a toast); this stores the answer. onDone(granted).
  // Never auto-grants. If the app has no UI hook, it no-ops (stays OFF) — never a dark-pattern default.
  function ask(scope, onDone) {
    onDone = onDone || function () {};
    try {
      if (typeof root.DD_CONSENT_PROMPT === 'function') {
        root.DD_CONSENT_PROMPT(scope, DISCLOSURE_VERSION, function (granted) { set(scope, !!granted); onDone(!!granted); });
        return;
      }
    } catch (e) {}
    onDone(false);   // no UI wired → default OFF
  }

  var api = {
    SCOPES: SCOPES, DISCLOSURE_VERSION: DISCLOSURE_VERSION,
    has: has, set: set, withdraw: withdraw, withdrawAll: withdrawAll,
    gate: gate, record: record, ask: ask
  };
  root.DDConsent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
