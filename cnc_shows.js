/* cnc_shows.js — Crickets and Cicadas real 2026 schedule.
 * SOURCE: the band's own public pages — https://cricketsandcicadasband.com
 *         + setlist.fm (https://www.setlist.fm/setlists/crickets-and-cicadas-5be063e0.html),
 *         captured 2026-08-03. Grateful Dead tribute, NJ/PA (touring the Mid-Atlantic + NY).
 * Band #4 on the DeadDance Mid-Atlantic calendar — same seed shape as DEAL (deal_shows.js) and
 *   Hot Sauce (hot_sauce_shows.js): a [date, project, venue, city, state, time] table → calendar rows.
 * Honest-state: every date here came from the band's public UPCOMING schedule. Nothing is invented.
 * TICKET: each row resolves to the canonical FREE band ticket — calendarRows sets price:"FREE" and
 *   NO external url, so the home calendar opens ticket.html?band=Crickets and Cicadas&price=FREE
 *   (the band ticket Michael sends the band). */
(function (root) {
  "use strict";
  // approx lat/lng per town — town centroids, accurate enough to plot on the map (NOT precise venue pins)
  var CO = {
    "Barrington, NJ":        [39.87, -75.06], "Spring City, PA":       [40.18, -75.55],
    "Haddon Heights, NJ":    [39.88, -75.06], "Whiteford, MD":         [39.71, -76.32],
    "Arnold, MD":            [39.03, -76.50], "Richmond, VA":          [37.54, -77.44],
    "Atlantic City, NJ":     [39.36, -74.42], "Livingston Manor, NY":  [41.90, -74.83],
    "Syracuse, NY":          [43.05, -76.15], "Medford, NJ":           [39.90, -74.82],
    "Clementon, NJ":         [39.81, -74.98]
  };
  var CNC = "Crickets and Cicadas";
  // band-level links (site / Facebook / Instagram / setlist.fm / archive.org) — attached to the band
  root.CNC_LINKS = {
    site:      "https://cricketsandcicadasband.com",
    facebook:  "https://www.facebook.com/cricketsandcicadas",
    instagram: "https://www.instagram.com/crickets_and_cicadas",
    setlistfm: "https://www.setlist.fm/setlists/crickets-and-cicadas-5be063e0.html",
    archive:   "https://archive.org/details/CricketsAndCicadasBand"
  };
  /* Logo: the band's REAL artwork drops in as cnc_logo.png (band supplies it — the upload IS consent).
     Until then, cnc_logo.svg is DeadDance's own honest placeholder badge. We never scrape it. */
  root.CNC_LOGO = "cnc_logo.png";
  root.CNC_LOGO_FALLBACK = "cnc_logo.svg";
  // [date, project, venue, city, state, time]
  var D = [
    ["2026-08-06", CNC, "Tonewood Brewing",                 "Barrington",       "NJ", ""],
    ["2026-08-07", CNC, "The Gem Music Hall",               "Spring City",      "PA", ""],
    ["2026-08-08", CNC, "Groove at the Grove 2026",         "Haddon Heights",   "NJ", ""],
    ["2026-08-09", CNC, "Slate Farm Brewery",               "Whiteford",        "MD", ""],
    ["2026-08-13", CNC, "Mothers Peninsula Grille",         "Arnold",           "MD", ""],
    ["2026-08-14", CNC, "Ripple Ray's",                     "Richmond",         "VA", ""],
    ["2026-08-16", CNC, "The Seed: A Living Beer Project",  "Atlantic City",    "NJ", ""],
    ["2026-08-22", CNC, "Catskill Brewery",                 "Livingston Manor", "NY", ""],
    ["2026-08-24", CNC, "Funk 'n Waffles",                  "Syracuse",         "NY", ""],
    ["2026-08-29", CNC, "Farm Truck Brewing",               "Medford",          "NJ", ""],
    ["2026-08-30", CNC, "Honey Grove Dispensary",           "Clementon",        "NJ", ""]
  ];
  var SHOWS = D.map(function (a) {
    var city = a[3], st = a[4], key = city && st ? city + ", " + st : "";
    return { date: a[0], project: a[1], venue: a[2], city: city, state: st,
      time: a[5] || "", private: a[6] === true, coords: key && CO[key] ? CO[key] : null,
      links: root.CNC_LINKS };
  });
  root.CNC_SHOWS = SHOWS;
  root.CNC_SHOWS_PUBLIC = SHOWS.filter(function (s) { return !s.private; });
  // Calendar shape: {date, band, venue, price, type, logo}. price:"FREE" + NO url → resolves to the
  //   canonical FREE band ticket (ticket.html?band=Crickets and Cicadas&price=FREE) in index.html.
  root.cncCalendarRows = function () {
    return root.CNC_SHOWS_PUBLIC.map(function (s) {
      return { date: s.date, band: s.project,
        venue: s.venue + (s.city ? ", " + s.city + " " + s.state : "") + (s.time ? " · " + s.time : ""),
        price: "FREE", type: "grateful_dead", deal: true, logo: root.CNC_LOGO };
    });
  };
  // Map shape for dd_showmap.js: {band, venue, city, date, time, real, coords}
  root.cncMapRows = function () {
    return root.CNC_SHOWS_PUBLIC.filter(function (s) { return s.coords; }).map(function (s) {
      return { band: s.project, venue: s.venue, city: s.city + ", " + s.state, date: s.date, time: s.time, real: true, coords: s.coords };
    });
  };
})(typeof window !== "undefined" ? window : this);
