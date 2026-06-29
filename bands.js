/* dead_dance — tribute-band roster + tour-date tracking (preseed).
   HONEST-STATE: band names/links are factual public info (public touring acts). Headliner tier per owner;
   regional set + tonight's real shows credited to **Compass Rose · gratefuldeadtributebands.com** (the source
   directory). Future dates marked "representative" until a permitted live feed (Bandsintown / the bands' own
   schedules / Compass Rose) is wired under their ToS — that integration is GATED (see the spec doc). We promote
   bands locally; we never sell their music. Promote = drafted copy, the owner sends (Jarvis — nothing auto-posts. */
var DD_SOURCE = { name: "Compass Rose", url: "http://gratefuldeadtributebands.com/", note: "500+ GD tribute bands, worldwide — credited in full." };

/* state → dead_dance region key (for mapping bands/shows to chapters). National headliners = "national". */
var DD_STATE_REGION = {CA:"bayarea",OR:"pnw",WA:"pnw",ID:"pnw",AK:"pnw",CO:"rockies",UT:"rockies",WY:"rockies",MT:"rockies",NM:"rockies",TX:"lonestar",OK:"lonestar",AZ:"lonestar",NV:"lonestar",IL:"greatlakes",IN:"greatlakes",MI:"greatlakes",OH:"greatlakes",WI:"greatlakes",MN:"greatlakes",IA:"greatlakes",NC:"southeast",SC:"southeast",GA:"southeast",FL:"southeast",TN:"southeast",AL:"southeast",KY:"southeast",PA:"midatl",NJ:"midatl",MD:"midatl",DC:"midatl",DE:"midatl",VA:"midatl",WV:"midatl",NY:"northeast",CT:"northeast",MA:"northeast",VT:"northeast",NH:"northeast",ME:"northeast",RI:"northeast"};
function ddBandRegion(b){ return b.region || (b.tier==="Headliner" ? "national" : (DD_STATE_REGION[b.home]||"national")); }

var DD_BANDS = [
  /* ---- Headliner tier (owner's highest-level list) — tour nationally (play every region) ---- */
  { id: "dso",   name: "Dark Star Orchestra",        tier: "Headliner", home: "National tour", region:"national", link: "http://www.darkstarorchestra.net/", note: "Recreates entire historic GD setlists, show by show. The gold standard.", hist:"Founded 1997 (Chicago). 3,000+ shows — the most-toured GD tribute." },
  { id: "jrad",  name: "Joe Russo's Almost Dead",     tier: "Headliner", home: "National tour", region:"national", link: "https://www.jrad.com/", note: "JRAD — the heavy, reimagined improv take. Festival headliner.", hist:"Formed 2013 (Brooklyn). Festival main-stage regular." },
  { id: "msjgb", name: "Melvin Seals & JGB",          tier: "Headliner", home: "National tour", region:"national", link: "https://melvinseals.com/", note: "The Hammond B-3 from the real Jerry Garcia Band — carrying the JGB flame.", hist:"Melvin played in the actual Jerry Garcia Band 1980–1995." },
  { id: "kadlecik", name: "John Kadlecik Band",        tier: "Headliner", home: "National tour", region:"national", link: "https://www.johnkadlecik.net/", note: "Furthur & DSO founder — 'Jerry's tone' incarnate.", hist:"Co-founded DSO; played in Furthur with Weir & Lesh." },
  { id: "mattson",  name: "Jeff Mattson",              tier: "Headliner", home: "National tour", region:"national", link: "https://www.darkstarorchestra.net/", note: "DSO lead guitar; Zen Tricksters. A heady favorite.", hist:"Zen Tricksters since the '80s; DSO lead since 2009." },
  { id: "kimock",   name: "Steve Kimock",              tier: "Headliner", home: "National tour", region:"national", link: "https://stevekimock.com/", note: "The guitarist's guitarist of the scene — Jerry's own favorite.", hist:"Zero, RatDog, KVHW — name-checked by Garcia himself." },
  { id: "sagespirits", name: "Sage & Spirits",         tier: "Headliner", home: "Regional/National", region:"national", link: "", note: "On the owner's highest-level list — confirm official page for the live feed." },
  /* ---- Regional / local set — real bands from Compass Rose's board (home state → region) ---- */
  { id: "playingdead", name: "Playing Dead",           tier: "Regional", home: "MA",  link: "http://playingdead.net/", note: "Grateful Wednesday residency, Soundcheck Studios (Pembroke, MA)." },
  { id: "masons",      name: "Mason's Children",       tier: "Regional", home: "OH",  link: "http://masonschildren.org", note: "Midwest staple — Ludlow Garage, Cincinnati." },
  { id: "deadmeat",    name: "Dead Meat",              tier: "Regional", home: "NY",  link: "https://www.facebook.com/gratefuldeadmeat/", note: "Woodstock-area — Colony, Woodstock." },
  { id: "diamondblues",name: "Diamond Blues",          tier: "Regional", home: "MA",  link: "https://www.facebook.com/DiamondBluesJGB", note: "JGB tribute — Midway Cafe, Jamaica Plain." },
  { id: "shakedownciti",name: "Shakedown Citi",        tier: "Regional", home: "NY",  link: "https://www.shakedownciti.com/", note: "Long Island — The Warehouse, Amityville." },
  { id: "rhapsody",    name: "Rhapsody In Red",        tier: "Local",    home: "OR",  link: "https://www.facebook.com/rhapsodyinredPDX", note: "Portland — Laurelthirst Public House." },
  { id: "dobbs",       name: "Dobbs' Dead",            tier: "Local",    home: "VT",  link: "https://www.facebook.com/profile.php?id=61550815341120", note: "Vermont — Zenbarn, Waterbury Center." },
  /* ---- From Compass Rose's live board (today) — home state → region ---- */
  { id: "deadpanic",   name: "Dead Panic",             tier: "Regional", home: "CO",  link: "", note: "Denver — Widespread/Dead crossover crew." },
  { id: "mysticdead",  name: "Mystic Dead",            tier: "Regional", home: "CT",  link: "https://www.mysticdead.com", note: "Connecticut — Strange Brew Pub, Norwich." },
  { id: "crazyfingers",name: "Crazy Fingers",          tier: "Regional", home: "FL",  link: "http://www.crazyfingers.net/", note: "South Florida — Sharkey's, Coral Springs." },
  { id: "terrapinflyer",name:"Terrapin Flyer",         tier: "Regional", home: "IL",  link: "http://www.terrapinflyer.com", note: "Chicago — 'Wave That Flag' summer tours." },
  { id: "eternallygr", name: "Eternally Grateful",     tier: "Regional", home: "NC",  link: "https://eternallygratefulmusic.com", note: "Charlotte — Jackalope Jacks residency." },
  { id: "be5d",        name: "Be5D",                   tier: "Regional", home: "NJ",  link: "https://www.facebook.com/profile.php?id=61557631414647", note: "NJ — Mark Diomede; Cooper's Riverview, Trenton." },
  { id: "westakron",   name: "West Akron Fadeaway",    tier: "Local",    home: "OH",  link: "", note: "NE Ohio — Wing Warehouse, Cuyahoga Falls." },
  { id: "deal",        name: "DEAL",                   tier: "Regional", home: "PA",  link: "https://www.facebook.com/DealGratefulDeadTribute", note: "Lehigh Valley — Sun Inn, Bethlehem (the owner's backyard)." },
  { id: "englishtown", name: "Englishtown Project",    tier: "Regional", home: "NJ",  link: "https://www.facebook.com/englishtownproject77/", note: "NJ — named for GD's '77 Englishtown show." },
  { id: "gratefulbros",name: "The Grateful Brothers",  tier: "Regional", home: "SC",  link: "https://www.thegratefulbrothers.com/", note: "Upstate SC — Greenville Downtown Alive." },
  { id: "deadmusicianstew",name:"Dead Musician Stew",  tier: "Local",    home: "VA",  link: "https://www.facebook.com/profile.php?id=100087712939516", note: "Northern VA — Lost Rhino Brewing, Ashburn." },
  { id: "boneyfingers",name: "Boney Fingers",          tier: "Regional", home: "WI",  link: "http://www.boneyfingers.net/", note: "Milwaukee — Edelweiss cruises & lakefront." },
  { id: "deadrevival", name: "The Dead Revival Band",  tier: "Regional", home: "OH",  link: "", note: "Ohio — featured in Compass Rose's 'Videos from the Vault.'" },
  { id: "cubensis",    name: "Cubensis",               tier: "Regional", home: "CA",  link: "", note: "SoCal — LA's longtime Dead tribute; The Mint." },
  { id: "chinacats",   name: "The China Cats",         tier: "Regional", home: "CA",  link: "", note: "NorCal — Matt Hartle on the Jerry lead; Felton Music Hall." },
  { id: "gratefulshred",name:"Grateful Shred",         tier: "Regional", home: "CA",  link: "", note: "LA — the young, beloved West-Coast Shred." },
  { id: "jmf",         name: "Jerry's Middle Finger",  tier: "Regional", home: "CA",  link: "", note: "SoCal — JGB-focused; Belly Up, Solana Beach." }
];
DD_BANDS.forEach(function(b){ if(!b.region) b.region = ddBandRegion(b); });

/* shows — TOP-TIER (Headliner) dates are VERIFIED from each band's published 2026 schedule,
   a hand-checked snapshot as of DD_SHOWS_ASOF (sources: JamBase + the bands' official tour pages).
   Regional/local rows are representative residencies, clearly labeled (real:false). Live auto-sync
   to the bands' feeds is the gated milestone; until then this is a manual snapshot — tap a band for
   their official page to confirm. near=true → "near you". */
var DD_SHOWS_ASOF = "Jun 27, 2026";
var DD_SHOWS = [
  /* ── Dark Star Orchestra · darkstarorchestra.net/tour ── */
  { bandId:"dso",   date:"Sat Jul 11", venue:"Rock the Dock Fest",                     city:"Lake George",   state:"NY", real:true,  near:false },
  { bandId:"dso",   date:"Tue Jul 28", venue:"Humphreys Concerts by the Bay",          city:"San Diego",     state:"CA", real:true,  near:false },
  { bandId:"dso",   date:"Fri Jul 31", venue:"Greek Theatre · Rex Foundation benefit", city:"Berkeley",      state:"CA", real:true,  near:false },
  { bandId:"dso",   date:"Fri Aug 7",  venue:"Chateau Ste. Michelle Winery",           city:"Woodinville",   state:"WA", real:true,  near:false },
  { bandId:"dso",   date:"Sat Sep 12", venue:"Ovation Hall · Ocean Casino Resort",     city:"Atlantic City", state:"NJ", real:true,  near:false },
  /* ── Joe Russo's Almost Dead · jrad.com ── */
  { bandId:"jrad",  date:"Sun Jul 19", venue:"see jrad.com for venue",                 city:"Harrisburg",    state:"PA", real:true,  near:false },
  { bandId:"jrad",  date:"Thu Jul 30", venue:"Brooklyn Bowl",                          city:"Las Vegas",     state:"NV", real:true,  near:false },
  { bandId:"jrad",  date:"Thu Aug 20", venue:"Mission Ballroom",                       city:"Denver",        state:"CO", real:true,  near:false },
  { bandId:"jrad",  date:"Fri Sep 25", venue:"The Rooftop at Pier 17",                 city:"New York",      state:"NY", real:true,  near:false },
  /* ── Melvin Seals & JGB · melvinsealsandjgb.com/tour-dates ── */
  { bandId:"msjgb", date:"Fri Jul 3",  venue:"McDonald Theatre",                       city:"Eugene",        state:"OR", real:true,  near:false },
  { bandId:"msjgb", date:"Sun Jul 12", venue:"The Caverns",                            city:"Pelham",        state:"TN", real:true,  near:false },
  { bandId:"msjgb", date:"Wed Aug 12", venue:"Lewes Ferry Grounds",                    city:"Lewes",         state:"DE", real:true,  near:false },
  { bandId:"msjgb", date:"Sat Aug 15", venue:"Tropicana Showroom · Caesars",           city:"Atlantic City", state:"NJ", real:true,  near:false },
  /* ── Steve Kimock · stevekimock.com ── */
  { bandId:"kimock",date:"Sun Aug 9",  venue:"Lincoln Hill Farms",                     city:"Canandaigua",   state:"NY", real:true,  near:false },
  /* ── Representative regional residencies (clearly labeled; not date-verified) ── */
  { bandId:"deal",        date:"upcoming",   venue:"Sun Inn · residency (representative)",          city:"Bethlehem", state:"PA", real:false, near:true },
  { bandId:"playingdead", date:"Wednesdays", venue:"Soundcheck Studios · residency (representative)", city:"Pembroke", state:"MA", real:false, near:false }
];
