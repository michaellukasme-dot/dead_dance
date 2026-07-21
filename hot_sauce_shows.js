/* hot_sauce_shows.js — Hot Sauce Band's real 2026 schedule.
 * SOURCE: https://www.hot-sauce-band.com/shows (public schedule, fetched 2026-07-10).
 *         Band: Rehoboth Beach / coastal DE + MD. Dead + reggae + Latin. Jimmy Davis, David Aman, Mike Shockley.
 * Michael saw them: Ocean City, MD (Abboud house party) + his cousin's. Cousin Kenny Abboud knows Jimmy from college.
 * Honest-state: every date came from the band's own public page. PRIVATE events are flagged private:true and
 *   never shown publicly (no venue, no map dot). Second band-supplied calendar after DEAL. */
(function (root) {
  "use strict";
  var CO = {
    "Indian River Inlet, DE": [38.61, -75.07], "Millsboro, DE": [38.59, -75.29],
    "Rehoboth Beach, DE": [38.72, -75.08], "Ocean City, MD": [38.34, -75.08],
    "Berlin, MD": [38.32, -75.22], "Long Neck, DE": [38.62, -75.15],
    "Lewes, DE": [38.77, -75.14], "Millville, DE": [38.55, -75.11],
    "Easton, MD": [38.77, -76.08], "Ocean Pines, MD": [38.38, -75.15],
    "Milton, DE": [38.78, -75.31], "Fenwick Island, DE": [38.46, -75.05],
    "Georgetown, DE": [38.69, -75.39], "Frankford, DE": [38.52, -75.23],
    "Milford, DE": [38.91, -75.43]
  };
  var FB = "https://www.facebook.com/HotSauceDelaware/";
  var HS = "Hot Sauce Band", ELZA = "Hot Sauce · ELZA Trio", DC = "Hot Sauce · Dave & Carol";
  // [date, project, venue, city, state, time, private?]
  var D = [
    ["2026-07-01", HS,   "Dockside",                        "Indian River Inlet", "DE", "5:00 PM"],
    ["2026-07-02", HS,   "Cupola Park Concert",             "Millsboro",          "DE", "6:00 PM"],
    ["2026-07-03", ELZA, "Kiwi's Kove",                     "Rehoboth Beach",     "DE", "4:00 PM"],
    ["2026-07-04", HS,   "Private event",                   "",                   "",   "", true],
    ["2026-07-05", DC,   "Twin Branch",                     "",                   "",   "1:00 PM"],
    ["2026-07-07", HS,   "Aqua Grill",                      "Rehoboth Beach",     "DE", "6:00 PM"],
    ["2026-07-08", HS,   "Dockside",                        "Indian River Inlet", "DE", "5:00 PM"],
    ["2026-07-10", HS,   "Windmill Creek Winery",           "Berlin",             "MD", "5:00 PM"],
    ["2026-07-11", HS,   "Paradise — Raw Bar",              "Long Neck",          "DE", "1:00 PM"],
    ["2026-07-12", ELZA, "The Room at Cedar Grove",         "Lewes",              "DE", ""],
    ["2026-07-14", HS,   "Stango Park Concert",             "Lewes",              "DE", "7:00 PM"],
    ["2026-07-15", HS,   "Dockside",                        "Indian River Inlet", "DE", "5:00 PM"],
    ["2026-07-16", ELZA, "Kiwi's Kove",                     "Rehoboth Beach",     "DE", "4:00 PM"],
    ["2026-07-17", DC,   "Twin Branch",                     "",                   "",   "4:00 PM"],
    ["2026-07-17", HS,   "Salted Rim",                      "Millville",          "DE", "9:00 PM"],
    ["2026-07-18", HS,   "Private event",                   "",                   "",   "", true],
    ["2026-07-19", HS,   "South Gate Grill",                "Ocean Pines",        "MD", "5:00 PM"],
    ["2026-07-21", HS,   "Aqua Grill",                      "Rehoboth Beach",     "DE", "6:00 PM"],
    ["2026-07-22", HS,   "Dockside",                        "Indian River Inlet", "DE", "5:00 PM"],
    ["2026-07-23", ELZA, "Vino Del Mar",                    "",                   "",   "4:00 PM"],
    ["2026-07-24", ELZA, "Kiwi's Kove",                     "Rehoboth Beach",     "DE", "4:00 PM"],
    ["2026-07-25", DC,   "Nassau Vineyard",                 "",                   "",   "12:00 PM"],
    ["2026-07-25", HS,   "Steamboat Landing",               "Milton",             "DE", "8:00 PM"],
    ["2026-07-26", HS,   "Bayside Deli — Brunch",           "Long Neck",          "DE", "11:00 AM"],
    ["2026-07-28", HS,   "Aqua Grill",                      "Rehoboth Beach",     "DE", "6:00 PM"],
    ["2026-07-29", HS,   "Dockside",                        "Indian River Inlet", "DE", "5:00 PM"],
    ["2026-07-30", ELZA, "Kiwi's Kove",                     "Rehoboth Beach",     "DE", "4:00 PM"],
    ["2026-07-31", DC,   "Twin Branch",                     "",                   "",   "4:00 PM"],
    ["2026-08-03", HS,   "Private event",                   "",                   "",   "", true],
    ["2026-08-04", HS,   "Aqua Grill",                      "Rehoboth Beach",     "DE", "6:00 PM"],
    ["2026-08-05", HS,   "Memorial Park",                   "Milton",             "DE", "7:00 PM"],
    ["2026-08-06", ELZA, "Kiwi's Kove",                     "Rehoboth Beach",     "DE", "3:00 PM"],
    ["2026-08-07", HS,   "Salted Rim",                      "Millville",          "DE", "9:00 PM"],
    ["2026-08-08", HS,   "Arenas",                          "Milford",            "DE", "9:00 PM"],
    ["2026-08-11", HS,   "Aqua Grill",                      "Rehoboth Beach",     "DE", "6:00 PM"],
    ["2026-08-12", HS,   "Dockside",                        "Indian River Inlet", "DE", "5:00 PM"],
    ["2026-08-13", HS,   "Windmill Creek Winery",           "Berlin",             "MD", "5:00 PM"],
    ["2026-08-14", HS,   "Summer Concert",                  "Georgetown",         "DE", "6:00 PM"],
    ["2026-08-15", HS,   "Paradise — Raw Bar",              "Long Neck",          "DE", "1:00 PM"],
    ["2026-08-16", HS,   "Private event",                   "",                   "",   "", true],
    ["2026-08-18", HS,   "Aqua Grill",                      "Rehoboth Beach",     "DE", "6:00 PM"],
    ["2026-08-19", HS,   "Dockside",                        "Indian River Inlet", "DE", "5:00 PM"],
    ["2026-08-21", ELZA, "Vino Del Mar",                    "",                   "",   "3:00 PM"],
    ["2026-08-22", HS,   "Chili Pepper Festival",           "Berlin",             "MD", "3:00 PM"],
    ["2026-08-23", HS,   "Bourbon Street",                  "Ocean City",         "MD", "6:00 PM"],
    ["2026-08-25", HS,   "Aqua Grill",                      "Rehoboth Beach",     "DE", "6:00 PM"],
    ["2026-08-26", HS,   "Dockside",                        "Indian River Inlet", "DE", "5:00 PM"],
    ["2026-08-27", HS,   "Private event",                   "",                   "",   "", true],
    ["2026-08-28", HS,   "South Gate Grill",                "Ocean Pines",        "MD", "7:00 PM"],
    ["2026-08-29", HS,   "Paradise — Lagoon",               "Long Neck",          "DE", "2:00 PM"],
    ["2026-08-30", HS,   "Private event",                   "",                   "",   "", true]
  ];
  var SHOWS = D.map(function (a) {
    var city = a[3], st = a[4], key = city && st ? city + ", " + st : "";
    return { date: a[0], project: a[1], venue: a[2], city: city, state: st,
      time: a[5] || "", private: a[6] === true, coords: key && CO[key] ? CO[key] : null, fb: FB };
  });
  root.HOTSAUCE_LOGO = "hot_sauce_logo.png";           // real artwork drops in here (band supplies it — consent)
  root.HOTSAUCE_LOGO_FALLBACK = "hot_sauce_logo.svg";
  root.HOTSAUCE_SHOWS = SHOWS;
  root.HOTSAUCE_SHOWS_PUBLIC = SHOWS.filter(function (s) { return !s.private; });
  root.hotSauceCalendarRows = function () {
    return root.HOTSAUCE_SHOWS_PUBLIC.map(function (s) {
      return { date: s.date, band: s.project,
        venue: s.venue + (s.city ? ", " + s.city + " " + s.state : "") + (s.time ? " · " + s.time : ""),
        price: "Info →", type: "grateful_dead", url: s.fb, deal: true, logo: root.HOTSAUCE_LOGO };
    });
  };
  root.hotSauceMapRows = function () {
    return root.HOTSAUCE_SHOWS_PUBLIC.filter(function (s) { return s.coords; }).map(function (s) {
      return { band: s.project, venue: s.venue, city: s.city + ", " + s.state, date: s.date, time: s.time, real: true, coords: s.coords };
    });
  };
})(typeof window !== "undefined" ? window : this);
