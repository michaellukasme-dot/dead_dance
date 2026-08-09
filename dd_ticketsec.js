/* ============================================================================
 * dd_ticketsec.js — the TICKET-SECURITY brain (the accountability + anti-fraud layer).
 *
 * PURE, testable logic + GUARDED spine wrappers for the "most secure ticket" flow:
 *   • encodeToken/parseToken — the wallet/QR token format  TIX:<id>:<sig>
 *   • redeemDecision(paid, staffToken) — the client-side PAID→requires-staff gate
 *   • humanStatus(result) — a redeem/verify RPC result → an HONEST door banner
 *       (green admit / amber already-used / RED forged / red not-staff), never a fake ✓
 *   • formatProv(rows) — the provenance/audit chain → readable lines
 *   • guarded verify/redeem/issue/staffClaim/prov/attend wrappers that CHAIN .then/.catch
 *     (supabase-js v2 only SENDS on then/await) and resolve the REAL server result.
 *     With NO client they resolve an HONEST offline shape — never a faked success.
 *
 * HOUSE LAW: authenticity/admit is asserted ONLY from a real server confirmation. The
 * signature is verified on the SERVER (the secret never reaches the client) — this module
 * never claims to verify a ticket by itself. Dual browser/node export.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  // ---- token format:  TIX:<ticket_id>:<sig> -------------------------------------
  function encodeToken(id, sig) {
    id = String(id == null ? '' : id).trim();
    sig = String(sig == null ? '' : sig).trim();
    if (!id || !sig) return '';
    return 'TIX:' + id + ':' + sig;
  }
  // parse a token from a raw string, a wallet QR, or a URL carrying ?tix=. Returns {id,sig} or null.
  function parseToken(s) {
    if (s && typeof s === 'object' && s.id && s.sig) return { id: String(s.id), sig: String(s.sig) };
    var str = String(s == null ? '' : s).trim();
    if (!str) return null;
    // pull ?tix= / &tix= out of a URL if present
    try {
      if (str.indexOf('http') === 0 && str.indexOf('tix=') >= 0) {
        var u = new URL(str); var q = u.searchParams.get('tix'); if (q) str = q.trim();
      }
    } catch (e) {}
    if (str.indexOf('TIX:') === 0) str = str.slice(4);
    var i = str.indexOf(':');
    if (i < 0) return null;
    var id = str.slice(0, i).trim(), sig = str.slice(i + 1).trim();
    if (!id || !sig) return null;
    return { id: id, sig: sig };
  }

  // ---- the PAID → requires-staff gate (PURE client-side pre-check) ---------------
  // A paid ticket may only be redeemed by staff holding the event's staff token.
  // Returns { ok, reason } — ok:false short-circuits before we even hit the server.
  function redeemDecision(paid, staffToken) {
    if (paid && !String(staffToken == null ? '' : staffToken).trim()) {
      return { ok: false, reason: 'not_staff' };
    }
    return { ok: true };
  }

  // ---- redeem/verify RPC result → an HONEST human banner ------------------------
  // tone: 'ok' (green admit) | 'warn' (amber already-used) | 'bad' (red — do not admit)
  function humanStatus(res) {
    res = res || {};
    if (res.offline) return { tone: 'bad', label: "Couldn't reach the server", sub: 'No connection — cannot verify. Do not admit on trust.' };
    if (res.ok && (res.status === 'admitted')) return { tone: 'ok', label: '✓ Admit', sub: 'Authentic · checked in' };
    var reason = res.reason || (res.authentic === false ? 'forged' : 'error');
    switch (reason) {
      case 'already_used': return { tone: 'warn', label: 'Already used', sub: res.redeemed_at ? ('Admitted ' + fmtAt(res.redeemed_at)) : 'This ticket was already redeemed.' };
      case 'stale':        return { tone: 'bad',  label: 'Expired code — refresh', sub: 'This code is stale (likely a screenshot). Have them reopen their live ticket.' };
      case 'forged':       return { tone: 'bad',  label: 'FORGED — do not admit', sub: 'Signature does not match. Not an authentic ticket.' };
      case 'not_staff':    return { tone: 'bad',  label: 'Not staff', sub: 'A paid ticket needs the event staff token to admit.' };
      case 'no_staff':     return { tone: 'bad',  label: 'No staff token set', sub: 'Register this event’s staff token before admitting paid tickets.' };
      case 'not_found':    return { tone: 'bad',  label: 'Unknown ticket', sub: 'No such ticket in the system.' };
      case 'secret_not_set': return { tone: 'bad', label: 'Not verifiable', sub: 'Ticket secret not set on the server.' };
      default:             return { tone: 'bad',  label: 'Not admitted', sub: res.err || 'Ticket could not be verified.' };
    }
  }
  // verify (pre-check, no mutation) result → human line
  function verifyStatus(res) {
    res = res || {};
    if (res.offline) return { tone: 'bad', label: "Couldn't reach the server", sub: 'No connection.' };
    if (res.authentic === true) {
      if (res.status === 'redeemed') return { tone: 'warn', label: 'Authentic — already used', sub: 'Valid signature, but already redeemed.' };
      if (res.status === 'void')     return { tone: 'bad',  label: 'Authentic — voided', sub: 'This ticket was voided.' };
      return { tone: 'ok', label: '✓ Authentic', sub: (res.paid ? 'Paid ticket' : 'Free ticket') + ' · valid' };
    }
    if (res.status === 'not_found') return { tone: 'bad', label: 'Unknown ticket', sub: 'No such ticket.' };
    return { tone: 'bad', label: 'FORGED — not authentic', sub: 'Signature does not match.' };
  }

  function fmtAt(s) { try { return new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return String(s || ''); } }

  // ---- provenance → readable lines ----------------------------------------------
  function formatProv(rows) {
    if (!rows || !rows.length) return [];
    return rows.map(function (r) {
      r = r || {};
      var when = ''; try { when = new Date(r.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { when = String(r.at || ''); }
      var icon = r.kind === 'issue' ? '🎟' : (r.kind === 'redeem' ? '🚪' : (r.kind === 'transfer' ? '↗' : '✖'));
      var note = r.note ? (' — ' + r.note) : '';
      var geo = (r.lat != null && r.lng != null) ? (' @ ' + (+r.lat).toFixed(4) + ',' + (+r.lng).toFixed(4)) : '';
      return icon + ' ' + r.kind + note + (r.actor ? (' · ' + r.actor) : '') + geo + ' · ' + when;
    });
  }

  // ---- guarded spine access -----------------------------------------------------
  function C() { try { if (typeof root.ddClient === 'function') { var c = root.ddClient(); if (c && c.rpc) return c; } } catch (e) {} return null; }
  // unwrap a supabase rpc reply: { data (our jsonb), error }
  function unwrap(r) { if (r && r.error) return { offline: true, ok: false }; return (r && r.data) || null; }

  // verify (no mutation) → resolves the real {authentic,status,paid} or honest offline.
  function verify(token) {
    var p = parseToken(token);
    if (!p) return Promise.resolve({ ok: false, reason: 'not_found' });
    var c = C();
    if (!c) return Promise.resolve({ offline: true, ok: false });
    try {
      return c.rpc('sf_ticket_verify', { p_ticket: p.id, p_sig: p.sig })
        .then(function (r) { return unwrap(r) || { offline: true, ok: false }; })
        .catch(function () { return { offline: true, ok: false }; });
    } catch (e) { return Promise.resolve({ offline: true, ok: false }); }
  }

  // redeem (atomic single-use). opts: { staffToken, lat, lng, by }. Chains .then/.catch.
  function redeem(token, opts) {
    opts = opts || {};
    var p = parseToken(token);
    if (!p) return Promise.resolve({ ok: false, reason: 'not_found' });
    var c = C();
    if (!c) return Promise.resolve({ offline: true, ok: false });
    try {
      return c.rpc('sf_ticket_redeem', {
        p_ticket: p.id, p_sig: p.sig,
        p_staff_token: (opts.staffToken != null ? String(opts.staffToken) : null),
        p_lat: (opts.lat != null ? opts.lat : null),
        p_lng: (opts.lng != null ? opts.lng : null),
        p_by: (opts.by != null ? String(opts.by) : null)
      })
      .then(function (r) { return unwrap(r) || { offline: true, ok: false }; })
      .catch(function () { return { offline: true, ok: false }; });
    } catch (e) { return Promise.resolve({ offline: true, ok: false }); }
  }

  // issue a ticket → resolves { ok, ticket_id, sig, token } or honest offline.
  function issue(o) {
    o = o || {};
    if (!o.event) return Promise.resolve({ ok: false, reason: 'event required' });
    var c = C();
    if (!c) return Promise.resolve({ offline: true, ok: false });
    try {
      return c.rpc('sf_ticket_issue', {
        p_event: String(o.event), p_tier: (o.tier != null ? String(o.tier) : 'ga'),
        p_paid: !!o.paid, p_price: (o.price != null ? o.price : null),
        p_owner: (o.owner != null ? String(o.owner) : null),
        p_issued_by: (o.by != null ? String(o.by) : null)
      })
      .then(function (r) { var d = unwrap(r); if (!d || d.offline) return { offline: true, ok: false };
        if (d.ok && d.ticket_id && d.sig) d.token = encodeToken(d.ticket_id, d.sig); return d; })
      .catch(function () { return { offline: true, ok: false }; });
    } catch (e) { return Promise.resolve({ offline: true, ok: false }); }
  }

  function staffClaim(event, staffToken, by) {
    var c = C(); if (!c) return Promise.resolve({ offline: true, ok: false });
    try {
      return c.rpc('sf_ticket_staff_claim', { p_event: String(event || ''), p_staff_token: String(staffToken || ''), p_by: (by != null ? String(by) : null) })
        .then(function (r) { return unwrap(r) || { offline: true, ok: false }; })
        .catch(function () { return { offline: true, ok: false }; });
    } catch (e) { return Promise.resolve({ offline: true, ok: false }); }
  }

  function prov(token) {
    var p = parseToken(token); var id = p ? p.id : String(token || '').trim();
    if (!id) return Promise.resolve([]);
    var c = C(); if (!c) return Promise.resolve([]);
    try {
      return c.rpc('sf_ticket_prov', { p_ticket: id })
        .then(function (r) { var d = unwrap(r); return Array.isArray(d) ? d : []; })
        .catch(function () { return []; });
    } catch (e) { return Promise.resolve([]); }
  }

  function attend(token) {
    var p = parseToken(token); var id = p ? p.id : String(token || '').trim();
    if (!id) return Promise.resolve(null);
    var c = C(); if (!c) return Promise.resolve(null);
    try {
      return c.rpc('sf_ticket_attend', { p_ticket: id })
        .then(function (r) { return unwrap(r) || null; })
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  // ---- ROTATING (time-based) entry code — makes "screenshots won't get you in" TRUE -----------
  // The device fetches its per-ticket seed once (getSeed), then rolls a fresh code every ~15s
  // on-device: code = HMAC(seed, id|step). A screenshot shows one step and goes stale within ~30s.
  function _hmacHex(seedStr, msg) {
    try {
      var subtle = (root.crypto && root.crypto.subtle) || (typeof crypto !== 'undefined' && crypto.subtle);
      if (!subtle || typeof TextEncoder === 'undefined') return Promise.resolve(null);
      var enc = new TextEncoder();
      return subtle.importKey('raw', enc.encode(String(seedStr)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
        .then(function (k) { return subtle.sign('HMAC', k, enc.encode(String(msg))); })
        .then(function (buf) { var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2); return s; });
    } catch (e) { return Promise.resolve(null); }
  }
  function rotStep(win) { win = win || 15; return Math.floor(Date.now() / 1000 / win); }
  function rotCode(seed, id, step) { return _hmacHex(seed, String(id) + '|' + step).then(function (h) { return h ? h.slice(0, 16) : null; }); }
  function parseRot(s) {
    var str = String(s == null ? '' : s).trim();
    try { if (str.indexOf('http') === 0 && str.indexOf('tix=') >= 0) { var u = new URL(str); var q = u.searchParams.get('tix'); if (q) str = q.trim(); } } catch (e) {}
    if (str.indexOf('TIXR:') !== 0) return null;
    var p = str.slice(5).split(':'); if (p.length < 3) return null;
    var step = parseInt(p[1], 10); if (!(step >= 0)) return null;
    if (!p[0] || !p[2]) return null;
    return { id: p[0], step: step, code: p[2] };
  }
  // start rolling. onTick(token, secondsLeft, step) fires now + every second. Returns a stop() fn.
  function startRotating(id, seed, onTick, opts) {
    opts = opts || {}; var win = opts.window || 15; var stopped = false, timer = null;
    function tick() {
      if (stopped) return; var step = rotStep(win);
      rotCode(seed, id, step).then(function (code) {
        if (stopped || !code) return;
        var secsLeft = win - (Math.floor(Date.now() / 1000) % win);
        try { onTick('TIXR:' + id + ':' + step + ':' + code, secsLeft, step); } catch (e) {}
      });
    }
    tick(); timer = setInterval(tick, 1000);
    return function stop() { stopped = true; if (timer) clearInterval(timer); };
  }
  // fetch this ticket's seed (server hands it over ONLY on a valid static sig). Cache it, roll offline.
  function getSeed(token) {
    var p = parseToken(token); if (!p) return Promise.resolve({ ok: false, reason: 'not_found' });
    var c = C(); if (!c) return Promise.resolve({ offline: true, ok: false });
    try { return c.rpc('sf_ticket_seed', { p_ticket: p.id, p_sig: p.sig }).then(function (r) { return unwrap(r) || { offline: true, ok: false }; }).catch(function () { return { offline: true, ok: false }; }); }
    catch (e) { return Promise.resolve({ offline: true, ok: false }); }
  }
  // redeem a scanned ROTATING token (TIXR:id:step:code). opts: { staffToken, lat, lng, by }.
  function redeemRot(token, opts) {
    opts = opts || {}; var p = parseRot(token); if (!p) return Promise.resolve({ ok: false, reason: 'not_found' });
    var c = C(); if (!c) return Promise.resolve({ offline: true, ok: false });
    try {
      return c.rpc('sf_ticket_redeem_rot', {
        p_ticket: p.id, p_step: p.step, p_code: p.code,
        p_staff_token: (opts.staffToken != null ? String(opts.staffToken) : null),
        p_lat: (opts.lat != null ? opts.lat : null), p_lng: (opts.lng != null ? opts.lng : null),
        p_by: (opts.by != null ? String(opts.by) : null)
      }).then(function (r) { return unwrap(r) || { offline: true, ok: false }; }).catch(function () { return { offline: true, ok: false }; });
    } catch (e) { return Promise.resolve({ offline: true, ok: false }); }
  }

  var api = {
    encodeToken: encodeToken, parseToken: parseToken,
    rotStep: rotStep, rotCode: rotCode, parseRot: parseRot, startRotating: startRotating, getSeed: getSeed, redeemRot: redeemRot,
    redeemDecision: redeemDecision, humanStatus: humanStatus, verifyStatus: verifyStatus,
    formatProv: formatProv,
    verify: verify, redeem: redeem, issue: issue, staffClaim: staffClaim, prov: prov, attend: attend
  };
  root.DDTicketSec = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
