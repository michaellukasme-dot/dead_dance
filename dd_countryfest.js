/* dd_countryfest.js — CountryFest (Easton? No — Bethlehem, SteelStacks) seed for DeadDance/StageFill.
   An ArtsQuest event on the SteelStacks campus — Aug 21-22, 2026. NEW for 2026.
   KEY: both stages are ALREADY in musikfest.html STAGES (Southside), so this festival reuses the
   existing georeferenced map + config with NO new coords. Stage names below match the MusikFest STAGES
   entries exactly so the map/acts-on-now/presence all bind by name substring.
   Source: artsquest.org/festivals/more-festivals-and-experiences/countryfest (crawled 2026-08-01). */
(function (root) {
  var D1 = "2026-08-21", D2 = "2026-08-22";
  // These two map to existing MusikFest Southside STAGES (reuse — no new pins):
  //   "Highmark Blue Shield Community Stage"  → lat 40.61431742, lng -75.36787332
  //   "Air Products Americaplatz at Levitt Pavilion" (a.k.a. "Levitt Pavilion SteelStacks") → 40.61479449, -75.36829889
  var COMMUNITY = "Highmark Blue Shield Community Stage";
  var LEVITT    = "Air Products Americaplatz at Levitt Pavilion";
  var STAGES = [
    { n: COMMUNITY, side:"S", reuse:true, lat:40.61431741767585, lng:-75.36787331553037, where:"Highmark Blue Shield Community Stage on the Air Products Town Square." },
    { n: LEVITT,    side:"S", reuse:true, lat:40.61479448696134, lng:-75.36829888824602, where:"Levitt Pavilion SteelStacks (the free lawn stage under the blast furnaces)." }
  ];
  // schedule rows mirror DD_MUSIKFEST shape {d,t,st,b,sc}. sc:'sf' (StageFill) — all country here.
  var LINEUP = [
    // ---- Friday Aug 21 ----
    {d:D1,t:"6:00 PM", st:COMMUNITY, b:"Erin Kelly", sc:"sf"},
    {d:D1,t:"7:30 PM", st:LEVITT,    b:"Kevin Kenny – The Chesney Show", sc:"sf"},
    {d:D1,t:"9:00 PM", st:COMMUNITY, b:"Stomp and Shine (Line Dance Lessons)", sc:"sf"},
    {d:D1,t:"9:00 PM", st:COMMUNITY, b:"Whiskey and Roses", sc:"sf"},
    // ---- Saturday Aug 22 ----
    {d:D2,t:"4:00 PM", st:COMMUNITY, b:"Luke Borchelt", sc:"sf"},
    {d:D2,t:"5:00 PM", st:LEVITT,    b:"Clayton Mullen", sc:"sf"},
    {d:D2,t:"6:30 PM", st:COMMUNITY, b:"Peytan Porter", sc:"sf"},
    {d:D2,t:"7:30 PM", st:LEVITT,    b:"Lainey Nation – A Tribute to Lainey Wilson", sc:"sf"},
    {d:D2,t:"9:00 PM", st:COMMUNITY, b:"Adam and the Armadillos", sc:"sf"}
  ];
  root.DD_COUNTRYFEST = {
    name:"CountryFest", org:"ArtsQuest", city:"Bethlehem", state:"PA",
    dates:[D1,D2], venue:"SteelStacks", center:{lat:40.61455,lng:-75.36808},
    reusesMap:"musikfest (Southside) — both stages already in STAGES",
    ticketing:"confirm with ArtsQuest — Levitt/Community SteelStacks shows are often free; headliners may be ticketed",
    stages:STAGES, lineup:LINEUP,
    note:"NEW 2026 ArtsQuest event. Reuses the MusikFest georeferenced map + config. 9 sets over 2 days."
  };
  if (typeof module!=='undefined' && module.exports) module.exports = root.DD_COUNTRYFEST;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
