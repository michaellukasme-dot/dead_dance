/* dd_ticketsec.test.js — node harness for the TICKET-SECURITY brain.
   Run:  node dd_ticketsec.test.js   (exit 0 = all green)
   Covers WITHOUT a backend: token round-trip + parse (raw/TIX/URL/garbage), the paid→
   requires-staff gate, redeem-result → human banner mapping (admit / already-used / FORGED /
   not-staff / offline), provenance formatting, and that verify/redeem are HONEST offline.
   Then, with a FAKE client, proves verify/redeem/issue actually FIRE and pass the real result. */
'use strict';
global.window = global;

var TS = require('./dd_ticketsec.js');

var pass = 0, fail = 0, fails = [];
function ok(name, cond) { if (cond) { pass++; } else { fail++; fails.push(name); console.log('  ✗ ' + name); } }

// ---- token encode / parse ----
(function () {
  var tok = TS.encodeToken('abc123', 'deadbeef');
  ok('encodeToken → TIX:<id>:<sig>', tok === 'TIX:abc123:deadbeef');
  ok('encodeToken empty id → ""', TS.encodeToken('', 'x') === '');
  var p = TS.parseToken(tok);
  ok('parseToken round-trip id', p && p.id === 'abc123');
  ok('parseToken round-trip sig', p && p.sig === 'deadbeef');
  ok('parseToken raw id:sig (no prefix)', (function () { var q = TS.parseToken('id9:sig9'); return q && q.id === 'id9' && q.sig === 'sig9'; })());
  ok('parseToken from URL ?tix=', (function () { var q = TS.parseToken('https://deaddance.app/door?tix=TIX:u1:s1'); return q && q.id === 'u1' && q.sig === 's1'; })());
  ok('parseToken garbage → null', TS.parseToken('not-a-token') === null);
  ok('parseToken empty → null', TS.parseToken('') === null);
  ok('parseToken object passthrough', (function () { var q = TS.parseToken({ id: 'o1', sig: 'o2' }); return q && q.id === 'o1' && q.sig === 'o2'; })());
})();

// ---- paid → requires-staff gate (PURE) ----
(function () {
  ok('free ticket never needs staff', TS.redeemDecision(false, null).ok === true);
  ok('paid + no staff token → blocked (not_staff)', (function () { var d = TS.redeemDecision(true, ''); return d.ok === false && d.reason === 'not_staff'; })());
  ok('paid + staff token → allowed', TS.redeemDecision(true, 'STAFF-XYZ').ok === true);
})();

// ---- redeem result → human banner ----
(function () {
  ok('admit → green (ok tone)', TS.humanStatus({ ok: true, status: 'admitted', authentic: true }).tone === 'ok');
  ok('already_used → amber (warn)', (function () { var h = TS.humanStatus({ ok: false, reason: 'already_used', redeemed_at: '2026-08-01T20:00:00Z' }); return h.tone === 'warn' && /already used/i.test(h.label); })());
  ok('forged → RED do-not-admit', (function () { var h = TS.humanStatus({ ok: false, reason: 'forged', authentic: false }); return h.tone === 'bad' && /FORGED/.test(h.label); })());
  ok('not_staff → red', (function () { var h = TS.humanStatus({ ok: false, reason: 'not_staff' }); return h.tone === 'bad' && /not staff/i.test(h.label); })());
  ok('offline → red honest (no fake admit)', (function () { var h = TS.humanStatus({ offline: true }); return h.tone === 'bad' && /server/i.test(h.label); })());
  ok('authentic:false (no reason) → forged mapping', TS.humanStatus({ ok: false, authentic: false }).tone === 'bad');
})();

// ---- verify result → human line ----
(function () {
  ok('verify authentic+valid → green', TS.verifyStatus({ ok: true, authentic: true, status: 'valid', paid: true }).tone === 'ok');
  ok('verify authentic+redeemed → amber', TS.verifyStatus({ ok: true, authentic: true, status: 'redeemed' }).tone === 'warn');
  ok('verify not authentic → red FORGED', (function () { var h = TS.verifyStatus({ ok: true, authentic: false, status: 'valid' }); return h.tone === 'bad' && /FORGED/.test(h.label); })());
})();

// ---- provenance formatting ----
(function () {
  var lines = TS.formatProv([
    { kind: 'issue', actor: 'st-a', at: '2026-08-01T18:00:00Z', note: 'free' },
    { kind: 'redeem', actor: 'door', lat: 40.61, lng: -75.38, at: '2026-08-01T20:00:00Z', note: 'admitted' }
  ]);
  ok('formatProv returns a line per row', lines.length === 2);
  ok('formatProv issue line carries kind', /issue/.test(lines[0]));
  ok('formatProv redeem line carries geo', /40\.61/.test(lines[1]) && /-75\.38/.test(lines[1]));
  ok('formatProv empty → []', TS.formatProv([]).length === 0);
})();

// ---- HONEST no-client behavior (guarded wrappers) ----
Promise.all([
  TS.verify('TIX:x:y'),
  TS.redeem('TIX:x:y', {}),
  TS.issue({ event: 'musikfest-2026' }),
  TS.prov('TIX:x:y'),
  TS.attend('TIX:x:y')
]).then(function (r) {
  ok('verify() → offline (honest) with no client', r[0] && r[0].offline === true);
  ok('redeem() → offline (honest) with no client', r[1] && r[1].offline === true);
  ok('issue() → offline (honest) with no client', r[2] && r[2].offline === true);
  ok('prov() → [] with no client (no fake audit)', Array.isArray(r[3]) && r[3].length === 0);
  ok('attend() → null with no client (no fake attendance)', r[4] === null);
})
// ---- WITH a fake client: writes actually FIRE and pass the real result through ----
.then(function () {
  var calls = [];
  function fakeClient(result) { return { rpc: function (name, args) { calls.push({ name: name, args: args }); return Promise.resolve(result); } }; }
  function fakeThrow() { return { rpc: function () { return Promise.reject(new Error('network')); } }; }

  global.window.ddClient = function () { return fakeClient({ error: null, data: { ok: true, authentic: true, status: 'valid', paid: true } }); };
  return TS.verify('TIX:id1:sig1').then(function (v) {
    ok('verify() → real authentic result on success', v.authentic === true && v.status === 'valid');
    ok('verify() actually SENT sf_ticket_verify', calls.some(function (c) { return c.name === 'sf_ticket_verify'; }));
    ok('verify() passed parsed id+sig', calls[0].args.p_ticket === 'id1' && calls[0].args.p_sig === 'sig1');
  })
  .then(function () {
    calls.length = 0;
    global.window.ddClient = function () { return fakeClient({ error: null, data: { ok: true, status: 'admitted', authentic: true } }); };
    return TS.redeem('TIX:id2:sig2', { staffToken: 'S1', lat: 40.6, lng: -75.3, by: 'door' }).then(function (v) {
      ok('redeem() → admitted on server success', v.ok === true && v.status === 'admitted');
      ok('redeem() SENT sf_ticket_redeem with staff token + geo', calls[0].name === 'sf_ticket_redeem' && calls[0].args.p_staff_token === 'S1' && calls[0].args.p_lat === 40.6);
    });
  })
  .then(function () {
    global.window.ddClient = function () { return fakeClient({ error: null, data: { ok: false, reason: 'already_used', redeemed_at: '2026-08-01T20:00:00Z' } }); };
    return TS.redeem('TIX:id3:sig3', {}).then(function (v) {
      ok('redeem() → already_used passthrough (idempotent single-use)', v.ok === false && v.reason === 'already_used');
      var h = TS.humanStatus(v); ok('already_used interpreted as amber banner', h.tone === 'warn');
    });
  })
  .then(function () {
    global.window.ddClient = function () { return fakeClient({ error: null, data: { ok: false, reason: 'forged', authentic: false } }); };
    return TS.redeem('TIX:id4:sig4', {}).then(function (v) {
      var h = TS.humanStatus(v); ok('forged path shape → RED do-not-admit', v.authentic === false && h.tone === 'bad' && /FORGED/.test(h.label));
    });
  })
  .then(function () {
    calls.length = 0;
    global.window.ddClient = function () { return fakeClient({ error: null, data: { ok: true, ticket_id: 'NEWID', sig: 'NEWSIG', status: 'valid', paid: false } }); };
    return TS.issue({ event: 'musikfest-2026', paid: false, owner: 'st-a', by: 'st-a' }).then(function (v) {
      ok('issue() returns token built from id+sig', v.ok === true && v.token === 'TIX:NEWID:NEWSIG');
      ok('issue() SENT sf_ticket_issue', calls[0].name === 'sf_ticket_issue');
    });
  })
  .then(function () {
    global.window.ddClient = function () { return fakeThrow(); };
    return TS.redeem('TIX:id5:sig5', {}).then(function (v) {
      ok('redeem() → offline on network throw (never throws, honest)', v.offline === true);
    });
  })
  .then(function () {
    global.window.ddClient = function () { return fakeClient({ error: null, data: [{ kind: 'issue', at: '2026-08-01T18:00:00Z' }] }); };
    return TS.prov('TIX:id6:sig6').then(function (rows) {
      ok('prov() passes server audit rows through', Array.isArray(rows) && rows[0].kind === 'issue');
    });
  });
})
.then(function () {
  console.log('\n dd_ticketsec harness: ' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log(' ❌ FAILURES ABOVE: ' + fails.join('; ')); process.exit(1); }
  else { console.log(' ✅ all green'); }
})
.catch(function (e) { console.log(' ❌ harness threw: ' + (e && e.stack || e)); process.exit(1); });
