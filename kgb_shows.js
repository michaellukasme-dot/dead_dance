/* kgb_shows.js — Karl's Garcia Band ("KGB") real 2026 schedule.
 * SOURCE: the band's own public pages — https://www.karlsgarciaband.com/all-shows
 *         + setlist.fm, captured 2026-08-03. Jerry Garcia Band tribute (JGB), Mid-Atlantic (PA/NJ).
 * Band #3 on the DeadDance Mid-Atlantic calendar — same seed shape as DEAL (deal_shows.js) and
 *   Hot Sauce (hot_sauce_shows.js): a [date, project, venue, city, state, time] table → calendar rows.
 * Honest-state: every date here came from the band's public schedule. Nothing is invented.
 *   The 2026-07-19 Robbinsville date ALREADY PLAYED — it stays in the table for the record, and the
 *   calendar/map "clear-to-history" filters drop any date before today, so it shows as past (off upcoming).
 * TICKET: unlike DEAL/Hot Sauce (which link out to Facebook "Info →"), each KGB row resolves to the
 *   canonical FREE band ticket — calendarRows sets price:"FREE" and NO external url, so the home
 *   calendar opens ticket.html?band=Karl's Garcia Band&price=FREE (the band ticket Michael sends Karl). */
(function (root) {
  "use strict";
  // approx lat/lng per town — town centroids, accurate enough to plot on the map (NOT precise venue pins)
  var CO = {
    "Robbinsville, NJ": [40.21, -74.62],
    "Wayne, PA":        [40.04, -75.39],
    "Lake Como, NJ":    [40.16, -74.03]
  };
  var KGB = "Karl's Garcia Band";
  // band-level links (site / all-shows / Facebook / Instagram / phone) — attached to the band, not a per-show url
  root.KGB_LINKS = {
    site:     "https://www.karlsgarciaband.com",
    allShows: "https://www.karlsgarciaband.com/all-shows",
    facebook: "https://www.facebook.com/people/KGB-Karls-Garcia-Band/61554840195938/",
    instagram:"https://www.instagram.com/karlsgarciaband/",
    phone:    "+1 215-704-2094"
  };
  /* Logo: the band's REAL artwork drops in as kgb_logo.png (band supplies it — the upload IS consent).
     Until then, kgb_logo.svg is DeadDance's own honest placeholder badge. We never scrape it. */
  root.KGB_LOGO = "kgb_logo.png";
  root.KGB_LOGO_FALLBACK = "kgb_logo.svg";
  // [date, project, venue, city, state, time]
  var D = [
    ["2026-07-19", KGB, "German American Society", "Robbinsville", "NJ", ""],          // ALREADY PLAYED — clear-to-history drops it from upcoming
    ["2026-08-07", KGB, "118 North",               "Wayne",        "PA", ""],
    ["2026-08-08", KGB, "Bar Anticipation",        "Lake Como",    "NJ", ""]
  ];
  var SHOWS = D.map(function (a) {
    var city = a[3], st = a[4], key = city && st ? city + ", " + st : "";
    return { date: a[0], project: a[1], venue: a[2], city: city, state: st,
      time: a[5] || "", private: a[6] === true, coords: key && CO[key] ? CO[key] : null,
      links: root.KGB_LINKS };
  });
  root.KGB_SHOWS = SHOWS;
  root.KGB_SHOWS_PUBLIC = SHOWS.filter(function (s) { return !s.private; });
  // Calendar shape: {date, band, venue, price, type, logo}. price:"FREE" + NO url → resolves to the
  //   canonical FREE band ticket (ticket.html?band=Karl's Garcia Band&price=FREE) in index.html.
  root.kgbCalendarRows = function () {
    return root.KGB_SHOWS_PUBLIC.map(function (s) {
      return { date: s.date, band: s.project,
        venue: s.venue + (s.city ? ", " + s.city + " " + s.state : "") + (s.time ? " · " + s.time : ""),
        price: "FREE", type: "grateful_dead", deal: true, logo: root.KGB_LOGO };
    });
  };
  // Map shape for dd_showmap.js: {band, venue, city, date, time, real, coords}
  root.kgbMapRows = function () {
    return root.KGB_SHOWS_PUBLIC.filter(function (s) { return s.coords; }).map(function (s) {
      return { band: s.project, venue: s.venue, city: s.city + ", " + s.state, date: s.date, time: s.time, real: true, coords: s.coords };
    });
  };
})(typeof window !== "undefined" ? window : this);
