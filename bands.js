/* dead_dance — tribute-band roster + tour-date tracking (preseed).
   HONEST-STATE: band names/links are factual public info (public touring acts). Headliner tier per owner;
   regional set + tonight's real shows credited to **Compass Rose · gratefuldeadtributebands.com** (the source
   directory). Future dates marked "representative" until a permitted live feed (Bandsintown / the bands' own
   schedules / Compass Rose) is wired under their ToS — that integration is GATED (see the spec doc). We promote
   bands locally; we never sell their music. Promote = drafted copy, the owner sends (Jarvis — nothing auto-posts. */
var DD_SOURCE = { name: "Compass Rose", url: "http://gratefuldeadtributebands.com/", note: "500+ GD tribute bands, worldwide — credited in full." };

var DD_BANDS = [
  /* ---- Headliner tier (owner's highest-level list) ---- */
  { id: "dso",   name: "Dark Star Orchestra",        tier: "Headliner", home: "National tour",  link: "http://www.darkstarorchestra.net/", note: "Recreates entire historic GD setlists, show by show. The gold standard." },
  { id: "jrad",  name: "Joe Russo's Almost Dead",     tier: "Headliner", home: "National tour",  link: "https://www.jrad.com/", note: "JRAD — the heavy, reimagined improv take. Festival headliner." },
  { id: "msjgb", name: "Melvin Seals & JGB",          tier: "Headliner", home: "National tour",  link: "https://melvinseals.com/", note: "The Hammond B-3 from the real Jerry Garcia Band — carrying the JGB flame." },
  { id: "kadlecik", name: "John Kadlecik Band",        tier: "Headliner", home: "National tour",  link: "https://www.johnkadlecik.net/", note: "Furthur & DSO founder — 'Jerry's tone' incarnate." },
  { id: "mattson",  name: "Jeff Mattson",              tier: "Headliner", home: "National tour",  link: "https://www.darkstarorchestra.net/", note: "DSO lead guitar; Zen Tricksters. A heady favorite." },
  { id: "kimock",   name: "Steve Kimock",              tier: "Headliner", home: "National tour",  link: "https://stevekimock.com/", note: "The guitarist's guitarist of the scene — Jerry's own favorite." },
  { id: "sagespirits", name: "Sage & Spirits",         tier: "Headliner", home: "Regional/National", link: "", note: "On the owner's highest-level list — confirm official page for the live feed." },
  /* ---- Regional / local set — real bands seen on Compass Rose's board ---- */
  { id: "playingdead", name: "Playing Dead",           tier: "Regional", home: "MA",  link: "http://playingdead.net/", note: "Grateful Wednesday residency, Soundcheck Studios (Pembroke, MA)." },
  { id: "masons",      name: "Mason's Children",       tier: "Regional", home: "OH",  link: "http://masonschildren.org", note: "Midwest staple — Ludlow Garage, Cincinnati." },
  { id: "deadmeat",    name: "Dead Meat",              tier: "Regional", home: "NY",  link: "https://www.facebook.com/gratefuldeadmeat/", note: "Woodstock-area — Colony, Woodstock." },
  { id: "diamondblues",name: "Diamond Blues",          tier: "Regional", home: "MA",  link: "https://www.facebook.com/DiamondBluesJGB", note: "JGB tribute — Midway Cafe, Jamaica Plain." },
  { id: "shakedownciti",name: "Shakedown Citi",        tier: "Regional", home: "NY",  link: "https://www.shakedownciti.com/", note: "Long Island — The Warehouse, Amityville." },
  { id: "rhapsody",    name: "Rhapsody In Red",        tier: "Local",    home: "OR",  link: "https://www.facebook.com/rhapsodyinredPDX", note: "Portland — Laurelthirst Public House." },
  { id: "dobbs",       name: "Dobbs' Dead",            tier: "Local",    home: "VT",  link: "https://www.facebook.com/profile.php?id=61550815341120", note: "Vermont — Zenbarn, Waterbury Center." }
];

/* shows: real (tonight, via Compass Rose, credited) + representative upcoming (clearly labeled). near=true → "near you" */
var DD_SHOWS = [
  { bandId: "dso",        date: "Wed Jun 24", venue: "ESL Ballpark",        city: "Rochester",    state: "NY", real: true,  near: false },
  { bandId: "playingdead",date: "Wed Jun 24", venue: "Soundcheck Studios",  city: "Pembroke",     state: "MA", real: true,  near: false },
  { bandId: "masons",     date: "Wed Jun 24", venue: "Ludlow Garage",       city: "Cincinnati",   state: "OH", real: true,  near: false },
  { bandId: "deadmeat",   date: "Wed Jun 24", venue: "Colony",              city: "Woodstock",    state: "NY", real: true,  near: false },
  { bandId: "diamondblues",date:"Wed Jun 24", venue: "Midway Cafe",         city: "Jamaica Plain",state: "MA", real: true,  near: false },
  /* representative upcoming near the owner (Lehigh Valley / Philly) — populate live from the bands' schedules once the feed clears */
  { bandId: "jrad",       date: "Fri Jul 11", venue: "The Met (representative)",   city: "Philadelphia", state: "PA", real: false, near: true },
  { bandId: "dso",        date: "Sat Jul 19", venue: "Ardmore Music Hall (representative)", city: "Ardmore", state: "PA", real: false, near: true },
  { bandId: "msjgb",      date: "Thu Aug 7",  venue: "Sherman Theater (representative)",    city: "Stroudsburg", state: "PA", real: false, near: true }
];
