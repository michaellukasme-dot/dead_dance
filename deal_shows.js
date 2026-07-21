/* deal_shows.js — DEAL's real 2026 schedule.
 * SOURCE: John Smith (lead guitarist / manager, DEAL) — given directly to Michael, 2026-07-10.
 *         Band: https://www.facebook.com/DealGratefulDeadTribute/  (Allentown / Lehigh Valley, since 2017)
 * This is the FIRST band-supplied calendar in dead.dance — the anchor band, band #1.
 * Honest-state: every date here came from the band. Private parties are flagged private:true
 *   and are NEVER shown publicly (no venue address, no map dot, no ticket) — the band can see them,
 *   the public cannot. Projects: DEAL (full), DEAL Duo, DEAL Trio, DEAL & Co.
 * When John sends an update, regenerate this one file — nothing else changes. */
(function (root) {
  "use strict";
  // approx lat/lng per town — accurate enough to plot on the national map (all Lehigh Valley / E-PA / W-NJ)
  var CO = {
    "Hellertown, PA": [40.58, -75.34], "Hackettstown, NJ": [40.85, -74.83],
    "Coplay, PA": [40.67, -75.50], "Allentown, PA": [40.60, -75.47],
    "Wescosville, PA": [40.57, -75.55], "Long Valley, NJ": [40.79, -74.78],
    "Media, PA": [39.92, -75.39], "Easton, PA": [40.69, -75.22],
    "New Hope, PA": [40.36, -74.95], "Lansdale, PA": [40.24, -75.28],
    "Bangor, PA": [40.87, -75.21], "Bridgeport, PA": [40.10, -75.34],
    "Souderton, PA": [40.31, -75.32], "Macungie, PA": [40.52, -75.56],
    "Coopersburg, PA": [40.51, -75.39], "Emmaus, PA": [40.54, -75.50],
    "Tatamy, PA": [40.74, -75.25], "Hatfield, PA": [40.28, -75.30],
    "Perkasie, PA": [40.37, -75.29], "Quakertown, PA": [40.44, -75.34]
  };
  var FB = "https://www.facebook.com/DealGratefulDeadTribute/";
  /* Logo: the band's REAL artwork drops in as deal_logo.png (John supplies it — consent).
     Until then, deal_logo.svg is dead.dance's own honest placeholder badge. We never scrape it. */
  root.DEAL_LOGO = "deal_logo.png";
  root.DEAL_LOGO_FALLBACK = "deal_logo.svg";
  // [date, project, venue, city, state, time, private?]
  var D = [
    ["2026-07-10", "DEAL Duo",  "Lost Tavern Brewing",              "Hellertown",  "PA", "6:00 PM"],
    ["2026-07-11", "DEAL",      "Czigmeister Brewing — Grateful for Summer Festival", "Hackettstown", "NJ", ""],
    ["2026-07-15", "DEAL Trio", "Coplay Gazebo",                    "Coplay",      "PA", ""],
    ["2026-07-17", "DEAL",      "Ringers Roost",                    "Allentown",   "PA", ""],
    ["2026-07-25", "DEAL Trio", "Foundation Tavern",                "Wescosville", "PA", "6:00 PM"],
    ["2026-07-26", "DEAL",      "Chilton Mill Brewing",             "Long Valley", "NJ", "2:00 PM"],
    ["2026-08-01", "DEAL",      "Punjab Live",                      "Media",       "PA", "8:00 PM"],
    ["2026-08-02", "DEAL Trio", "Easton Public Market",             "Easton",      "PA", ""],
    ["2026-08-08", "DEAL & Co.","Dharma Bums — special guests",     "New Hope",    "PA", ""],
    ["2026-08-11", "DEAL",      "St. Stanislaus Summer Festival",   "Lansdale",    "PA", "6:00 PM"],
    ["2026-08-14", "DEAL Duo",  "Lost Tavern Brewing",              "Hellertown",  "PA", "6:00 PM"],
    ["2026-08-15", "DEAL",      "Franklin Hill Vineyards",          "Bangor",      "PA", "1:00 PM"],
    ["2026-08-16", "DEAL",      "Bridgeport Ribhouse",              "Bridgeport",  "PA", "4:00 PM"],
    ["2026-09-03", "DEAL",      "Live at the Falls — Scott Park Amphitheatre", "Easton", "PA", "6:00 PM"],
    ["2026-09-05", "DEAL",      "Brass Collar Brewing",             "Souderton",   "PA", "7:00 PM"],
    ["2026-09-06", "DEAL",      "Rising River Brewing",             "Macungie",    "PA", "6:30 PM"],
    ["2026-09-11", "DEAL",      "Lafayette Bar",                    "Easton",      "PA", "8:00 PM"],
    ["2026-09-12", "DEAL",      "Bobstock Stage",                   "Coopersburg", "PA", ""],
    ["2026-09-18", "DEAL",      "Yergey Brewing",                   "Emmaus",      "PA", ""],
    ["2026-09-19", "DEAL",      "HiJinx Brewing (new location!)",   "Tatamy",      "PA", ""],
    ["2026-09-20", "DEAL Trio", "Chilton Mill Brewing",             "Long Valley", "NJ", ""],
    ["2026-10-02", "DEAL",      "East End Pub",                     "Hatfield",    "PA", "8:30 PM"],
    ["2026-10-03", "DEAL",      "Free Will Brewing",                "Perkasie",    "PA", "7:00 PM"],
    ["2026-10-09", "DEAL Duo",  "Lost Tavern Brewing",              "Hellertown",  "PA", "6:00 PM"],
    ["2026-10-10", "DEAL",      "Private event",                    "",            "",   "", true],
    ["2026-10-17", "DEAL Trio", "Private event",                    "",            "",   "", true],
    ["2026-10-24", "DEAL Trio", "Private event",                    "",            "",   "", true],
    ["2026-10-31", "DEAL",      "Private event",                    "",            "",   "", true],
    ["2026-11-01", "DEAL Trio", "Easton Public Market",             "Easton",      "PA", ""],
    ["2026-11-07", "DEAL",      "West End Pub",                     "Quakertown",  "PA", "8:30 PM"],
    ["2026-11-13", "DEAL Duo",  "Lost Tavern Brewing",              "Hellertown",  "PA", "6:00 PM"],
    ["2026-11-14", "DEAL",      "Dharma Bums",                      "New Hope",    "PA", ""],
    ["2026-11-15", "DEAL",      "Bridgeport Ribhouse",              "Bridgeport",  "PA", "4:00 PM"],
    ["2026-11-28", "DEAL",      "Punjab Live",                      "Media",       "PA", "8:00 PM"],
    ["2026-12-04", "DEAL",      "Rising River Brewing",             "Macungie",    "PA", "6:30 PM"],
    ["2026-12-05", "DEAL",      "Free Will Brewing",                "Perkasie",    "PA", "7:00 PM"],
    ["2026-12-06", "DEAL Trio", "Easton Public Market",             "Easton",      "PA", ""],
    ["2026-12-11", "DEAL Duo",  "Lost Tavern Brewing",              "Hellertown",  "PA", "6:00 PM"]
  ];
  var SHOWS = D.map(function (a) {
    var city = a[3], st = a[4], key = city && st ? city + ", " + st : "";
    return {
      date: a[0], project: a[1], venue: a[2], city: city, state: st,
      time: a[5] || "", private: a[6] === true,
      coords: key && CO[key] ? CO[key] : null,
      fb: FB
    };
  });
  root.DEAL_SHOWS = SHOWS;
  root.DEAL_SHOWS_PUBLIC = SHOWS.filter(function (s) { return !s.private; });
  // Calendar shape: {date, band, venue, price, type, url}
  root.dealCalendarRows = function () {
    return root.DEAL_SHOWS_PUBLIC.map(function (s) {
      return {
        date: s.date, band: s.project,
        venue: s.venue + (s.city ? ", " + s.city + " " + s.state : "") + (s.time ? " · " + s.time : ""),
        price: "Info →", type: "grateful_dead", url: s.fb, deal: true, logo: root.DEAL_LOGO
      };
    });
  };
  // Map shape for dd_showmap.js: {band, venue, city, date, real, coords}
  root.dealMapRows = function () {
    return root.DEAL_SHOWS_PUBLIC.filter(function (s) { return s.coords; }).map(function (s) {
      return { band: s.project, venue: s.venue, city: s.city + ", " + s.state, date: s.date, time: s.time, real: true, coords: s.coords };
    });
  };
})(typeof window !== "undefined" ? window : this);
