/* rift_shows.js — Rift (Philadelphia's Phish Tribute) real 2026 schedule.
 * SOURCE: the band's own public pages — https://riftphilly.com
 *         + their public socials (IG/YouTube) and Bandsintown listings, captured 2026-08-03.
 *         Phish / jam tribute, formed summer 2023. Members: Matt Agostini (bass), Matt Elberson
 *         (drums), Sean Coyne (guitar), John Hildenbrand (keys). Region: Mid-Atlantic (Philly/PA/MD).
 * Band #6 on the DeadDance Mid-Atlantic calendar — SAME seed shape as Crickets and Cicadas
 *   (cnc_shows.js) and Shakedown Citi (shakedown_citi_shows.js): a
 *   [date, project, venue, city, state, time] table -> rows, with the paid/external-row handling
 *   Shakedown added (priceOverride/urlOverride on the paid dates only).
 * Honest-state: every date here came from the band's public UPCOMING schedule. Nothing is invented.
 *   NOTE (no duplicate): their 2026-08-05 Musikfest set (Zinzenplatz) is ALREADY on the Mid-Atlantic
 *   calendar via MF_DEAD_ACTS in index.html — so it is INTENTIONALLY NOT repeated here (same as
 *   Shakedown Citi's Musikfest date was skipped).
 * TICKET: like CNC/Shakedown, each FREE row resolves to the canonical FREE band ticket — calendarRows
 *   sets price:"FREE" and NO external url, so the home calendar opens
 *   ticket.html?band=Rift&price=FREE (the shareable band ticket Michael sends the band).
 *   NAME SEAM (one honest divergence): the Musikfest festival data lists the fuller name
 *   "Rift (Philadelphia Phish Tribute)"; the shareable calendar tickets here use the clean "Rift"
 *   — the identity Michael is using in outreach. Same band, two labels; noted, not hidden.
 *   PAID SEAM (same as Shakedown's Le Poisson Rouge row): the 2026-08-15 King of Prussia and
 *   2026-08-21 Grateful Daytrippers Family Reunion dates are EXTERNALLY-ticketed PAID shows
 *   (Bandsintown "Tickets" links) — NOT DeadDance free tickets. Those two rows carry a price + url,
 *   so the calendar renders them as external "Tix ->" rows (never the free band ticket). Every other
 *   row stays FREE, exactly like CNC/Shakedown. */
(function (root) {
  "use strict";
  // approx lat/lng per town — town centroids, accurate enough to plot on the map (NOT precise venue pins)
  var CO = {
    "Elkton, MD":         [39.61, -75.83],
    "King of Prussia, PA":[40.09, -75.38],
    "Sellersville, PA":   [40.35, -75.30]
  };
  var RF = "Rift";
  // band-level links (site / Instagram / YouTube / booking) — attached to the band, not a per-show url
  root.RIFT_LINKS = {
    site:      "https://riftphilly.com",
    instagram: "https://www.instagram.com/riftphilly",
    youtube:   "https://www.youtube.com/@RiftPhilly",
    booking:   "becky@riftphilly.com"
  };
  /* Logo: the band's REAL artwork drops in as rift_logo.png (band supplies it — the upload IS consent).
     Until then, rift_logo.svg is DeadDance's own honest placeholder badge. Never scraped. */
  root.RIFT_LOGO = "rift_logo.png";
  root.RIFT_LOGO_FALLBACK = "rift_logo.svg";
  // [date, project, venue, city, state, time, private, priceOverride, urlOverride]
  //   private (idx6): true -> dropped from the public list (none here). priceOverride/urlOverride
  //   (idx7/8): set ONLY for the paid/external dates; everything else stays FREE.
  var D = [
    ["2026-08-07", RF, "Elkton Music Hall",                    "Elkton",          "MD", ""], // RSVP/free -> canonical FREE band ticket
    ["2026-08-15", RF, "Upper Merion Township Building Park",  "King of Prussia", "PA", "", false, "Tix ->", "https://riftphilly.com"], // PAID/EXTERNAL — Bandsintown, NOT a DeadDance free ticket
    ["2026-08-21", RF, "Grateful Daytrippers Family Reunion 2026", "Sellersville", "PA", "", false, "Tix ->", "https://riftphilly.com"]  // PAID/festival — Bandsintown, external
  ];
  var SHOWS = D.map(function (a) {
    var city = a[3], st = a[4], key = city && st ? city + ", " + st : "";
    return { date: a[0], project: a[1], venue: a[2], city: city, state: st,
      time: a[5] || "", private: a[6] === true, coords: key && CO[key] ? CO[key] : null,
      price: a[7] || "", url: a[8] || "", links: root.RIFT_LINKS };
  });
  root.RIFT_SHOWS = SHOWS;
  root.RIFT_SHOWS_PUBLIC = SHOWS.filter(function (s) { return !s.private; });
  // Calendar shape: {date, band, venue, price, type, logo}. FREE row: price:"FREE" + NO url -> resolves to
  //   the canonical FREE band ticket (ticket.html?band=Rift&price=FREE) in index.html.
  //   The PAID/EXTERNAL rows carry their own price + url -> calendar renders them as external "Tix ->".
  root.riftCalendarRows = function () {
    return root.RIFT_SHOWS_PUBLIC.map(function (s) {
      var row = { date: s.date, band: s.project,
        venue: s.venue + (s.city ? ", " + s.city + " " + s.state : "") + (s.time ? " · " + s.time : ""),
        price: s.url ? (s.price || "Tix ->") : "FREE", type: "grateful_dead", deal: true, logo: root.RIFT_LOGO };
      if (s.url) row.url = s.url; // external/paid -> not the free band ticket
      return row;
    });
  };
  // Map shape for dd_showmap.js: {band, venue, city, date, time, real, coords}
  root.riftMapRows = function () {
    return root.RIFT_SHOWS_PUBLIC.filter(function (s) { return s.coords; }).map(function (s) {
      return { band: s.project, venue: s.venue, city: s.city + ", " + s.state, date: s.date, time: s.time, real: true, coords: s.coords };
    });
  };
})(typeof window !== "undefined" ? window : this);
