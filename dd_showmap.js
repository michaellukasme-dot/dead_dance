/* dead_dance — Show Map (home page). MERGED with the TCTP/Rosebud "bus map" brain.
   Honest-state: plots UPCOMING shows on a real projected US map by venue city.
   Data = real headliner tour dates (cross-checked to seeded venues). Sample rows labeled.

   Two levels, ported from the proven TCTP tiered map:
     • NATIONAL — real map (state borders) + 11 CHAPTER badges. Lit = show count.
       DIM (dashed "+") = a chapter waiting — tap to post the first date (the growth loop).
     • CHAPTER — geographic zoom into the chapter + its show list / festivals / tickets /
       "add a date". Rosebud narrates every level.
   "Near me" zooms to the viewer's chapter (GPS or picked). Framework-less. Nothing sells here. */
(function () {
  "use strict";

  /* ---- 1. City → lat/lng ---- */
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
    "Fort Lauderdale, FL": [26.12, -80.14], "Ardmore, PA": [40.01, -75.29], "Philadelphia, PA": [39.95, -75.16], "Veneta, OR": [44.05, -123.35],
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

  /* ---- 2. Shows ---- */
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
    { band: "Jerry Garcia Symphonic Celebration (feat. John Kimock)", venue: "TD Pavilion at Highmark Mann · The Philly Pops", city: "Philadelphia, PA", date: "2026-08-28", real: true },
    { band: "Steve Kimock — Bobby Weir Celebration", venue: "Oregon Country Fair", city: "Veneta, OR", date: "2026-07-12", real: true },
    { band: "House Band (sample)", venue: "The Catalyst", city: "Santa Cruz, CA", date: "2026-07-15", sample: true },
    { band: "House Band (sample)", venue: "The Showbox", city: "Seattle, WA", date: "2026-07-22", sample: true },
    { band: "House Band (sample)", venue: "Antone's", city: "Austin, TX", date: "2026-08-05", sample: true },
    { band: "House Band (sample)", venue: "Variety Playhouse", city: "Atlanta, GA", date: "2026-08-12", sample: true },
    { band: "House Band (sample)", venue: "9:30 Club", city: "Washington, DC", date: "2026-08-19", sample: true },
    { band: "House Band (sample)", venue: "The Sinclair", city: "Cambridge, MA", date: "2026-08-26", sample: true },
    { band: "House Band (sample)", venue: "Ardmore Music Hall", city: "Ardmore, PA", date: "2026-09-04", sample: true }
  ];
  try {
    [window.dealMapRows, window.hotSauceMapRows].forEach(function (fn) {
      if (!fn) return;
      fn().forEach(function (r) {
        SHOWS.push({ band: r.band, venue: r.venue, city: r.city, date: r.date, real: true });
        if (r.coords && !CITY[r.city]) CITY[r.city] = r.coords;
      });
    });
  } catch (e) {}

  /* ---- clear-to-history: a show that's already happened drops off the map automatically.
     Any show dated before today is "history" — last night's gig is gone this morning, no upkeep. ---- */
  var TODAY_ISO = (function () { var d = new Date(); function p(n) { return (n < 10 ? "0" : "") + n; } return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); })();
  SHOWS = SHOWS.filter(function (s) { return !s.date || s.date >= TODAY_ISO; });

  /* ---- 3. Projection lat/lng → viewBox (0..960 x 0..600) ---- */
  function project(lat, lng) {
    var x = (lng - (-125)) / ((-66) - (-125)) * (915 - 40) + 40;
    var y = (lat - 24) / (49.5 - 24) * (70 - 560) + 560;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  /* ---- 4. US outline + graticule ---- */
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
  function toPath(pts, close) {
    return pts.map(function (p, i) { var xy = project(p[0], p[1]); return (i ? "L" : "M") + xy[0] + "," + xy[1]; }).join(" ") + (close ? " Z" : "");
  }
  var US_PATH = toPath(US_OUTLINE, true);
  function buildGraticule() {
    var lines = "";
    for (var lng = -120; lng <= -70; lng += 10) { var a = project(24, lng), b = project(50, lng); lines += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>'; }
    for (var lat = 25; lat <= 45; lat += 5) { var c = project(lat, -125), d = project(lat, -66); lines += '<line x1="' + c[0] + '" y1="' + c[1] + '" x2="' + d[0] + '" y2="' + d[1] + '"/>'; }
    return lines;
  }
  var US_GRATICULE = buildGraticule();

  /* ---- 4b. State borders — exact western straight lines + iconic rivers + key eastern lines.
     Curated at the same abstraction level as the outline; clipped to the land. ---- */
  var STATE_LINES = [
    [[42.0,-120.0],[39.0,-120.0],[35.0,-114.63],[34.3,-114.14],[32.72,-114.53]], // CA east (NV + Colorado River)
    [[42.0,-124.2],[42.0,-114.05]],                 // 42N: OR/CA, NV/OR, UT/ID south
    [[42.0,-117.0],[49.0,-117.0]],                  // -117: ID west (OR/ID, WA/ID)
    [[37.0,-114.05],[42.0,-114.05]],                // -114: NV/UT, AZ/UT
    [[37.0,-114.05],[37.0,-94.62]],                 // 37N: UT/AZ, CO/NM, KS/OK
    [[31.33,-109.05],[41.0,-109.05]],               // -109: four-corners vertical (UT/CO, AZ/NM)
    [[41.0,-111.05],[41.0,-102.05]],                // 41N: CO/WY, NE/CO
    [[41.0,-111.05],[45.0,-111.05]],                // -111: WY west
    [[45.0,-111.05],[45.0,-104.05]],                // 45N: MT/WY
    [[41.0,-104.05],[49.0,-104.05]],                // -104: WY/NE-SD, MT/ND
    [[37.0,-102.05],[41.0,-102.05]],                // -102: CO/KS, CO/NE
    [[43.0,-104.05],[43.0,-96.44]],                 // 43N: SD/NE
    [[40.0,-102.05],[40.0,-95.30]],                 // 40N: KS/NE
    [[32.0,-103.05],[36.5,-103.05]],                // -103: NM/TX (panhandle west)
    [[36.5,-103.05],[36.5,-100.00]],                // 36.5N: OK panhandle top
    [[43.0,-96.44],[41.5,-96.10],[40.6,-95.90],[39.6,-95.10],[39.1,-94.60]], // Missouri R (NE/IA/MO)
    [[47.2,-95.00],[45.0,-92.90],[43.5,-91.20],[42.5,-90.60],[41.4,-91.05],[40.4,-91.40],[38.8,-90.20],[37.0,-89.20],[35.1,-90.10],[33.6,-91.05],[32.3,-91.10],[31.0,-91.60],[30.0,-91.20],[29.95,-90.10]], // Mississippi R
    [[37.0,-89.20],[37.9,-88.00],[37.9,-86.50],[38.3,-85.80],[38.7,-84.90],[38.4,-82.60],[39.2,-81.50]], // Ohio R
    [[36.50,-89.70],[36.50,-81.70]],                // 36.5N: TN/KY (VA)
    [[35.00,-90.30],[35.00,-81.70]],                // 35N: TN south
    [[30.70,-85.00],[35.00,-85.00]],                // -85: AL/GA
    [[30.20,-88.40],[35.00,-88.20]],                // -88: MS/AL
    [[39.72,-80.52],[39.72,-75.80]],                // Mason–Dixon: PA/MD
    [[38.40,-80.52],[42.30,-80.52]]                 // -80.5: OH-WV/PA-ish
  ];
  var STATE_PATH = STATE_LINES.map(function (ln) { return toPath(ln, false); }).join(" ");

  /* ---- 4c. Chapters (= Ambassador patches / Rosebud regions). centroid + festival key. ---- */
  var CHAPTERS = [
    { name: "Bay Area",                c: [37.9, -122.3], fk: "bayarea" },
    { name: "Pacific Northwest",       c: [46.2, -122.3], fk: "pnw" },
    { name: "Mountain West",           c: [39.6, -105.8], fk: "rockies" },
    { name: "Southwest",               c: [34.2, -114.5], fk: "rockies" },
    { name: "Texas",                   c: [30.6, -97.5],  fk: "lonestar" },
    { name: "South Central",           c: [35.4, -90.5],  fk: "lonestar" },
    { name: "Midwest",                 c: [40.6, -89.5],  fk: "greatlakes" },
    { name: "Great Lakes",             c: [42.6, -84.0],  fk: "greatlakes" },
    { name: "Southeast",               c: [33.4, -83.8],  fk: "southeast" },
    { name: "Mid-Atlantic",            c: [39.3, -77.2],  fk: "midatl" },
    { name: "Northeast + New England", c: [43.2, -72.6],  fk: "northeast" }
  ];
  function shortName(n) { return n.split(" + ")[0]; }

  function haversineMi(a, b, c, d) {
    var R = 3958.8, toR = Math.PI / 180;
    var dLat = (c - a) * toR, dLng = (d - b) * toR;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function nearestChapter(lat, lng) {
    var best = CHAPTERS[0], bd = 1e9;
    CHAPTERS.forEach(function (ch) { var d = haversineMi(lat, lng, ch.c[0], ch.c[1]); if (d < bd) { bd = d; best = ch; } });
    return best;
  }
  // assign every locatable show to its nearest chapter
  var CH_INDEX = {}; CHAPTERS.forEach(function (ch) { ch.shows = []; CH_INDEX[ch.name] = ch; });
  SHOWS.forEach(function (s) { var ll = CITY[s.city]; if (!ll) return; s._ll = ll; var ch = nearestChapter(ll[0], ll[1]); ch.shows.push(s); s._chapter = ch.name; });
  CHAPTERS.forEach(function (ch) { ch.shows.sort(function (a, b) { return a.date < b.date ? -1 : 1; }); });
  function chapterByName(n) { return CH_INDEX[n] || null; }
  function festsFor(ch) { try { return (window.DD_FESTIVALS || []).filter(function (f) { return f.region === ch.fk; }); } catch (e) { return []; } }

  var FULL_VB = [0, 0, 960, 600];
  function boxToVB(b) {
    var pts = [project(b.latMax, b.lngMin), project(b.latMin, b.lngMax), project(b.latMax, b.lngMax), project(b.latMin, b.lngMin)];
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var w = maxX - minX, h = maxY - minY;
    minX -= w * 0.14; maxX += w * 0.14; minY -= h * 0.16; maxY += h * 0.16;
    w = maxX - minX; h = maxY - minY;
    var aspect = 960 / 600, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    return [cx - w / 2, cy - h / 2, w, h];
  }
  function chapterVB(ch) {
    if (ch.shows.length) {
      var lats = ch.shows.map(function (s) { return s._ll[0]; }), lngs = ch.shows.map(function (s) { return s._ll[1]; });
      var b = { latMin: Math.min.apply(null, lats), latMax: Math.max.apply(null, lats), lngMin: Math.min.apply(null, lngs), lngMax: Math.max.apply(null, lngs) };
      if (b.latMax - b.latMin < 2.4) { var mLat = (b.latMin + b.latMax) / 2; b.latMin = mLat - 1.6; b.latMax = mLat + 1.6; }
      if (b.lngMax - b.lngMin < 3.2) { var mLng = (b.lngMin + b.lngMax) / 2; b.lngMin = mLng - 2.4; b.lngMax = mLng + 2.4; }
      return boxToVB(b);
    }
    return boxToVB({ latMin: ch.c[0] - 4.2, latMax: ch.c[0] + 4.2, lngMin: ch.c[1] - 6.0, lngMax: ch.c[1] + 6.0 });
  }

  function fmtDate(iso) { var d = new Date(iso + "T12:00:00"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function notified(id) { try { return !!localStorage.getItem("dd.showmap.notify." + id); } catch (e) { return false; } }
  function setNotified(id) { try { localStorage.setItem("dd.showmap.notify." + id, "1"); } catch (e) {} }
  function showId(s) { return (s.band + s.date).replace(/[^a-z0-9]/gi, "").toLowerCase(); }

  /* ---- 5. Render ---- */
  function render(host) {
    var level = "nation", curVB = FULL_VB.slice(), rafId = 0, fallbackT = 0, userLoc = null, radiusMi = 50;

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
        '<div class="showmap-farrah" id="farrahMap"></div>' +
        '<div class="showmap-region" hidden>' +
          '<button class="showmap-back" hidden>‹ All chapters</button>' +
          '<button class="showmap-loc">📍 Use my location</button>' +
          '<select class="showmap-select" aria-label="Pick a chapter">' +
            '<option value="">Pick a chapter…</option>' +
            CHAPTERS.map(function (ch) { return '<option value="' + esc(ch.name) + '">' + esc(shortName(ch.name)) + '</option>'; }).join('') +
          '</select>' +
          '<select class="showmap-radius" hidden aria-label="Radius (miles)">' +
            [25,50,100,200,300].map(function(m){ return '<option value="'+m+'"'+(m===50?' selected':'')+'>'+m+' mi</option>'; }).join('') +
          '</select>' +
          '<span class="showmap-near"></span>' +
        '</div>' +
        '<div class="showmap-legend">' +
          '<span class="lg real">● verified date</span>' +
          '<span class="lg sample">● sample (from our venues)</span>' +
          '<span class="lg dim">◌ chapter waiting — tap to seed it</span>' +
          '<span class="showmap-honest">Honest-state — sample rows labeled; nothing sells here.</span>' +
        '</div>' +
        '<div class="showmap-wrap">' +
          '<svg class="showmap-svg" viewBox="0 0 960 600" role="img" aria-label="US map of upcoming shows" preserveAspectRatio="xMidYMid meet">' +
            '<defs><clipPath id="usClip"><path d="' + US_PATH + '"></path></clipPath></defs>' +
            '<path class="us-land" d="' + US_PATH + '"></path>' +
            '<g class="us-grat" clip-path="url(#usClip)">' + US_GRATICULE + '</g>' +
            '<path class="us-states" clip-path="url(#usClip)" d="' + STATE_PATH + '"></path>' +
            '<g class="sm-you"></g>' +
            '<g class="sm-dots"></g>' +
            '<g class="sm-badges"></g>' +
          '</svg>' +
          '<div class="showmap-pop" id="showmapPop" hidden></div>' +
        '</div>' +
        '<div class="showmap-panel" id="showmapPanel" hidden></div>' +
      '</div>';

    var svg = host.querySelector(".showmap-svg");
    var dotsG = host.querySelector(".sm-dots");
    var badgeG = host.querySelector(".sm-badges");
    var youG = host.querySelector(".sm-you");
    var pop = host.querySelector("#showmapPop");
    var wrap = host.querySelector(".showmap-wrap");
    var regionRow = host.querySelector(".showmap-region");
    var nearEl = host.querySelector(".showmap-near");
    var radiusSel = host.querySelector(".showmap-radius");
    function showRadius(on){ if (radiusSel) radiusSel.hidden = !on; }
    var sel = host.querySelector(".showmap-select");
    var backBtn = host.querySelector(".showmap-back");
    var farrahEl = host.querySelector("#farrahMap");
    var panel = host.querySelector("#showmapPanel");

    function farrah(html) { farrahEl.innerHTML = '🎙️ ' + html; }

    /* --- dots: sized as fraction of viewBox → constant on-screen. mode: 'nation' faint, 'chapter' bold+labels --- */
    function drawDots(vbW, chapterName) {
      var isCh = !!chapterName;
      var rCore = (isCh ? 0.0066 : 0.0042) * vbW, rPulse = (isCh ? 0.011 : 0.007) * vbW, sw = 0.0016 * vbW;
      var vx0 = curVB[0], vy0 = curVB[1], vx1 = curVB[0] + curVB[2], vy1 = curVB[1] + curVB[3];
      var html = "";
      SHOWS.forEach(function (s, i) {
        var ll = s._ll; if (!ll) return;
        if (isCh && chapterName !== '*' && s._chapter !== chapterName) return;   // chapter view filters; '*' = radius (all)
        var p = project(ll[0], ll[1]);
        var cls = "smdot " + (s.sample ? "sample" : "real") + (isCh ? "" : " faint");
        html += '<g class="' + cls + '" data-i="' + i + '"' + (isCh ? ' tabindex="0" role="button"' : '') +
          ' aria-label="' + esc(s.band + " at " + s.venue + ", " + s.city) + '">' +
          '<circle class="smpulse" cx="' + p[0] + '" cy="' + p[1] + '" r="' + rPulse.toFixed(1) + '"></circle>' +
          '<circle class="smcore" cx="' + p[0] + '" cy="' + p[1] + '" r="' + rCore.toFixed(1) + '" style="stroke-width:' + sw.toFixed(2) + '"></circle>';
        if (isCh && p[0] >= vx0 && p[0] <= vx1 && p[1] >= vy0 && p[1] <= vy1) {
          html += '<text class="smlabel" x="' + (p[0] + rCore + 2) + '" y="' + (p[1] + rCore * 0.4) +
            '" style="font-size:' + (0.019 * vbW).toFixed(1) + 'px;stroke-width:' + (0.0022 * vbW).toFixed(2) + 'px">' + esc(s.city.replace(/,.*$/, "")) + '</text>';
        }
        html += '</g>';
      });
      dotsG.innerHTML = html;
      if (isCh) dotsG.querySelectorAll(".smdot").forEach(function (g) {
        var i = +g.getAttribute("data-i");
        g.addEventListener("click", function (e) { e.stopPropagation(); showPop(i, g); });
        g.addEventListener("mouseenter", function () { showPop(i, g); });
        g.addEventListener("focus", function () { showPop(i, g); });
      });
    }

    /* --- chapter badges (national only): lit=count, dim=+ (tap to seed) --- */
    function drawBadges(show) {
      if (!show) { badgeG.innerHTML = ""; return; }
      var vbW = 960, rB = 0.03 * vbW, fC = 0.026 * vbW, fL = 0.017 * vbW;
      badgeG.innerHTML = CHAPTERS.map(function (ch) {
        var p = project(ch.c[0], ch.c[1]), n = ch.shows.length, live = n > 0;
        var sz = live ? (rB + Math.min(n, 8) * 0.0022 * vbW) : rB * 0.86;
        return '<g class="smbadge' + (live ? "" : " dim") + '" data-ch="' + esc(ch.name) + '" tabindex="0" role="button" ' +
          'aria-label="' + esc(ch.name + (live ? (": " + n + " shows") : ": no dates yet — add the first")) + '">' +
          '<circle class="bdot" cx="' + p[0] + '" cy="' + p[1] + '" r="' + sz.toFixed(1) + '"></circle>' +
          '<text class="bnum" x="' + p[0] + '" y="' + (p[1] + fC * 0.34) + '" style="font-size:' + fC.toFixed(1) + 'px">' + (live ? n : "+") + '</text>' +
          '<text class="blbl" x="' + p[0] + '" y="' + (p[1] + sz + fL * 1.1) + '" style="font-size:' + fL.toFixed(1) + 'px">' + esc(shortName(ch.name)) + '</text>' +
          '</g>';
      }).join("");
      badgeG.querySelectorAll(".smbadge").forEach(function (g) {
        var name = g.getAttribute("data-ch");
        g.addEventListener("click", function (e) { e.stopPropagation(); drill(name); });
        g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); drill(name); } });
      });
    }

    /* --- viewBox tween --- */
    function easeIO(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function animateTo(target, ms, chapterName, onDone) {
      hidePop();
      if (rafId) cancelAnimationFrame(rafId);
      if (fallbackT) clearTimeout(fallbackT);
      var start = curVB.slice(), t0 = null, done = false;
      drawDots(target[2], chapterName);
      function finish() {                              // guaranteed destination (works even if rAF is paused/throttled)
        if (done) return; done = true;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        curVB = target.slice(); svg.setAttribute("viewBox", curVB.join(" ")); drawDots(curVB[2], chapterName);
        if (onDone) onDone();
      }
      function step(ts) {
        if (done) return;
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / ms), e = easeIO(k);
        var vb = start.map(function (v, idx) { return v + (target[idx] - v) * e; });
        svg.setAttribute("viewBox", vb.join(" "));
        if (k < 1) rafId = requestAnimationFrame(step); else finish();
      }
      rafId = requestAnimationFrame(step);
      fallbackT = setTimeout(finish, ms + 250);        // safety net: if no frames tick, snap to the zoomed view
    }

    function clearYou() { youG.innerHTML = ""; }
    function markYou(lat, lng, vbW) {
      var p = project(lat, lng), r = 0.011 * (vbW || curVB[2]);
      youG.innerHTML =
        '<circle class="you-ring" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (r * 1.9).toFixed(1) + '"></circle>' +
        '<circle class="you-dot" cx="' + p[0] + '" cy="' + p[1] + '" r="' + r.toFixed(1) + '"></circle>';
    }

    /* --- popover (Notify me) --- */
    function showPop(i, gEl) {
      var s = SHOWS[i], id = showId(s), done = notified(id);
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

    /* --- wiring into the app's existing flows (guarded) --- */
    function addDate(chapterName) {
      hidePop();
      if (typeof window.closeMap === "function") { try { window.closeMap(); } catch (e) {} }
      if (typeof window.openGig === "function") { try { window.openGig("date", chapterName); return; } catch (e) {} }
      if (window.toast) window.toast("📅 Add a date in " + chapterName + " — opening the date desk.");
    }
    function buyTicket(s) {
      hidePop();
      try { window.CURBUY = { band: s.band, venue: s.venue, price: s.price || "" }; } catch (e) {}
      if (typeof window.buy === "function") { try { window.buy("ticket"); return; } catch (e) {} }
      if (window.toast) window.toast("🎟️ " + s.band + " — secure checkout. (Demo)");
    }

    /* --- the drill panel (Rosebud show list) --- */
    function renderPanel(ch) {
      var fests = festsFor(ch);
      var rows = ch.shows.map(function (s) {
        var id = showId(s), done = notified(id);
        return '<div class="prow">' +
          '<div class="pdt">' + esc(fmtDate(s.date).split(" ")[0]) + '<small>' + esc(fmtDate(s.date).split(" ")[1]) + '</small></div>' +
          '<div class="pinfo"><b>' + esc(s.band) + (s.sample ? ' <em class="pop-tag">SAMPLE</em>' : '') + '</b><span>' + esc(s.venue) + ' · ' + esc(s.city) + '</span></div>' +
          '<button class="ptix" data-i="' + SHOWS.indexOf(s) + '">🎟️ Tickets</button>' +
          '<button class="pnotify' + (done ? ' done' : '') + '" data-id="' + id + '">' + (done ? '✓' : '🔔') + '</button>' +
          '</div>';
      }).join("");
      var fhtml = fests.length ? ('<div class="pfhead">🎆 Summer festivals</div>' + fests.map(function (f) {
        var when = f.start ? (f.start.slice(5) + (f.end && f.end !== f.start ? ("–" + f.end.slice(5)) : "")) : "Summer";
        return '<div class="pfrow"><div class="pfdt">🎆<small>' + esc(f.days || "") + 'd</small></div>' +
          '<div class="pinfo"><b>' + esc(f.name) + '</b><span>' + esc(f.city || "") + ' · ' + esc(when) + '</span></div>' +
          '<span class="pftag">Festival</span></div>';
      }).join("")) : "";
      if (!ch.shows.length && !fests.length) {
        panel.innerHTML = '<button class="paddbig" data-ch="' + esc(ch.name) + '">📅 Be the first to post a date in ' + esc(shortName(ch.name)) + '</button>';
      } else {
        panel.innerHTML = fhtml + rows + '<button class="padd" data-ch="' + esc(ch.name) + '">＋ Add a date in ' + esc(shortName(ch.name)) + '</button>';
      }
      panel.hidden = false;
      panel.querySelectorAll(".ptix").forEach(function (b) { b.onclick = function () { buyTicket(SHOWS[+b.getAttribute("data-i")]); }; });
      panel.querySelectorAll(".pnotify").forEach(function (b) { b.onclick = function () { setNotified(b.getAttribute("data-id")); b.classList.add("done"); b.textContent = "✓"; if (window.toast) window.toast("🔔 Noted — we'll ping you."); }; });
      panel.querySelectorAll(".padd,.paddbig").forEach(function (b) { b.onclick = function () { addDate(b.getAttribute("data-ch")); }; });
    }

    /* --- levels --- */
    function toNation() {
      level = "nation"; clearYou();
      host.querySelectorAll(".showmap-seg button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-mode") === "national"); });
      backBtn.hidden = true; regionRow.hidden = true; panel.hidden = true; showRadius(false);
      animateTo(FULL_VB.slice(), 560, null, function () { drawBadges(true); });
      var lit = CHAPTERS.filter(function (c) { return c.shows.length; }), tot = 0;
      lit.forEach(function (c) { tot += c.shows.length; });
      var nf = 0; try { nf = (window.DD_FESTIVALS || []).length; } catch (e) {}
      farrah('The bus is rolling through <b>' + lit.length + ' chapter' + (lit.length !== 1 ? 's' : '') + '</b> tonight — <b>' + tot + ' shows</b>' + (nf ? (' + <b>' + nf + ' summer festivals</b>') : '') + ' on the board. Tap a lit region — or a <b>dark one to post the first date.</b>');
    }
    function drill(chapterName) {
      var ch = chapterByName(chapterName); if (!ch) return;
      level = chapterName;
      host.querySelectorAll(".showmap-seg button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-mode") === "local"); });
      drawBadges(false); clearYou(); showRadius(false);
      regionRow.hidden = false; backBtn.hidden = false; sel.value = ch.name;
      nearEl.textContent = ch.shows.length ? (ch.shows.length + (ch.shows.length === 1 ? " show" : " shows")) : "waiting — seed it";
      animateTo(chapterVB(ch), 620, chapterName);
      renderPanel(ch);
      var fests = festsFor(ch);
      if (ch.shows.length) farrah('<b>' + esc(shortName(ch.name)) + '</b> — <b>' + ch.shows.length + ' show' + (ch.shows.length > 1 ? 's' : '') + '</b>' + (fests.length ? (' + <b>' + fests.length + ' festival' + (fests.length > 1 ? 's' : '') + '</b>') : '') + ' on the board. Grab tickets, or add your own date.');
      else farrah('<b>' + esc(shortName(ch.name)) + '</b> is quiet right now. Light it up — <b>add the first date</b> and the whole chapter sees it.');
      try { localStorage.setItem("dd.showmap.chapter", ch.name); } catch (e) {}
    }

    /* zoom to a mile-radius around the viewer (default 50 mi, up to 300) and count shows inside it */
    function zoomToRadius(mi) {
      if (!userLoc) return;
      radiusMi = mi;
      var lat = userLoc[0], lng = userLoc[1];
      var latSpan = mi / 69, lngSpan = mi / (69 * Math.max(0.25, Math.cos(lat * Math.PI / 180)));
      var tvb = boxToVB({ latMin: lat - latSpan, latMax: lat + latSpan, lngMin: lng - lngSpan, lngMax: lng + lngSpan });
      level = "radius";
      host.querySelectorAll(".showmap-seg button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-mode") === "local"); });
      drawBadges(false); regionRow.hidden = false; backBtn.hidden = false; showRadius(true);
      animateTo(tvb, 600, "*");                 // '*' = show every dot inside the radius view
      markYou(lat, lng, tvb[2]);
      var n = SHOWS.filter(function (s) { return s._ll && haversineMi(lat, lng, s._ll[0], s._ll[1]) <= mi; }).length;
      nearEl.textContent = n + (n === 1 ? " show" : " shows") + " within " + mi + " mi";
      if (radiusSel) radiusSel.value = String(mi);
    }
    function useLocation() {
      if (!navigator.geolocation) { nearEl.textContent = "Location off — pick a chapter"; return; }
      nearEl.textContent = "📍 Locating…";
      navigator.geolocation.getCurrentPosition(function (pos) {
        userLoc = [pos.coords.latitude, pos.coords.longitude];
        zoomToRadius(radiusMi);              // default 50 mi
      }, function () { nearEl.textContent = "Location blocked — pick a chapter"; }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
    }

    function setMode(m) {
      if (m === "national") { toNation(); return; }
      // Near me → GPS radius (default 50 mi). The chapter dropdown still drills a chapter manually.
      host.querySelectorAll(".showmap-seg button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-mode") === "local"); });
      regionRow.hidden = false; backBtn.hidden = false; drawBadges(false);
      useLocation();
    }

    /* --- controls --- */
    host.querySelectorAll(".showmap-seg button").forEach(function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); }); });
    backBtn.addEventListener("click", toNation);
    host.querySelector(".showmap-loc").addEventListener("click", function () { clearYou(); useLocation(); });
    if (radiusSel) radiusSel.addEventListener("change", function () { zoomToRadius(+radiusSel.value || 50); });
    sel.addEventListener("change", function () { if (sel.value) { showRadius(false); drill(sel.value); } });
    wrap.addEventListener("mouseleave", hidePop);
    document.addEventListener("click", function (e) {
      if (pop.hidden) return;
      if (!pop.contains(e.target) && !e.target.closest(".smdot")) hidePop();
    });
    var x = host.querySelector(".showmap-x");
    if (x) x.onclick = function () { host.style.display = "none"; try { localStorage.setItem("dd.showmap.hidden", "1"); } catch (e) {} };

    // boot at national
    drawDots(FULL_VB[2], null);
    drawBadges(true);
    toNation();
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
