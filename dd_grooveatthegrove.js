/* dd_grooveatthegrove.js — GROOVE AT THE GROVE 2026 seed for the DeadDance multi-festival engine.
   Sat Aug 8, 2026 · 3:00–9:00 PM · Norcross-McLaughlin Memorial Dell (outdoor amphitheater) inside
   Haddon Lake Park, 1214 S Park Ave, Haddon Heights, NJ 08035 (dell opened 1995). FREE admission.
   Presented by HIP Inc. + Lackadaisical Lemon (Lackadaisical Lemon is the host band).

   OWN footprint (Haddon Heights, NJ) — brings its own center + pins, renders on the same map engine
   as MusikFest via ?fest=groove-at-the-grove-2026 (mirrors dd_baconfest.js / dd_allentownfair.js).

   HONESTY (House Law — nothing fabricated as fact):
   • The DELL (music stage) center is a REAL owner-provided pin (from Google Maps). The amenity POIs
     (Food Trucks/Beer/Vendors/Entrance) are APPROX placements around it — those carry approx:true + "(approx)".
   • Individual SET TIMES are NOT published. Do not read the per-row "3:00 PM" as a set time — it is the
     event's real 3:00 PM window-open (doors), and ALL five acts are pinned to it as a placeholder so the
     schedule renders. Lineup order is as-given/unknown. Swap in the real grid + times when announced.
   • POIs (Food Trucks / Beer / Vendors / Entrance) are rendered as approx map PINS via the stages array —
     same convention the Allentown Fair seed uses for its non-music points; the own-fest map engine draws
     one pin type. "The Dell" is the single MUSIC stage (poi:false); the rest are amenities (poi:true). */
(function (root) {
  var DATE   = "2026-08-08";              // Saturday, August 8, 2026
  var STAGE  = "The Dell";                // the one music stage (the amphitheater)
  var CENTER = { lat: 39.885998, lng: -75.084920 };   // REAL pin (Google Maps, owner-provided) — The Dell, Haddon Lake Park

  // The Dell = the REAL music-stage pin (owner-provided coordinate). The rest are AMENITY POIs placed
  // APPROX around it (~40–60 m offsets, illustrative, not surveyed) — those carry approx:true + "(approx)".
  var STAGES = [
    { n: STAGE,          lat: 39.885998, lng: -75.084920, side: "S", approx: false, poi: false,
      where: "The Dell — Norcross-McLaughlin Memorial Dell, the outdoor amphitheater in Haddon Lake Park. Music stage. (verified pin)" },
    { n: "Food Trucks",  lat: 39.886300, lng: -75.084500, side: "S", approx: true, poi: true,
      where: "Food trucks — placement approximate, near the Dell. (approx)" },
    { n: "Beer",         lat: 39.885700, lng: -75.084500, side: "S", approx: true, poi: true,
      where: "Beer — placement approximate, near the Dell. (approx)" },
    { n: "Vendors",      lat: 39.886300, lng: -75.085400, side: "S", approx: true, poi: true,
      where: "Vendors — placement approximate, near the Dell. (approx)" },
    { n: "Entrance",     lat: 39.885600, lng: -75.085400, side: "S", approx: true, poi: true,
      where: "Park entrance off S Park Ave — placement approximate. (approx)" }
  ];

  // 5 acts, all within the 3:00–9:00 PM window. Set times NOT known → every act pinned to 3:00 PM
  // (the real window-open) as a placeholder, order as-given. sc:'sf' (StageFill). All FREE.
  var ACTS = [
    "Lackadaisical Lemon",
    "Nik Greeley & The Operators",
    "Crickets & Cicadas",
    "Turtles in Plaid",
    "Sean Daniels & The Law Abiding Citizens"
  ];
  var LINEUP = ACTS.map(function (b) {
    return { d: DATE, t: "3:00 PM", st: STAGE, b: b, sc: "sf" };   // t = 3 PM window-open placeholder (real per-act times unpublished)
  });

  root.DD_GROOVEATTHEGROVE = {
    name: "Groove at the Grove 2026",
    slug: "groove-at-the-grove-2026",
    org: "HIP Inc. + Lackadaisical Lemon",     // presenters
    host: "Lackadaisical Lemon",               // host band
    presentedBy: "HIP Inc. + Lackadaisical Lemon",
    city: "Haddon Heights", state: "NJ",
    venue: "Norcross-McLaughlin Memorial Dell · Haddon Lake Park",
    address: "1214 S Park Ave, Haddon Heights, NJ 08035",
    dates: [DATE], time: "3:00–9:00 PM",
    free: true, ownStages: true,
    center: CENTER,                             // REAL owner-provided pin
    genres: ["improvisational rock", "funk", "psychedelia", "bluegrass"],
    amenities: ["Food trucks", "Beer", "Vendors"],
    stages: STAGES, lineup: LINEUP,
    note: "Sat Aug 8, 2026 · 3–9 PM · Haddon Heights, NJ · FREE. Own footprint. REAL center pin (owner-provided, Google Maps); amenity-POI placements approx. Per-act SET TIMES unpublished — all 5 acts pinned to the 3 PM window-open placeholder, order as-given. POIs (Food Trucks/Beer/Vendors/Entrance) render as approx pins (Allentown-Fair convention). Every act → FREE band ticket."
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DD_GROOVEATTHEGROVE;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
