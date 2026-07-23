/* dd_setlist.js — the band's setlist tease (window.DDSetlist).
   The band drops its set (+ optional drip start/interval). If the set is running, now() returns the
   song that's up — computed server-side from the drip; NO client guessing. If the band hasn't set a
   list (or no drip timing), now() resolves null and Owsley's ask simply drops the song slot.
   Degrades to null if the backend (dd_roster_setlist.sql) isn't run yet — never throws. */
(function (root) {
  'use strict';
  function C() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function slugify(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  // songs: array of titles. dripStartISO: ISO string when the set started (or null). dripMin: minutes/song (or null).
  function set(band, songs, dripStartISO, dripMin) {
    var c = C(); if (!c) return Promise.resolve(null);
    return c.rpc('dd_setlist_set', { p_band_slug: slugify(band), p_band_name: band || null,
      p_songs: songs || [], p_drip_start: dripStartISO || null, p_drip_min: dripMin || null })
      .then(function (r) { return (r && r.data) || null; }).catch(function () { return null; });
  }
  function get(band) {
    var c = C(); if (!c || !band) return Promise.resolve(null);
    return c.rpc('dd_setlist_get', { p_band_slug: slugify(band) })
      .then(function (r) { var a = (r && r.data) || []; return a[0] || null; }).catch(function () { return null; });
  }
  function now(band) {
    var c = C(); if (!c || !band) return Promise.resolve(null);
    return c.rpc('dd_setlist_now', { p_band_slug: slugify(band) })
      .then(function (r) { return (r && r.data) || null; }).catch(function () { return null; });
  }
  root.DDSetlist = { set: set, get: get, now: now, slugify: slugify };
})(typeof window !== 'undefined' ? window : this);
