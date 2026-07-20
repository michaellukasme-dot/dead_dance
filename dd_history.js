/* dd_history.js — "Today in Grateful Dead History" + "Today in Dark Star Orchestra History".
   The GD archive becomes our dataset: each show keyed by date. DSO entries carry `recreates` = the
   GD show date they mimic (DSO plays a historic GD show note-for-note; sometimes more than once).
   This lines the two up for Karaoke play and DOUBLE trivia.

   SEED is accurate-but-partial. The full GD archive (~2,300 shows) + DSO cross-reference is the
   deep-research task (#19) — it drops straight into GD[] and DSO[] with the same shape, no code change.
   Trivia only generates questions the data actually supports (no invented counts). window.DDHistory. */
(function (root) {
  "use strict";

  // GD show: {date:'YYYY-MM-DD', venue, city, note}  — verified dates (canon + real GD dates DSO recreated, from the DSO Starbase).
  var GD = [
    { date: "1969-02-11", venue: "Fillmore East", city: "New York, NY", note: "" },
    { date: "1969-02-27", venue: "Fillmore West", city: "San Francisco, CA", note: "“The Eleven” — early psychedelic peak (Live/Dead era)." },
    { date: "1969-12-30", venue: "Boston Tea Party", city: "Boston, MA", note: "" },
    { date: "1970-01-03", venue: "Fillmore East", city: "New York, NY", note: "" },
    { date: "1970-05-02", venue: "Harpur College", city: "Binghamton, NY", note: "Acoustic + electric; released as Dick’s Picks Vol. 8." },
    { date: "1972-08-27", venue: "Old Renaissance Faire Grounds", city: "Veneta, OR", note: "“Sunshine Daydream” — a legendary hot-day Dark Star." },
    { date: "1973-10-23", venue: "Metropolitan Sports Center", city: "Bloomington, MN", note: "" },
    { date: "1973-10-29", venue: "Kiel Auditorium", city: "St. Louis, MO", note: "" },
    { date: "1974-06-28", venue: "Boston Garden", city: "Boston, MA", note: "" },
    { date: "1976-06-04", venue: "Paramount Theatre", city: "Portland, OR", note: "" },
    { date: "1976-07-13", venue: "Orpheum Theatre", city: "San Francisco, CA", note: "" },
    { date: "1977-05-08", venue: "Barton Hall, Cornell University", city: "Ithaca, NY", note: "Cornell ’77 — the most famous show in the canon; Library of Congress registry." },
    { date: "1977-11-01", venue: "Cobo Arena", city: "Detroit, MI", note: "" },
    { date: "1978-08-30", venue: "Red Rocks Amphitheatre", city: "Morrison, CO", note: "" },
    { date: "1978-09-15", venue: "Giza Sound and Light Theater", city: "Giza, Egypt", note: "The legendary shows at the Great Pyramid." },
    { date: "1979-01-15", venue: "Springfield Civic Center Arena", city: "Springfield, MA", note: "" },
    { date: "1982-11-26", venue: "Bob Marley Performing Arts Center", city: "Montego Bay, Jamaica", note: "" },
    { date: "1983-05-15", venue: "Greek Theatre, UC Berkeley", city: "Berkeley, CA", note: "" },
    { date: "1984-10-18", venue: "Brendan Byrne Arena", city: "East Rutherford, NJ", note: "" },
    { date: "1985-11-17", venue: "Long Beach Arena", city: "Long Beach, CA", note: "" },
    { date: "1987-09-18", venue: "Madison Square Garden", city: "New York, NY", note: "" },
    { date: "1989-07-07", venue: "John F. Kennedy Stadium", city: "Philadelphia, PA", note: "Stadium-era Dead in Philly." },
    { date: "1990-09-11", venue: "The Spectrum", city: "Philadelphia, PA", note: "" },
    { date: "1994-07-19", venue: "Deer Creek Music Center", city: "Noblesville, IN", note: "$24.50, 7:00 PM. Night 1 of a three-night run." },
    { date: "1994-07-20", venue: "Deer Creek Music Center", city: "Noblesville, IN", note: "$24.50, 7:00 PM. Night 2 of three." },
    { date: "1994-07-21", venue: "Deer Creek Music Center", city: "Noblesville, IN", note: "$24.50, 7:00 PM. Night 3 of three." },
    { date: "1995-07-09", venue: "Soldier Field", city: "Chicago, IL", note: "The final Grateful Dead concert with Jerry Garcia." }
  ];

  // DSO show: {date, venue, city, recreates:'YYYY-MM-DD'|null} — REAL pairs from the DSO Starbase
  // (dsoforums.net/dso_starbase). "recreates" = the GD show DSO played note-for-note that night.
  // This is a sample; the full ~3,300-show set loads via the setlist.fm / Starbase ingestion (task #19).
  var DSO = [
    { n: 3319, date: "2025-02-15", venue: "Roseland Theater", city: "Portland, OR", recreates: "1979-01-15", note: "Sold out", set: "Jack Straw ; Jack-a-Roe ; Cassidy ; Row Jimmy ; Mama Tried > Mexicali…" },
    { n: 3317, date: "2025-02-13", venue: "The Showbox", city: "Seattle, WA", recreates: "1990-09-11", note: "Sold out", set: "Jack Straw ; Bertha > Greatest Story Ever Told ; Candyman ; Queen Jane…" },
    { n: 3315, date: "2025-02-10", venue: "Blue Lake Casino & Hotel", city: "Blue Lake, CA", recreates: "1974-06-28", note: "Rob Koritz on drums; Dino drums on filler.", set: "Mississippi Half-Step Uptown Toodleloo > It Must Have Been The Roses…" },
    { n: 3313, date: "2025-02-07", venue: "Uptown Theatre", city: "Napa, CA", recreates: "1985-11-17", note: "Sold out", set: "Mississippi Half-Step Uptown Toodleloo ; New Minglewood Blues ; Stagger Lee…" },
    { n: 3312, date: "2025-02-06", venue: "The Guild Theatre", city: "Menlo Park, CA", recreates: "1973-10-29", note: "Dino on drums", set: "Cold Rain And Snow ; Beat It On Down The Line ; Brown Eyed Women…" },
    { n: 3311, date: "2025-02-05", venue: "Golden State Theatre", city: "Monterey, CA", recreates: "1987-09-18", note: "", set: "Hell In A Bucket > Sugaree > Walkin' Blues ; Candyman ; When I Paint My Masterpiece…" },
    { n: 3310, date: "2025-02-03", venue: "Ventura Music Hall", city: "Ventura, CA", recreates: "1969-02-11", note: "Sold out", set: "Good Morning Little Schoolgirl ; Cryptical Envelopment > The Other One…" },
    { n: 3307, date: "2025-01-30", venue: "The Van Buren", city: "Phoenix, AZ", recreates: "1976-06-04", note: "", set: "The Promised Land ; Friend Of The Devil ; Mama Tried ; Sugaree ; Cassidy…" },
    { n: 3305, date: "2025-01-16", venue: "Jewel Paradise Cove", city: "Runaway Bay, Jamaica", recreates: "1982-11-26", note: "Scarlet>Fire w/ Jen Hartswick on trumpet.", set: "Sugaree > New Minglewood Blues ; Loser ; Man Smart (Woman Smarter)…" },
    { n: 3304, date: "2025-01-15", venue: "Jewel Paradise Cove", city: "Runaway Bay, Jamaica", recreates: "1977-11-01", note: "", set: "Might As Well ; Jack Straw ; Tennessee Jed ; El Paso ; Friend Of The Devil…" },
    { n: 3301, date: "2025-01-03", venue: "Capitol Theatre", city: "Port Chester, NY", recreates: "1970-01-03", note: "55-year anniversary show.", set: "Morning Dew ; Me And My Uncle ; Hard To Handle ; Cumberland Blues…" },
    { n: 3299, date: "2024-12-30", venue: "Capitol Theatre", city: "Port Chester, NY", recreates: "1983-05-15", note: "", set: "Touch Of Grey ; New Minglewood Blues ; Ramble On Rose ; Cassidy…" },
    { n: 3298, date: "2024-12-29", venue: "Franklin Music Hall", city: "Philadelphia, PA", recreates: "1978-09-15", note: "The Egypt show.", set: "Ollin Arageed > The Promised Land ; Friend Of The Devil ; Mama Tried…" },
    { n: 3295, date: "2024-11-29", venue: "The Paramount", city: "Huntington, NY", recreates: "1969-12-30", note: "", set: "Good Lovin' > drums > Good Lovin' ; Mama Tried ; New Speedway Boogie…" },
    { n: 3294, date: "2024-11-27", venue: "Penn's Peak", city: "Jim Thorpe, PA", recreates: "1976-07-13", note: "Sold out — DSO's 30th Penn's Peak show.", set: "Mississippi Half-Step Uptown Toodleloo ; Big River ; Peggy-O ; Cassidy…" },
    { n: 3293, date: "2024-11-26", venue: "Stage AE", city: "Pittsburgh, PA", recreates: "1978-08-30", note: "", set: "The Promised Land ; Sugaree ; Mexicali Blues > Mama Tried ; Stagger Lee…" },
    { n: 3292, date: "2024-11-23", venue: "College Street Music Hall", city: "New Haven, CT", recreates: "1984-10-18", note: "", set: "Feel Like A Stranger ; Candyman ; Little Red Rooster ; Big Railroad Blues…" },
    { n: 3290, date: "2024-11-21", venue: "Broome County Forum Theatre", city: "Binghamton, NY", recreates: "1973-10-23", note: "Rob Koritz on drums; Dino drums on filler.", set: "The Promised Land ; Sugaree ; Mexicali Blues ; They Love Each Other…" }
  ];
  var DSO_SOURCE = "DSO Starbase (dsoforums.net/dso_starbase) · setlist.fm/dark-star-orchestra";
  // Are DSO counts authoritative yet? Only true after the FULL Starbase set is ingested. Until then we
  // NEVER ask "how many times has DSO played this" — a partial sample would undercount. No faking.
  var DSO_COMPLETE = false;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayMMDD(d) { d = d || new Date(); return pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function mmdd(iso) { return String(iso || "").slice(5, 10); }
  function yr(iso) { return String(iso || "").slice(0, 4); }

  function onThisDay(list, when) { var k = todayMMDD(when); return (list || []).filter(function (s) { return mmdd(s.date) === k; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }

  // how many times DSO has recreated a given GD date (from whatever DSO data we hold)
  function dsoTimesFor(gdDate) { return DSO.filter(function (s) { return s.recreates === gdDate; }).length; }

  /* ---- DOUBLE trivia — only questions the data supports ---- */
  function shuffle(a, seed) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; var j = Math.floor((seed / 233280) * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function trivia(gd) {
    var out = [], seed = 7;
    (gd || onThisDay(GD)).forEach(function (s) {
      seed += 13;
      var y = +yr(s.date);
      // Q1 (always available from GD data): what year?
      var yrs = [y]; for (var k = 1; yrs.length < 4; k++) { if (yrs.indexOf(y - k) < 0 && y - k > 1964) yrs.push(y - k); if (yrs.length < 4 && yrs.indexOf(y + k) < 0 && y + k <= 1995) yrs.push(y + k); }
      out.push({ q: "When did the Grateful Dead play " + s.venue + " (" + s.city + ")?", choices: shuffle(yrs, seed).map(String), answer: String(y), kind: "gd" });
      // Q2 (DSO count) — ONLY when the FULL DSO set is loaded (a partial sample would undercount). No faking.
      var n = dsoTimesFor(s.date);
      if (DSO_COMPLETE && n > 0) out.push({ q: "How many times has Dark Star Orchestra recreated the " + s.date + " show?", choices: dedupeNums([n, n + 1, Math.max(1, n - 1), n + 2]).map(String), answer: String(n), kind: "dso" });
      // Q2b (DSO cross-reference) — always safe when we have the pairing: which GD show did DSO play back?
      var rec = DSO.filter(function (d) { return d.recreates === s.date; })[0];
      if (rec) out.push({ q: "On " + rec.date + " at " + rec.venue + ", which historic Grateful Dead show did DSO play?", choices: shuffle([s.date, "1977-05-08", "1972-08-27", "1995-07-09"].filter(function (v, i, a) { return a.indexOf(v) === i; }), seed + 5), answer: s.date, kind: "dso" });
    });
    return out;
  }
  function dedupeNums(a) { var seen = {}, o = []; a.forEach(function (n) { if (!seen[n]) { seen[n] = 1; o.push(n); } }); while (o.length < 2) o.push(o[o.length - 1] + 1); return o; }

  root.DDHistory = {
    GD: GD, DSO: DSO, source: DSO_SOURCE, complete: function () { return DSO_COMPLETE; },
    recent: function (k) { return DSO.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, k || 30); },
    gdByDate: function (d) { return GD.filter(function (g) { return g.date === d; })[0] || null; },
    todayGD: function (when) { return onThisDay(GD, when); },
    todayDSO: function (when) { return onThisDay(DSO, when); },
    dsoTimesFor: dsoTimesFor,
    trivia: trivia,
    // one place for #19 to load the full sets:
    load: function (gd, dso) { try { if (gd && gd.length) GD = root.DDHistory.GD = gd; if (dso && dso.length) DSO = root.DDHistory.DSO = dso; } catch (e) {} }
  };
})(typeof window !== "undefined" ? window : this);
