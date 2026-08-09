/* ============================================================================
 * dd_crowd_uploader.js — the ONLY thing that would move a location off-device.
 *
 * DORMANT BY DESIGN. It transmits nothing unless BOTH are true:
 *   (1) DDConsent.gate('contribute') === true   → the fan opted into MORE, AND
 *   (2) window.SF_CROWD_ENABLED === true         → the org/P0 flag (flipped only after counsel).
 * With either false (the default), start() is a no-op and no bytes leave the phone.
 *
 * What it sends when live: a rotating, non-identity token + a coarse point, to sf_crowd_ingest,
 * which re-fuzzes, drops sensitive locations, and stores ephemerally. No identity is ever sent.
 * Guarded. Dual browser/node export.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  var _timer = null;

  function _live() {
    try { return root.SF_CROWD_ENABLED === true && root.DDConsent && root.DDConsent.gate('contribute'); }
    catch (e) { return false; }
  }
  // rotating, NON-identity token: per-session + per-zone; rotates when the session changes.
  function _token(zone) {
    try {
      var s = root._sf_sess || (root._sf_sess = Math.random().toString(36).slice(2, 10));
      return 'c-' + s + '-' + String(zone || '').slice(0, 8);
    } catch (e) { return 'c-' + Math.random().toString(36).slice(2, 8); }
  }
  function _client() { try { return (typeof root.ddClient === 'function') ? root.ddClient() : null; } catch (e) { return null; } }

  function _flush(zone) {
    if (!_live()) return;                                   // re-check the gate every tick
    var c = _client(); if (!c || !c.rpc) return;
    var buf = root.DDNetGPS && root.DDNetGPS.buffer; if (!buf) return;
    var rows = buf.peek(50); if (!rows.length) return;
    var tier = null;
    try { tier = root.DDNetGPS.currentTier().code; } catch (e) {}
    var sent = 0;
    rows.forEach(function (r) {
      if (!r || !r.p || r.p.length < 2) return;
      try {
        // NO client token — the server derives an unforgeable, per-bucket token from the session.
        c.rpc('sf_crowd_ingest', { p_zone: zone || null, p_lat: r.p[0], p_lng: r.p[1], p_tier: r.tier || tier })
          .then(function () {}).catch(function () {});
        sent++;
      } catch (e) {}
    });
    if (sent) buf.clear();                                  // fire-and-forget; buffer is on-device only
  }

  // start the (dormant) uploader for a zone. Returns stop(). No-op unless live.
  function start(zone, opts) {
    opts = opts || {};
    stop();
    if (!_live()) return function () {};                    // dark → do nothing
    _timer = setInterval(function () { _flush(zone); }, opts.intervalMs || 20000);
    return stop;
  }
  function stop() { if (_timer) { clearInterval(_timer); _timer = null; } return true; }

  var api = { start: start, stop: stop, isLive: _live, _dormantByDefault: true };
  root.DDCrowdUploader = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
