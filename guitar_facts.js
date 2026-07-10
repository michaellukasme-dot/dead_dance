/* ============================================================================
 * guitar_facts.js — Jerry's seven guitars. ONE source of truth, three consumers:
 *   1) guitars.html  — a Group for each guitar (history + crowdsourced photos)
 *   2) dd_games.js   — trivia questions folded into GD Trivia Night
 *   3) nowplaying.js — Hanz & Franz riff on guitar lore in the Shuffle Bar
 *
 * HONEST-STATE / IP: every history below is written from scratch by us out of
 * public facts (dates, builders, materials, prices, auctions). No prose is
 * copied from jerrygarcia.com or any other source. Facts aren't copyrightable;
 * someone else's sentences are. Photos are CROWDSOURCED from our own users —
 * we reproduce no third-party images.
 * v1 · 2026-07-09
 * ========================================================================== */
(function (root) {
  "use strict";

  var GUITARS = [
    {
      id: "alligator", name: "Alligator", icon: "🐊",
      years: "1971–1973", builder: "Fender (1955 Stratocaster)", cost: "~$250 — a gift",
      tag: "The pawnshop Strat that became a Frankenstein.",
      story: "Graham Nash turned up a 1955 Stratocaster in a Phoenix pawn shop for a couple hundred dollars and handed it to Jerry as thanks for playing on his solo record. Jerry made it unmistakably his: a grinning cartoon alligator sticker went on the pickguard, and the guitar had its name. Alembic's techs rebuilt it so many times they took to calling it a Frankenstein — always changing, never finished. It was the guitar of the Europe '72 era, and Jerry retired it after his birthday show in the summer of 1973.",
      specs: "Swamp-ash body, maple neck. Endlessly modified — including a brass faceplate after the original broke onstage.",
      firstLast: "Retired after Aug 1, 1973 — his birthday — at Roosevelt Stadium, Jersey City.",
      fate: "Sold at auction in December 2019 for about $420,000.",
      facts: [
        "Named for a sticker, not an inlay.",
        "Carried him through the Europe '72 run.",
        "Fender's Custom Shop built a limited replica for what would've been Jerry's 80th."
      ]
    },
    {
      id: "travisbean", name: "Travis Bean", icon: "🔩",
      years: "1975–1978", builder: "Travis Bean", cost: "~$1,395",
      tag: "Aluminum necks. A radical idea he actually kept.",
      story: "For three years Jerry played guitars with necks machined out of aluminum — Travis Bean's conviction that metal would hold tune and sing longer than wood. Two came off the wall of a Palo Alto music store; the TB500s were built to Jerry's spec. The one he favored was onstage at Barton Hall in May of 1977 and on the sessions that became Terrapin Station and the Jerry Garcia Band's Cats Under the Stars. These were also his laboratory: the first guitar he hung a synth pickup on, and the first with the onboard effects loop he'd use for the rest of his life.",
      specs: "Hawaiian koa bodies, aluminum necks and headstocks, brass nut, 22 frets, rosewood fingerboard.",
      firstLast: "First seen Sept 1975; the TB500 stepped aside when Wolf returned in the fall of 1977.",
      fate: "TB500 #12 is in private hands; a Garcia Travis Bean neck went through Sotheby's in 2021.",
      facts: [
        "Where the famous effects loop (OBEL) started.",
        "Onstage at Cornell's Barton Hall, 5/8/77.",
        "Stickers included one reading 'The Enemy is Listening.'"
      ]
    },
    {
      id: "wolf", name: "Wolf", icon: "🐺",
      years: "1973–1993", builder: "Doug Irwin", cost: "~$1,500",
      tag: "A sticker named it. Then it was carved into the wood forever.",
      story: "At the end of 1972 Jerry walked into a shop, saw the very first guitar Doug Irwin had ever built, and bought it on the spot. Then he asked Irwin to make him another — no limits. That second guitar became Wolf. A cartoon wolf sticker Jerry pressed on below the tailpiece gave it its name, and when the guitar came back for repairs, Irwin inlaid the wolf into the body permanently. It debuted in September 1973 at a private party for the Hells Angels on a boat in New York Harbor.",
      specs: "Purpleheart and curly maple, ebony fingerboard, 24 frets. A peacock inlay on the peghead at first, later replaced by Irwin's eagle.",
      firstLast: "Debut 9/5/73 with Garcia & Saunders; last played with the Dead at the Oakland Coliseum, 2/23/93.",
      fate: "Awarded to Irwin in the 2001 settlement and auctioned in 2002. Sold again in 2017 for $1.9 million — and the buyer matched it, sending roughly $3.2 million to the Southern Poverty Law Center.",
      facts: [
        "Came out of retirement in 1989 as Jerry's MIDI guinea pig.",
        "Its 2017 sale became one of the great charitable moments in guitar history.",
        "The wolf started as a sticker Jerry stuck on himself."
      ]
    },
    {
      id: "tiger", name: "Tiger", icon: "🐯",
      years: "1979–1995", builder: "Doug Irwin", cost: "$5,800",
      tag: "\"Don't hold back.\" Six years and 13.5 pounds later…",
      story: "Right after Wolf, Jerry asked Doug Irwin for another and told him not to hold back and not to worry what it cost. Irwin took him at his word — roughly six years and two thousand hours. What came back was a slab of laminated cocobolo, maple and padauk, bound in solid brass, weighing thirteen and a half pounds, with a tiger inlaid behind the tailpiece that gave it its name. It became the guitar Jerry played longer than any other, and he loved it for the sheer number of voices it gave him.",
      specs: "Laminated 'hippie sandwich' of cocobolo, maple and padauk; solid brass binding and hardware; 13.5 lbs. Five-way pickup selector, onboard effects loop.",
      firstLast: "First played at the Oakland Auditorium on 8/4/79 ('Jack Straw'). Its final outing is disputed — long lore says the Dead's last show in July 1995; the family's own account and a 2026 auction record put it at a Jerry Garcia Band show that spring.",
      fate: "Awarded to Irwin in the 2001 settlement; sold in 2002 for $957,500, and again in March 2026 for $11.56 million — among the most expensive guitars ever sold.",
      facts: [
        "Thirteen and a half pounds. Jerry played it for sixteen years.",
        "Its 2026 sale shattered a $1–2M estimate.",
        "Irwin was told to ignore the budget entirely."
      ]
    },
    {
      id: "rosebud", name: "Rosebud", icon: "🌹",
      years: "1989–1995", builder: "Doug Irwin", cost: "$11,000",
      tag: "Irwin's masterpiece. Named for a dancing skeleton.",
      story: "Delivered at the end of 1989, Rosebud was everything Doug Irwin had learned poured into one instrument, with MIDI built in from the start. It's nearly Tiger's twin, but two pounds lighter — the flame-maple core hollowed out to lift the weight off Jerry's shoulder. Irwin called the dancing skeleton inlaid on the cover plate 'The Saint.' Jerry called the whole guitar Rosebud, and it's long been guessed he was tipping his hat to Citizen Kane. It became his main guitar for the last stretch of his life.",
      specs: "Carved cocobolo top and back, hollowed flame-maple core, 24-fret ebony fingerboard, onboard MIDI. ~11.5 lbs.",
      firstLast: "First played New Year's Eve 1989 in Oakland ('Sugar Magnolia'); last with the Dead at Soldier Field, 7/9/95.",
      fate: "Stayed with the band in the 2001 settlement; has been displayed at the Rock & Roll Hall of Fame.",
      facts: [
        "MIDI was designed in, not bolted on.",
        "Two pounds lighter than Tiger, by design.",
        "'The Saint' was Irwin's name for the skeleton — 'Rosebud' was Jerry's."
      ]
    },
    {
      id: "lightningbolt", name: "Lightning Bolt", icon: "⚡",
      years: "1993–1995", builder: "Stephen Cripe", cost: "A gift",
      tag: "Built by a man who'd never made a guitar.",
      story: "Stephen Cripe built ornate wooden interiors for sailboats in the Florida Keys and had never built a guitar in his life. He froze frames of a Dead concert video to work out the shape of Tiger, built his own version by feel, and mailed it to the band's office. Jerry picked it up and essentially never put it down — it was his primary instrument for the last two years of his life. Even the wood has a story: a fingerboard of Brazilian rosewood salvaged from an old building, and a body cut from an East Indian rosewood opium bed.",
      specs: "Black walnut core, East Indian rosewood top and back, salvaged Brazilian rosewood fingerboard, mother-of-pearl lightning-bolt inlay.",
      firstLast: "First played with the Jerry Garcia Band in Seattle, 8/7/93; last with the Dead at Shoreline, 6/4/95.",
      fate: "Displayed at the Rock & Roll Hall of Fame. Cripe died in 1996.",
      facts: [
        "Copied from paused video frames — no templates, no measurements.",
        "The body wood came from an opium bed.",
        "A gift. Cripe asked for nothing."
      ]
    },
    {
      id: "tophat", name: "Top Hat", icon: "🎩",
      years: "Delivered 1995 — barely played", builder: "Stephen Cripe", cost: "$6,500",
      tag: "\"Just do it. If I don't like it, I'll send it back.\"",
      story: "Jerry met Cripe backstage in Florida and asked him for a backup to Lightning Bolt. Cripe hadn't measured the original or even photographed it, and said so. Jerry told him to build it anyway — if it wasn't right, he'd send it back. So Cripe built it from feel. When it was done he told the office to pay him whatever they thought it was worth, and a check came for $6,500 — the first guitar he ever sold. Jerry hardly played it, and loved it anyway.",
      specs: "Walnut core with laminated cocobolo top and back, maple and rosewood neck, recycled ivory inlays. The top-hat inlay was carved from warthog tusk.",
      firstLast: "Delivered April 1995, months before Jerry's death. Rarely taken onstage.",
      fate: "Displayed at the Rock & Roll Hall of Fame.",
      facts: [
        "Built with no measurements of the guitar it was copying.",
        "Cripe let them name their own price. They said $6,500.",
        "The top-hat inlay is warthog tusk."
      ]
    }
  ];

  /* ---- Trivia — same {q, c[4], a} shape dd_games.js already uses ---- */
  var TRIVIA = [
    { q: "Who gave Jerry the 1955 Stratocaster known as 'Alligator'?", c: ["Graham Nash", "David Crosby", "Bob Weir", "Neil Young"], a: 0 },
    { q: "Which luthier built Wolf, Tiger and Rosebud?", c: ["Doug Irwin", "Stephen Cripe", "Travis Bean", "Leo Fender"], a: 0 },
    { q: "How did 'Alligator' get its name?", c: ["A sticker on the pickguard", "An inlay in the neck", "Its green finish", "A song"], a: 0 },
    { q: "Jerry's guitar 'Tiger' sold at auction in 2026 for about…", c: ["$11.5 million", "$1.9 million", "$950,000", "$420,000"], a: 0 },
    { q: "Wolf's 2017 auction raised millions for which organization?", c: ["Southern Poverty Law Center", "Rex Foundation", "Red Cross", "MusiCares"], a: 0 },
    { q: "What was unusual about Jerry's Travis Bean guitars?", c: ["Aluminum necks", "No frets", "Seven strings", "Built-in speakers"], a: 0 },
    { q: "Who built Lightning Bolt and Top Hat?", c: ["Stephen Cripe", "Doug Irwin", "Alembic", "Travis Bean"], a: 0 },
    { q: "Before he built guitars, Stephen Cripe built…", c: ["Sailboat interiors", "Race cars", "Church organs", "Hotel furniture"], a: 0 },
    { q: "Doug Irwin called Rosebud's skeleton inlay…", c: ["The Saint", "Bertha", "The Reaper", "Jack Straw"], a: 0 },
    { q: "Roughly how much did Tiger weigh?", c: ["13.5 lbs", "6 lbs", "20 lbs", "9 lbs"], a: 0 },
    { q: "Which Garcia guitar had MIDI designed in from the start?", c: ["Rosebud", "Wolf", "Alligator", "Tiger"], a: 0 },
    { q: "Commissioning Tiger, Jerry told Doug Irwin…", c: ["Don't hold back", "Make it cheap", "Copy Wolf", "Make it light"], a: 0 },
    { q: "Lightning Bolt and Top Hat are displayed at the…", c: ["Rock & Roll Hall of Fame", "Smithsonian", "Grammy Museum", "MoMA"], a: 0 },
    { q: "Doug Irwin's legal dispute with the Dead was over which guitars?", c: ["Wolf and Tiger", "Rosebud only", "Alligator", "The Travis Beans"], a: 0 },
    { q: "A Travis Bean TB500 was onstage at which legendary 1977 show?", c: ["Barton Hall, Cornell", "Winterland", "Red Rocks", "Watkins Glen"], a: 0 },
    { q: "Stephen Cripe copied Tiger's shape from…", c: ["Frozen video frames", "Blueprints from Irwin", "A museum visit", "Jerry's sketches"], a: 0 },
    { q: "Lightning Bolt's body wood was salvaged from…", c: ["An opium bed", "A church pew", "A shipwreck", "A barn door"], a: 0 },
    { q: "Top Hat's namesake inlay is carved from…", c: ["Warthog tusk", "Abalone", "Ebony", "Brass"], a: 0 }
  ];

  /* ---- Hanz & Franz: Hanz blusters, Franz knows the facts. No lyrics, just lore. ---- */
  var HF = [
    { h: "TIGER weighed thirteen and a half POUNDS. My back hurts thinking about it.", f: "Easy, love — Doug Irwin spent six years and about two thousand hours on it. Jerry told him not to hold back, and he didn't." },
    { h: "A guy who built BOAT interiors made Jerry's last guitar. BOATS!", f: "Stephen Cripe, sweetheart. Never built a guitar in his life — he froze frames of a concert video to copy the shape. Jerry played it almost exclusively for two years." },
    { h: "Wolf sold for one-point-nine MILLION dollars!", f: "And the buyer matched it, dear — roughly $3.2 million went to the Southern Poverty Law Center." },
    { h: "That alligator on the pickguard? It's just a STICKER.", f: "A sticker that named a guitar, Hanz. Graham Nash found that Strat in a Phoenix pawn shop for about two hundred fifty dollars." },
    { h: "Aluminum necks?! Who does that?", f: "Travis Bean did — and Jerry played them three years. It's where his effects loop was born." },
    { h: "Rosebud. Like the sled, right?", f: "Maybe. Irwin called the skeleton inlay 'The Saint.' Jerry named the whole guitar Rosebud." },
    { h: "Tiger went for ELEVEN MILLION!", f: "$11.56 million in 2026, love. One of the priciest guitars ever sold — it blew past its estimate." },
    { h: "Jerry gave guitars away like candy.", f: "He did. Twenty-five or so he played with any regularity, and he passed plenty on once he'd moved past them." },
    { h: "Top Hat — he barely PLAYED it!", f: "And loved it anyway. Cripe told them to pay whatever they thought it was worth. The check was $6,500 — his first sale ever." },
    { h: "There was a LAWSUIT over the guitars?", f: "Jerry's will left the Irwins to Doug. The band disagreed. They settled in 2001 — Irwin took Wolf and Tiger home." },
    { h: "Lightning Bolt's body came from an OPIUM BED?", f: "East Indian rosewood, yes. Cripe used reclaimed wood — the fingerboard came out of an old building." },
    { h: "Wolf's got a peacock on the headstock?", f: "It did at first! Irwin swapped his own eagle in later, and inlaid the wolf into the body while he was at it." }
  ];

  root.GDGuitars = { GUITARS: GUITARS, TRIVIA: TRIVIA, HF: HF, VERSION: "1" };
})(typeof window !== "undefined" ? window : globalThis);
