/* dd_bandagent.js — %BAND_AGENT%, the per-band agent / N+1 member brain (window.DDBandAgent).
   Blank slate per band. Learns roles from behavior (taper, photographers, self-provider, roster),
   gates on BAND CONSENT, and ROUTES a targeted ask to the right PRESENT person — never the crowd by default.
   Twin of the patient's therapist agent: one primitive, a blank agent trained per entity.
   Local-first (localStorage), guarded spine (dd_bandagent_* RPCs). Never throws. */
(function (root) {
  'use strict';
  function C(){ try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function slug(s){ return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function _key(s){ return 'dd.bandagent.' + slug(s); }
  function _blank(s, name){ return { slug: slug(s), name: name || '', consent: { taping: null, photos: null, posts: null },
    selfProvides: { setlist: false, audio: false }, roles: { taper: null, photographers: [] }, roster: [], asks: [] }; }
  function get(s, name){ try { var v = JSON.parse(localStorage.getItem(_key(s)) || 'null'); if (v && v.slug) { if (name && !v.name) v.name = name; return v; } } catch (e) {} return _blank(s, name); }
  function _save(st){ try { localStorage.setItem(_key(st.slug), JSON.stringify(st)); } catch (e) {}
    try { var c = C(); if (c && c.rpc) c.rpc('dd_bandagent_save', { p_band: st.slug, p_state: st }); } catch (e) {} return st; }

  // ---- consent (band-first gate) ----
  function setConsent(s, kind, val){ var st = get(s); if (kind in st.consent) st.consent[kind] = !!val; return _save(st); }
  function consent(s, kind){ return get(s).consent[kind]; }              // null = unknown, true / false

  // ---- learn (from behavior) ----
  function learnRole(s, role, who){ var st = get(s); if (!who) return st;
    if (role === 'taper') st.roles.taper = who;
    else if (role === 'photographer') { if (st.roles.photographers.indexOf(who) < 0) st.roles.photographers.push(who); }
    return _save(st); }
  function learnSelfProvide(s, kind){ var st = get(s); if (kind in st.selfProvides) st.selfProvides[kind] = true; return _save(st); }
  function learnMember(s, name, instrument, memberId){ var st = get(s); var id = memberId || slug(name);
    for (var i = 0; i < st.roster.length; i++) { if (st.roster[i].id === id) { if (instrument) st.roster[i].instrument = instrument; return _save(st); } }
    st.roster.push({ id: id, name: name || '', instrument: instrument || '' }); return _save(st); }
  function memberIds(st){ return st.roster.map(function (m) { return m.id; }); }

  // ---- THE ROUTER: who to ask for a task, given who's present ----
  // task: 'audio' | 'photo' | 'setlist' | 'roster'.  present: array of ids (fans + members) at the show.
  // returns { target:id|null, reason }. null target = DO NOT ASK (self-provided / no consent / nobody).
  function whoToAsk(s, task, present){
    var st = get(s); present = present || [];
    if (task === 'audio' && st.consent.taping !== true) return { target: null, reason: 'no taping consent' };
    if (task === 'photo' && st.consent.photos === false) return { target: null, reason: 'photos declined' };
    if (task === 'audio' && st.selfProvides.audio) return { target: null, reason: 'band self-provides audio' };
    if (task === 'setlist' && st.selfProvides.setlist) return { target: null, reason: 'band self-provides setlist' };
    if (task === 'audio' && st.roles.taper && present.indexOf(st.roles.taper) >= 0) return { target: st.roles.taper, reason: 'known taper present' };
    if (task === 'photo') { for (var i = 0; i < st.roles.photographers.length; i++) { if (present.indexOf(st.roles.photographers[i]) >= 0) return { target: st.roles.photographers[i], reason: 'known photographer present' }; } }
    // crowd fallback — NEVER a performing member (they're on stage); prefer a present fan
    var members = memberIds(st), fans = present.filter(function (id) { return members.indexOf(id) < 0; });
    if (fans.length) return { target: fans[0], reason: 'crowd fallback (present fan)' };
    return { target: null, reason: present.length ? 'only performers present — not asked' : 'nobody present to ask' };
  }

  // ---- ask log (don't re-spam the same task per event) ----
  function askKey(task, ev){ return task + '|' + (ev || ''); }
  function shouldAsk(s, task, ev){ var st = get(s), k = askKey(task, ev); for (var i = 0; i < st.asks.length; i++) { if (st.asks[i].k === k && (st.asks[i].status === 'asked' || st.asks[i].status === 'done')) return false; } return true; }
  function logAsk(s, task, ev, target){ var st = get(s); st.asks.push({ k: askKey(task, ev), task: task, ev: ev || '', target: target || null, status: 'asked', ts: Date.now() });
    if (st.asks.length > 50) st.asks = st.asks.slice(-50);   // bounded log — no unbounded storage growth
    return _save(st); }
  function fulfill(s, task, ev){ var st = get(s), k = askKey(task, ev); st.asks.forEach(function (a) { if (a.k === k) a.status = 'done'; }); return _save(st); }

  // ---- differentiated post spec (data only; rendering delegated to dd_reels / spread_maker) ----
  function composePostSpec(s, ev, contributions){
    var st = get(s); if (st.consent.posts === false) return null; contributions = contributions || {};
    var photos = contributions.photos || [];
    return { band: st.name || st.slug, slug: st.slug, event: ev || '',
      brand: 'theme:' + st.slug, setlist: contributions.setlist || [], roster: st.roster,
      photos: photos, collage: photos.slice(0, 9),
      credits: photos.map(function (p) { return p.by; }).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }),
      consentPosts: st.consent.posts === true };
  }

  root.DDBandAgent = { get: get, setConsent: setConsent, consent: consent, learnRole: learnRole, learnSelfProvide: learnSelfProvide,
    learnMember: learnMember, memberIds: memberIds, whoToAsk: whoToAsk, shouldAsk: shouldAsk, logAsk: logAsk, fulfill: fulfill,
    composePostSpec: composePostSpec, slug: slug };
})(typeof window !== 'undefined' ? window : this);
