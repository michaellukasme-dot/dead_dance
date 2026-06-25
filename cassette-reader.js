/* ============================================================================
 * cassette-reader — the CONTENT-READER archetype (the_reader's "cassette = card").
 * No scroll. Pills filter; the tape IS the card; ◀ ▶ walk the filtered set; it plays.
 * Setlist + Lyrics open SIMPLE TOASTS. Lyrics text is served by a LICENSED provider
 * (LyricFind/Musixmatch) — this component never stores/reproduces lyrics. REC = points.
 * Uses market-core for events (gamification + ratings). v0.1 · 2026-06-22
 * ========================================================================== */
(function (root) {
  "use strict";
  var MC = root.MarketCore;

  var CSS =
  /* Defaults = the GD archive's native parchment/tie-dye skin (a deliberate content-reader
   * identity, not a leak). A host may override any of these via cfg.theme so the cassette
   * wears the host's world (e.g. dead_dance parchment, or AA's palette). Applied per instance. */
  ".cz{--cz-font:Georgia,'Iowan Old Style',serif;--ink:#1a1207;--paper:#f4ead6;--green:#2c4327;--gold:#c8932f;--rust:#9a3b1b;--blue:#5aa9d6;--line:#d8c8a6;font-family:var(--cz-font);background:var(--paper);color:var(--ink);min-height:100%;display:flex;flex-direction:column}" +
  ".cz *{box-sizing:border-box}" +
  ".cz-h{background:var(--ink);color:var(--paper);padding:12px 16px;display:flex;align-items:center;gap:12px}.cz-h .bolt{color:var(--gold)}.cz-h h1{font-size:18px;margin:0;letter-spacing:.04em}.cz-h .sub{font-size:.66rem;opacity:.8;letter-spacing:.16em;text-transform:uppercase}.cz-logo{width:42px;height:42px;border-radius:50%;flex:none;object-fit:cover;box-shadow:0 0 0 2px #f4ead555}" +
  ".cz-bar{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;padding:10px 16px;background:#fff8;border-bottom:1px solid var(--line)}.cz-cnt{font-size:.8rem;color:var(--rust);font-style:italic;margin-right:6px}.cz-fl{font-size:.72rem;color:var(--rust);font-weight:700;text-transform:uppercase;letter-spacing:.08em}" +
  ".cz-pill{background:#fff;border:1.5px solid var(--green);color:var(--green);border-radius:999px;padding:6px 12px;font:600 12.5px Georgia,serif;cursor:pointer;white-space:nowrap}.cz-pill:hover{background:#f0ead6}.cz-pill.on{background:var(--green);color:#fff}.cz-pill.dream{border-color:var(--rust);color:var(--rust)}" +
  ".cz-stage{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px}" +
  ".cz-arrow{flex:none;width:0;height:0;border-top:26px solid transparent;border-bottom:26px solid transparent;cursor:pointer;opacity:.85}.cz-arrow:hover{opacity:1}.cz-arrow.l{border-right:34px solid var(--blue)}.cz-arrow.r{border-left:34px solid var(--blue)}.cz-arrow.off{opacity:.2;cursor:default}" +
  ".cz-tape{flex:0 0 auto;width:min(560px,calc(100vw - 110px));min-height:336px;background:var(--green);border-radius:16px;padding:18px;color:#f4ead6;box-shadow:inset 0 0 0 4px #00000022,0 6px 22px #0003;position:relative}" +
  ".cz-tape .scr{position:absolute;top:14px;left:18px;right:18px;display:flex;justify-content:space-between;align-items:flex-start}.cz-rec{background:#f4ead6;color:var(--rust);border-radius:999px;padding:3px 9px;font:700 11px Georgia;display:inline-flex;gap:5px;align-items:center}.cz-rec .dot{width:8px;height:8px;border-radius:50%;background:var(--rust)}" +
  ".cz-side{font-size:30px;font-style:italic;color:#f4ead6cc;text-align:right;line-height:1}.cz-side small{display:block;font-size:10px;letter-spacing:.2em;font-style:normal}" +
  /* handwritten mixtape label — truncates with an ellipsis, never a hard clip */
  ".cz-label{font-family:'Bradley Hand','Segoe Script','Snell Roundhand','Comic Sans MS',cursive;font-size:20px;line-height:1.15;color:#f4ead6;margin:40px 14px 0;padding-bottom:3px;border-bottom:1.5px solid #f4ead655;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72%}" +
  ".cz-win{background:#f4ead6;color:var(--ink);border-radius:8px;margin:10px 8px 12px;padding:14px;text-align:center;border-top:7px solid var(--gold);overflow-wrap:anywhere;word-break:break-word}.cz-win .dt{font-size:18px;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cz-win .dt b{color:var(--rust)}.cz-win .vn{font-size:13px;margin-top:2px}.cz-win .bd{font-style:italic;font-size:12px;color:#6b5a3a;margin-top:2px}" +
  /* orange tape-grade chip (the cassette's brand/grade tab) + bottom row */
  ".cz-tapebot{display:flex;align-items:center;gap:10px;margin-top:10px;padding:0 2px}.cz-grade{flex:none;background:var(--gold);color:#1a1207;font:800 11px Georgia;border-radius:4px;padding:4px 10px;letter-spacing:.1em;box-shadow:0 1px 0 #0003}" +
  ".cz-reels{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:10px}.cz-reel{width:40px;height:40px;border-radius:50%;border:3px solid #f4ead6;display:flex;align-items:center;justify-content:center;color:#f4ead6}.cz-reel:after{content:'✸';font-size:20px}.cz-counter{background:#1a1207;color:var(--gold);font:700 15px 'Courier New',monospace;border-radius:5px;padding:4px 10px;letter-spacing:2px}@keyframes czspin{to{transform:rotate(360deg)}}.cz-reel.spin{animation:czspin 1.5s linear infinite}" +
  ".cz-np{margin-top:10px;text-align:center;font-size:12.5px;color:#f4ead6cc}.cz-np b{color:#fff}.cz-tapebot .cz-np{margin-top:0;flex:1;min-width:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
  ".cz-player{display:flex;align-items:center;gap:14px;justify-content:center;background:#141414;border-radius:14px;max-width:480px;margin:0 auto 8px;padding:12px 16px;color:#fff}.cz-player button{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}.cz-player .cz-play{width:46px;height:46px;border-radius:50%;background:#fff;color:#141414;font-size:20px;box-shadow:0 2px 8px #0006;display:flex;align-items:center;justify-content:center}.cz-seek{flex:1;height:4px;background:#ffffff44;border-radius:2px;position:relative}.cz-seek i{position:absolute;left:60%;top:-4px;width:12px;height:12px;border-radius:50%;background:#fff}" +
  ".cz-recbtn{display:block;margin:0 auto 10px;background:#fff;border:2px solid var(--rust);color:var(--rust);border-radius:999px;padding:9px 22px;font:800 15px Georgia;cursor:pointer;display:flex;gap:8px;align-items:center}.cz-recbtn .dot{width:13px;height:13px;border-radius:50%;background:var(--rust)}" +
  ".cz-buy{display:flex;gap:8px;align-items:center;justify-content:center;margin:2px auto 12px;background:var(--rust);color:#fff;border:0;border-radius:999px;padding:13px 34px;font:800 16.5px Georgia;cursor:pointer;box-shadow:0 4px 14px rgba(154,59,27,.35)}.cz-buy:hover{filter:brightness(1.08)}" +
  ".cz-showrow{display:flex;gap:8px;justify-content:center;margin:0 auto 10px;max-width:480px}.cz-mode{flex:1;background:#fff;border:1.5px solid var(--rust);color:var(--rust);border-radius:999px;padding:9px 12px;font:700 13px Georgia;cursor:pointer}.cz-mode:hover{background:#fbe7e2}.cz-mode.on{background:var(--rust);color:#fff}.cz-heard{background:var(--gold);color:#1a1207;border-radius:4px;padding:2px 7px;font:800 9.5px Georgia;letter-spacing:.05em;margin-left:6px}" +
  ".cz-licbar{background:#fff;border-bottom:1px solid var(--line);padding:9px 16px;text-align:center;font-size:12px;color:var(--rust);line-height:1.5}.cz-licbar b{color:var(--ink)}" +
  ".cz-sets{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:6px 0}.cz-set{background:#fff;border:1px solid var(--rust);color:var(--rust);border-radius:999px;padding:6px 16px;font:600 12.5px Georgia;cursor:pointer}.cz-set:hover{background:#fbe7e2}.cz-set.lyr{border-color:var(--gold);color:#8a5a0a}" +
  ".cz-notes{max-width:620px;margin:6px auto 0;padding:10px 14px;background:#fff8;border:1px solid var(--line);border-radius:8px;font-size:12.5px;color:#5a4a2a;line-height:1.5}" +
  ".cz-foot{padding:10px 16px 22px;font-size:11px;color:#8a7a55;text-align:center}" +
  /* toasts + panels */
  ".cz-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#1a1207;color:#f4ead6;border-radius:12px;padding:14px 18px;max-width:88%;width:420px;box-shadow:0 8px 30px #0005;z-index:60}.cz-toast h4{margin:0 0 6px;color:var(--gold);font-size:14px}.cz-toast ol{margin:0;padding-left:20px;font-size:13px;line-height:1.6}.cz-toast .lic{font-size:10.5px;color:#c8932f;margin-top:8px;font-style:italic}.cz-toast .x{position:absolute;top:8px;right:12px;cursor:pointer;opacity:.7}" +
  ".cz-pop{position:fixed;z-index:55;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 26px #0003;padding:12px;width:300px;max-width:calc(100vw - 16px);max-height:340px;overflow:auto}.cz-pop h4{margin:0 0 8px;font-size:13px;color:var(--green)}.cz-pop label{display:block;font-size:13px;padding:4px 2px;cursor:pointer}.cz-pop input[type=text]{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;font:14px Georgia}.cz-pop .opt{display:inline-block;background:#f0ead6;border-radius:8px;padding:6px 10px;margin:3px;font-size:12.5px;cursor:pointer}.cz-pop .opt:hover{background:var(--green);color:#fff}.cz-pop .opt.dim{opacity:.4}";

  function inject() { if (document.getElementById("cz-css")) return; var s = document.createElement("style"); s.id = "cz-css"; s.textContent = CSS; document.head.appendChild(s); }
  /* host theme tokens → the cassette's CSS vars (applied inline per instance) */
  var TMAP = { font: "--cz-font", ink: "--ink", paper: "--paper", tape: "--green", gold: "--gold", rust: "--rust", blue: "--blue", line: "--line" };
  function applyTheme(el, th) { if (!th) return; Object.keys(TMAP).forEach(function (k) { if (th[k] != null) el.style.setProperty(TMAP[k], th[k]); }); }
  function esc(x){return String(x==null?"":x);}
  function todayMD(){var d=new Date();return ("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);}
  /* recording source → the cassette's grade tab (skeuomorphic + informative) */
  function grade(src){var s=esc(src).toLowerCase();if(s.indexOf("matrix")>=0)return "MTX";if(s.indexOf("sound")>=0||s==="sbd")return "SBD";if(s.indexOf("aud")>=0)return "AUD";if(s.indexOf("fm")>=0)return "FM";return (esc(src||"TAPE").toUpperCase().replace(/[^A-Z]/g,"").slice(0,3))||"TAPE";}

  function mount(rootEl, cfg) {
    inject();
    var shows = cfg.shows || [], acct = cfg.account || { id: "head", region: "US" };
    var F = { years: [], place: null, song: "", venue: "", dream: null };
    var idx = 0, playing = false, pts = ptsLoad(), curTrack = 0, openKey = null;
    function ptsLoad(){try{return +localStorage.getItem("cz.pts")||0;}catch(e){return 0;}}
    function ptsSave(){try{localStorage.setItem("cz.pts",pts);}catch(e){}}
    /* show-mode = play the whole show continuously, no track breaks (like the concert). Per-track stays too. */
    var showMode = false;
    function listenedKey(){return "cz.listened."+(cfg.marketId||"gd");}
    var listened=(function(){try{return JSON.parse(localStorage.getItem(listenedKey()))||{};}catch(e){return {};}})();
    function markListened(id){if(id&&!listened[id]){listened[id]=Date.now();try{localStorage.setItem(listenedKey(),JSON.stringify(listened));}catch(e){}}}

    function filtered() {
      return shows.filter(function (s) {
        if (F.years.length && F.years.indexOf(s.year) < 0) return false;
        if (F.place && (s.state !== F.place && s.country !== F.place)) return false;
        if (F.venue && esc(s.venue).toLowerCase().indexOf(F.venue.toLowerCase()) < 0) return false;
        if (F.song) { var hit = (s.sets || []).some(function (st) { return (st.songs || []).some(function (g) { return g.toLowerCase().indexOf(F.song.toLowerCase()) >= 0; }); }); if (!hit) return false; }
        if (F.dream === "onthisday") { if (esc(s.date).slice(5) !== todayMD()) return false; }
        if (F.dream === "vaultheat") { if ((s.rating || 0) < 4.7) return false; }
        if (F.dream === "segue") { var seg = s.segues === true || (s.sets || []).some(function (st) { return (st.songs || []).some(function (g) { return /->|>|→/.test(g); }); }); if (!seg) return false; }
        return true;
      });
    }
    var view = shows.slice();
    function apply() { view = filtered(); if (F.dream === "surprise" && view.length) view = [view[Math.floor(Math.random() * view.length)]]; if (idx >= view.length) idx = 0; curTrack = (view[idx] && view[idx].startTrack) || 0; render(); }

    var el = document.createElement("div"); el.className = "cz"; rootEl.innerHTML = ""; rootEl.appendChild(el);
    applyTheme(el, cfg.theme);   /* the cassette wears the host's world (per instance) */

    /* REAL in-app audio — plays without leaving the app. Lives OUTSIDE el so a
       re-render never destroys it. Only plays a source the show actually carries
       (honest-state: cleared/consented streams only — no source, no fake play). */
    var audio = document.createElement("audio"); audio.preload = "none"; audio.style.display = "none"; document.body.appendChild(audio);
    /* a show plays as a PLAYLIST: tracks auto-advance so the whole set plays, not one song */
    function trackList(s) {
      if (s && s.tracks && s.tracks.length) return s.tracks.map(function (t) { return { url: t.u ? t.u : (s.audioBase ? s.audioBase + t.f + ".mp3" : null), title: t.t }; }).filter(function (x) { return x.url; });
      if (s && (s.audio || s.stream)) return [{ url: s.audio || s.stream, title: s.nowPlaying || "Track 1" }];
      return [];
    }
    function npTitle(s) { var tl = trackList(s); if (tl.length && tl[curTrack]) return tl[curTrack].title; return (s && (s.nowPlaying || (s.sets && s.sets[0] && s.sets[0].songs[0]))) || "—"; }
    /* in show-mode the UI doesn't flip song to song — the dancer just keeps spinning */
    function npLabel(s) { return showMode ? "the whole show — no breaks 🌹" : npTitle(s); }
    function handLabel(s) { return esc(s && s.band || "Live") + " " + (s && s.year ? "’" + String(s.year).slice(-2) : "") + (npLabel(s) && npLabel(s) !== "—" ? " — " + esc(npLabel(s)) : ""); }
    function updateNP() { var s = view[idx]; var npb = el.querySelector(".cz-np b"); if (npb) npb.textContent = npLabel(s); var lbl = el.querySelector(".cz-label"); if (lbl) { var h = handLabel(s); lbl.textContent = h; lbl.title = h; } syncPlay(); }
    function syncPlay() { var pb = el.querySelector(".cz-play"); if (pb) pb.textContent = playing ? "⏸" : "▶"; var rs = el.querySelectorAll(".cz-reel"); for (var i = 0; i < rs.length; i++) rs[i].classList.toggle("spin", playing); }
    audio.addEventListener("play", function () { playing = true; var id = (view[idx] || {}).id; var fresh = id && !listened[id]; markListened(id); if (fresh) render(); else syncPlay(); });
    audio.addEventListener("pause", function () { playing = false; syncPlay(); });
    audio.addEventListener("ended", function () {
      var tl = trackList(view[idx]);
      if (curTrack < tl.length - 1) { curTrack++; audio.src = tl[curTrack].url; audio.play().catch(function () {}); updateNP(); }
      else { playing = false; curTrack = 0; syncPlay(); }
    });
    audio.addEventListener("error", function () { playing = false; syncPlay(); });
    audio.addEventListener("timeupdate", function () { var sk = el.querySelector(".cz-seek i"); if (sk && audio.duration) sk.style.left = Math.max(0, Math.min(100, audio.currentTime / audio.duration * 100)) + "%"; });

    function pills() {
      function on(k){return F[k]&&(F[k].length||F[k]!==null&&F[k]!=="")?" on":"";}
      return '<div class="cz-bar"><span class="cz-cnt">' + view.length + ' / ' + shows.length + ' shows</span><span class="cz-fl">filter</span>' +
        '<button class="cz-pill' + (F.years.length?" on":"") + '" data-pop="years">YEARS</button>' +
        '<button class="cz-pill' + (F.place?" on":"") + '" data-pop="place">STATE</button>' +
        '<button class="cz-pill' + (F.song?" on":"") + '" data-pop="song">SONGS</button>' +
        '<button class="cz-pill' + (F.venue?" on":"") + '" data-pop="venue">VENUE</button>' +
        '<button class="cz-pill dream' + (F.dream?" on":"") + '" data-pop="dream">YOU DREAM IT UP ✦</button>' +
        (F.years.length||F.place||F.song||F.venue||F.dream?'<button class="cz-pill" data-clear="1">clear</button>':'') + '</div>';
    }
    function tape() {
      var s = view[idx];
      if (!s) return '<div class="cz-stage"><div class="cz-tape"><div class="cz-win"><div class="dt">No tapes match</div><div class="vn">loosen a filter</div></div></div></div>';
      var np = npLabel(s);
      var hand = handLabel(s);
      return '<div class="cz-stage">' +
        '<div class="cz-arrow l' + (idx <= 0 ? " off" : "") + '" data-nav="-1"></div>' +
        '<div class="cz-tape"><div class="scr"><span class="cz-rec"><span class="dot"></span> REC · ' + pts + ' pts</span><span class="cz-side">A<small>SIDE</small></span></div>' +
          '<div class="cz-label" title="' + hand + '">' + hand + '</div>' +
          '<div class="cz-win"><div class="dt"><b>' + esc(s.date) + '</b> · ' + esc(s.venue) + '</div><div class="vn">' + esc(s.city) + ', ' + esc(s.state || s.country) + '</div><div class="bd">' + esc(s.band) + (s.rating ? ' · ★' + s.rating : '') + '</div></div>' +
          '<div class="cz-reels"><div class="cz-reel' + (playing ? ' spin' : '') + '"></div><div class="cz-counter">' + ("000" + (idx + 1)).slice(-4) + '.0</div><div class="cz-reel' + (playing ? ' spin' : '') + '"></div></div>' +
          '<div class="cz-tapebot"><span class="cz-grade" title="' + esc(s.source || "best source") + '">' + grade(s.source) + '</span>' + (listened[s.id] ? '<span class="cz-heard">✓ heard</span>' : '') + '<div class="cz-np">' + ((np && np !== "—") ? (showMode ? '♪ <b>' + esc(np) + '</b>' : '♪ now playing: <b>' + esc(np) + '</b>') : (s.lineup ? '<b>' + esc(s.lineup) + '</b>' : '♪')) + '</div></div></div>' +
        '<div class="cz-arrow r' + (idx >= view.length - 1 ? " off" : "") + '" data-nav="1"></div></div>';
    }
    function controls() {
      var s = view[idx]; if (!s) return "";
      var setPills = (s.sets || []).map(function (st, i) { return '<button class="cz-set" data-set="' + i + '">' + esc(st.name) + '</button>'; }).join("") +
        '<button class="cz-set lyr" data-lyr="1">LYRICS ♫</button>';
      var transport = cfg.hidePlayer ? "" :
        '<div class="cz-player"><button data-trk="-1" title="previous track">⏮</button><button class="cz-play" data-play="1">' + (playing ? "⏸" : "▶") + '</button><div class="cz-seek"><i></i></div><button data-trk="1" title="next track">⏭</button><button data-like="1">♥</button></div>' +
        '<button class="cz-recbtn" data-rec="1"><span class="dot"></span> REC a bootleg</button>';
      var buyBtn = cfg.buy ? '<button class="cz-buy" data-buy="1">🛒 ' + esc(cfg.buy.label || "Buy Now") + '</button>' : '';
      var showRow = cfg.hidePlayer ? "" : '<div class="cz-showrow"><button class="cz-mode' + (showMode ? " on" : "") + '" data-show="1" title="Play the whole show — no track breaks, like the concert">🌹 dead_dance</button><button class="cz-mode" data-new="1" title="Play a show you haven\'t heard yet">🎲 New show</button></div>';
      return transport + showRow + buyBtn +
        '<div class="cz-sets">' + setPills + '</div>' +
        (s.notes ? '<div class="cz-notes">' + esc(s.notes) + '</div>' : '');
    }
    function render() {
      var logo = (cfg.brand && cfg.brand.logo) ? '<img class="cz-logo" src="' + esc(cfg.brand.logo) + '" alt="">' : '';
      el.innerHTML = '<div class="cz-h">' + logo + '<span class="bolt">' + esc((cfg.brand && cfg.brand.icon) || "⚡") + '</span><div><h1>' + esc(cfg.brand && cfg.brand.name || "Every Show") + '</h1><div class="sub">' + esc(cfg.brand && cfg.brand.sub || "live archive · in your pocket") + '</div></div></div>' +
        pills() + (cfg.license ? '<div class="cz-licbar">' + cfg.license + '</div>' : '') + tape() + controls() +
        '<div class="cz-foot">The cassette is the card · ◀ ▶ for the next/last show · no list, no scroll. Audio plays the best community source. Lyrics + content served only under license. ' + pts + ' REC points.</div>';
    }

    /* toasts + popovers */
    function closeUI() { ["cz-toast", "cz-pop"].forEach(function (c) { var ns = document.querySelectorAll("." + c); for (var i = 0; i < ns.length; i++) ns[i].remove(); }); openKey = null; }
    function toast(html) { closeUI(); var t = document.createElement("div"); t.className = "cz-toast"; t.innerHTML = '<span class="x" data-close="1">✕</span>' + html; document.body.appendChild(t); }
    /* bubbles are CENTERED over the cassette (just below the filter row), not anchored far left/right */
    function popover(anchor, html) { closeUI(); var p = document.createElement("div"); p.className = "cz-pop"; p.innerHTML = html; document.body.appendChild(p); var r = anchor.getBoundingClientRect(); var w = Math.min(300, window.innerWidth - 16); p.style.left = Math.round((window.innerWidth - w) / 2) + "px"; p.style.top = (r.bottom + 8) + "px"; }
    function yearHas(y) { return shows.some(function (s) { return s.year === y; }); }

    function openPop(key, anchor) {
      if (key === "years") { var ys = []; for (var yr = 1965; yr <= 1995; yr++) ys.push(yr); shows.forEach(function (s) { if (s.year && ys.indexOf(s.year) < 0) ys.push(s.year); }); ys.sort(function (a, b) { return a - b; }); popover(anchor, '<h4>Filter by year · 1965–1995</h4>' + ys.map(function (y) { return '<span class="opt' + (yearHas(y) ? '' : ' dim') + '" data-year="' + y + '">' + (F.years.indexOf(y) >= 0 ? "✓ " : "") + y + '</span>'; }).join("")); }
      else if (key === "place") { var ps = []; shows.forEach(function (s) { var k = s.country && s.country !== "USA" ? s.country : s.state; if (k && ps.indexOf(k) < 0) ps.push(k); }); popover(anchor, '<h4>State — then countries</h4>' + ps.map(function (p2) { return '<span class="opt" data-place="' + esc(p2) + '">' + esc(p2) + '</span>'; }).join("")); }
      else if (key === "song") { popover(anchor, '<h4>Search a song</h4><input type="text" id="cz-song" placeholder="e.g., Stagger Lee" value="' + esc(F.song) + '">'); var i = document.getElementById("cz-song"); i.focus(); i.oninput = function () { F.song = i.value; F.dream = null; apply(); }; }
      else if (key === "venue") { popover(anchor, '<h4>Search a venue</h4><input type="text" id="cz-ven" placeholder="venue name" value="' + esc(F.venue) + '">'); var v = document.getElementById("cz-ven"); v.focus(); v.oninput = function () { F.venue = v.value; F.dream = null; apply(); }; }
      else if (key === "dream") { popover(anchor, '<h4>You dream it up ✦</h4><span class="opt" data-dream="onthisday">📅 On This Day</span><span class="opt" data-dream="nearme">📍 Near Me</span><span class="opt" data-dream="surprise">🎲 Surprise — Stagger\'s Pick</span><span class="opt" data-dream="vaultheat">🔥 Vault Heat</span><span class="opt" data-dream="segue">🔗 Segue Hunter</span>'); }
      openKey = key;
    }

    function playTrack(i) {
      var s = view[idx], tl = trackList(s); if (!tl.length) return false;
      curTrack = Math.max(0, Math.min(i, tl.length - 1));
      try { audio.src = tl[curTrack].url; var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
      updateNP(); return true;
    }
    el.addEventListener("click", function (e) {
      var t = e.target.closest("[data-pop],[data-nav],[data-trk],[data-play],[data-rec],[data-set],[data-lyr],[data-like],[data-clear],[data-buy],[data-show],[data-new]"); if (!t) return;
      if (t.dataset.pop) { if (openKey === t.dataset.pop) { closeUI(); } else { openPop(t.dataset.pop, t); } }
      else if (t.dataset.nav) { var n = idx + (+t.dataset.nav); if (n >= 0 && n < view.length) { idx = n; try { audio.pause(); } catch (e2) {} playing = false; curTrack = (view[n] && view[n].startTrack) || 0; render(); } }
      else if (t.dataset.trk) { var s = view[idx], tl = trackList(s); if (tl.length) { showMode = false; playTrack(curTrack + (+t.dataset.trk)); } }
      else if (t.dataset.show != null) {
        var ssh = view[idx], tlsh = trackList(ssh);
        if (!tlsh.length) { toast('<h4>🌹 Play as a show</h4><div style="font-size:13px">This tape carries no cleared stream yet (licensing gate). The shows that DO carry a source play the whole set continuously — no track breaks, like the concert.</div>'); return; }
        showMode = true; curTrack = 0; markListened(ssh.id);
        try { audio.src = tlsh[0].url; var prsh = audio.play(); if (prsh && prsh.catch) prsh.catch(function () {}); } catch (e5) {}
        render();
      }
      else if (t.dataset.new != null) {
        var pool = view.filter(function (x) { return !listened[x.id] && trackList(x).length; });
        var allHeard = false;
        if (!pool.length) { pool = view.filter(function (x) { return trackList(x).length; }); allHeard = true; }
        if (!pool.length) { toast('<h4>🎲 New show</h4><div style="font-size:13px">No tape in this filter carries a cleared stream yet.</div>'); return; }
        var pick = pool[Math.floor(Math.random() * pool.length)];
        idx = view.indexOf(pick); curTrack = 0; markListened(pick.id);
        try { audio.src = trackList(pick)[0].url; var prn = audio.play(); if (prn && prn.catch) prn.catch(function () {}); } catch (e6) {}
        render();
        if (allHeard) toast('<h4>🎲 You\'ve heard them all 🌹</h4><div style="font-size:13px">Spinning a favorite again — the circle never stops.</div>');
      }
      else if (t.dataset.play) {
        var sp = view[idx], tl2 = trackList(sp);
        if (tl2.length) {
          try { var want = tl2[Math.min(curTrack, tl2.length - 1)].url; if (audio.getAttribute("src") !== want) audio.src = want; if (audio.paused) { var pr2 = audio.play(); if (pr2 && pr2.catch) pr2.catch(function () { toast('<h4>Couldn\'t start that source</h4><div style="font-size:13px">The stream didn\'t load just now — try again, or arrow to another show.</div>'); }); } else { audio.pause(); } } catch (e3) {}
        } else {
          toast('<h4>▶ The player is real — it plays in-app</h4><div style="font-size:13px">No leaving the app: it streams the show right here, reels spinning. This particular tape carries no cleared stream yet — that\'s the licensing &amp; band-consent gate (Esther/Ira). The shows that DO carry a source play the whole set, song to song.</div><div class="lic">Honest-state: we never fake playback for a source we don\'t carry.</div>');
        }
      }
      else if (t.dataset.like) { /* like */ }
      else if (t.dataset.clear) { F = { years: [], place: null, song: "", venue: "", dream: null }; idx = 0; apply(); }
      else if (t.dataset.rec != null) { pts += 25; ptsSave(); if (MC) MC.emit({ type: "listing_viewed", market_id: cfg.marketId || "gd_archive", actor_account: acct.id, payload: { rec: true, show: (view[idx] || {}).id } }); toast('<h4>🎙️ Bootleg recorded — +25 pts</h4><div style="font-size:13px">Thanks for taping for the community. If 5+ sources exist, we rate them and always play the best — yours. (Capture runs only with the band\'s consent.)</div>'); render(); }
      else if (t.dataset.set != null) { var s = view[idx], st = s.sets[+t.dataset.set]; toast('<h4>' + esc(st.name) + ' — ' + esc(s.date) + '</h4><ol>' + (st.songs || []).map(function (g) { return '<li>' + esc(g) + '</li>'; }).join("") + '</ol><div class="lic">Setlist = factual song titles.</div>'); }
      else if (t.dataset.lyr != null) { var s2 = view[idx], np = s2.nowPlaying || (s2.sets && s2.sets[0] && s2.sets[0].songs[0]) || "this song"; toast('<h4>♫ Lyrics — “' + esc(np) + '”</h4><div style="font-size:13px;line-height:1.5">Lyrics are streamed live from your <b>licensed</b> lyrics provider (LyricFind / Musixmatch) and appear here in the app, with attribution.</div><div class="lic">Licensed content · default-deny outside the license · nothing stored or reproduced here.</div>'); }
      else if (t.dataset.buy != null) { var sb = view[idx]; var burl = sb && sb.buy; if (burl) { try { window.open(burl, "_blank", "noopener"); } catch (e4) {} } else { toast('<h4>🛒 Buy / stream — ' + esc(sb.date) + ' · ' + esc(sb.venue) + '</h4><div style="font-size:13px;line-height:1.5">' + ((cfg.buy && cfg.buy.note) || 'Demo: this is where a fan buys or streams this show. In production it routes to the rights-holder’s licensed store — the house carries <b>rights, not copies</b>, and takes only the agreed cut.') + '</div><div class="lic">No audio is played or reproduced in this demo — that unlocks only under the rights-holder’s license.</div>'); } }
    });
    document.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closeUI(); else if (!e.target.closest(".cz-pop,.cz-toast,[data-pop],[data-set],[data-lyr],[data-rec],[data-buy]")) closeUI(); });
    document.addEventListener("click", function (e) {
      var o = e.target.closest("[data-year],[data-place],[data-dream]"); if (!o) return;
      if (o.dataset.year != null) { var y = +o.dataset.year; var i = F.years.indexOf(y); if (i >= 0) F.years.splice(i, 1); else F.years.push(y); F.dream = null; apply(); openPop("years", document.querySelector('[data-pop="years"]')); }
      else if (o.dataset.place != null) { F.place = (F.place === o.dataset.place ? null : o.dataset.place); F.dream = null; closeUI(); apply(); }
      else if (o.dataset.dream != null) { F.dream = o.dataset.dream; if (o.dataset.dream === "nearme") F.place = acct.region === "US" ? "PA" : F.place; closeUI(); apply(); }
    });

    render();
    return { render: render };
  }
  root.CassetteReader = { mount: mount, VERSION: "0.1" };
})(typeof window !== "undefined" ? window : globalThis);
