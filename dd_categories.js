/* dd_categories.js — the StageFill Categories taxonomy + a user's chosen options.
   THE BOUNDARY (see DESIGN_events_and_suggestions.md): the Grateful Dead world is the
   community and always shows. StageFill is every OTHER kind of night out — a personal
   option a member opts into by category. This module is that opt-in:
     • the category list (the "Categories" sidebar, DeadDance-style)
     • which categories THIS user wants to see (localStorage 'dd.cats' — private, on-device)
     • mapping any act/show to a category, and asking "does the user want this option?"
   Turning a category on is what lets its StageFill options appear in Suggestions and be
   saved to My Calendar. Nothing here ever touches the community calendar or the rollups. */
(function (root) {
  // The categories a member can opt into. Music-first (this is a live-music family), then
  // the rest of the night — comedy, theater, dance, the open mic down the street.
  var CATS = [
    { key: 'live_music',  label: 'Live Music',        icon: '🎸' },
    { key: 'tribute',     label: 'Tribute & Cover',   icon: '🎤' },
    { key: 'dj',          label: 'DJ / Electronic',   icon: '🎧' },
    { key: 'jazz_blues',  label: 'Jazz & Blues',      icon: '🎷' },
    { key: 'country',     label: 'Country & Americana', icon: '🤠' },
    { key: 'acoustic',    label: 'Acoustic & Singer-Songwriter', icon: '🪕' },
    { key: 'comedy',      label: 'Comedy',            icon: '😂' },
    { key: 'theater',     label: 'Theater',           icon: '🎭' },
    { key: 'dance',       label: 'Dance',             icon: '💃' },
    { key: 'open_mic',    label: 'Open Mic',          icon: '🎙️' },
    { key: 'karaoke',     label: 'Karaoke & Trivia',  icon: '🎵' },
    { key: 'festival',    label: 'Festivals',         icon: '🎪' },
    { key: 'family',      label: 'Family',            icon: '🧸' },
    { key: 'arts',        label: 'Visual Arts',       icon: '🎨' }
  ];

  // Map a show/act's genre|style|scene text to one category key.
  function categorize(o) {
    if (!o) return 'live_music';
    var t = ((o.genre || '') + ' ' + (o.style || '') + ' ' + (o.scene || o.type || '') + ' ' + (o.category || '')).toLowerCase();
    if (o.category) { for (var i = 0; i < CATS.length; i++) if (CATS[i].key === o.category) return o.category; }
    if (/comedy|stand-?up|improv/.test(t)) return 'comedy';
    if (/theater|theatre|play|musical|broadway/.test(t)) return 'theater';
    if (/karaoke|trivia|bingo/.test(t)) return 'karaoke';
    if (/open ?mic/.test(t)) return 'open_mic';
    if (/festival|fest\b/.test(t)) return 'festival';
    if (/family|kids|all ?ages/.test(t)) return 'family';
    if (/dance|ballet|salsa|tango/.test(t)) return 'dance';
    if (/art|gallery|paint|visual/.test(t)) return 'arts';
    if (/dj|electronic|edm|house|techno/.test(t)) return 'dj';
    if (/jazz|blues|soul|r&b/.test(t)) return 'jazz_blues';
    if (/country|americana|bluegrass|honky/.test(t)) return 'country';
    if (/acoustic|singer|songwriter|folk/.test(t)) return 'acoustic';
    if (/tribute|cover|top ?40/.test(t)) return 'tribute';
    return 'live_music';
  }

  function labelFor(key) { for (var i = 0; i < CATS.length; i++) if (CATS[i].key === key) return CATS[i].icon + ' ' + CATS[i].label; return 'Live Music'; }

  // The user's chosen options — private, on-device. Empty by default: StageFill is opt-in,
  // so a fresh member sees the pure community until they pick a category to open.
  function get() { try { return JSON.parse(localStorage.getItem('dd.cats') || '[]'); } catch (e) { return []; } }
  function set(arr) { try { localStorage.setItem('dd.cats', JSON.stringify(arr || [])); } catch (e) {} }
  function has(key) { return get().indexOf(key) >= 0; }
  function toggle(key) { var a = get(), i = a.indexOf(key); if (i >= 0) a.splice(i, 1); else a.push(key); set(a); return a; }
  // Does the user want this StageFill option? (Community/GD shows bypass this entirely.)
  function wants(show) { var g = get(); if (!g.length) return false; return g.indexOf(categorize(show)) >= 0; }

  root.DDCats = { list: function () { return CATS.slice(); }, categorize: categorize, labelFor: labelFor,
    get: get, set: set, has: has, toggle: toggle, wants: wants };
})(typeof window !== 'undefined' ? window : this);
