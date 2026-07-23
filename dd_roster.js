/* dd_roster.js — a band IS a roster (window.DDRoster).
   A band group's members (DD friends) + the instrument each plays. One person can sit in many
   rosters. Owsley's ask names a real member on a real instrument — only from what the band entered.
   Degrades to [] / null if the backend (dd_roster_setlist.sql) isn't run yet — never throws. */
(function (root) {
  'use strict';
  function C() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function slugify(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  function forBand(band) {
    var c = C(); if (!c || !band) return Promise.resolve([]);
    return c.rpc('dd_roster_list', { p_band_slug: slugify(band) })
      .then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }
  // kind: 'play' (musician) | 'crew' (sound/lighting/camera/manager). Default 'play'.
  function add(band, name, instrument, kind, memberId, sort) {
    var c = C(); if (!c) return Promise.resolve(null);
    return c.rpc('dd_roster_add', { p_band_slug: slugify(band), p_band_name: band || null,
      p_member_name: name || null, p_instrument: instrument || null, p_kind: kind || 'play',
      p_member_id: memberId || null, p_sort: sort || 0 })
      .then(function (r) { return (r && r.data) || null; }).catch(function () { return null; });
  }
  function remove(id) {
    var c = C(); if (!c || !id) return Promise.resolve(false);
    return c.rpc('dd_roster_remove', { p_id: id }).then(function () { return true; }).catch(function () { return false; });
  }
  // one PERFORMER (name + instrument) for the mid-solo ask — never the crew; random so it rotates. null if no players.
  function pick(band) {
    return forBand(band).then(function (rows) {
      var players = (rows || []).filter(function (r) { return (r.kind || 'play') === 'play'; });
      if (!players.length) return null;
      var m = players[Math.floor(Math.random() * players.length)];
      return { name: m.member_name, instrument: m.instrument || '' };
    });
  }
  root.DDRoster = { forBand: forBand, add: add, remove: remove, pick: pick, slugify: slugify };
})(typeof window !== 'undefined' ? window : this);
