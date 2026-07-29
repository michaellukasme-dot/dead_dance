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
    var rec = _read(band, date), r = merge(rec.songs, title, fan);
    if (r.added) {
      _write(band, date, rec);
      try { if (root.DDCoins && DDCoins.feed) DDCoins.feed('setlist', 'setlist|' + slug(band) + '|' + r.song.norm + '|' + fan); } catch (e) {}
      try { if (root.DDCoins && DDCoins.pop) DDCoins.pop(1); } catch (e) {}
      try { var c = C(); if (c && c.rpc) c.rpc('dd_setlist_fan_add', { p_band: slug(band), p_show: date || '', p_song: r.song.n, p_fan: fan }); } catch (e) {}
    }
    return { locked: false, added: !!r.added, already: !!r.already, list: view(rec.songs, fan) };
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

  root.DDSetlistCrowd = { add: add, get: get, view: view, status: status, locked: locked, pull: pull, fanId: fanId, _norm: norm, _merge: merge, _slug: slug };
})(typeof window !== 'undefined' ? window : this);
