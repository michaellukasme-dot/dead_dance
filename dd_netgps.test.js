/* dd_netgps.test.js — pure-logic tests + a privacy egress guard. Run: node dd_netgps.test.js */
var N = require('./dd_netgps.js');
var pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } }
function eq(a, b, m) { ok(a === b, m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

// ---- tierFromSignals ----
eq(N.tierFromSignals({ onLine: false }).rank, 0, 'offline → T0');
eq(N.tierFromSignals({ onLine: true, wifi: true }).rank, 6, 'wifi → T6');
eq(N.tierFromSignals({ onLine: true, effectiveType: '4g', downlink: 25, rtt: 40 }).rank, 5, 'fast 4g → T5');
eq(N.tierFromSignals({ onLine: true, effectiveType: '4g', downlink: 1 }).rank, 3, 'thin 4g → T3');
eq(N.tierFromSignals({ onLine: true, effectiveType: 'slow-2g' }).rank, 1, 'slow-2g → T1');
eq(N.tierFromSignals({ onLine: true, effectiveType: '2g' }).rank, 2, '2g → T2');
eq(N.tierFromSignals({ onLine: true, effectiveType: '4g', downlink: 25, saveData: true }).rank, 3, 'saveData caps fidelity');
eq(N.tierFromSignals({ onLine: true }).rank, 4, 'unknown-but-online → assume T4');

// ---- samplerPolicy (tier drives policy, motion drives sampling, battery sacred) ----
ok(N.samplerPolicy(6, 'move', 0.05).mode === 'significant' && N.samplerPolicy(6, 'move', 0.05).why === 'battery-critical', 'battery critical → significant');
ok(N.samplerPolicy(6, 'still', 1).gps === false, 'no motion → GPS off (parked)');
eq(N.samplerPolicy(6, 'walk', 1).intervalMs, 2000, 'wifi + moving → densest 2s');
eq(N.samplerPolicy(1, 'walk', 1).intervalMs, 30000, 'no link → coarse 30s');
ok(N.samplerPolicy(6, 'walk', 0.2).intervalMs >= 15000, 'low battery slows cadence');
eq(N.samplerPolicy(6, 'still', 1).mode, 'parked', 'still → parked mode');

// ---- mapProfile (blow the doors off high, degrade low) ----
var hi = N.mapProfile(6), lo = N.mapProfile(0), mid = N.mapProfile(3);
ok(hi.quality === 'max' && hi.live && hi.prefetch && hi.retina, 'T6 → full fidelity');
ok(lo.quality === 'low' && lo.cacheFirst && !lo.live && !lo.prefetch, 'T0 → cache-first, no live/prefetch');
ok(mid.quality === 'med' && !mid.live, 'T3 → med, no live');
ok(hi.maxConcurrent > lo.maxConcurrent, 'high tier allows more concurrent tiles');

// ---- buffer is on-device + coarsens + never throws ----
ok(typeof N.buffer.push({ t: Date.now(), p: [40.6, -75.3], tier: 'T4' }) === 'number', 'buffer.push returns a count, no throw');
ok(N.buffer.peek(1).every(function (r) { return !('id' in r) && !('name' in r); }), 'buffered rows carry NO identity');

// ---- PRIVACY EGRESS GUARD: the module must transmit nothing ----
var src = require('fs').readFileSync(__dirname + '/dd_netgps.js', 'utf8');
var egress = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|\.rpc\s*\(|navigator\.connection\.|axios|\.ajax\(/;
ok(!egress.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'NO network egress in module body (client-only, nothing uploads)');
ok(N._uploads === false, '_uploads flag is false');

console.log('\ndd_netgps: ' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
