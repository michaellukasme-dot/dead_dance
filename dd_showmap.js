/* dead_dance — Show Map (home page).
   Honest-state: plots UPCOMING shows on a US map by venue city.
   Data source = real headliner tour dates (HEADLINER_TOUR_DATES_real_2026-06-30.md,
   cross-checked to the seeded venues where they overlap). Sample rows are labeled SAMPLE.
   Framework-less. "🔔 Notify me" only captures demand — nothing sells, no external links. */
(function () {
  "use strict";

  /* ---- 1. City → lat/lng lookup (seeded venues + real headliner cities) ---- */
  var CITY = {
    // Seeded-venue cities
    "Santa Cruz, CA": [36.97, -122.03], "Felton, CA": [37.05, -122.07],
    "Mill Valley, CA": [37.91, -122.55], "San Francisco, CA": [37.77, -122.42],
    "Berkeley, CA": [37.87, -122.27], "Novato, CA": [38.11, -122.57],
    "Portland, OR": [45.52, -122.68], "Eugene, OR": [44.05, -123.09],
    "Seattle, WA": [47.61, -122.33], "Spokane, WA": [47.66, -117.43],
    "Solana Beach, CA": [32.99, -117.27], "Los Angeles, CA": [34.05, -118.24],
    "San Juan Capistrano, CA": [33.50, -117.66], "Hermosa Beach, CA": [33.86, -118.40],
    "Denver, CO": [39.74, -104.99], "Morrison, CO": [39.66, -105.21],
    "Boulder, CO": [40.01, -105.27], "Bellvue, CO": [40.63, -105.22],
    "Austin, TX": [30.27, -97.74], "New Braunfels, TX": [29.70, -98.12],
    "Dallas, TX": [32.78, -96.80], "San Antonio, TX": [29.42, -98.49],
    "Houston, TX": [29.76, -95.37], "Chicago, IL": [41.88, -87.63],
    "Indianapolis, IN": [39.77, -86.16], "Ferndale, MI": [42.46, -83.13],
    "Cuyahoga Falls, OH": [41.13, -81.48], "Asheville, NC": [35.60, -82.55],
    "Atlanta, GA": [33.75, -84.39], "Nashville, TN": [36.16, -86.78],
    "Fort Lauderdale, FL": [26.12, -80.14], "Ardmore, PA": [40.01, -75.29],
    "Washington, DC": [38.91, -77.04], "Bethlehem, PA": [40.63, -75.37],
    "Trenton, NJ": [40.22, -74.74], "Annapolis, MD": [38.98, -76.49],
    "Ashburn, VA": [39.05, -77.49], "Port Chester, NY": [41.00, -73.67],
    "Brooklyn, NY": [40.68, -73.94], "New York, NY": [40.71, -74.01],
    "Burlington, VT": [44.48, -73.21], "Manchester, CT": [41.78, -72.52],
    "Cambridge, MA": [42.37, -71.11], "Portland, ME": [43.66, -70.26],
    // Real headliner cities (from HEADLINER_TOUR_DATES)
    "Lake George, NY": [43.42, -73.71], "San Diego, CA": [32.72, -117.16],
    "Sacramento, CA": [38.58, -121.49], "Carterville, IL": [37.76, -89.08],
    "Pelham, TN": [35.34, -85.85], "Garrettsville, OH": [41.29, -81.10],
    "Lewes, DE": [38.77, -75.14], "Atlantic City, NJ": [39.36, -74.42],
    "Arcata, CA": [40.87, -124.08], "Vienna, VA": [38.90, -77.27],
    "Cleveland Heights, OH": [41.52, -81.56], "Harrisburg, PA": [40.27, -76.88],
    "Las Vegas, NV": [36.17, -115.14], "Costa Mesa, CA": [33.64, -117.92],
    "Napa, CA": [38.30, -122.29], "Carnation, WA": [47.65, -121.91],
    "Vail, CO": [39.64, -106.37], "Dillon, CO": [39.63, -106.04],
    "Madison, WI": [43.07, -89.40], "Grand Rapids, MI": [42.96, -85.67],
    "Richmond, VA": [37.54, -77.44], "Nantucket, MA": [41.28, -70.10],
    "Deerfield, MA": [42.54, -72.61], "Nashua, NH": [42.77, -71.47],
    "Jay, VT": [44.97, -72.53], "Canandaigua, NY": [42.89, -77.28],
    "Petaluma, CA": [38.23, -122.64]
  };

  /* ---- 2. Shows. real=true → sourced from headliner sheet. sample → clearly labeled. ---- */
  var SHOWS = [
    // REAL — from HEADLINER_TOUR_DATES_real_2026-06-30.md
    { band: "Melvin Seals & JGB", venue: "McDonald Theatre", city: "Eugene, OR", date: "2026-07-03", real: true },
    { band: "Dark Star Orchestra", venue: "Rock the Dock", city: "Lake George, NY", date: "2026-07-11", real: true },
    { band: "Joe Russo's Almost Dead", venue: "Holliday Park", city: "Indianapolis, IN", date: "2026-07-17", real: true },
    { band: "Joe Russo's Almost Dead", venue: "Evans Amphitheater", city: "Cleveland Heights, OH", date: "2026-07-18", real: true },
    { band: "Joe Russo's Almost Dead", venue: "Riverfront Park", city: "Harrisburg, PA", date: "2026-07-19", real: true },
    { band: "Dark Star Orchestra", venue: "Humphrey's by the Bay", city: "San Diego, CA", date: "2026-07-28", real: true },
    { band: "Dark Star Orchestra", venue: "California State Fair", city: "Sacramento, CA", date: "2026-07-30", real: true },
    { band: "Dark Star Orchestra", venue: "Greek Theatre (Rex benefit)", city: "Berkeley, CA", date: "2026-07-31", real: true },
    { band: "Melvin Seals & JGB", venue: "Great American Music Hall", city: "San Francisco, CA", date: "2026-08-02", real: true },
    { band: "Joe Russo's Almost Dead", venue: "Quarry Amphitheater", city: "Santa Cruz, CA", date: "2026-08-01", real: true },
    { band: "Kimock · Oteil & Friends", venue: "French Broad River Brewery", city: "Asheville, NC", date: "2026-08-02", real: true },
    { band: "Joe Russo's Almost Dead", venue: "The Mission Ballroom", city: "Denver, CO", date: "2026-08-20", real: true },
    { band: "Joe Russo's Almost Dead", venue: "Dillon Amphitheater", city: "Dillon, CO", date: "2026-08-22", real: true },
    { band: "Steve Kimock (Donna Jean celebration)", venue: "Mystic Theatre", city: "Petaluma, CA", date: "2026-08-22", real: true },
    { band: "Joe Russo's Almost Dead", venue: "The Rooftop at Pier 17", city: "New York, NY", date: "2026-09-25", real: true },
    { band: "Joe Russo's Almost Dead", venue: "The Salt Shed", city: "Chicago, IL", date: "2026-10-02", real: true },
    { band: "John Kadlecik — Sages & Spirits", venue: "The Capitol Theatre", city: "Port Chester, NY", date: "2026-10-02", real: true },
    { band: "Jeff Mattson & Friends", venue: "City Winery", city: "New York, NY", date: "2026-10-23", real: true },
    // SAMPLE — from seeded venues, so the map has coverage where we book. Labeled sample.
    { band: "House Band (sample)", venue: "The Catalyst", city: "Santa Cruz, CA", date: "2026-07-15", sample: true },
    { band: "House Band (sample)", venue: "The Showbox", city: "Seattle, WA", date: "2026-07-22", sample: true },
    { band: "House Band (sample)", venue: "Antone's", city: "Austin, TX", date: "2026-08-05", sample: true },
    { band: "House Band (sample)", venue: "Variety Playhouse", city: "Atlanta, GA", date: "2026-08-12", sample: true },
    { band: "House Band (sample)", venue: "9:30 Club", city: "Washington, DC", date: "2026-08-19", sample: true },
    { band: "House Band (sample)", venue: "The Sinclair", city: "Cambridge, MA", date: "2026-08-26", sample: true },
    { band: "House Band (sample)", venue: "Ardmore Music Hall", city: "Ardmore, PA", date: "2026-09-04", sample: true }
  ];

  /* ---- 3. Projection: lat/lng → x/y in the SVG viewBox (0..960 x 0..600). ---- */
  /* Simple linear fit tuned to the contiguous-US outline used below.
     lng -125..-66  →  x 40..915 ;  lat 24..49.5  →  y 560..70. */
  function project(lat, lng) {
    var x = (lng - (-125)) / ((-66) - (-125)) * (915 - 40) + 40;
    var y = (lat - 24) / (49.5 - 24) * (70 - 560) + 560;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  /* ---- 4. Lightweight contiguous-US silhouette (single path, low-poly). ---- */
  var US_PATH = "M110,150 L250,120 L430,95 L620,88 L770,110 L860,150 L905,205 " +
    "L900,255 L860,300 L845,360 L820,410 L775,470 L720,515 L650,545 L560,560 " +
    "L470,558 L400,540 L340,500 L300,470 L255,430 L210,400 L170,360 L140,320 " +
    "L120,270 L100,215 Z";

  var TOTAL = SHOWS.length, REAL = SHOWS.filter(function (s) { return s.real; }).length;

  function fmtDate(iso) {
    var d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function notified(id) { try { return !!localStorage.getItem("dd.showmap.notify." + id); } catch (e) { return false; } }
  function setNotified(id) { try { localStorage.setItem("dd.showmap.notify." + id, "1"); } catch (e) {} }

  /* ---- 5. Render ---- */
  function render(host) {
    var dots = "";
    SHOWS.forEach(function (s, i) {
      var ll = CITY[s.city];
      if (!ll) return;                              // skip unknown cities (no coordinate error)
      var p = project(ll[0], ll[1]);
      var cls = s.sample ? "smdot sample" : "smdot real";
      dots += '<g class="' + cls + '" data-i="' + i + '" tabindex="0" role="button" ' +
        'aria-label="' + esc(s.band + " at " + s.venue + ", " + s.city + ", " + fmtDate(s.date)) + '">' +
        '<circle class="smpulse" cx="' + p[0] + '" cy="' + p[1] + '" r="9"></circle>' +
        '<circle class="smcore" cx="' + p[0] + '" cy="' + p[1] + '" r="5.5"></circle>' +
        '</g>';
    });

    host.innerHTML =
      '<div class="showmap-card">' +
        '<div class="showmap-head">' +
          '<b>🗺️ Shows on the map</b>' +
          '<span class="showmap-sub">' + TOTAL + ' upcoming · ' + REAL + ' real dates</span>' +
          '<button class="showmap-x" aria-label="Hide map" title="Hide">✕</button>' +
        '</div>' +
        '<div class="showmap-legend">' +
          '<span class="lg real">● verified date</span>' +
          '<span class="lg sample">● sample (from our venues)</span>' +
          '<span class="showmap-honest">Honest-state — sample rows labeled; nothing sells here.</span>' +
        '</div>' +
        '<div class="showmap-wrap">' +
          '<svg class="showmap-svg" viewBox="0 0 960 600" role="img" aria-label="US map of upcoming shows" preserveAspectRatio="xMidYMid meet">' +
            '<path class="us-land" d="' + US_PATH + '"></path>' +
            dots +
          '</svg>' +
          '<div class="showmap-pop" id="showmapPop" hidden></div>' +
        '</div>' +
      '</div>';

    var pop = host.querySelector("#showmapPop");
    var wrap = host.querySelector(".showmap-wrap");

    function showPop(i, gEl) {
      var s = SHOWS[i];
      var id = (s.band + s.date).replace(/[^a-z0-9]/gi, "").toLowerCase();
      var done = notified(id);
      pop.innerHTML =
        '<div class="pop-band">' + esc(s.band) + (s.sample ? ' <em class="pop-tag">SAMPLE</em>' : '') + '</div>' +
        '<div class="pop-line">' + esc(s.venue) + ' · ' + esc(s.city) + '</div>' +
        '<div class="pop-date">📅 ' + fmtDate(s.date) + ', 2026</div>' +
        '<button class="pop-notify' + (done ? ' done' : '') + '" data-id="' + id + '">' +
          (done ? '✓ We\'ll ping you' : '🔔 Notify me') + '</button>' +
        '<div class="pop-foot">Stays in the app — just captures who wants in.</div>';
      // position popover near the dot, clamped inside the wrap
      var wr = wrap.getBoundingClientRect(), gr = gEl.getBoundingClientRect();
      var left = gr.left - wr.left + gr.width / 2;
      var top = gr.top - wr.top;
      pop.hidden = false;
      var pw = pop.offsetWidth, ph = pop.offsetHeight;
      left = Math.max(8, Math.min(left - pw / 2, wr.width - pw - 8));
      top = top - ph - 10; if (top < 6) top = gr.bottom - wr.top + 10;
      pop.style.left = left + "px"; pop.style.top = top + "px";

      var nb = pop.querySelector(".pop-notify");
      nb.onclick = function (ev) {
        ev.stopPropagation();
        setNotified(this.getAttribute("data-id"));
        this.classList.add("done"); this.textContent = "✓ We'll ping you";
        if (window.toast) window.toast("🔔 Noted — we'll ping you when " + s.band + " is confirmed.");
      };
    }
    function hidePop() { pop.hidden = true; }

    host.querySelectorAll(".smdot").forEach(function (g) {
      var i = +g.getAttribute("data-i");
      g.addEventListener("click", function (e) { e.stopPropagation(); showPop(i, g); });
      g.addEventListener("mouseenter", function () { showPop(i, g); });
      g.addEventListener("focus", function () { showPop(i, g); });
    });
    wrap.addEventListener("mouseleave", hidePop);
    document.addEventListener("click", function (e) {
      if (pop.hidden) return;
      if (!pop.contains(e.target) && !e.target.closest(".smdot")) hidePop();
    });

    var x = host.querySelector(".showmap-x");
    if (x) x.onclick = function () {
      host.style.display = "none";
      try { localStorage.setItem("dd.showmap.hidden", "1"); } catch (e) {}
    };
  }

  function init() {
    var host = document.getElementById("showMap");
    if (!host) return;
    try { if (localStorage.getItem("dd.showmap.hidden")) { host.style.display = "none"; return; } } catch (e) {}
    render(host);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
