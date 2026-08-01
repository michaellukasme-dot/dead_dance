/* ============================================================================
 * dd_festivals.js — the MULTI-FESTIVAL REGISTRY (Option B).
 *
 * One map engine, many festivals. MusikFest, CountryFest, Oktoberfest… all share
 * the SteelStacks/Bethlehem georeferenced footprint, so instead of cloning the map
 * per festival, the host registers each festival's lineup + stages here and picks
 * the ACTIVE one (default: musikfest) — usually from ?fest=<key>. The host then
 * binds its schedule/stages/dates to whatever this returns.
 *
 * SAFETY: with no ?fest param, pick() returns 'musikfest' and resolve('musikfest')
 * hands back the exact MusikFest lineup + ALL stages — so the live map is unchanged.
 *
 * Pure + unit-tested. Guarded telemetry (ids only, NO PII). Dual browser/node.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  var REG = {};
  var ACTIVE = 'musikfest';
  var DEFAULT_KEY = 'musikfest';

  function slug(s){ return String(s==null?'':s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

  // register a festival. spec: {name, lineup:[{d,t,st,b,sc}], stages:[{n,..}]|[name], dates:[], title, cover}
  function register(key, spec){
    key = slug(key); if(!key) return null; spec = spec || {};
    var lineup = Array.isArray(spec.lineup) ? spec.lineup : [];
    var stageNames = (spec.stages || []).map(function(s){ return typeof s === 'string' ? s : (s && s.n); }).filter(Boolean);
    var dates = (spec.dates && spec.dates.length) ? spec.dates.slice()
              : Array.from(new Set(lineup.map(function(r){ return r && r.d; }).filter(Boolean))).sort();
    REG[key] = {
      key: key, name: spec.name || key, title: spec.title || spec.name || key,
      lineup: lineup, stageNames: stageNames, dates: dates,
      cover: (spec.cover != null ? spec.cover : null),
      all: !stageNames.length         // no stage list = use ALL the host's stages (that's MusikFest)
    };
    return REG[key];
  }

  function has(key){ return !!REG[slug(key)]; }
  function get(key){ return REG[slug(key)] || null; }
  function keys(){ return Object.keys(REG); }
  function count(){ return keys().length; }
  function list(){ return keys().map(function(k){ return { key:k, name:REG[k].name, dates:REG[k].dates }; }); }

  // choose a festival from a URL/search string; DEFAULT when missing or unknown (safe)
  function pick(search){
    var m = String(search == null ? '' : search).match(/[?&]fest=([^&#]+)/);
    var k = m ? slug(decodeURIComponent(m[1])) : '';
    return (k && REG[k]) ? k : DEFAULT_KEY;
  }

  function setActive(key){ key = slug(key); if (REG[key]) { ACTIVE = key; emit('switch', { key:key }); return key; } return ACTIVE; }
  function active(){ return ACTIVE; }
  function resolve(key){ return get(key || ACTIVE); }

  // filter a host's full STAGES array to the active festival's stages by NORMALIZED EXACT name.
  // (Exact, not substring — "Americaplatz" must NOT leak into "…Americaplatz at Levitt Pavilion".)
  // A festival with no stageNames (musikfest) → returns ALL stages unchanged. Unknown key → ALL (safe).
  function nrm(s){ return String(s == null ? '' : s).toLowerCase().replace(/\s+/g,' ').trim(); }
  function stageFilter(allStages, key){
    var f = get(key || ACTIVE);
    if (!f || f.all) return (allStages || []).slice();
    var want = {}; f.stageNames.forEach(function(n){ var k = nrm(n); if (k) want[k] = 1; });
    return (allStages || []).filter(function(s){ return !!want[nrm(s && s.n)]; });
  }

  function emit(evt, p){ p = p || {};
    try{ if (root.DDTele && typeof root.DDTele.event === 'function'){ root.DDTele.event('festivals.'+evt, p); return; }
      if (typeof root.ddEvent === 'function'){ root.ddEvent('festivals.'+evt, p); } }catch(e){} }

  var api = { register:register, has:has, get:get, keys:keys, count:count, list:list,
              pick:pick, setActive:setActive, active:active, resolve:resolve, stageFilter:stageFilter,
              slug:slug, DEFAULT_KEY:DEFAULT_KEY, _reg:REG,
              _reset:function(){ REG={}; ACTIVE=DEFAULT_KEY; } };
  root.ddFestivals = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
