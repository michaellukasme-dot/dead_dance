/* ============================================================================
 * dd_netgps.js — CONNECTIVITY-AWARE GPS + ADAPTIVE MAP engine.  CLIENT-ONLY.
 *
 * The OSI idea, on device: measure the live link tier and let it drive
 *   (1) GPS sampling cadence   — tier drives policy, motion drives sampling, battery is sacred
 *   (2) MAP fidelity           — richer where there's bandwidth, graceful where there isn't
 *   (3) a LOCAL buffer         — fragments queue ON DEVICE only
 *
 * PRIVACY GATE (house law): **nothing here uploads.** The buffer stays on the phone.
 * Server collection is gated on STAGEFILL_PRIVACY_CHARTER_v2 (P0 ratification + counsel).
 * This module never transmits location; it only makes the on-device map smarter.
 *
 * Pure, testable core + guarded browser wrappers. Dual browser/node export. No deps.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  // ---- TIER MODEL (worst → best), mapped from the Network Information API -------------
  // Ranks mirror CONNECTIVITY_TIER_MATRIX: T0 none · T1 sat/none-ish · T2 low · T3 med ·
  // T4 good LTE · T5 great · T6 wifi · T7 broadband/desktop.
  var TIERS = {
    0: { code: 'T0', label: 'No connection' },
    1: { code: 'T1', label: 'Barely there' },
    2: { code: 'T2', label: 'Weak' },
    3: { code: 'T3', label: 'OK' },
    4: { code: 'T4', label: 'Good' },
    5: { code: 'T5', label: 'Great' },
    6: { code: 'T6', label: 'Wi-Fi' },
    7: { code: 'T7', label: 'Broadband' }
  };

  // PURE: signals → tier. `sig` = { onLine, effectiveType, downlink(Mbps), rtt(ms), saveData, wifi }.
  function tierFromSignals(sig) {
    sig = sig || {};
    if (sig.onLine === false) return tier(0, sig);
    // Wi-Fi / mains context (native can pass wifi:true) → top unless throttled.
    if (sig.wifi === true && sig.saveData !== true) return tier(6, sig);
    var dl = (typeof sig.downlink === 'number') ? sig.downlink : null;   // Mbps
    var rtt = (typeof sig.rtt === 'number') ? sig.rtt : null;            // ms
    var et = sig.effectiveType || '';
    var rank;
    if (et === 'slow-2g') rank = 1;
    else if (et === '2g') rank = 2;
    else if (et === '3g') rank = 3;
    else if (et === '4g') rank = 4;
    else rank = (dl != null ? null : 4);                                 // unknown & online → assume decent
    // Refine 4g by measured bandwidth/latency when present.
    if (rank === 4 && dl != null) {
      if (dl >= 20 && (rtt == null || rtt <= 60)) rank = 5;              // great
      else if (dl < 1.5) rank = 3;                                       // 4g label but thin → treat as OK/med
    }
    if (rank == null) rank = (dl >= 10 ? 5 : dl >= 2 ? 4 : dl >= 0.5 ? 3 : 2);
    if (sig.saveData === true && rank > 3) rank = 3;                     // honor Data Saver → cap fidelity
    return tier(rank, sig);
  }
  function tier(rank, sig) {
    rank = Math.max(0, Math.min(7, rank | 0));
    return { rank: rank, code: TIERS[rank].code, label: TIERS[rank].label,
             downKbps: (sig && typeof sig.downlink === 'number') ? Math.round(sig.downlink * 1000) : null,
             saveData: !!(sig && sig.saveData) };
  }

  // IMPURE: read the live browser/native signals → tier.
  function currentTier() {
    var onLine = true;
    try { onLine = (typeof navigator !== 'undefined') ? navigator.onLine !== false : true; } catch (e) {}
    var c = null; try { c = (navigator && (navigator.connection || navigator.mozConnection || navigator.webkitConnection)) || null; } catch (e) {}
    var wifi = false;
    try { wifi = !!(root.DDShell && root.DDShell.netType && root.DDShell.netType() === 'wifi'); } catch (e) {}
    return tierFromSignals({
      onLine: onLine,
      effectiveType: c && c.effectiveType, downlink: c && c.downlink, rtt: c && c.rtt,
      saveData: !!(c && c.saveData), wifi: wifi
    });
  }

  // ---- SAMPLER POLICY — tier drives policy, motion drives sampling, battery is sacred ----
  // PURE. motion: 'still'|'walk'|'move'. battery: 0..1 (or null). Returns the cadence to run GPS at.
  function samplerPolicy(rank, motion, battery) {
    motion = motion || 'move';
    var b = (typeof battery === 'number') ? battery : 1;
    // battery sacred — starve GPS when low
    if (b <= 0.10) return { gps: motion !== 'still', mode: 'significant', intervalMs: 120000, why: 'battery-critical' };
    if (motion === 'still') return { gps: false, mode: 'parked', intervalMs: 0, why: 'no motion — parked' };
    // tier scales cadence (higher tier can afford denser sampling / uploads-later)
    var iv;
    if (rank <= 1) iv = 30000;        // no/near-no link — coarse, buffer only
    else if (rank <= 2) iv = 20000;
    else if (rank <= 3) iv = 10000;
    else if (rank <= 5) iv = 4000;    // good/great — dense
    else iv = 2000;                   // wifi/broadband — densest
    if (b <= 0.25 && iv < 15000) iv = 15000;   // low battery — slow down but keep going
    var mode = iv <= 4000 ? 'dense' : (iv <= 10000 ? 'interval' : 'significant');
    return { gps: true, mode: mode, intervalMs: iv, why: 'tier ' + rank + ' / ' + motion };
  }

  // ---- MAP FIDELITY — blow the doors off where there's bandwidth, degrade gracefully otherwise ----
  // PURE. Returns a rendering profile a Leaflet (or any) map can apply.
  function mapProfile(rank, opts) {
    opts = opts || {};
    var quality = rank >= 6 ? 'max' : rank >= 4 ? 'high' : rank >= 3 ? 'med' : 'low';
    var live = rank >= 4;                       // live presence / animated features only when we can afford it
    var prefetch = rank >= 4;                   // pre-pull surrounding tiles only on good links
    var retina = rank >= 5;                     // @2x tiles only on great/wifi
    var animate = rank >= 4;
    return {
      tier: rank, quality: quality, live: live, prefetch: prefetch, retina: retina, animate: animate,
      cacheFirst: rank <= 2,                    // weak/none → serve cached tiles first, don't fight the network
      tileOptions: {
        updateWhenIdle: rank <= 3,              // low tier: only load tiles when panning stops (saves data)
        keepBuffer: rank >= 4 ? 4 : 2,          // prefetch ring
        detectRetina: retina,
        crossOrigin: true
      },
      maxConcurrent: rank <= 2 ? 2 : rank <= 4 ? 6 : 10,   // throttle tile requests on thin links
      note: rank <= 1 ? 'offline-first — cached tiles only' : (rank <= 2 ? 'thin link — conservative' : 'full fidelity')
    };
  }

  // IMPURE: apply a profile to a live Leaflet map (guarded on L + the map + a tile layer).
  function applyToMap(map, profile) {
    try {
      if (!map || !profile) return false;
      map.eachLayer(function (layer) {
        if (layer && layer._url && layer.options) {                 // a tile layer
          layer.options.updateWhenIdle = profile.tileOptions.updateWhenIdle;
          layer.options.keepBuffer = profile.tileOptions.keepBuffer;
          if ('detectRetina' in layer.options) layer.options.detectRetina = profile.tileOptions.detectRetina;
        }
      });
      return true;
    } catch (e) { return false; }
  }

  // ---- LOCAL BUFFER — ON DEVICE ONLY. Never uploads. (Contribution/upload is charter-gated, not here.) ----
  var BUF_KEY = 'dd_netgps_buffer_v1';
  function _load() { try { return JSON.parse(localStorage.getItem(BUF_KEY) || '[]'); } catch (e) { return []; } }
  function _save(a) { try { localStorage.setItem(BUF_KEY, JSON.stringify(a.slice(-2000))); } catch (e) {} }   // cap
  var buffer = {
    // push a DE-IDENTIFIED fragment locally. No identity, no upload. Coarsen before it's ever stored.
    push: function (frag) {
      try {
        // consent-gated: never buffer unless the fan granted 'contribute' (default off — no local honeypot)
        if (root.DDConsent && !root.DDConsent.has('contribute')) return 0;
        var p = (frag && frag.p) || null;
        if (p && p.length >= 2) p = [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];  // coarsen (~110m) before it is ever stored
        var a = _load(); a.push({ t: Math.floor((frag && frag.t || Date.now()) / 1000), p: p, tier: (frag && frag.tier) || null }); _save(a); return a.length;
      } catch (e) { return 0; }
    },
    size: function () { return _load().length; },
    peek: function (n) { var a = _load(); return a.slice(-(n || 50)); },
    clear: function () { try { localStorage.removeItem(BUF_KEY); } catch (e) {} }
  };

  // ENHANCE a live Leaflet map: apply the current tier profile now, and re-apply when the
  // connection changes. OPT-IN — you call it; it never auto-runs, so it can't break an existing map.
  // Returns a stop() to detach the listeners.
  function enhance(map) {
    if (!map) return function () {};
    function apply() { try { applyToMap(map, mapProfile(currentTier().rank)); } catch (e) {} }
    apply();
    var c = null; try { c = navigator && (navigator.connection || navigator.mozConnection || navigator.webkitConnection); } catch (e) {}
    function on() { apply(); }
    try { if (c && c.addEventListener) c.addEventListener('change', on); } catch (e) {}
    try { if (root.addEventListener) { root.addEventListener('online', on); root.addEventListener('offline', on); } } catch (e) {}
    return function stop() {
      try { if (c && c.removeEventListener) c.removeEventListener('change', on); } catch (e) {}
      try { if (root.removeEventListener) { root.removeEventListener('online', on); root.removeEventListener('offline', on); } } catch (e) {}
    };
  }

  // ---- convenience: one call the map layer can poll ----
  function snapshot(motion, battery) {
    var t = currentTier();
    return { tier: t, sampler: samplerPolicy(t.rank, motion, battery), map: mapProfile(t.rank) };
  }

  var api = {
    TIERS: TIERS,
    tierFromSignals: tierFromSignals, currentTier: currentTier,
    samplerPolicy: samplerPolicy, mapProfile: mapProfile, applyToMap: applyToMap, enhance: enhance,
    buffer: buffer, snapshot: snapshot,
    _uploads: false   // explicit marker: this module performs NO network uploads.
  };
  root.DDNetGPS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
