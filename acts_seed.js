/* acts_seed.js — the ANY-ACT registry (the booking exchange under DeadDance).
   The fan app (deaddance.app) shows Grateful Dead acts ONLY — the Deadhead crowd never
   sees the rest. The Venue Console + AI Booking Agent see EVERY act an Ambassador signs in
   their patch: any genre, any size, from a headlining band to the Tuesday piano-bar player —
   matched to any room, country club to dive.
   Demo/sample acts (dead:false). Real acts register via act_register.html.
   Fields:
     genre  — MAIN genre (top-level filter). Grateful Dead acts live in band_seed.js.
     style  — the descriptive sub-style shown under the genre
     size   — Solo · Duo · Trio · Band · DJ
     fit    — best room: Upscale · Neighborhood · Dive · Any
     energy — Chill · Mid · High
     fee    — typical ask (USD, planning estimate) */
window.DDActs = [
  // Classical
  { name:"The Sonoma Quartet", mono:"SQ", genre:"Classical", style:"String quartet", size:"Quartet", fit:"Upscale", energy:"Chill", city:"Santa Rosa", state:"CA", fee:550 },
  // Piano / Standards
  { name:"Marcus at the Keys", mono:"MK", genre:"Piano / Standards", style:"Solo piano bar", size:"Solo", fit:"Upscale", energy:"Chill", city:"San Francisco", state:"CA", fee:300 },
  // Jazz
  { name:"Amelia Sun", mono:"AS", genre:"Jazz", style:"Jazz vocalist", size:"Solo", fit:"Upscale", energy:"Chill", city:"Chicago", state:"IL", fee:400 },
  { name:"The Velvet Trio", mono:"VT", genre:"Jazz", style:"Jazz trio", size:"Trio", fit:"Upscale", energy:"Chill", city:"New York", state:"NY", fee:600 },
  { name:"The Nightcaps", mono:"NC", genre:"Jazz", style:"Jazz duo", size:"Duo", fit:"Neighborhood", energy:"Chill", city:"New Orleans", state:"LA", fee:450 },
  { name:"The Downbeats", mono:"DB", genre:"Jazz", style:"Swing & standards", size:"Band", fit:"Upscale", energy:"Mid", city:"Los Angeles", state:"CA", fee:800 },
  // Rock
  { name:"Ramble On", mono:"RO", genre:"Rock", style:"Classic rock", size:"Band", fit:"Neighborhood", energy:"High", city:"Oakland", state:"CA", fee:900 },
  { name:"Midnight Special", mono:"MS", genre:"Rock", style:"Classic rock", size:"Band", fit:"Neighborhood", energy:"Mid", city:"Cleveland", state:"OH", fee:650 },
  { name:"American Girls", mono:"AG", genre:"Rock", style:"Tom Petty tribute", size:"Band", fit:"Neighborhood", energy:"Mid", city:"San Jose", state:"CA", fee:800 },
  { name:"Come Together", mono:"CT", genre:"Rock", style:"Beatles tribute", size:"Band", fit:"Upscale", energy:"Mid", city:"Boston", state:"MA", fee:1100 },
  { name:"Kashmir Nights", mono:"KN", genre:"Rock", style:"Led Zeppelin tribute", size:"Band", fit:"Neighborhood", energy:"High", city:"Seattle", state:"WA", fee:1000 },
  { name:"The Fuzz", mono:"FZ", genre:"Rock", style:"Punk", size:"Band", fit:"Dive", energy:"High", city:"Brooklyn", state:"NY", fee:600 },
  // Pop
  { name:"Neon Tuesday", mono:"NT", genre:"Pop", style:"Pop covers", size:"Band", fit:"Any", energy:"High", city:"Nashville", state:"TN", fee:800 },
  { name:"The Encore", mono:"EN", genre:"Pop", style:"Top 40 party band", size:"Band", fit:"Any", energy:"High", city:"Austin", state:"TX", fee:850 },
  { name:"Glitter Boys", mono:"GB", genre:"Pop", style:"80s dance covers", size:"Band", fit:"Upscale", energy:"High", city:"Las Vegas", state:"NV", fee:900 },
  // Hip-Hop
  { name:"The Cypher", mono:"CY", genre:"Hip-Hop", style:"Live MC + DJ", size:"Duo", fit:"Neighborhood", energy:"High", city:"Atlanta", state:"GA", fee:700 },
  // R&B / Soul
  { name:"Superstition", mono:"SU", genre:"R&B / Soul", style:"Funk & soul", size:"Band", fit:"Neighborhood", energy:"High", city:"Detroit", state:"MI", fee:1000 },
  { name:"Velour", mono:"VL", genre:"R&B / Soul", style:"Neo-soul", size:"Band", fit:"Upscale", energy:"Mid", city:"Philadelphia", state:"PA", fee:700 },
  // Electronic / DJ
  { name:"DJ Northbound", mono:"DJ", genre:"Electronic / DJ", style:"Open-format DJ", size:"DJ", fit:"Any", energy:"High", city:"Denver", state:"CO", fee:500 },
  // Country
  { name:"Honky Tonk Union", mono:"HU", genre:"Country", style:"Honky-tonk", size:"Band", fit:"Dive", energy:"High", city:"Fort Worth", state:"TX", fee:650 },
  { name:"The Tailgaters", mono:"TG", genre:"Country", style:"Country covers", size:"Band", fit:"Dive", energy:"High", city:"Dallas", state:"TX", fee:700 },
  // Blues
  { name:"Bayou Kings", mono:"BK", genre:"Blues", style:"Electric blues", size:"Band", fit:"Dive", energy:"High", city:"Memphis", state:"TN", fee:700 },
  // Folk / Americana
  { name:"Sarah Vale", mono:"SV", genre:"Folk / Americana", style:"Singer-songwriter", size:"Solo", fit:"Neighborhood", energy:"Chill", city:"Portland", state:"OR", fee:350 },
  { name:"Rosewood", mono:"RW", genre:"Folk / Americana", style:"Singer-songwriter duo", size:"Duo", fit:"Upscale", energy:"Chill", city:"Burlington", state:"VT", fee:450 },
  { name:"Blue Ridge Runners", mono:"BR", genre:"Folk / Americana", style:"Bluegrass", size:"Band", fit:"Neighborhood", energy:"Mid", city:"Asheville", state:"NC", fee:600 },
  { name:"Steel & Pine", mono:"SP", genre:"Folk / Americana", style:"Bluegrass duo", size:"Duo", fit:"Neighborhood", energy:"Mid", city:"Nashville", state:"TN", fee:500 },
  // Reggae
  { name:"Island Time", mono:"IT", genre:"Reggae", style:"Reggae", size:"Band", fit:"Neighborhood", energy:"Mid", city:"San Diego", state:"CA", fee:700 },
  // Latin
  { name:"Fuego", mono:"FG", genre:"Latin", style:"Latin dance", size:"Band", fit:"Any", energy:"High", city:"Miami", state:"FL", fee:900 }
];

/* Canonical top-level genres for the registry (musicgenreslist.com-style). The register form
   offers this full list; an act picks a top-level genre + free-text style. Grateful Dead is a
   first-class genre (the fan-app-visible one). Sub-styles live in each act's `style`. */
window.DD_GENRES = [
  "Grateful Dead","Rock","Pop","Country","Hip-Hop","R&B / Soul","Electronic / DJ","Jazz",
  "Blues","Folk / Americana","Latin","Reggae","Classical","Piano / Standards","Cover / Top 40"
];
