/* shakedown_citi_shows.js — Shakedown Citi real 2026 schedule.
 * SOURCE: the band's own public pages — https://www.shakedownciti.com
 *         + their public socials (FB/IG/YouTube), captured 2026-08-03. Jam band, "born in the heart
 *         of a Grateful Dead parking lot at Citi Field in 2023" — channels the Dead, doesn't imitate.
 *         Region: Mid-Atlantic (touring NY/NJ/CT).
 * Band #5 on the DeadDance Mid-Atlantic calendar — SAME seed shape as Karl's Garcia Band (kgb_shows.js)
 *   and Crickets and Cicadas (cnc_shows.js): a [date, project, venue, city, state, time] table -> rows.
 * Honest-state: every date here came from the band's public UPCOMING schedule. Nothing is invented.
 *   NOTE (no duplicate): their 2026-08-03 Musikfest set (PNC/Stadtplatz, 9:30 PM) is ALREADY on the
 *   Mid-Atlantic calendar via MF_DEAD_ACTS in index.html — so it is INTENTIONALLY NOT repeated here.
 * TICKET: like KGB/CNC, each FREE row resolves to the canonical FREE band ticket — calendarRows sets
 *   price:"FREE" and NO external url, so the home calendar opens
 *   ticket.html?band=Shakedown Citi&price=FREE (the band ticket Michael sends the band).
 *   SEAM (one honest divergence from the pure KGB/CNC shape): the 2026-08-09 Le Poisson Rouge date is
 *   an EXTERNALLY-ticketed PAID show ($32.96 GA, sold off-platform via KYD Labs) — NOT a DeadDance free
 *   ticket. So that ONE row carries a price + url, which makes the calendar render it as an external
 *   "Tix ->" row (never the free band ticket). Every other row stays FREE, exactly like KGB/CNC. */
(function (root) {
  "use strict";
  // approx lat/lng per town — town centroids, accurate enough to plot on the map (NOT precise venue pins)
  var CO = {
    "Fairfield, CT":  [41.14, -73.26], "New York, NY":  [40.73, -74.00],
    "Patchogue, NY":  [40.77, -73.02], "Lake Como, NJ": [40.16, -74.03],
    "Simsbury, CT":   [41.88, -72.80], "Brooklyn, NY":  [40.68, -73.94]
  };
  var SC = "Shakedown Citi";
  // band-level links (site / Facebook / Instagram / YouTube) — attached to the band, not a per-show url
  root.SHAKEDOWN_CITI_LINKS = {
    site:      "https://www.shakedownciti.com",
    facebook:  "https://www.facebook.com/profile.php?id=61552688850386",
    instagram: "https://www.instagram.com/shakedownciti/",
    youtube:   "https://www.youtube.com/@ShakedownCiti"
  };
  /* Logo: the band's REAL artwork drops in as shakedown_citi_logo.png (band supplies it — the upload IS
     consent). Until then, shakedown_citi_logo.svg is DeadDance's own honest placeholder badge. Never scraped. */
  root.SHAKEDOWN_CITI_LOGO = "shakedown_citi_logo.png";
  root.SHAKEDOWN_CITI_LOGO_FALLBACK = "shakedown_citi_logo.svg";
  // [date, project, venue, city, state, time, private, priceOverride, urlOverride]
  //   private (idx6): true -> dropped from the public list (none here). priceOverride/urlOverride
  //   (idx7/8): set ONLY for the paid/external Le Poisson Rouge date; everything else stays FREE.
  var D = [
    ["2026-08-07", SC, "FTC Stage One",              "Fairfield", "CT", ""],
    ["2026-08-09", SC, "Le Poisson Rouge",           "New York",  "NY", "", false, "$32.96 · Tix ->", "https://www.shakedownciti.com"], // PAID/EXTERNAL — KYD Labs, NOT a DeadDance free ticket
    ["2026-08-17", SC, "89 North",                   "Patchogue", "NY", ""],
    ["2026-08-22", SC, "Bar Anticipation",           "Lake Como", "NJ", ""],
    ["2026-09-04", SC, "Talcott Mountain Collective","Simsbury",  "CT", ""],
    ["2026-09-13", SC, "Industry City Bandshell",    "Brooklyn",  "NY", ""]
  ];
  var SHOWS = D.map(function (a) {
    var city = a[3], st = a[4], key = city && st ? city + ", " + st : "";
    return { date: a[0], project: a[1], venue: a[2], city: city, state: st,
      time: a[5] || "", private: a[6] === true, coords: key && CO[key] ? CO[key] : null,
      price: a[7] || "", url: a[8] || "", links: root.SHAKEDOWN_CITI_LINKS };
  });
  root.SHAKEDOWN_CITI_SHOWS = SHOWS;
  root.SHAKEDOWN_CITI_SHOWS_PUBLIC = SHOWS.filter(function (s) { return !s.private; });
  // Calendar shape: {date, band, venue, price, type, logo}. FREE row: price:"FREE" + NO url -> resolves to
  //   the canonical FREE band ticket (ticket.html?band=Shakedown Citi&price=FREE) in index.html.
  //   The one PAID/EXTERNAL row carries its own price + url -> calendar renders it as an external "Tix ->".
  root.shakedownCitiCalendarRows = function () {
    return root.SHAKEDOWN_CITI_SHOWS_PUBLIC.map(function (s) {
      var row = { date: s.date, band: s.project,
        venue: s.venue + (s.city ? ", " + s.city + " " + s.state : "") + (s.time ? " · " + s.time : ""),
        price: s.url ? (s.price || "Tix ->") : "FREE", type: "grateful_dead", deal: true, logo: root.SHAKEDOWN_CITI_LOGO };
      if (s.url) row.url = s.url; // external/paid -> not the free band ticket
      return row;
    });
  };
  // Map shape for dd_showmap.js: {band, venue, city, date, time, real, coords}
  root.shakedownCitiMapRows = function () {
    return root.SHAKEDOWN_CITI_SHOWS_PUBLIC.filter(function (s) { return s.coords; }).map(function (s) {
      return { band: s.project, venue: s.venue, city: s.city + ", " + s.state, date: s.date, time: s.time, real: true, coords: s.coords };
    });
  };
})(typeof window !== "undefined" ? window : this);
