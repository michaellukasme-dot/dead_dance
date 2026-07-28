/* dd_dead_tributes.js — the TOP Dead/jam tribute band in each of the 50 states + DC, seeded into
   DeadDance: pinned to their state, mapped to a local chapter, with a representative 90-day schedule
   for the chapter calendar, and registered into the "Claim my band" flow like every marquee act.

   HONESTY: the 90-day dates are ESTIMATED (recurring by how often the band gigs) and every event is
   flagged { est:true } — "unconfirmed until the band claims & confirms," matching DeadDance's sample-
   event labeling. Real dates replace them the moment the band claims. Big national acts were excluded.

   Source: curated from gratefuldeadtributebands.com state pages + Bandsintown/band sites (2026 research).
   Client-only, guarded, never throws. Exposes window.DDDeadTributes. */
(function (root) {
  "use strict";

  // state -> local chapter (the 10 DeadDance chapters)
  var CHAP = {
    ME:"Northeast", NH:"Northeast", VT:"Northeast", MA:"Northeast", RI:"Northeast", CT:"Northeast",
    NY:"Mid-Atlantic", NJ:"Mid-Atlantic", PA:"Mid-Atlantic", DE:"Mid-Atlantic", MD:"Mid-Atlantic", DC:"Mid-Atlantic", VA:"Mid-Atlantic", WV:"Mid-Atlantic",
    NC:"Southeast", SC:"Southeast", GA:"Southeast", FL:"Southeast", TN:"Southeast", KY:"Southeast", AL:"Southeast", MS:"Southeast", AR:"Southeast", LA:"Southeast",
    TX:"Lone Star", OK:"Lone Star",
    OH:"Great Lakes", MI:"Great Lakes", IN:"Great Lakes", IL:"Great Lakes", WI:"Great Lakes", MN:"Great Lakes", IA:"Great Lakes", MO:"Great Lakes",
    CO:"Rocky Mtn", MT:"Rocky Mtn", WY:"Rocky Mtn", UT:"Rocky Mtn", ID:"Rocky Mtn", NM:"Rocky Mtn", ND:"Rocky Mtn", SD:"Rocky Mtn", NE:"Rocky Mtn", KS:"Rocky Mtn",
    WA:"Pacific NW", OR:"Pacific NW", AK:"Pacific NW",
    CA:"SoCal", AZ:"SoCal", NV:"SoCal", HI:"SoCal"
  };
  // rough home-city coords so the map can pin a band per state (city center; good enough for a state pin)
  var CITY = {
    "Birmingham,AL":[33.5186,-86.8104],"Phoenix,AZ":[33.4484,-112.0740],"Rogers,AR":[36.3320,-94.1185],
    "Los Angeles,CA":[34.0522,-118.2437],"Manitou Springs,CO":[38.8597,-104.9172],"Branford,CT":[41.2795,-72.8151],
    "Fort Lauderdale,FL":[26.1224,-80.1373],"Athens,GA":[33.9519,-83.3576],"Maui,HI":[20.7984,-156.3319],
    "Boise,ID":[43.6150,-116.2023],"Chicago,IL":[41.8781,-87.6298],"Bloomington,IN":[39.1653,-86.5264],
    "Iowa City,IA":[41.6611,-91.5302],"Lawrence,KS":[38.9717,-95.2353],"Lexington,KY":[38.0406,-84.5037],
    "New Orleans,LA":[29.9511,-90.0715],"Portland,ME":[43.6591,-70.2568],"Towson,MD":[39.4015,-76.6019],"Wilmington,DE":[39.7391,-75.5398],
    "Boston,MA":[42.3601,-71.0589],"Detroit,MI":[42.3314,-83.0458],"Minneapolis,MN":[44.9778,-93.2650],
    "Ocean Springs,MS":[30.4113,-88.8281],"St. Louis,MO":[38.6270,-90.1994],"Bozeman,MT":[45.6770,-111.0429],
    "Omaha,NE":[41.2565,-95.9345],"Reno,NV":[39.5296,-119.8138],"Manchester,NH":[42.9956,-71.4548],
    "South Jersey,NJ":[39.6690,-74.9060],"Santa Fe,NM":[35.6870,-105.9378],"Warwick,NY":[41.2565,-74.3593],
    "Raleigh,NC":[35.7796,-78.6382],"Fargo,ND":[46.8772,-96.7898],"Columbus,OH":[39.9612,-82.9988],
    "Tulsa,OK":[36.1540,-95.9928],"Portland,OR":[45.5152,-122.6784],"Philadelphia,PA":[39.9526,-75.1652],
    "Providence,RI":[41.8240,-71.4128],"Charleston,SC":[32.7765,-79.9311],"Nashville,TN":[36.1627,-86.7816],
    "Austin,TX":[30.2672,-97.7431],"Salt Lake City,UT":[40.7608,-111.8910],"Waterbury Center,VT":[44.3670,-72.7490],
    "Norfolk,VA":[36.8508,-76.2859],"Spokane,WA":[47.6588,-117.4260],"Morgantown,WV":[39.6295,-79.9559],
    "Milwaukee,WI":[43.0389,-87.9065],"Jackson Hole,WY":[43.4799,-110.7624],"Washington,DC":[38.9072,-77.0369]
  };

  // tier -> gig cadence in days (how the 90-day estimate recurs)
  var CADENCE = { High:7, Medium:14, Low:30, None:0 };

  // [name, city, state, StageFill type, tier]
  var RAW = [
    ["T.U.B (The UnKnamed Band)","Birmingham","AL","Grateful Dead tribute","Low"],
    ["Xtra Ticket","Phoenix","AZ","Grateful Dead tribute","High"],
    ["Friends of the Phamily","Rogers","AR","Dead + jam","Low"],
    ["Cubensis","Los Angeles","CA","Grateful Dead + JGB tribute","High"],
    ["Shakedown Street","Manitou Springs","CO","Grateful Dead tribute","High"],
    ["Rob Glassman Band","Branford","CT","Grateful Dead + JGB tribute","High"],
    ["Montana Wildaxe","Wilmington","DE","Dead & jam","Low"],
    ["Crazy Fingers","Fort Lauderdale","FL","Grateful Dead tribute","High"],
    ["Cosmic Charlie","Athens","GA","Grateful Dead tribute","High"],
    ["The Maui Pranksters","Maui","HI","Grateful Dead / JGB tribute","Medium"],
    ["Grateful","Boise","ID","Grateful Dead tribute","Medium"],
    ["Terrapin Flyer","Chicago","IL","Grateful Dead tribute","High"],
    ["Hyryder","Bloomington","IN","Dead & jam","High"],
    ["Winterland","Iowa City","IA","Era recreation","Medium"],
    ["Playdead","Lawrence","KS","Grateful Dead tribute","Medium"],
    ["Born Cross Eyed","Lexington","KY","Grateful Dead tribute","Low"],
    ["Dead Feat","New Orleans","LA","Dead + other","Low"],
    ["A Band Beyond Description","Portland","ME","Grateful Dead tribute","Medium"],
    ["InDEADnation","Towson","MD","Grateful Dead tribute","High"],
    ["Bearly Dead","Boston","MA","Grateful Dead tribute","High"],
    ["Raising The Dead","Detroit","MI","Grateful Dead tribute","Medium"],
    ["The Jones Gang","Minneapolis","MN","Grateful Dead tribute","High"],
    ["The Terrapins","Ocean Springs","MS","Grateful Dead tribute","Low"],
    ["The Schwag","St. Louis","MO","Grateful Dead tribute","High"],
    ["Dead Sky","Bozeman","MT","Grateful Dead tribute","Medium"],
    ["Unbroken Chain","Omaha","NE","Grateful Dead tribute","Medium"],
    ["The Casual Dogs","Reno","NV","Grateful Dead tribute","High"],
    ["Not Fade Away Band","Manchester","NH","Grateful Dead tribute","High"],
    ["Dead Reckoning","South Jersey","NJ","Grateful Dead tribute","High"],
    ["Detroit Lightning","Santa Fe","NM","Grateful Dead tribute","High"],
    ["Nailed Shutt","Warwick","NY","Dead & jam","High"],
    ["Bring Out Yer Dead","Raleigh","NC","Grateful Dead tribute","High"],
    ["The Quarterly","Fargo","ND","Era recreation","Low"],
    ["The Dead Revival Band","Columbus","OH","Grateful Dead tribute","Medium"],
    ["The Deadgummits","Tulsa","OK","Grateful Dead tribute","High"],
    ["Garcia Birthday Band","Portland","OR","Grateful Dead tribute","High"],
    ["DEAL","Philadelphia","PA","Grateful Dead tribute","High"],
    ["Blue Drew and the Magoos","Providence","RI","Grateful Dead tribute","Medium"],
    ["The Reckoning","Charleston","SC","Grateful Dead tribute","High"],
    ["The Stolen Faces","Nashville","TN","Grateful Dead tribute","High"],
    ["DeadEye","Austin","TX","Grateful Dead tribute","High"],
    ["The Pranksters Band","Salt Lake City","UT","Grateful Dead tribute","Low"],
    ["Dobbs' Dead","Waterbury Center","VT","Grateful Dead tribute","High"],
    ["Grateful Jed","Norfolk","VA","Grateful Dead tribute","Medium"],
    ["Spokane Is Dead","Spokane","WA","Grateful Dead / JGB tribute","Medium"],
    ["Dead All Along","Morgantown","WV","Grateful Dead tribute","Low"],
    ["Another One","Milwaukee","WI","Grateful Dead tribute","Medium"],
    ["The Deadlocks","Jackson Hole","WY","Grateful Dead tribute","Low"],
    ["Stealing Liberty","Washington","DC","Grateful Dead tribute","High"]
    // (South Dakota + Alaska: no state-based Dead tribute found — served by touring acts)
  ];

  function slug(n) { return String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function coords(city, st) { return CITY[city + "," + st] || null; }

  var BANDS = RAW.map(function (r) {
    var st = r[2];
    return { name: r[0], slug: slug(r[0]), city: r[1], state: st, chapter: CHAP[st] || "", type: r[3], tier: r[4], ll: coords(r[1], st), claimable: true, accepted: false };
  });
  var BY = {}; BANDS.forEach(function (b) { BY[b.slug] = b; });

  // ---- representative 90-day schedule (ESTIMATED; flagged est:true) ----
  function fmtISO(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function events(days) {
    days = days || 90; var out = [], today = new Date(); today.setHours(0, 0, 0, 0);
    BANDS.forEach(function (b, bi) {
      var step = CADENCE[b.tier] || 0; if (!step) return;
      var offset = (bi % step);                                   // stagger start so the calendar isn't all on day 0
      for (var d = offset; d <= days; d += step) {
        var dt = new Date(today.getTime() + d * 86400000);
        out.push({ band: b.name, slug: b.slug, date: fmtISO(dt), city: b.city, state: b.state, chapter: b.chapter,
          venue: "Local venue · " + b.city, lat: b.ll ? b.ll[0] : null, lng: b.ll ? b.ll[1] : null,
          type: b.type, est: true, note: "Estimated — unconfirmed until " + b.name + " claims & confirms" });
      }
    });
    return out;
  }

  // ---- "Claim my band": DDBandGroups-shaped records so the claim UI lists them like the marquee acts ----
  function claimable() {
    return BANDS.map(function (b) {
      return { name: b.name, disp: b.name, slug: b.slug, ic: "🌹", state: b.state, city: b.city, chapter: b.chapter,
        type: b.type, accepted: false, tuned: false, members: (b.tier === "High" ? 800 : b.tier === "Medium" ? 350 : 150),
        qr: "https://deaddance.app/" + b.slug, claim: true, source: "dead-tributes-seed" };
    });
  }

  root.DDDeadTributes = {
    bands: function () { return BANDS.slice(); },
    get: function (n) { return BY[slug(n)] || null; },
    byState: function (s) { s = String(s || "").toUpperCase(); return BANDS.filter(function (b) { return b.state === s; }); },
    byChapter: function (c) { return BANDS.filter(function (b) { return b.chapter === c; }); },
    chapterOf: function (s) { return CHAP[String(s || "").toUpperCase()] || ""; },
    events: events,
    claimable: claimable,
    count: BANDS.length
  };
})(typeof window !== "undefined" ? window : this);
