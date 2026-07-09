/* ============================================================================
 * gd_live.js — LIVE Grateful Dead archive provider for the cassette reader.
 * Pulls the real etree "GratefulDead" collection from the Internet Archive
 * (taping was always band-sanctioned, streams free), so the reader can play
 * EVERY show — not a hand-curated handful.
 *
 *   GDLive.load(cb, onProgress)  → dedupes to one best recording per date,
 *                                  transforms to the reader's show shape,
 *                                  caches to localStorage (7-day TTL).
 *   GDLive.hydrate(show, cb)     → lazily fetches metadata/{id} for that show,
 *                                  builds the MP3 tracklist + a setlist.
 *
 * Honest-state: nothing is faked. A show only plays if the Archive actually
 * carries streamable MP3s; if hydrate finds none, the reader shows its normal
 * "no cleared stream" state. JSON endpoints are CORS-enabled; media <audio>
 * loads cross-origin fine (no CORS needed for playback).
 * v1 · 2026-07-09
 * ========================================================================== */
(function (root) {
  "use strict";
  var IA = "https://archive.org";
  var COLLECTION = "GratefulDead";
  var CACHE_KEY = "gd.live.index.v1";
  var CACHE_TTL = 7 * 24 * 3600 * 1000;   // 7 days
  var PAGE_ROWS = 1000;                    // docs per search page
  var MAX_PAGES = 30;                      // safety cap (~30k recordings scanned)

  function jget(url) {
    return fetch(url, { credentials: "omit" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  /* ---- source label from the identifier (sbd / aud / matrix / fm / betty) ---- */
  function srcFromId(id) {
    var s = String(id || "").toLowerCase();
    if (s.indexOf("matrix") >= 0) return "Matrix";
    if (s.indexOf("sbd") >= 0) return "Soundboard";
    if (s.indexOf("betty") >= 0) return "Soundboard";      // Betty Boards = SBD masters
    if (s.indexOf(".fm") >= 0 || s.indexOf("fm.") >= 0) return "FM";
    if (s.indexOf("aud") >= 0) return "Audience";
    return "Tape";
  }
  function srcRank(id) {   // prefer better sources when deduping a date
    var s = srcFromId(id);
    return s === "Matrix" ? 3 : s === "Soundboard" ? 3 : s === "FM" ? 2 : 1;
  }

  var US_STATES = ("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT " +
    "NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC").split(" ");

  /* ---- one search doc → the reader's show shape (no tracks yet) ---- */
  function toShow(d) {
    var date = String(d.date || "").slice(0, 10);
    var year = +String(d.date || "").slice(0, 4) || d.year || 0;
    var cov = String(d.coverage || "").split(",");
    var city = (cov[0] || "").trim();
    var place = (cov[1] || "").trim();
    var state = "", country = "USA";
    if (place && US_STATES.indexOf(place.toUpperCase()) >= 0) state = place.toUpperCase();
    else if (place) { country = place; state = ""; }        // e.g. "London, England"
    var rating = d.avg_rating != null ? Math.round((+d.avg_rating) * 10) / 10 : 0;
    return {
      id: d.identifier, date: date, year: year,
      venue: d.venue || "", city: city, state: state, country: country,
      band: "Grateful Dead", source: srcFromId(d.identifier), rating: rating,
      sets: [],                 // filled on hydrate
      _needsHydrate: true, _rank: srcRank(d.identifier)
    };
  }

  /* ---- page the whole collection, dedupe to the best recording per date ----
     opts = { query, cacheKey, band } lets the SAME engine load any catalog
     (Grateful Dead by default; Jerry Garcia Band via identifier:jgb*). ---- */
  function load(cb, onProgress, opts) {
    opts = opts || {};
    var QUERY = opts.query || ("collection:" + COLLECTION);
    var CK = opts.cacheKey || CACHE_KEY;
    var BAND = opts.band || "Grateful Dead";
    // serve fresh cache instantly
    try {
      var raw = localStorage.getItem(CK);
      if (raw) {
        var c = JSON.parse(raw);
        if (c && c.t && (Date.now() - c.t) < CACHE_TTL && c.shows && c.shows.length) {
          if (onProgress) onProgress(c.shows.length, c.shows.length, true);
          cb(c.shows); return;
        }
      }
    } catch (e) {}

    var byDate = {};   // date → best show
    var total = 0, scanned = 0, page = 0;
    var fields = "identifier,date,venue,coverage,avg_rating";

    function pageURL(p) {   // page with start= (rows*p); start is always supported
      return IA + "/advancedsearch.php?q=" + encodeURIComponent(QUERY) +
        "&fl=" + fields + "&sort=date+asc&rows=" + PAGE_ROWS + "&start=" + (p * PAGE_ROWS) + "&output=json";
    }
    function keep(show) {
      var k = show.date; if (!k) return;
      var cur = byDate[k];
      if (!cur || show.rating > cur.rating ||
        (show.rating === cur.rating && show._rank > cur._rank)) byDate[k] = show;
    }
    function finish() {
      var shows = Object.keys(byDate).sort().map(function (k) { return byDate[k]; });
      try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), shows: shows })); } catch (e) {}
      cb(shows);
    }
    function step() {
      if (page >= MAX_PAGES) { finish(); return; }
      jget(pageURL(page)).then(function (j) {
        var resp = j.response || {}, docs = resp.docs || [];
        total = resp.numFound || total;
        docs.forEach(function (d) { if (d.identifier && d.date) { var sh = toShow(d); sh.band = BAND; keep(sh); scanned++; } });
        if (onProgress) onProgress(scanned, total, false);
        if (docs.length < PAGE_ROWS || scanned >= total) { finish(); return; }
        page++; step();
      }).catch(function () {
        // network hiccup: use what we have (or fail soft to null so host can seed)
        if (Object.keys(byDate).length) finish(); else cb(null);
      });
    }
    step();
  }

  /* ---- lazy per-show hydrate: metadata/{id} → tracks + setlist ---- */
  var NON_SONG = /^(tuning|crowd|silence|banter|intro|applause|jam tuning)$/i;

  function hydrate(show, cb) {
    if (!show || !show.id) { cb && cb(null); return; }
    if (show.tracks && show.tracks.length) { cb && cb(show); return; }
    jget(IA + "/metadata/" + encodeURIComponent(show.id)).then(function (m) {
      // backfill venue/city from item metadata (JGB items often lack it in search results)
      var md = m.metadata || {};
      if (!show.venue && md.venue) show.venue = md.venue;
      if ((!show.city || !show.state) && md.coverage) { var cov = String(md.coverage).split(","); if (!show.city) show.city = (cov[0] || "").trim(); if (!show.state && cov[1]) show.state = (cov[1] || "").trim(); }
      if (!show.venue && md.title) show.venue = String(md.title).replace(/\s*\d{4}[-/]\d{2}[-/]\d{2}.*$/, "").trim();
      var files = (m.files || []).filter(function (f) { return /mp3/i.test(f.format || ""); });
      // order by filename (…d1t01, d1t02 … d2t01) — natural disc/track order
      files.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), undefined, { numeric: true }); });
      var tracks = files.map(function (f) {
        return { u: IA + "/download/" + encodeURIComponent(show.id) + "/" + encodeURIComponent(f.name),
                 t: (f.title || f.name.replace(/\.mp3$/i, "")) };
      });
      if (!tracks.length) { show._needsHydrate = false; cb && cb(show); return; }  // honest: no stream
      // factual setlist from titles (skip tuning/crowd), de-dupe consecutive repeats
      var songs = [], last = null;
      tracks.forEach(function (t) {
        var name = String(t.t).replace(/\s*\[[^\]]*\]\s*$/, "").trim();
        if (NON_SONG.test(name)) return;
        if (name && name !== last) { songs.push(name); last = name; }
      });
      show.tracks = tracks;
      show.sets = songs.length ? [{ name: "SETLIST", songs: songs }] : [];
      show.nowPlaying = tracks[0].t;
      show._needsHydrate = false;
      cb && cb(show);
    }).catch(function () { cb && cb(null); });
  }

  root.GDLive = { load: load, hydrate: hydrate, COLLECTION: COLLECTION, VERSION: "1" };
})(typeof window !== "undefined" ? window : globalThis);
