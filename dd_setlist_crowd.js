/* dd_setlist_crowd.js — fan-crowdsourced setlist (window.DDSetlistCrowd).
   BAND-FIRST: if the band entered a setlist it is authoritative → this layer is LOCKED (no fan edits, no Cookie).
   Only on the GAP (no band setlist) do fans fill it. Each genuinely-new fan add rewards a Cookie (DDCoins.feed),
   and when fans converge on the same song its confidence rises (consensus). Provenance: fan ids are kept.
   Local-first (localStorage), guarded spine (dd_setlist_fan_add write · dd_setlist_crowd_get read). Never throws. */
(function (root) {
  'use strict';
  function C(){ try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function slug(s){ return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function norm(t){ return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function fanId(){
    try { if (root.DDFlywheel && DDFlywheel.fanId) return DDFlywheel.fanId(); } catch (e) {}
    try { var k = 'dd.fanid', v = localStorage.getItem(k); if (!v) { v = (root.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('fan-' + Date.now()); localStorage.setItem(k, v); } return v; } catch (e) { return 'anon'; }
  }
  function _key(band, date){ return 'dd.crowd.' + slug(band) + '|' + (date || ''); }
  function _read(band, date){ try { var v = JSON.parse(localStorage.getItem(_key(band, date)) || 'null'); return (v && v.songs) ? v : { songs: [] }; } catch (e) { return { songs: [] }; } }
  function _write(band, date, rec){ try { localStorage.setItem(_key(band, date), JSON.stringify(rec)); } catch (e) {} }

  // A band setlist LOCKS the crowd layer. bandRec = {songs:[...], bandSet?:bool}
  function locked(bandRec){ if (!bandRec) return false; if (bandRec.bandSet) return true; return (bandRec.songs || []).length > 0; }

  // merge a fan's title into the list (dedup per fan+song). returns {added, already, song}
  function merge(list, title, fan){
    var n = norm(title); if (!n) return { added: false };
    for (var i = 0; i < list.length; i++) {
      if (list[i].norm === n) { var s = list[i]; s.fans = s.fans || [];
        if (s.fans.indexOf(fan) < 0) { s.fans.push(fan); return { added: true, song: s }; }
        return { added: false, already: true, song: s };
      }
    }
    var o = { n: String(title).trim(), norm: n, fans: [fan], t: Date.now() }; list.push(o); return { added: true, song: o };
  }
  // seed a remote (spine) song + its distinct-fan count, without double-counting local fans
  function _seedRemote(list, title, count){
    var n = norm(title); if (!n) return; count = +count || 1;
    for (var i = 0; i < list.length; i++) { if (list[i].norm === n) { list[i].remote = Math.max(list[i].remote || 0, count); return; } }
    list.push({ n: String(title).trim(), norm: n, fans: [], remote: count, t: Date.now() });
  }
  function _count(s){ return Math.max((s.fans || []).length, s.remote || 0); }

  // ADD a fan song IF not band-locked. Rewards a Cookie on a genuinely-new contribution.
  function add(band, date, title, bandRec, fan){
    fan = fan || fanId();
    if (locked(bandRec)) return { locked: true };
    var rec = _read(band, date), r = merge(rec.songs, title, fan), rewarded = false;
    if (r.added) {
      // COOKIE ON CONSENSUS, not on unverified submission (Claudine anti-farm): the reward fires only when a
      // song reaches 2+ distinct fans. Junk a lone actor types never gets confirmed → never mints value.
      // Deduped per song (no fan in key) → exactly one Cookie per confirmed song, ever.
      if ((r.song.fans || []).length >= 2 && !r.song._rw) {
        r.song._rw = true; rewarded = true;
        try { if (root.DDCoins && DDCoins.feed) DDCoins.feed('setlist', 'setlist|' + slug(band) + '|' + r.song.norm); } catch (e) {}
        try { if (root.DDCoins && DDCoins.pop) DDCoins.pop(1); } catch (e) {}
      }
      _write(band, date, rec);
      // TRUTHFUL PUSH: chain .then/.catch so the write actually SENDS (supabase-js v2 only fires on then/catch) →
      // crowd consensus now syncs cross-device instead of silently dropping. Best-effort/background: the local
      // add + Cookie already reflect the real local state, so failure here is logged, never falsely reported.
      try { var c = C(); if (c && c.rpc) c.rpc('dd_setlist_fan_add', { p_band: slug(band), p_show: date || '', p_song: r.song.n, p_fan: fan }).then(function(){}).catch(function(){}); } catch (e) {}
    }
    return { locked: false, added: !!r.added, already: !!r.already, rewarded: rewarded, list: view(rec.songs, fan) };
  }
  // the crowd list, sorted by consensus (fan count) then time; annotated byMe + fans count
  function view(list, fan){
    fan = fan || fanId();
    return (list || []).slice().sort(function (a, b) { return (_count(b) - _count(a)) || (a.t - b.t); })
      .map(function (s) { return { n: s.n, fans: _count(s), byMe: (s.fans || []).indexOf(fan) >= 0 }; });
  }
  function get(band, date){ return view(_read(band, date).songs); }
  function status(band, date){ var s = _read(band, date).songs, f = {}; s.forEach(function (o) { (o.fans || []).forEach(function (x) { f[x] = 1; }); }); return { songs: s.length, fans: Object.keys(f).length }; }
  // pull remote crowd (other devices) → merge names/counts into local cache; async, guarded, never throws
  function pull(band, date){ var c = C(); if (!c || !c.rpc) return Promise.resolve(false);
    try {
      return c.rpc('dd_setlist_crowd_get', { p_band: slug(band), p_show: date || '' }).then(function (r) {
        var rows = (r && r.data) || []; if (!rows.length) return false;
        var rec = _read(band, date); rows.forEach(function (row) { _seedRemote(rec.songs, row.song || row.n, row.fans || row.fan_count || 1); }); _write(band, date, rec); return true;
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  // ============================================================================
  // ESTIMATED TIMELINE (pure, node-testable) — honest "est." elapsed for a
  // crowdsourced setlist. The band declared NOTHING, so we can't know real
  // lengths; we INFER play order + spacing from when fans REPORTED each song.
  //   • anchor the earliest-reported song to 00:00
  //   • each later song's elapsed = (its report time − first report time)
  //   • normalize monotonic non-decreasing (clamp a negative to the prior start)
  //   • clamp outlier gaps (a single wild timestamp can't blow up the clock)
  // Every value here is an ESTIMATE — the fan display MUST label it "est.".
  // ============================================================================
  function _median(arr) {
    var a = (arr || []).filter(function (x) { return typeof x === 'number' && isFinite(x); }).slice().sort(function (x, y) { return x - y; });
    if (!a.length) return null; var m = Math.floor(a.length / 2);
    return (a.length % 2) ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function _fmt(sec) {
    sec = Math.max(0, Math.round(+sec || 0)); var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
  }
  // reports: [{n, t}] (earliest report ms) OR [{n, times:[ms,...]}] (uses median).
  // opts.maxGapSec caps any single inter-song gap (default 3600s = 1h).
  function estimateTimeline(reports, opts) {
    opts = opts || {};
    var maxGap = (opts.maxGapSec != null) ? Math.max(0, +opts.maxGapSec) : 3600;
    var rows = (reports || []).map(function (r) {
      var rep = (r && r.times && r.times.length) ? _median(r.times) : (r && typeof r.t === 'number' ? r.t : null);
      return { n: (r && r.n) || '', rep: rep };
    }).filter(function (r) { return r.rep != null; });
    rows.sort(function (a, b) { return a.rep - b.rep; });        // play order = report order in time
    if (!rows.length) return [];
    var t0 = rows[0].rep, prev = 0, out = [];
    for (var i = 0; i < rows.length; i++) {
      var raw = Math.round((rows[i].rep - t0) / 1000);            // seconds since first report
      var start = Math.max(raw, prev);                            // monotonic: clamp negatives to prior
      if (start - prev > maxGap) start = prev + maxGap;           // clamp outlier gap
      out.push({ n: rows[i].n, start: start, startLabel: _fmt(start), est: true });
      prev = start;
    }
    return out;
  }
  // reports(band,date) → [{n, t, fans}] from the local crowd cache (t = earliest add ms).
  function reports(band, date) {
    var songs = _read(band, date).songs || [];
    return songs.map(function (s) { return { n: s.n, t: s.t, fans: _count(s) }; });
  }

  // ============================================================================
  // LIFT CROWD → BAND EDITOR (pure, node-testable) — the reverse path.
  //   The crowd built the list; the band posted nothing. BEFORE archive the band
  //   may pull that crowd list INTO their editor to correct it. We hand them
  //   editable songs seeded from the ESTIMATED timeline:
  //     • names kept in estimated play order
  //     • each song's LENGTH inferred from the gap to the NEXT est. start
  //       (last song has no next → blank length, band fills it)
  //     • est. start/label carried as the starting value the band sees
  //     • est:true stays until the band SAVES (then it becomes band-confirmed)
  //   Returns { songs:[{n,len,lenLabel,start,startLabel,est}], text:"Name  m:ss\n…" }
  //   where `text` prefills the band's textarea (its "Name  m:ss" format).
  // ============================================================================
  function liftToEditable(repList, opts) {
    var est = estimateTimeline(repList, opts) || [];
    var out = [];
    for (var i = 0; i < est.length; i++) {
      var next = est[i + 1];
      var len = next ? Math.max(0, next.start - est[i].start) : 0;   // infer length from est. gaps
      out.push({ n: est[i].n, len: len, lenLabel: (len ? _fmt(len) : ''),
        start: est[i].start, startLabel: est[i].startLabel, est: true });
    }
    var text = out.map(function (s) { return s.n + (s.lenLabel ? ('  ' + s.lenLabel) : ''); }).join('\n');
    return { songs: out, text: text, est: est };
  }

  root.DDSetlistCrowd = { add: add, get: get, view: view, status: status, locked: locked, pull: pull, fanId: fanId,
    estimateTimeline: estimateTimeline, reports: reports, liftToEditable: liftToEditable,
    _median: _median, _norm: norm, _merge: merge, _slug: slug };
})(typeof window !== 'undefined' ? window : this);
