/* dd_mf_bands.js — the single source of truth for the MusikFest Dead & Jam bands.
   Shared by mf_band.html (the event page) and band_ad.html (the rolling ad card).
   Research 2026-07-26; unverified rosters flagged, filled after outreach.

   Tiers (per band):
     tier:"less"  → $0.  Just in the festival list, like the non-Dead acts. No dedicated page.
     tier:"more"  → $20. The full purple state-machine page (Pre → Live → Historical).  [default]
     tier:"most"  → $30. Everything in MORE + the band uploads their own hero background image (bg).
   Optional field:
     bg: "https://…"  → custom hero background image; applied ONLY on the MOST tier. */
(function (root) {
  root.DD_MF_BANDS = {
    "rift": { name: "Rift", kind: "Philadelphia Phish Tribute", home: "Philadelphia, PA",
      members: [{ n: "Sean Coyne", r: "Guitar" }, { n: "John Hildenbrand", r: "Keys" }, { n: "Matt Agostini", r: "Bass" }, { n: "Matt Elberson", r: "Drums" }],
      set: { date: "2026-08-02", time: "12:00 PM", stage: "" },
      setlist: { win: { s: "12:00", e: "13:00" }, songs: [{ n: "Suzy Greenberg", at: "12:02" }] },
      tease: [], recording: null,
      links: { Website: "https://riftphilly.com/", Instagram: "https://www.instagram.com/riftphilly/", Facebook: "https://www.facebook.com/riftphilly/", YouTube: "https://www.youtube.com/@RiftPhilly" },
      coming: [{ d: "Aug 15, 2026", v: "Concerts Under the Stars", c: "King of Prussia, PA" }],
      conf: "Lineup confirmed via riftphilly.com." },
    "life-after-dead": { name: "Life After Dead", kind: "Grateful Dead Tribute", home: "Bethlehem, PA",
      members: [{ n: "Rich Jeffreys", r: "Lead vocals & guitar" }, { n: "Jon Fadem", r: "Lead guitar & vocals" }, { n: "Dave Johnsen", r: "Bass & vocals" }, { n: "Zach Martin", r: "Drums" }],
      set: { date: "", time: "", stage: "", note: "Festival set to confirm" },
      tease: [], recording: null,
      links: { Website: "https://www.reverbnation.com/lifeafterdead1", Facebook: "https://www.facebook.com/lifeafterdeadband", Instagram: "https://www.instagram.com/lifeafterdeadband/" },
      coming: [{ d: "Jun 27, 2026", v: "Musikfest Café at SteelStacks", c: "Bethlehem, PA" }],
      conf: "Lineup confirmed via ArtsQuest. Festival set date to confirm with band." },
    "shakedown-citi": { name: "Shakedown Citi", kind: "Grateful Dead / Jam", home: "New York, NY",
      members: [],
      set: { date: "2026-08-03", time: "", stage: "" },
      tease: [], recording: null,
      links: { Website: "https://www.shakedownciti.com/", Instagram: "https://www.instagram.com/shakedownciti/", Facebook: "https://www.facebook.com/shakedownciti", Spotify: "https://open.spotify.com/artist/642FvT9DfSxEEAORYWqPmq", Bandsintown: "https://www.bandsintown.com/a/15537374-shakedown-citi" },
      coming: [{ d: "Jul 29, 2026", v: "The Warehouse", c: "Amityville, NY" }, { d: "Aug 1, 2026", v: "Jerry Jam 20", c: "Middle Island, NY" }, { d: "Aug 5, 2026", v: "Westcott Theater", c: "Syracuse, NY" }, { d: "Aug 6, 2026", v: "Bearsville Theater", c: "Woodstock, NY" }, { d: "Aug 7, 2026", v: "FTC StageOne", c: "Fairfield, CT" }],
      conf: "Set: Aug 3. Roster not yet published — awaiting the band." },
    "liberty-jams": { name: "Liberty Jams", kind: "Jam Band", home: "",
      members: [],
      set: { date: "2026-08-05", time: "", stage: "" },
      tease: [], recording: null,
      links: {},
      coming: [],
      conf: "Set: Aug 5. No public roster or links found — awaiting the band." },
    /* SAMPLE of the ticketed treatment — a band that lets us sell tickets for their OWN show. */
    "demo-ticketed": { name: "Your Band", kind: "Ticketed headline show · sample", home: "Bethlehem, PA",
      tier: "most", bg: "https://deaddance.app/MUSIKFEST_poster.jpg",
      members: [{ n: "— your lineup —", r: "appears here" }],
      ticketed: true, host: "managed",
      set: { date: "2026-09-19", time: "8:00 PM", stage: "The Foundry · SteelStacks" },
      tickets: [{ name: "General Admission", price_cents: 2500, sample: true }, { name: "Free RSVP", price_cents: 0, sample: true }],
      tease: [], recording: null,
      links: {},
      coming: [],
      conf: "Sample of the ticketed treatment. Real Stripe checkout goes live when the band turns on ticketing." }
  };
})(typeof window !== "undefined" ? window : this);
