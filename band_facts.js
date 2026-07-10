/* ============================================================================
 * band_facts.js — Every band Jerry played in, 1961–1995. One source of truth:
 *   1) bands.html    — a Group for each band on a timeline (history + photos)
 *   2) dd_games.js   — trivia folded into GD Trivia Night
 *   3) nowplaying.js — Hanz & Franz riff on band lore in the Shuffle Bar
 *
 * HONEST-STATE / IP: every history is written from scratch by us out of public
 * facts (dates, members, instruments, records). No prose copied from anyone.
 * The early Palo Alto outfits are thinly documented — where the record is thin
 * we SAY SO instead of inventing. Photos are crowdsourced from our own users.
 * v1 · 2026-07-09
 * ========================================================================== */
(function (root) {
  "use strict";

  var BANDS = [
    { id:"bobjerry", name:"Bob and Jerry", icon:"🎼", years:"May – June 1961", era:"The Palo Alto folk years",
      who:"Robert Hunter · Jerry Garcia", kind:"Folk duo",
      story:"The first band, and only barely a band — two young men who'd just met, playing folk songs for a matter of weeks. It matters for one reason: the other half of this duo was Robert Hunter, who would spend the next thirty years writing the words Jerry sang.",
      sparse:true, facts:["Jerry and Hunter met in the spring of 1961.","Played only a handful of times.","Thinly documented — little survives beyond the fact of it."] },

    { id:"garcianelson", name:"Jerry Garcia and David Nelson", icon:"🎸", years:"June 1961 – Nov 1962", era:"The Palo Alto folk years",
      who:"Jerry Garcia · David Nelson", kind:"Guitar duo",
      story:"An informal partnership with a guitarist who kept turning up for the next thirty years — Nelson would co-found the New Riders of the Purple Sage and stand beside Jerry again in the Acoustic Band in the eighties.",
      sparse:true, facts:["Nelson later co-founded New Riders of the Purple Sage.","He returned for the Jerry Garcia Acoustic Band, 1987–88.","Lightly documented as a named act."] },

    { id:"leicesterhunter", name:"Garcia, Leicester & Hunter", icon:"🪕", years:"Summer 1961", era:"The Palo Alto folk years",
      who:"Jerry Garcia · Marshall Leicester · Robert Hunter", kind:"Folk jams",
      story:"Not so much a band as a summer of playing on porches with Marshall Leicester and Robert Hunter. Leicester is the one who pointed Jerry toward old-time music and the banjo — a nudge that set the next four years.",
      sparse:true, facts:["Loose folk sessions, never a formal group.","Leicester helped steer Jerry toward old-time music.","Sparse documentation."] },

    { id:"tubthumpers", name:"Thunder Mountain Tub Thumpers", icon:"🥁", years:"Spring 1962", era:"The Palo Alto folk years",
      who:"Garcia · Hunter · David Nelson · Joe & Jim Edminston", kind:"Folk / jug-adjacent",
      story:"Bob and Jerry grew a few members and a much better name. Beyond the roster and the season, almost nothing about this outfit survives.",
      sparse:true, facts:["Grew directly out of Bob and Jerry.","Essentially undocumented beyond its lineup."] },

    { id:"hogstompers", name:"Sleepy Hollow Hog Stompers", icon:"🐖", years:"May – Sept 1962", era:"The Palo Alto folk years",
      who:"Garcia · Marshall Leicester · Dick Arnold", kind:"Old-time / bluegrass",
      story:"A trio built around Jerry's frailing banjo — the old clawhammer style, before he chased the fast melodic playing that would define him. They recorded in June of 1962, and those tapes surfaced decades later on the Before the Dead archival set.",
      facts:["Jerry on clawhammer banjo.","Their 1962 recordings appear on 'Before the Dead.'","One of the earliest recordings of Jerry that exists."] },

    { id:"wildwood", name:"Wildwood Boys", icon:"🌲", years:"Fall 1962", era:"The Palo Alto folk years",
      who:"Garcia (banjo) · Robert Hunter (mandolin/bass) · David Nelson (guitar)", kind:"Bluegrass",
      story:"Serious bluegrass, and the point was Jerry's banjo. They won the amateur band contest at the Monterey Folk Festival — the first time anybody handed him a prize for playing music.",
      facts:["Won the amateur contest at the Monterey Folk Festival.","Existed on and off for about six months.","Formed largely to develop Jerry's banjo playing."] },

    { id:"hartvalley", name:"Hart Valley Drifters", icon:"🪕", years:"November 1962", era:"The Palo Alto folk years",
      who:"Garcia · Robert Hunter (bass) · David Nelson · Norman Van Maastricht (dobro)", kind:"Bluegrass",
      story:"The most documented of the early bluegrass outfits, because a Stanford radio station taped them. That 1962 session was eventually released as an album — a young Jerry Garcia, banjo in hand, years before anyone would electrify anything.",
      facts:["A 1962 KZSU radio session was later released as 'Folk Time.'","Hunter on bass and vocals.","Jerry on banjo, guitar and vocals."] },

    { id:"badwater", name:"Badwater Valley Boys", icon:"💧", years:"Winter 1962", era:"The Palo Alto folk years",
      who:"Garcia · Ken Frankel · Marshall Leicester · Robert Hunter", kind:"Bluegrass / old-time",
      story:"A winter's worth of bluegrass with the usual Palo Alto suspects. The roster is essentially all that's left of it.",
      sparse:true, facts:["Undocumented beyond the lineup."] },

    { id:"jerrysara", name:"Jerry & Sara", icon:"💞", years:"Spring 1963 – Spring 1964", era:"The Palo Alto folk years",
      who:"Jerry Garcia · Sara Ruppenthal", kind:"Folk duo",
      story:"A folk duo with Sara Ruppenthal, who would become his first wife. They played coffeehouses when the bluegrass bands weren't playing.",
      sparse:true, facts:["Sara Ruppenthal became Jerry's first wife.","Occasional performances; lightly documented."] },

    { id:"godawful", name:"Godawful Palo Alto Bluegrass Ensemble", icon:"🎻", years:"Summer 1963", era:"The Palo Alto folk years",
      who:"Garcia (mandolin) · Peter Wernick · one more", kind:"Bluegrass",
      story:"Worth remembering for one delicious fact: Jerry played mandolin in this one, because the other fellow — Peter Wernick, later of Hot Rize — could only play banjo, and somebody had to. The name is the best thing anybody ever called a band.",
      facts:["Jerry played MANDOLIN, not banjo.","Peter Wernick later co-founded Hot Rize.","Ended when Wernick went back to college."] },

    { id:"blackmountain", name:"Black Mountain Boys", icon:"⛰️", years:"Winter 1963 – Spring 1964", era:"The Palo Alto folk years",
      who:"Garcia (banjo) · Robert Hunter · David Nelson · Eric Thompson, then Sandy Rothman", kind:"Bluegrass",
      story:"By now Jerry's banjo had teeth. He'd left the old clawhammer behind for the fast, melodic style Bill Keith had introduced, and he was very good. Recordings survive from the Top of the Tangent in Palo Alto — a serious bluegrass band, a year before the Warlocks.",
      facts:["Jerry playing in the melodic Bill Keith banjo style.","Recordings survive from the Top of the Tangent.","Sandy Rothman later joined the Garcia Acoustic Band."] },

    { id:"mothermccree", name:"Mother McCree's Uptown Jug Champions", icon:"🫙", years:"Spring – Fall 1964", era:"The Palo Alto folk years",
      who:"Garcia · Bob Weir · Ron 'Pigpen' McKernan (and others)", kind:"Jug band",
      story:"The Grateful Dead in embryo. Three of the men who'd form the band were here already — Garcia, Weir and Pigpen — playing jug-band music on kazoos and washtubs, roughly twenty-five or thirty gigs' worth. A live set taped at the Top of the Tangent in July of 1964 was finally released decades later. Say the name out loud. It's the best one they ever had.",
      facts:["Three future Grateful Dead members: Garcia, Weir, Pigpen.","Around 25–30 gigs.","A July 1964 live tape was released in the late 1990s."] },

    { id:"asphalt", name:"Asphalt Mountain Jungle Boys", icon:"🛣️", years:"Summer 1964", era:"The Palo Alto folk years",
      who:"Garcia · Eric Thompson · Jody Stecher", kind:"Bluegrass",
      story:"The last of the bluegrass trios before everything went electric. Minimal documentation, magnificent name.",
      sparse:true, facts:["Little documented beyond the lineup."] },

    { id:"warlocks", name:"The Warlocks", icon:"⚡", years:"Dec 1964 – Nov 1965", era:"Going electric",
      who:"Garcia · Weir · Pigpen · Phil Lesh · Bill Kreutzmann", kind:"Electric rock",
      story:"Jerry plugged in. The five men who'd be the Grateful Dead played bars and pizza parlors as the Warlocks, and then became the house band for Ken Kesey's early Acid Tests. Late in 1965 they learned another band was already recording under that name — so they needed a new one. Jerry always said he opened a dictionary at random and there it was: a folklore motif about a dead man's spirit repaying the stranger who paid for his burial. Grateful Dead.",
      facts:["The full founding five, electric, for the first time.","House band at Ken Kesey's early Acid Tests.","Renamed because another band already had 'Warlocks.'"] },

    { id:"gratefuldead", name:"Grateful Dead", icon:"💀", years:"Dec 1965 – July 1995", era:"The main road", big:true,
      who:"Garcia · Weir · Lesh · Pigpen · Kreutzmann · Hart — and Constanten, the Godchauxs, Mydland, Welnick, Hornsby", kind:"Psychedelic rock · Americana · the endless jam",
      story:"Thirty years. Jerry's lifelong band and the reason for all of this. They invented an audience that followed them city to city and taped every note; they made two of the great American albums in a single year, 1970, and then spent a quarter century refusing to play them the same way twice. It ended when Jerry died in August of 1995.",
      facts:["'Workingman's Dead' and 'American Beauty' both landed in 1970.","'Live/Dead' (1969) captured what they actually were.","Their only Top-10 single was 'Touch of Grey,' in 1987."] },

    { id:"hartbeats", name:"Mickey and the Hartbeats", icon:"🥁", years:"Oct – Nov 1968", era:"Side roads",
      who:"Garcia · Phil Lesh · Mickey Hart · Bill Kreutzmann", kind:"Instrumental exploration",
      story:"The Dead minus Weir and Pigpen, playing the Matrix in San Francisco because they weren't allowed to use their own name that week. What's left on tape is prized: Jerry and Phil trading lead lines as near-equals, with nobody holding down the middle. Elvin Bishop and Jack Casady sat in.",
      facts:["The Dead without Weir and Pigpen.","They couldn't use the band's name, so they invented one.","Tapes are treasured for the Garcia–Lesh interplay."] },

    { id:"nrps", name:"New Riders of the Purple Sage", icon:"🤠", years:"March 1969 – Nov 1971", era:"Side roads",
      who:"John 'Marmaduke' Dawson · Garcia (pedal steel) · David Nelson", kind:"Country rock",
      story:"Jerry joined a country-rock band on an instrument he barely knew, for the express purpose of learning it. He played pedal steel with the New Riders for two and a half years — often opening for the Dead, then walking back onstage with them — and left in 1971 once he'd gotten what he came for.",
      facts:["Jerry joined specifically to practice pedal steel guitar.","Debuted July 1969, opening for the Grateful Dead.","Buddy Cage replaced him on steel when he left."] },

    { id:"wales", name:"Jerry Garcia and Howard Wales", icon:"🎹", years:"May 1970 – Jan 1972", era:"Side roads",
      who:"Garcia · Howard Wales (organ) · often Bill Vitt, John Kahn", kind:"Jazz-rock fusion",
      story:"Late-night instrumental fusion with an organist whose harmonic sense left Jerry scrambling. Jerry said keeping up with Wales did more for his ear than almost anything else. The studio record was called Hooteroll?",
      facts:["Wales had played on the Dead's 'American Beauty.'","Their 1971 album: 'Hooteroll?'","Jerry credited Wales with stretching his ear."] },

    { id:"saunders", name:"Jerry Garcia and Merl Saunders", icon:"🎹", years:"Dec 1970 – June 1975", era:"Side roads",
      who:"Garcia · Merl Saunders (keys) · John Kahn (bass) · Bill Vitt (drums) · sometimes Tom Fogerty", kind:"Soul · R&B · jazz",
      story:"For five years, whenever the Dead weren't out, Jerry played bars with Merl Saunders — loose, soulful, unbothered, mostly covers, hours long. This is where he met John Kahn, who'd stay at his side for the rest of his life. Their Live at Keystone captured it.",
      facts:["'Live at Keystone' was recorded in Berkeley in July 1973.","Tom Fogerty of Creedence played rhythm for a stretch.","This band evolved directly into Legion of Mary."] },

    { id:"oitw", name:"Old & In the Way", icon:"🎻", years:"Jan 1973 – April 1974", era:"Side roads", big:true,
      who:"Garcia (banjo) · David Grisman (mandolin) · Peter Rowan (guitar) · Vassar Clements (fiddle) · John Kahn (bass)", kind:"Bluegrass",
      story:"Jerry went home. Fifteen months of straight bluegrass with Grisman, Peter Rowan and the great Vassar Clements, and Jerry back on the banjo he'd put down a decade earlier. Owsley Stanley taped a night at the Boarding House in 1973; the album that came out of it was, for years, the best-selling bluegrass record ever made.",
      facts:["Recorded live at the Boarding House, SF, Oct 1973, by Owsley Stanley.","For years the best-selling bluegrass album of all time.","Released on the Dead's own Round Records."] },

    { id:"gasb", name:"Great American String Band", icon:"🎶", years:"April – June 1974", era:"Side roads",
      who:"Garcia · David Grisman · Richard Greene (fiddle) · Taj Mahal · others", kind:"Acoustic swing / blues",
      story:"A handful of shows across two months. Three Old & In the Way alumni, but it leaned bluesy and swinging rather than bluegrass — a stepping stone toward what Grisman would build next.",
      facts:["Only a few shows, April–June 1974.","Taj Mahal played bass and sang.","A precursor to the David Grisman Quintet."] },

    { id:"legion", name:"Legion of Mary", icon:"🎷", years:"Dec 1974 – July 1975", era:"Side roads",
      who:"Garcia · Merl Saunders · John Kahn · Martin Fierro (sax) · Ron Tutt (drums)", kind:"Soul · jazz · R&B",
      story:"The Garcia–Saunders bar band, finally given a name and a horn. About sixty shows. Then Jerry quietly dropped Saunders and Fierro, kept Kahn and Tutt, and the thing that walked out the other side was called the Jerry Garcia Band.",
      facts:["Roughly 60 shows.","The last formal phase of the Garcia/Saunders partnership.","Became the Jerry Garcia Band."] },

    { id:"jgb", name:"Jerry Garcia Band", icon:"🌹", years:"Oct 1975 – April 1995", era:"The main road", big:true,
      who:"Garcia · John Kahn (the only constant) · Nicky Hopkins, Merl Saunders, Ozzie Ahlers, Melvin Seals…", kind:"Soul · R&B · rock · Hunter/Garcia originals",
      story:"Twenty years and Jerry's true second home. The JGB was where he sang other people's songs like they were his own and stretched them past anything a Dead crowd expected. Only John Kahn was there the whole way. Nicky Hopkins opened the piano bench; Melvin Seals held it longest. Their single studio album, Cats Under the Stars, sold poorly and was Jerry's favorite record he ever made.",
      facts:["Only studio album: 'Cats Under the Stars' (1978) — his own favorite.","John Kahn was the sole constant besides Jerry.","Melvin Seals was the longest-serving keyboardist."] },

    { id:"reconstruction", name:"Reconstruction", icon:"🎺", years:"Jan – Sept 1979", era:"Side roads",
      who:"Garcia · Merl Saunders · John Kahn · Ron Stallings (sax) · Ed Neumeister (trombone) · Gaylord Birch (drums)", kind:"Jazz-funk with horns",
      story:"John Kahn put together a horn-driven jazz-funk sextet and Jerry played guitar in it for nine months and fifty-odd shows, all of them in California and Colorado. No studio album — only tapes. It's the strangest, funkiest band he ever stood in.",
      facts:["About 57 shows, all in CA and CO.","First show Jan 1979 at the Keystone Berkeley.","No studio album exists — live tapes only."] },

    { id:"kahn", name:"Jerry Garcia and John Kahn", icon:"🎸", years:"April 1982 – May 1989", era:"Side roads",
      who:"Garcia (acoustic guitar) · John Kahn (upright bass)", kind:"Acoustic duo",
      story:"Just the two of them: an acoustic guitar and an upright bass, about sixty-odd shows across the eighties. In May of 1982 they played inside the Oregon State Penitentiary. It is the most stripped-down Jerry ever performed.",
      facts:["Played the Oregon State Penitentiary, May 1982.","Roughly 60–65 shows, mostly 1982 and 1984–86.","Kahn on upright bass."] },

    { id:"jgab", name:"Jerry Garcia Acoustic Band", icon:"🪗", years:"March 1987 – July 1988", era:"Side roads",
      who:"Garcia · David Nelson · Sandy Rothman · John Kahn · Kenny Kosek (fiddle)", kind:"Folk · bluegrass",
      story:"Twenty-five years after Palo Alto, Jerry put an acoustic band together with David Nelson and Sandy Rothman — the same men from the Wildwood Boys and the Black Mountain Boys. The circle closed. They recorded Almost Acoustic at the Warfield and the Wiltern.",
      facts:["'Almost Acoustic' recorded late 1987, released Dec 1988.","Nelson and Rothman had played with Jerry in 1962–64.","John Kahn on upright bass, again."] },

    { id:"grisman", name:"Jerry Garcia and David Grisman", icon:"🍕", years:"Dec 1990 – May 1994", era:"The last road", big:true,
      who:"Jerry Garcia · David Grisman", kind:"Acoustic — folk, bluegrass, jazz, blues",
      story:"Two old friends from the bluegrass days sitting in a room with a guitar and a mandolin, recording for Grisman's own label because nobody else got a say. They made a children's record. They made a record of old ballads. And they made a tape with Tony Rice that leaked, got named for the delivery guy who supposedly walked off with it, and became the most beloved bootleg-turned-album in the catalog.",
      facts:["Released on Grisman's own Acoustic Disc label.","'Not for Kids Only' (1993) is a record of children's songs.","'The Pizza Tapes,' with Tony Rice, came out in 2000."] }
  ];

  /* ---- Trivia — same {q, c[4], a} shape dd_games.js uses ---- */
  var TRIVIA = [
    { q:"Before they were the Grateful Dead, the band was called…", c:["The Warlocks","Mother McCree's","The Zodiacs","The Emergency Crew"], a:0 },
    { q:"Which jug band already contained Garcia, Weir and Pigpen?", c:["Mother McCree's Uptown Jug Champions","Wildwood Boys","Hart Valley Drifters","Black Mountain Boys"], a:0 },
    { q:"In New Riders of the Purple Sage, Jerry mainly played…", c:["Pedal steel guitar","Bass","Drums","Banjo"], a:0 },
    { q:"Old & In the Way's mandolin player was…", c:["David Grisman","Peter Rowan","Vassar Clements","John Kahn"], a:0 },
    { q:"Old & In the Way's fiddler on the famous live album was…", c:["Vassar Clements","Richard Greene","Kenny Kosek","Sandy Rothman"], a:0 },
    { q:"Which band turned into the Jerry Garcia Band?", c:["Legion of Mary","Reconstruction","Old & In the Way","The Warlocks"], a:0 },
    { q:"Besides Jerry, the only constant in the Jerry Garcia Band was…", c:["John Kahn","Melvin Seals","Merl Saunders","Ron Tutt"], a:0 },
    { q:"The Jerry Garcia Band's only studio album was…", c:["Cats Under the Stars","Reflections","Garcia","Compliments"], a:0 },
    { q:"Jerry's 1979 horn-driven jazz-funk band was called…", c:["Reconstruction","Legion of Mary","Great American String Band","The Hartbeats"], a:0 },
    { q:"Jerry and David Grisman's album of children's songs was…", c:["Not for Kids Only","Shady Grove","The Pizza Tapes","Almost Acoustic"], a:0 },
    { q:"'Mickey and the Hartbeats' was the Grateful Dead without…", c:["Weir and Pigpen","Lesh and Hart","Kreutzmann","Garcia"], a:0 },
    { q:"In his early bluegrass bands, Jerry mostly played…", c:["Banjo","Pedal steel","Bass","Fiddle"], a:0 },
    { q:"Robert Hunter, the Dead's lyricist, first played with Jerry in…", c:["a folk duo called Bob and Jerry","The Warlocks","New Riders","Reconstruction"], a:0 },
    { q:"The Jerry Garcia Acoustic Band's live album was…", c:["Almost Acoustic","Cats Under the Stars","Reflections","Shady Grove"], a:0 },
    { q:"Jerry's jazz-rock album with organist Howard Wales was…", c:["Hooteroll?","Live at Keystone","Compliments","Reflections"], a:0 },
    { q:"Old & In the Way's live album was for years the best-selling album in which genre?", c:["Bluegrass","Jazz","Folk","Country"], a:0 },
    { q:"Jerry and Merl Saunders' famous 1973 live album was…", c:["Live at Keystone","Hooteroll?","Almost Acoustic","Reconstruction"], a:0 },
    { q:"In the Godawful Palo Alto Bluegrass Ensemble, Jerry played…", c:["Mandolin","Banjo","Fiddle","Bass"], a:0 },
    { q:"The Wildwood Boys won the amateur band contest at which festival?", c:["Monterey Folk Festival","Newport Folk Festival","Big Sur Folk Festival","Berkeley Folk Festival"], a:0 },
    { q:"Jerry and John Kahn once played a concert inside…", c:["Oregon State Penitentiary","Alcatraz","San Quentin","Folsom Prison"], a:0 }
  ];

  /* ---- Hanz & Franz: Hanz blusters, Franz knows. Facts and lore, never lyrics. ---- */
  var HF = [
    { h:"They were called the WARLOCKS?", f:"They were, love — until they found another band already had the name. Jerry always said he opened a dictionary at random and there it was." },
    { h:"Jerry played BANJO before he played guitar?", f:"Bluegrass banjo, dear. Wildwood Boys, Hart Valley Drifters, Black Mountain Boys — he was chasing Bill Keith's melodic style." },
    { h:"Pedal steel? JERRY?", f:"New Riders of the Purple Sage. He joined that band mostly to make himself practice it." },
    { h:"Old & In the Way. Bluegrass. Of all things.", f:"And for years its live album was the best-selling bluegrass record ever made. Grisman on mandolin, Vassar Clements on fiddle." },
    { h:"'Legion of Mary' sounds like a church.", f:"Merl Saunders, John Kahn, Martin Fierro and Ron Tutt, sweetheart. Jerry reshuffled it and it walked out as the Jerry Garcia Band." },
    { h:"The JGB had a HUNDRED keyboard players!", f:"A few, love. Nicky Hopkins opened; Melvin Seals stayed longest. Only John Kahn was there the entire twenty years." },
    { h:"Cats Under the Stars FLOPPED.", f:"It did. And Jerry called it the favorite record he ever made." },
    { h:"'Mickey and the Hartbeats' — made-up name!", f:"The Dead minus Weir and Pigpen. They weren't allowed to use their own name that week, so they used that one." },
    { h:"Jerry made a KIDS record?", f:"'Not for Kids Only,' with David Grisman. They also made 'The Pizza Tapes,' which is the finest title in all of music." },
    { h:"He played a PRISON?", f:"Oregon State Penitentiary, 1982. Just Jerry and John Kahn with an upright bass." },
    { h:"Mother McCree's Uptown Jug Champions.", f:"Say it again, it's wonderful. Garcia, Weir and Pigpen — the Grateful Dead in embryo, playing washtub and kazoo." },
    { h:"He played MANDOLIN in one band!", f:"The Godawful Palo Alto Bluegrass Ensemble — the other fellow could only play banjo, so somebody had to." }
  ];

  root.GDBands = { BANDS: BANDS, TRIVIA: TRIVIA, HF: HF, VERSION: "1" };
})(typeof window !== "undefined" ? window : globalThis);
