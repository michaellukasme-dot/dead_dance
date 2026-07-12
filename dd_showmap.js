/* dead_dance — Show Map (home page).
   Honest-state: plots UPCOMING shows on a US map by venue city.
   Data source = real headliner tour dates (cross-checked to seeded venues where they overlap).
   Sample rows are labeled SAMPLE.
   National / Near-me toggle: "Near me" zooms the map to the viewer's region — detected by GPS,
   or picked from the region menu. Framework-less. "🔔 Notify me" only captures demand. */
(function () {
  "use strict";

  /* ---- 1. City → lat/lng lookup (seeded venues + real headliner cities) ---- */
  var CITY = {
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
    { band: "House Band (sample)", venue: "The Catalyst", city: "Santa Cruz, CA", date: "2026-07-15", sample: true },
    { band: "House Band (sample)", venue: "The Showbox", city: "Seattle, WA", date: "2026-07-22", sample: true },
    { band: "House Band (sample)", venue: "Antone's", city: "Austin, TX", date: "2026-08-05", sample: true },
    { band: "House Band (sample)", venue: "Variety Playhouse", city: "Atlanta, GA", date: "2026-08-12", sample: true },
    { band: "House Band (sample)", venue: "9:30 Club", city: "Washington, DC", date: "2026-08-19", sample: true },
    { band: "House Band (sample)", venue: "The Sinclair", city: "Cambridge, MA", date: "2026-08-26", sample: true },
    { band: "House Band (sample)", venue: "Ardmore Music Hall", city: "Ardmore, PA", date: "2026-09-04", sample: true }
  ];

  /* DEAL + Hot Sauce — real band dates. Merge in + register their towns. */
  try {
    [window.dealMapRows, window.hotSauceMapRows].forEach(function (fn) {
      if (!fn) return;
      fn().forEach(function (r) {
        SHOWS.push({ band: r.band, venue: r.venue, city: r.city, date: r.date, real: true });
        if (r.coords && !CITY[r.city]) CITY[r.city] = r.coords;
      });
    });
  } catch (e) {}

  /* ---- 3. Projection: lat/lng → x/y in the SVG viewBox (0..960 x 0..600). ---- */
  function project(lat, lng) {
    var x = (lng - (-125)) / ((-66) - (-125)) * (915 - 40) + 40;
    var y = (lat - 24) / (49.5 - 24) * (70 - 560) + 560;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  /* ---- 4. Contiguous-US outline, projected through the SAME projection as the dots. ---- */
  var US_OUTLINE = [
    [48.4,-124.7],[46.9,-124.1],[46.2,-123.9],[43.9,-124.1],[42.0,-124.4],[40.4,-124.4],
    [38.9,-123.7],[37.8,-122.5],[36.6,-121.9],[35.4,-120.9],[34.4,-119.7],[34.0,-118.5],
    [33.4,-117.6],[32.5,-117.1],
    [32.6,-114.7],[31.3,-111.0],[31.3,-108.2],[31.8,-108.2],[31.8,-106.5],[29.8,-104.5],
    [29.2,-102.8],[29.4,-100.9],[28.4,-100.3],[27.4,-99.5],[26.0,-97.5],
    [27.8,-97.1],[28.4,-96.4],[29.3,-94.8],[29.7,-93.9],[29.6,-92.1],[29.2,-90.3],
    [29.1,-89.2],[30.0,-89.1],[30.4,-88.0],[30.4,-86.5],[29.9,-84.4],[29.1,-83.0],
    [27.8,-82.7],[26.4,-82.1],[25.8,-81.5],[25.1,-80.9],[25.2,-80.3],
    [25.8,-80.1],[26.7,-80.0],[28.4,-80.6],[29.9,-81.3],[31.1,-81.4],[32.1,-80.8],
    [32.8,-79.9],[33.9,-78.0],[34.7,-76.7],[35.2,-75.5],[36.9,-76.0],[37.9,-75.4],
    [38.8,-75.0],[39.3,-74.4],[40.5,-74.0],[40.6,-73.1],[41.0,-71.9],[41.4,-71.4],
    [41.7,-70.3],[42.4,-70.9],[43.0,-70.7],[43.7,-70.2],[44.1,-69.1],[44.4,-68.2],[44.9,-67.0],
    [47.1,-68.4],[47.4,-69.2],[45.3,-71.1],[45.0,-73.3],[45.0,-74.7],[44.1,-76.4],
    [43.4,-79.2],[42.3,-79.8],[41.7,-82.5],[41.9,-83.4],[45.8,-84.4],[46.5,-84.5],
    [46.9,-88.5],[46.8,-90.9],[46.7,-92.1],[47.3,-95.0],[49.0,-95.2],[49.0,-104.0],
    [49.0,-117.0],[49.0,-123.0]
  ];
  function buildPath(pts) {
    return pts.map(function (p, i) { var xy = project(p[0], p[1]); return (i ? "L" : "M") + xy[0] + "," + xy[1]; }).join(" ") + " Z";
  }
  var US_PATH = buildPath(US_OUTLINE);

  function buildGraticule() {
    var lines = "";
    for (var lng = -120; lng <= -70; lng += 10) { var a = project(24, lng), b = project(50, lng); lines += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>'; }
    for (var lat = 25; lat <= 45; lat += 5) { var c = project(lat, -125), d = project(lat, -66); lines += '<line x1="' + c[0] + '" y1="' + c[1] + '" x2="' + d[0] + '" y2="' + d[1] + '"/>'; }
    return lines;
  }
  var US_GRATICULE = buildGraticule();

  /* ---- 4b. Regions — the "Near me" menu. Each is a lat/lng box we zoom to. ---- */
  var REGIONS = [
    { key: "west",   label: "West Coast",       latMin: 32.0, latMax: 49.0, lngMin: -125.0, lngMax: -116.0 },
    { key: "mtn",    label: "Mountain West",    latMin: 31.5, latMax: 49.0, lngMin: -117.5, lngMax: -103.5 },
    { key: "texas",  label: "Texas & South",    latMin: 25.5, latMax: 37.0, lngMin: -107.0, lngMax: -92.0 },
    { key: "midwest",label: "Midwest & Lakes",  latMin: 36.5, latMax: 48.5, lngMin: -98.0,  lngMax: -80.0 },
    { key: "south",  label: "Southeast",        latMin: 24.5, latMax: 37.5, lngMin: -91.0,  lngMax: -75.0 },
    { key: "midatl", label: "Mid-Atlantic",     latMin: 36.5, latMax: 43.2, lngMin: -81.5,  lngMax: -73.0 },
    { key: "ne",     label: "Northeast",        latMin: 39.8, latMax: 47.6, lngMin: -76.5,  lngMax: -66.8 }
  ];
  function regionByKey(k) { for (var i = 0; i < REGIONS.length; i++) if (REGIONS[i].key === k) return REGIONS[i]; return null; }

  var FULL_VB = [0, 0, 960, 600];

  /* lat/lng box → padded viewBox, aspect-corrected to the 960×600 frame so it isn't letterboxed. */
  function boxToVB(b) {
    var pts = [project(b.latMax, b.lngMin), project(b.latMin, b.lngMax), project(b.latMax, b.lngMax), project(b.latMin, b.lngMin)];
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var w = maxX - minX, h = maxY - minY;
    var padX = w * 0.10, padY = h * 0.12;
    minX -= padX; maxX += padX; minY -= padY; maxY += padY;
    w = maxX - minX; h = maxY - minY;
    // correct to 960:600 (1.6) aspect so the zoom fills the frame edge-to-edge
    var aspect = 960 / 600, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    return [cx - w / 2, cy - h / 2, w, h];
  }

  function haversineMi(a, b, c, d) {
    var R = 3958.8, toR = Math.PI / 180;
    var dLat = (c - a) * toR, dLng = (d - b) * toR;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function nearestRegion(lat, lng) {
    var best = null, bd = 1e9;
    REGIONS.forEach(function (r) {
      var cLat = (r.latMin + r.latMax) / 2, cLng = (r.lngMin + r.lngMax) / 2;
      var d = haversineMi(lat, lng, cLat, cLng);
      if (d < bd) { bd = d; best = r; }
    });
    return best;
  }

  var TOTAL = SHOWS.length, REAL = SHOWS.filter(function (s) { return s.real; }).length;

  function fmtDate(iso) { var d = new Date(iso + "T12:00:00"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function notified(id) { try { return !!localStorage.getItem("dd.showmap.notify." + id); } catch (e) { return false; } }
  function setNotified(id) { try { localStorage.setItem("dd.showmap.notify." + id, "1"); } catch (e) {} }

  /* ---- 5. Render ---- */
  function render(host) {
    var mode = "national", curVB = FULL_VB.slice(), rafId = 0, youMarker = null;

    host.innerHTML =
      '<div class="showmap-card">' +
        '<div class="showmap-head">' +
          '<b>🗺️ Shows on the map</b>' +
          '<div class="showmap-seg" role="tablist">' +
            '<button data-mode="national" class="on">🇺🇸 National</button>' +
            '<button data-mode="local">📍 Near me</button>' +
          '</div>' +
          '<button class="showmap-x" aria-label="Hide map" title="Hide">✕</button>' +
        '</div>' +
        '<div class="showmap-region" hidden>' +
          '<button class="showmap-loc">📍 Use my location</button>' +
          '<select class="showmap-select" aria-label="Pick a region">' +
            '<option value="">Pick a region…</option>' +
            REGIONS.map(function (r) { return '<option value="' + r.key + '">' + r.label + '</option>'; }).join('') +
          '</select>' +
          '<span class="showmap-near"></span>' +
        '</div>' +
        '<div class="showmap-legend">' +
          '<span class="showmap-sub">' + TOTAL + ' upcoming · ' + REAL + ' real dates</span>' +
          '<span class="lg real">● verified date</span>' +
          '<span class="lg sample">● sample (from our venues)</span>' +
          '<span class="showmap-honest">Honest-state — sample rows labeled; nothing sells here.</span>' +
        '</div>' +
        '<div class="showmap-wrap">' +
          '<svg class="showmap-svg" viewBox="0 0 960 600" role="img" aria-label="US map of upcoming shows" preserveAspectRatio="xMidYMid meet">' +
            '<defs><clipPath id="usClip"><path d="' + US_PATH + '"></path></clipPath></defs>' +
            '<path class="us-land" d="' + US_PATH + '"></path>' +
            '<g class="us-grat" clip-path="url(#usClip)">' + US_GRATICULE + '</g>' +
            '<g class="sm-you"></g>' +
            '<g class="sm-dots"></g>' +
          '</svg>' +
          '<div class="showmap-pop" id="showmapPop" hidden></div>' +
        '</div>' +
      '</div>';

    var card = host.querySelector(".showmap-card");
    var svg = host.querySelector(".showmap-svg");
    var dotsG = host.querySelector(".sm-dots");
    var youG = host.querySelector(".sm-you");
    var pop = host.querySelector("#showmapPop");
    var wrap = host.querySelector(".showmap-wrap");
    var regionRow = host.querySelector(".showmap-region");
    var nearEl = host.querySelector(".showmap-near");
    var sel = host.querySelector(".showmap-select");

    /* --- dots sized as a fraction of the current viewBox width → constant on-screen size at any zoom --- */
    function drawDots(vbW) {
      var rCore = 0.0066 * vbW, rPulse = 0.011 * vbW, sw = 0.0016 * vbW;
      var labels = (vbW / 960) < 0.72;
      var vx0 = curVB[0], vy0 = curVB[1], vx1 = curVB[0] + curVB[2], vy1 = curVB[1] + curVB[3];
      var html = "";
      SHOWS.forEach(function (s, i) {
        var ll = CITY[s.city]; if (!ll) return;
        var p = project(ll[0], ll[1]);
        var cls = s.sample ? "smdot sample" : "smdot real";
        html += '<g class="' + cls + '" data-i="' + i + '" tabindex="0" role="button" ' +
          'aria-label="' + esc(s.band + " at " + s.venue + ", " + s.city + ", " + fmtDate(s.date)) + '">' +
          '<circle class="smpulse" cx="' + p[0] + '" cy="' + p[1] + '" r="' + rPulse.toFixed(1) + '"></circle>' +
          '<circle class="smcore" cx="' + p[0] + '" cy="' + p[1] + '" r="' + rCore.toFixed(1) + '" style="stroke-width:' + sw.toFixed(2) + '"></circle>';
        if (labels && p[0] >= vx0 && p[0] <= vx1 && p[1] >= vy0 && p[1] <= vy1) {
          var name = s.city.replace(/,.*$/, "");
          html += '<text class="smlabel" x="' + (p[0] + rCore + 2) + '" y="' + (p[1] + rCore * 0.4) +
            '" style="font-size:' + (0.019 * vbW).toFixed(1) + 'px;stroke-width:' + (0.0022 * vbW).toFixed(2) + 'px">' + esc(name) + '</text>';
        }
        html += '</g>';
      });
      dotsG.innerHTML = html;
      bindDots();
    }

    function bindDots() {
      dotsG.querySelectorAll(".smdot").forEach(function (g) {
        var i = +g.getAttribute("data-i");
        g.addEventListener("click", function (e) { e.stopPropagation(); showPop(i, g); });
        g.addEventListener("mouseenter", function () { showPop(i, g); });
        g.addEventListener("focus", function () { showPop(i, g); });
      });
    }

    /* --- viewBox tween --- */
    function easeIO(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function animateTo(target, ms) {
      hidePop();
      if (rafId) cancelAnimationFrame(rafId);
      var start = curVB.slice(), t0 = null;
      drawDots(target[2]); // size dots for destination up front
      function step(ts) {
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / ms), e = easeIO(k);
        var vb = start.map(function (v, idx) { return v + (target[idx] - v) * e; });
        svg.setAttribute("viewBox", vb.join(" "));
        if (k < 1) { rafId = requestAnimationFrame(step); }
        else { curVB = target.slice(); svg.setAttribute("viewBox", curVB.join(" ")); drawDots(curVB[2]); }
      }
      rafId = requestAnimationFrame(step);
    }

    function clearYou() { youG.innerHTML = ""; youMarker = null; }
    function markYou(lat, lng, vbW) {
      var p = project(lat, lng), r = 0.011 * (vbW || curVB[2]);
      youMarker = [lat, lng];
      youG.innerHTML =
        '<circle class="you-ring" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (r * 1.9).toFixed(1) + '"></circle>' +
        '<circle class="you-dot" cx="' + p[0] + '" cy="' + p[1] + '" r="' + r.toFixed(1) + '"></circle>';
    }

    /* --- popover (Notify me) --- */
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
      var wr = wrap.getBoundingClientRect(), gr = gEl.getBoundingClientRect();
      var left = gr.left - wr.left + gr.width / 2, top = gr.top - wr.top;
      pop.hidden = false;
      var pw = pop.offsetWidth, ph = pop.offsetHeight;
      left = Math.max(8, Math.min(left - pw / 2, wr.width - pw - 8));
      top = top - ph - 10; if (top < 6) top = gr.bottom - wr.top + 10;
      pop.style.left = left + "px"; pop.style.top = top + "px";
      pop.querySelector(".pop-notify").onclick = function (ev) {
        ev.stopPropagation();
        setNotified(this.getAttribute("data-id"));
        this.classList.add("done"); this.textContent = "✓ We'll ping you";
        if (window.toast) window.toast("🔔 Noted — we'll ping you when " + s.band + " is confirmed.");
      };
    }
    function hidePop() { pop.hidden = true; }

    /* --- region + near-me --- */
    function countNear(lat, lng, mi) {
      return SHOWS.filter(function (s) { var ll = CITY[s.city]; return ll && haversineMi(lat, lng, ll[0], ll[1]) <= mi; }).length;
    }
    function goRegion(r, note) {
      if (!r) return;
      sel.value = r.key;
      animateTo(boxToVB(r), 620);
      nearEl.textContent = note || (r.label + " — zoomed in");
      try { localStorage.setItem("dd.showmap.region", r.key); } catch (e) {}
    }
    function useLocation() {
      if (!navigator.geolocation) { nearEl.textContent = "Location off — pick a region"; return; }
      nearEl.textContent = "📍 Locating…";
      navigator.geolocation.getCurrentPosition(function (pos) {
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        var r = nearestRegion(lat, lng);
        var n = countNear(lat, lng, 300);
        // custom box centered on the viewer (a few states wide), then zoom
        var box = { latMin: lat - 4.4, latMax: lat + 4.4, lngMin: lng - 6.2, lngMax: lng + 6.2 };
        var tvb = boxToVB(box);
        animateTo(tvb, 620);
        markYou(lat, lng, tvb[2]);
        if (r) sel.value = r.key;
        nearEl.textContent = n + (n === 1 ? " show" : " shows") + " within 300 mi";
        try { localStorage.setItem("dd.showmap.region", r ? r.key : ""); } catch (e) {}
      }, function () {
        nearEl.textContent = "Location blocked — pick a region";
      }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
    }

    function setMode(m) {
      mode = m;
      host.querySelectorAll(".showmap-seg button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-mode") === m); });
      if (m === "national") {
        regionRow.hidden = true; clearYou();
        animateTo(FULL_VB.slice(), 560);
      } else {
        regionRow.hidden = false;
        var saved = null; try { saved = localStorage.getItem("dd.showmap.region"); } catch (e) {}
        var r = saved && regionByKey(saved);
        if (r) goRegion(r); else useLocation();
      }
    }

    /* --- wire controls --- */
    host.querySelectorAll(".showmap-seg button").forEach(function (b) {
      b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); });
    });
    host.querySelector(".showmap-loc").addEventListener("click", function () { clearYou(); useLocation(); });
    sel.addEventListener("change", function () { clearYou(); goRegion(regionByKey(sel.value)); });

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

    drawDots(FULL_VB[2]);
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
