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
  // Phase 6 — lock the set as permanent history (server-side). After this, dd_setlist_set is refused.
  function archive(band) {
    var c = C(); if (!c || !band) return Promise.resolve(null);
    return c.rpc('dd_setlist_archive', { p_band_slug: slugify(band) })
      .then(function (r) { return (r && r.data) || null; }).catch(function () { return null; });
  }
  // ============================================================================
  // PURE TIMELINE MATH (no network, no DOM) — the CD/cassette elapsed clock.
  //   A song has a NAME + a LENGTH. Song 1 starts at 00:00; every later song's
  //   elapsed START = cumulative sum of all prior song LENGTHS, plus a BREAK
  //   inserted at each set boundary. This is deterministic and node-testable.
  // ============================================================================

  // parseLen("4:53") → 293 · "1:02:03" → 3723 · 150 → 150 · bad → 0
  function parseLen(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? Math.max(0, Math.round(v)) : 0;
    var s = String(v).trim(); if (!s) return 0;
    if (/^\d+$/.test(s)) return Math.max(0, parseInt(s, 10)); // bare number = seconds
    var p = s.split(':').map(function (x) { return parseInt(x, 10); });
    if (p.some(isNaN)) return 0;
    var sec = 0; for (var i = 0; i < p.length; i++) sec = sec * 60 + p[i];
    return Math.max(0, sec);
  }
  // fmtClock(0)→"00:00" · 293→"04:53" · 3723→"62:03" (mm can exceed 59)
  function fmtClock(sec) {
    sec = Math.max(0, Math.round(+sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
  }
  function _lenSec(song) {
    if (song == null) return 0;
    if (typeof song === 'number' || typeof song === 'string') return parseLen(song);
    if (song.lenSec != null) return parseLen(song.lenSec);
    if (song.len != null) return parseLen(song.len);
    if (song.length != null) return parseLen(song.length);
    return 0;
  }
  // timeline(songs, {breakMin, setBreaks:[i,...], breakSec?}) →
  //   [{...song, start:<sec>, startLabel:"mm:ss"}] with cumulative elapsed starts.
  // setBreaks = song indices that BEGIN a new set (a break is inserted BEFORE them).
  function timeline(songs, opts) {
    songs = Array.isArray(songs) ? songs : [];
    opts = opts || {};
    var breakSec = (opts.breakSec != null) ? Math.max(0, Math.round(+opts.breakSec || 0))
                                           : Math.max(0, Math.round((+opts.breakMin || 0) * 60));
    var brk = {}; (opts.setBreaks || []).forEach(function (i) { brk[+i] = 1; });
    var acc = 0, out = [];
    for (var i = 0; i < songs.length; i++) {
      if (i > 0) { acc += _lenSec(songs[i - 1]); if (brk[i]) acc += breakSec; }
      var s = songs[i];
      var base = (s && typeof s === 'object') ? s : { n: String(s) };
      var o = {}; for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) o[k] = base[k];
      o.start = acc; o.startLabel = fmtClock(acc);
      out.push(o);
    }
    return out;
  }
  // clockAdd("9:00", 293) → "9:04" — a wall-clock H:MM plus elapsed SECONDS (floor to minute).
  function clockAdd(clock, addSec) {
    var m = /(\d{1,2}):(\d{2})/.exec(String(clock || ''));
    if (!m) return '';
    var total = (parseInt(m[1], 10) * 60) + parseInt(m[2], 10) + Math.floor((+addSec || 0) / 60);
    var h = Math.floor(total / 60), mm = ((total % 60) + 60) % 60;
    return h + ':' + (mm < 10 ? '0' + mm : '' + mm);
  }
  // schedule(songs, setStartClock, opts) → timeline songs annotated with teaseAt "H:MM".
  function schedule(songs, setStartClock, opts) {
    var tl = timeline(songs, opts || {});
    if (!setStartClock) return tl;
    return tl.map(function (s) { s.teaseAt = clockAdd(setStartClock, s.start); return s; });
  }

  // ============================================================================
  // COMPLETENESS (pure, node-testable) — the "is this event done?" truth.
  //   A show is COMPLETE only when the BAND has confirmed a real setlist AND the
  //   show is ARCHIVED (closed out / locked). A crowd-estimated list, an
  //   unconfirmed list, or an empty list is NOT complete — even if archived.
  //   Header sentinels ({_h:1,...}) are metadata, not songs.
  //   setlist rec: {songs:[...], archived?:bool, crowdEstimated?:bool}
  // ============================================================================
  function _realSongs(setlist) {
    var songs = (setlist && Array.isArray(setlist.songs)) ? setlist.songs : [];
    return songs.filter(function (s) { return !(s && s._h); });
  }
  // The band has confirmed a real setlist (not still crowd-estimated, not empty).
  function isBandConfirmed(setlist) {
    if (!setlist || typeof setlist !== 'object') return false;
    if (setlist.crowdEstimated === true) return false;   // explicitly still the crowd's estimate
    return _realSongs(setlist).length > 0;
  }
  // COMPLETE = band-confirmed setlist AND archived (closed out). Otherwise not complete.
  function isComplete(setlist) {
    return !!(setlist && setlist.archived && isBandConfirmed(setlist));
  }
  // The band MAY edit the setlist ONLY before archive. Archived → locked forever.
  function canEdit(setlist) { return !(setlist && setlist.archived); }

  root.DDSetlist = { set: set, get: get, now: now, archive: archive, slugify: slugify,
    parseLen: parseLen, fmtClock: fmtClock, timeline: timeline, clockAdd: clockAdd, schedule: schedule,
    isComplete: isComplete, isBandConfirmed: isBandConfirmed, canEdit: canEdit };
})(typeof window !== 'undefined' ? window : this);
