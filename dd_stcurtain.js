/* ============================================================================
 * dd_stcurtain.js — the "🤝 Street Team" CURTAIN brain (search / resolve / venue).
 *
 * PURE, testable logic behind the four street-team touch-phone utilities. No DOM,
 * no network — it turns lineup + band data into:
 *   • ticketUrl(act)                → the canonical FREE ticket URL for an act
 *   • buildIndex(bands, lineup)     → a searchable list of ACT / STAGE / MEMBER rows
 *   • search(q, index)              → real substring search over that list
 *   • resolveAct(q, index)          → the act a query resolves to (for the ticket share)
 *   • matchStage / stageCoords      → a lineup stage name → the STAGES coordinate row
 *   • nearestStage(here, stages)    → GPS nearest-stage (haversine), pure
 *   • venue(key) + approvedForPaid  → the %VENUE% config + the paid-door gate
 *
 * HOUSE LAW: this file makes NO server claims. The gate is honest — MusikFest 2026
 * is FREE, so paidSalesApproved:false, and the door utility must say so, not fake a
 * verify. Dual browser/node export so the harness (dd_stcurtain.test.js) can prove it.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  // ---- canonical ticket URL (matches adopt_a_band.html tixUrl / ticket.html?band=) ----
  function ticketUrl(act, base){
    var b = (base == null ? '' : String(base));
    return b + 'ticket.html?band=' + encodeURIComponent(String(act || '')) + '&price=FREE';
  }

  // ---- text normalizing -----------------------------------------------------------
  function norm(s){ return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  // strip the ArtsQuest sponsor prefixes so "Air Products Americaplatz…" matches "Americaplatz"
  function stageCore(s){
    return norm(s)
      .replace(/^(ibew\s*\d+\s*|njm\s*|pnc\s*|guardian life\s*|martin guitar\s*|air products\s*|highmark blue shield\s*|service electric\s*|yuengling\s*|wind creek\s*|frank banko\s*|lutron\s*)/g, '')
      .replace(/\s*@.*$/, '').replace(/\s*\(.*$/, '')
      .replace(/\s+(at|@)\s+.*$/, '')
      .trim();
  }
  // the leading significant token used to bridge short lineup names ↔ long STAGES names
  function keyword(s){ var c = stageCore(s); var w = c.split(' ')[0] || ''; return w; }

  // ---- SEARCH INDEX (acts + stages + band-member names) ---------------------------
  // bands: object keyed by slug → { name, members:[{n,r}] }   (DD_MF_BANDS shape)
  // lineup: array of rows → { b:act, st:stage, sc:'dd'|'sf', d, t }  (DD_MUSIKFEST shape)
  function buildIndex(bands, lineup){
    var out = [], seen = {};
    function add(label, type, act, stage){
      label = String(label == null ? '' : label).trim();
      if (!label) return;
      var k = type + '|' + norm(label) + '|' + norm(act || '');
      if (seen[k]) return; seen[k] = 1;
      out.push({ label: label, type: type, act: act || null, stage: stage || null, n: norm(label) });
    }
    (lineup || []).forEach(function (r){
      if (!r) return;
      if (r.b) add(r.b, 'act', r.b, r.st || null);
      if (r.st) add(r.st, 'stage', null, r.st);
    });
    if (bands) Object.keys(bands).forEach(function (slug){
      var band = bands[slug]; if (!band || !band.name) return;
      add(band.name, 'act', band.name);
      (band.members || []).forEach(function (m){
        var nm = m && (m.n || m.name); if (nm && !/^—/.test(String(nm))) add(nm, 'member', band.name);
      });
    });
    return out;
  }

  // real substring search over the index (case-insensitive), acts first
  function search(query, index, limit){
    var q = norm(query); if (!q) return [];
    var hits = (index || []).filter(function (e){ return e.n.indexOf(q) >= 0; });
    var rank = { act: 0, member: 1, stage: 2 };
    hits.sort(function (a, b){
      var ra = (a.n === q ? -1 : (a.n.indexOf(q) === 0 ? 0 : 1));
      var rb = (b.n === q ? -1 : (b.n.indexOf(q) === 0 ? 0 : 1));
      if (ra !== rb) return ra - rb;
      if (rank[a.type] !== rank[b.type]) return rank[a.type] - rank[b.type];
      return a.n.length - b.n.length;
    });
    return (limit ? hits.slice(0, limit) : hits);
  }

  // the ACT a query resolves to → the ticket to share. Acts + members carry an act;
  // a stage-only hit has no act (its act is time-dependent → resolved by the page).
  function resolveAct(query, index){
    var hits = search(query, index);
    for (var i = 0; i < hits.length; i++){ if (hits[i].act) return hits[i].act; }
    return null;
  }

  // ---- STAGE ↔ COORDS -------------------------------------------------------------
  // stages: array of STAGES rows { n, lat, lng, side, free }
  function matchStage(name, stages){
    if (!name || !stages || !stages.length) return null;
    var q = norm(name), qc = stageCore(name), qk = keyword(name);
    var exact = null, contains = null, tokenHit = null;
    for (var i = 0; i < stages.length; i++){
      var s = stages[i]; if (!s || s.lat == null) continue;
      var sn = norm(s.n), sc = stageCore(s.n), sk = keyword(s.n);
      if (sn === q || sc === qc) { exact = s; break; }
      if (!contains && (sn.indexOf(qc) >= 0 || qc && sc.indexOf(qc) >= 0 || (q && sn.indexOf(q) >= 0))) contains = s;
      if (!tokenHit && qk && qk.length > 3 && sk === qk) tokenHit = s;
    }
    return exact || contains || tokenHit || null;
  }
  function stageCoords(name, stages){
    var s = matchStage(name, stages);
    return s ? { name: s.n, lat: +s.lat, lng: +s.lng } : null;
  }

  // ---- GPS nearest-stage (pure haversine) -----------------------------------------
  function hav(aLat, aLng, bLat, bLng){
    function r(d){ return d * Math.PI / 180; }
    var dLat = r(bLat - aLat), dLng = r(bLng - aLng);
    var s = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(r(aLat))*Math.cos(r(bLat))*Math.sin(dLng/2)*Math.sin(dLng/2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));   // km
  }
  function nearestStage(here, stages){
    if (!here || !stages || !stages.length) return null;
    var best = null, bd = Infinity;
    for (var i = 0; i < stages.length; i++){
      var s = stages[i]; if (!s || s.lat == null) continue;
      var d = hav(here[0], here[1], +s.lat, +s.lng);
      if (d < bd){ bd = d; best = s; }
    }
    return best ? { stage: best, km: bd } : null;
  }

  // ---- PROXIMITY-ACCEPT eligibility (pure) -----------------------------------------
  // The free-event counterpart to paid door-verify: is this fan physically AT the stage,
  // so they may ACCEPT their free ticket? No network, no DOM — just honest geometry.
  //   here   = [lat,lng] (the map's last GPS fix / WALK.last) — null when GPS is off
  //   coords = { lat, lng } of the target stage/venue (from stageCoords)
  //   opts   = { radiusM:100, granted:false }
  // Returns:
  //   no fix     → { ok:false, reason:'no-gps',    eligible:false }   (honest: turn on tracking)
  //   no coords  → { ok:false, reason:'no-coords', eligible:false }
  //   already    → { ok:true,  already:true,  eligible:false, distanceM }   (idempotent)
  //   in range   → { ok:true,  eligible:true,  distanceM, radiusM, reason:'in-range' }
  //   too far    → { ok:true,  eligible:false, distanceM, radiusM, reason:'too-far' }
  function proximity(here, coords, opts){
    opts = opts || {};
    var radiusM = (opts.radiusM > 0) ? opts.radiusM : 100;
    if (!here || here[0] == null || here[1] == null) return { ok:false, reason:'no-gps', eligible:false, radiusM:radiusM };
    if (!coords || coords.lat == null || coords.lng == null) return { ok:false, reason:'no-coords', eligible:false, radiusM:radiusM };
    var distanceM = Math.round(hav(here[0], here[1], +coords.lat, +coords.lng) * 1000);
    if (opts.granted) return { ok:true, already:true, eligible:false, distanceM:distanceM, radiusM:radiusM, reason:'already' };
    var eligible = distanceM <= radiusM;
    return { ok:true, already:false, eligible:eligible, distanceM:distanceM, radiusM:radiusM, reason: eligible ? 'in-range' : 'too-far' };
  }

  // ---- %VENUE% REGISTRY + the paid-door GATE --------------------------------------
  // Every utility-4 door action is gated on paidSalesApproved. For MusikFest 2026 it
  // is FALSE (the festival is free) → utility 4 becomes "hand out FREE tickets", and
  // the honest message shows instead of a fake verify.
  var VENUES = {
    'musikfest-2026': {
      key: 'musikfest-2026', name: 'MusikFest 2026', fest: 'musikfest-2026',
      paidSalesApproved: false,               // free festival → no paid door-verify
      doorSlug: null,                          // no StageFill event slug for the free fest
      eventUrl: 'https://deaddance.app/musikfest',
      freeTicketBand: 'MusikFest 2026',        // the event's free ticket
      mapUrl: 'https://deaddance.app/musikfest'
    },
    // a small single venue — same structure (name + coords + the paid gate)
    'deal-lost-tavern': {
      key: 'deal-lost-tavern', name: 'Deal at Lost Tavern', fest: 'deal-lost-tavern',
      paidSalesApproved: false,                // flips true once approved for ticket sales
      doorSlug: null,
      eventUrl: '', freeTicketBand: 'Deal',
      lat: 40.6259, lng: -75.3705
    }
  };
  function venue(key){ return VENUES[key] || null; }
  function approvedForPaid(v){
    if (!v) return false;
    if (typeof v === 'string') v = venue(v);
    return !!(v && v.paidSalesApproved && v.doorSlug);
  }
  // door.html link ONLY when truly approved+wired; otherwise null (page says so honestly)
  function doorUrl(v, base){
    if (typeof v === 'string') v = venue(v);
    if (!approvedForPaid(v)) return null;
    return (base == null ? '' : String(base)) + 'door.html?ev=' + encodeURIComponent(v.doorSlug);
  }

  var api = {
    ticketUrl: ticketUrl,
    norm: norm, stageCore: stageCore, keyword: keyword,
    buildIndex: buildIndex, search: search, resolveAct: resolveAct,
    matchStage: matchStage, stageCoords: stageCoords,
    hav: hav, nearestStage: nearestStage, proximity: proximity,
    VENUES: VENUES, venue: venue, approvedForPaid: approvedForPaid, doorUrl: doorUrl
  };
  root.DDStCurtain = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
