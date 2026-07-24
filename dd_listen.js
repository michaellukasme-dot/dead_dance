/* dd_listen.js — the "Listen" pill. Signed-in only. One click pops a toast that
   auto-plays a RANDOM track from the live Grateful Dead archive (archive.org, the
   same free etree streams the cassette reader uses). Double-click the play button
   = next random track. One at a time. Nothing faked — real shows, real audio.

   These are the archive.org tracks that used to live in the Dealer / GD Archive tab. */
(function (w) {
  "use strict";
  var IA = "https://archive.org";

  // the "Every Show" set — famous shows, matched to real archive dates + a song to prefer.
  // If a date/recording misses, we just reroll to another — the toast always names what actually plays.
  var SHOWS = [
    { label: "Cornell '77 — Scarlet › Fire",       date: "1977-05-08", song: "scarlet" },
    { label: "Barton Hall '77 — Morning Dew",       date: "1977-05-08", song: "morning dew" },
    { label: "Veneta 8/27/72 — Dark Star",          date: "1972-08-27", song: "dark star" },
    { label: "Fillmore West 2/27/69 — The Eleven",  date: "1969-02-27", song: "eleven" },
    { label: "JFK Stadium '89 — Eyes of the World", date: "1989-07-07", song: "eyes of the world" },
    { label: "Hampton '89 — Help › Slip › Franklin's", date: "1989-10-09", song: "help on the way" },
    { label: "Winterland '74 — Playing in the Band",date: "1974-10-18", song: "playing in the band" },
    { label: "Europe '72 — China › Rider",          date: "1972-05-03", song: "china cat" }
  ];
  var NON_SONG = /tuning|crowd|silence|banter|intro|applause|dead air|star spangled|take a step/i;

  var idCache = {};          // date -> best identifier
  var audio = null, curLabel = "", loading = false;

  function signedIn() { try { return !!(w.DDMe && DDMe.signedIn && DDMe.signedIn()); } catch (e) { return false; } }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function jget(u) { return fetch(u, { credentials: "omit" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }); }

  function srcRank(id) { id = String(id || "").toLowerCase();
    if (id.indexOf("matrix") >= 0 || id.indexOf("sbd") >= 0 || id.indexOf("betty") >= 0) return 3;
    if (id.indexOf(".fm") >= 0) return 2; if (id.indexOf("aud") >= 0) return 1; return 1; }

  function resolveId(date) {
    if (idCache[date]) return Promise.resolve(idCache[date]);
    var q = "collection:GratefulDead AND date:" + date;
    var u = IA + "/advancedsearch.php?q=" + encodeURIComponent(q) + "&fl=identifier,avg_rating&rows=40&output=json";
    return jget(u).then(function (j) {
      var docs = ((j.response || {}).docs) || [];
      if (!docs.length) throw new Error("no docs");
      docs.sort(function (a, b) { return srcRank(b.identifier) - srcRank(a.identifier) || ((b.avg_rating || 0) - (a.avg_rating || 0)); });
      idCache[date] = docs[0].identifier; return idCache[date];
    });
  }
  function trackURL(id, song) {
    return jget(IA + "/metadata/" + encodeURIComponent(id)).then(function (m) {
      var files = (m.files || []).filter(function (f) { return /mp3/i.test(f.format || "") || /\.mp3$/i.test(f.name || ""); });
      files.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), undefined, { numeric: true }); });
      var songs = files.filter(function (f) { return !NON_SONG.test(String(f.title || f.name)); });
      if (!songs.length) songs = files;
      if (!songs.length) throw new Error("no mp3");
      var pick = null;
      if (song) pick = songs.filter(function (f) { return String(f.title || f.name).toLowerCase().indexOf(song) >= 0; })[0];
      if (!pick) pick = songs[Math.floor(Math.random() * songs.length)];
      return { url: IA + "/download/" + encodeURIComponent(id) + "/" + encodeURIComponent(pick.name),
               title: String(pick.title || pick.name.replace(/\.mp3$/i, "")) };
    });
  }

  function ensureAudio() {
    if (!audio) {
      audio = new Audio(); audio.preload = "auto";
      audio.addEventListener("playing", paint); audio.addEventListener("pause", paint); audio.addEventListener("ended", next);
    }
    return audio;
  }

  // pick a random show and play a track; reroll on any miss (bad date / no stream)
  function play(tries) {
    tries = tries || 0; if (tries > SHOWS.length) { setLoading(false); setLabel("Couldn’t reach the Archive — tap ▶ to retry", true); return; }
    var s = SHOWS[Math.floor(Math.random() * SHOWS.length)];
    setLoading(true); openToast();
    resolveId(s.date).then(function (id) { return trackURL(id, s.song); }).then(function (tk) {
      curLabel = s.label + " · " + tk.title;
      var a = ensureAudio(); a.src = tk.url;
      var p = a.play(); if (p && p.catch) p.catch(function () { paint(); });   // autoplay may need a tap on mobile
      setLoading(false); setLabel(curLabel, false); paint();
    }).catch(function () { play(tries + 1); });
  }
  function next() { if (loading) return; play(); }           // double-click ▶ → next random
  function toggle() { var a = ensureAudio(); if (a.paused) { if (!a.src) { play(); return; } a.play().catch(function () {}); } else a.pause(); }
  function stop() { try { if (audio) { audio.pause(); } } catch (e) {} closeToast(); }

  // ---- UI ----
  function css() {
    if (document.getElementById("ddl-css")) return;
    var s = document.createElement("style"); s.id = "ddl-css"; s.textContent =
      ".ddl-pill{position:fixed;left:14px;bottom:74px;z-index:9996;display:inline-flex;align-items:center;gap:7px;background:#241634;color:#fff;" +
      "border:0;border-radius:999px;padding:9px 15px;font:800 13px/1 -apple-system,Segoe UI,Roboto,sans-serif;cursor:pointer;box-shadow:0 8px 22px rgba(20,10,40,.4)}" +
      ".ddl-pill:active{transform:scale(.96)}.ddl-pill .n{font-size:15px}" +
      "@media(max-width:560px){.ddl-pill{bottom:70px}}" +
      ".ddl-toast{position:fixed;left:14px;bottom:120px;z-index:9997;display:none;align-items:center;gap:11px;background:#fff;color:#1a1320;" +
      "border-radius:14px;padding:9px 12px 9px 9px;box-shadow:0 14px 40px rgba(20,10,40,.34);max-width:min(360px,92vw);font:13px/1.3 -apple-system,Segoe UI,Roboto,sans-serif}" +
      ".ddl-toast.on{display:flex}" +
      ".ddl-btn{flex:none;width:40px;height:40px;border-radius:50%;border:0;background:linear-gradient(135deg,#7a3cc0,#b8002e);color:#fff;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
      ".ddl-btn:active{transform:scale(.94)}" +
      ".ddl-meta{flex:1;min-width:0}.ddl-meta b{display:block;font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".ddl-meta span{font-size:11px;color:#8a7fa0}" +
      ".ddl-x{flex:none;border:0;background:#f0ecf6;color:#6a5f86;width:26px;height:26px;border-radius:50%;font-size:14px;cursor:pointer}" +
      ".ddl-spin{display:inline-block;width:15px;height:15px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:ddlspin .7s linear infinite}" +
      "@keyframes ddlspin{to{transform:rotate(360deg)}}";
    document.head.appendChild(s);
  }
  var pillEl = null, toastEl = null, clickT = null;
  function mountPill() {
    if (pillEl || !signedIn()) return; css();
    pillEl = document.createElement("button"); pillEl.className = "ddl-pill"; pillEl.type = "button";
    pillEl.innerHTML = '<span class="n">🎵</span> Listen';
    pillEl.title = "Play a random show from the Archive";
    pillEl.addEventListener("click", function () { openToast(); if (audio && audio.src && !audio.paused) { /* already playing */ } play(); });
    document.body.appendChild(pillEl);
  }
  function buildToast() {
    if (toastEl) return; css();
    toastEl = document.createElement("div"); toastEl.className = "ddl-toast";
    toastEl.innerHTML =
      '<button class="ddl-btn" id="ddl-btn" title="Play / pause · double-click for the next random track"><span class="ddl-spin"></span></button>' +
      '<div class="ddl-meta"><b id="ddl-title">Finding a show…</b><span>Grateful Dead · Internet Archive · double-click ▶ for another</span></div>' +
      '<button class="ddl-x" title="Stop">✕</button>';
    document.body.appendChild(toastEl);
    var btn = toastEl.querySelector("#ddl-btn");
    // single click = play/pause, double click = next random
    btn.addEventListener("click", function () { if (clickT) { clearTimeout(clickT); clickT = null; next(); return; } clickT = setTimeout(function () { clickT = null; toggle(); }, 240); });
    toastEl.querySelector(".ddl-x").addEventListener("click", stop);
  }
  function openToast() { buildToast(); toastEl.classList.add("on"); }
  function closeToast() { if (toastEl) toastEl.classList.remove("on"); }
  function setLoading(on) { loading = on; paint(); }
  function setLabel(t, err) { buildToast(); var el = toastEl.querySelector("#ddl-title"); if (el) el.textContent = t; }
  function paint() {
    if (!toastEl) return; var btn = toastEl.querySelector("#ddl-btn"); if (!btn) return;
    if (loading) { btn.innerHTML = '<span class="ddl-spin"></span>'; return; }
    var playing = audio && audio.src && !audio.paused;
    btn.textContent = playing ? "❚❚" : "▶";
  }

  w.DDListen = { play: play, next: next, toggle: toggle, stop: stop, open: function () { openToast(); play(); } };

  function boot() { if (signedIn()) mountPill(); }
  if (document.readyState !== "loading") boot(); else document.addEventListener("DOMContentLoaded", boot);
  try { if (w.DDMe && DDMe.onChange) DDMe.onChange(function () { if (signedIn()) mountPill(); else if (pillEl) { pillEl.remove(); pillEl = null; } }); } catch (e) {}
})(window);
