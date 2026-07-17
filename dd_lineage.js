/* dd_lineage.js — the Grateful Dead bloodline: every keeper of the flame from the Warlocks (1965)
   forward, each a joinable GROUP that opens with an original history synthesis written for DeadDance.
   The keyboard seat is rendered as the succession it truly was — the chair that kept claiming its
   players (Pigpen → Keith → Brent → Vince), with the handoff overlapping at each boundary.
   Plus the Archive.org group — the taper covenant. All content is original synthesis (facts, retold);
   photos/memories are USER-uploaded (platform posture, not the house publishing). */
(function (w) {
  w.DD_LINEAGE = {
    intro: "Thirty years, one long song. These are the players who carried it — founders, drummers, and the "
         + "keyboard seat that no one held for long. Join the family. Add your photos and your memories; the "
         + "story belongs to everyone who was in the room.",

    // seat: 'founder' | 'drums' | 'keys' | 'vocals' | 'guest'.  chair: order in the keyboard succession.
    members: [
      { slug:"jerry-garcia", name:"Jerry Garcia", role:"Lead guitar · vocals", years:"1965–1995", ic:"🌹",
        seat:"founder", died:"August 9, 1995", verifier:"the Jerry Garcia Family (JGF)",
        syn:"From the Warlocks in the Palo Alto folk-and-jug scene, Jerry Garcia was the gravity the band orbited without ever admitting it had a leader. A banjo player turned electric guitarist, he built a fluid, singing, exploratory lead voice — bluegrass filigree, blues feeling, jazz's willingness to get lost. Through the Acid Tests, the Haight, and thirty years on the road, his warmth and curiosity set the band's temperature; with Robert Hunter he wrote the songbook, and on the side he ran the Jerry Garcia Band. He fought the health and the habits that finally caught him, and died August 9, 1995. The Grateful Dead, as such, ended with him — and everything on this app flows downhill from his hands." },

      { slug:"bob-weir", name:"Bob Weir", role:"Rhythm guitar · vocals", years:"1965–present", ic:"🎸",
        seat:"founder", verifier:"the Weir family — Monet or Chloe",
        syn:"The teenager who talked his way into the Warlocks grew into the most inventive rhythm guitarist in American rock — playing the spaces Garcia left, inverting chords, treating rhythm like a second lead. From cowboy-song kid (“Mexicali Blues,” “Me and My Uncle”) to keeper of the flame, Weir carried the music forward for decades after — The Other Ones, The Dead, Furthur, Dead & Company, Wolf Bros. If Garcia was the river, Weir was the banks that gave it shape, and the one who kept the songs on the road." },

      { slug:"phil-lesh", name:"Phil Lesh", role:"Bass · vocals", years:"1965–1995", ic:"🎵",
        seat:"founder", died:"October 25, 2024", verifier:"Grahame Lesh (his son)",
        syn:"A classically trained trumpeter and avant-garde composition student with no rock-bass experience, Phil Lesh approached the low end as a second melodic voice — counterpoint, not foundation. His restless, roaming lines are why the band never sat still. Off stage he was its conscience about sound (the Wall of Sound was partly his obsession) and later its most generous mentor: Phil Lesh & Friends became a finishing school for a whole generation of jam musicians, including his son Grahame. He died October 25, 2024, the last of the founding rhythm-section architects to go." },

      { slug:"bill-kreutzmann", name:"Bill Kreutzmann", role:"Drums", years:"1965–1995", ic:"🥁",
        seat:"founder",
        syn:"The Warlocks' original drummer and the band's steady pulse — the groove the others improvised against. When Mickey Hart joined in 1967 the two became the Rhythm Devils, a two-drummer conversation that let the band breathe in odd meters and long, tidal jams. Bill's feel was looser, bluesier, more song-serving; together the drummers were the engine room that made the thirty-minute journeys possible. He kept the beat every one of the band's thirty years." },

      { slug:"ron-pigpen-mckernan", name:"Ron “Pigpen” McKernan", role:"Organ · harmonica · vocals", years:"1965–1972", ic:"🎤",
        seat:"founder", chair:1, died:"March 8, 1973",
        syn:"The soul of the early band and its first frontman — before Garcia was. Pigpen was the blues heart: Hammond organ, harmonica, and a growling, commanding voice that turned “Turn On Your Lovelight” and “Midnight Hour” into twenty-minute revival meetings. He was the biker-blues center of the Haight. As the band drifted toward psychedelic exploration and Keith Godchaux's piano, and as years of hard drinking failed his health, his role narrowed. His last show was June 1972; he died March 8, 1973, at 27 — the first keeper of the seat to fall, and the reason the keyboard chair became a lineage." },

      { slug:"mickey-hart", name:"Mickey Hart", role:"Drums · percussion", years:"1967–1971, 1974–1995", ic:"🪘",
        seat:"drums",
        syn:"The second drummer and the band's ethnomusicologist — he brought the world's percussion into the Grateful Dead, from tar and tabla to “the Beast,” his towering rig. His arrival created the two-drummer dialogue that defined the band's rhythmic ambition. He left in 1971 amid the fallout from his father Lenny's embezzlement of the band, returned in 1974, and made “Drums/Space” — the nightly percussion-and-noise excursion — his and Kreutzmann's shared frontier. He remains a keeper of the rhythm to this day." },

      { slug:"tom-constanten", name:"Tom Constanten", role:"Keyboards", years:"1968–1970", ic:"🎹",
        seat:"keys", chair:1.5,
        syn:"The avant-garde keyboardist — “TC,” a friend of Lesh's from the composition world, steeped in Stockhausen and prepared-piano experiments. He powered the band's most experimental period (Anthem of the Sun, Aoxomoxoa), layering dissonance and tape-music ideas over the acid-rock. He overlapped with Pigpen rather than replacing him, left in 1970, and remains the band's most purely experimental keyboard voice." },

      { slug:"keith-godchaux", name:"Keith Godchaux", role:"Piano", years:"1971–1979", ic:"🎹",
        seat:"keys", chair:2, died:"July 23, 1980", verifier:"Zion Godchaux (their son)",
        syn:"He walked up to Garcia at a club, said he was the band's next keyboard player, and — remarkably — was right. Keith slid into the seat through 1971 as Pigpen faded, bringing a jazzy, McCoy Tyner-tinged acoustic piano that redefined the band through its 1972–74 peak — the Europe '72 grace, the fluid bebop touch under Garcia's leads. As the decade wore on his playing and health dimmed; he and Donna left in early 1979. He died in a car accident on July 23, 1980. He took the chair from a dying man and gave the band its most elegant years." },

      { slug:"donna-jean-godchaux", name:"Donna Jean Godchaux", role:"Vocals", years:"1972–1979", ic:"🎶",
        seat:"vocals", verifier:"Zion Godchaux (her son)",
        syn:"The band's only long-term female member — a Muscle Shoals session singer (she'd sung on “When a Man Loves a Woman”) who joined alongside husband Keith. Her harmonies colored the mid-'70s band, soaring on a good night and famously unpredictable on a rough one. She and Keith left in 1979; she went on to the Donna Jean Godchaux Band and remains a beloved elder of the scene." },

      { slug:"brent-mydland", name:"Brent Mydland", role:"Keyboards · vocals", years:"1979–1990", ic:"🎹",
        seat:"keys", chair:3, died:"July 26, 1990",
        syn:"For eleven years — the longest tenure of any keyboardist after Pigpen — Brent was the band's third voice and emotional lightning rod. His Hammond and piano gave the '80s band its muscle, and his originals (“Far From Me,” “Blow Away,” “I Will Take You Home”) brought a raw, aching soul the songbook hadn't had. Wracked by self-doubt and addiction, he died of an overdose on July 26, 1990, at 37 — the third keyboardist to die, deepening the seat's hard legend." },

      { slug:"vince-welnick", name:"Vince Welnick", role:"Keyboards · vocals", years:"1990–1995", ic:"🎹",
        seat:"keys", chair:4, died:"June 2, 2006",
        syn:"The last man in the chair. Formerly of the Tubes, Vince took the seat weeks after Brent's death and held it through the band's final five years — synth textures and high harmonies as Garcia's health declined around him. He struggled with the weight of the role and with the band's end, and he died June 2, 2006. He is the last keyboardist of the Grateful Dead proper." },

      { slug:"bruce-hornsby", name:"Bruce Hornsby", role:"Piano (1990–1992)", years:"1990–1992", ic:"🎹",
        seat:"guest",
        syn:"Not a full member but the grand-piano lifeline — an established star (“The Way It Is”) who sat in for scores of shows after Brent's death and during Vince's early tenure, giving the early-'90s band a jolt of virtuosity and joy. He came and went as a friend of the band, and his rolling piano is all over the last great stretch." },

      { slug:"jeff-chimenti", name:"Jeff Chimenti", role:"Keyboards — the living chair", years:"1998–present", ic:"🎹",
        seat:"keys", chair:5,
        syn:"Jeff Chimenti holds the chair now — and he is the one who lived in it. From RatDog through Furthur, Dead & Company, Bob Weir & Wolf Bros, and the Golden Gate Wingmen, Chimenti has been the keyboard voice of the living Grateful Dead for a quarter century: the longest-serving keeper of the seat since it became a lineage, and the first to hold it and thrive. Where the old chair kept its price — Pigpen, Keith, Brent, Vince — Chimenti carried it forward, the piano and organ under Weir's and Mayer's hands, the bridge from the Dead that was to the Dead that still plays. The seat, at last, has an heir who survived it." },

      { slug:"robert-hunter", name:"Robert Hunter", role:"Lyricist — the silent member", years:"1967–1995", ic:"🖋",
        seat:"pen", died:"September 23, 2019",
        syn:"The band's silent member and its poet. Robert Hunter never played a note on stage, yet he was as much the Grateful Dead as anyone — Garcia's lifelong writing partner and the pen behind the songbook's soul: “Ripple,” “Box of Rain,” “Truckin’,” “Uncle John's Band,” “Brokedown Palace,” “Terrapin Station,” “Scarlet Begonias.” An old San Francisco folk-scene friend of Garcia's — they'd busked together before the band existed — Hunter turned American myth, the road, and hard-won grace into words the whole culture learned by heart. He is the only non-performer ever inducted into the Rock & Roll Hall of Fame as a member of a band. He died September 23, 2019. The words were his." },

      { slug:"john-perry-barlow", name:"John Perry Barlow", role:"Lyricist — Weir's pen", years:"1971–1995", ic:"🖋",
        seat:"pen", died:"February 7, 2018",
        syn:"Bob Weir's writing partner and the band's second poet — the words behind “Cassidy,” “Mexicali Blues,” “Estimated Prophet,” “Looks Like Rain,” and “The Music Never Stopped.” A Wyoming cattle rancher turned lyricist, Barlow gave Weir's songs their swagger and their strange horizons. Beyond the band he became a founding voice of the digital age — co-founder of the Electronic Frontier Foundation and author of “A Declaration of the Independence of Cyberspace.” He died February 7, 2018. If Hunter was Garcia's pen, Barlow was Weir's." },

      { slug:"merl-saunders", name:"Merl Saunders", role:"Keyboards — Garcia's first keyboard partner", years:"1971–1975", ic:"🎹",
        seat:"jgb", jgbChair:1, died:"October 24, 2008",
        syn:"The keyboardist who first pulled Garcia off the Dead's stage into the loose, soulful side-band world. Through the early '70s, Garcia and Merl Saunders — the Garcia-Saunders band and Legion of Mary — worked the Bay Area clubs nightly, a jazzy, gospel-soaked R&B counterpoint to the Grateful Dead's arena psychedelia. Saunders' Hammond and Fender Rhodes taught the side project its language. When he moved on, the keyboard chair in what became the Jerry Garcia Band passed to a young organist named Melvin Seals — and the JGB found its permanent sound. Merl died October 24, 2008." },

      { slug:"melvin-seals", name:"Melvin Seals", role:"Organ — the JGB engine", years:"1980–present", ic:"🎹",
        seat:"jgb", jgbChair:2,
        syn:"The Hammond B-3 thunder of the Jerry Garcia Band. Melvin Seals took the JGB keyboard chair around 1980 and held it through Garcia's death in 1995 — the gospel-soul fire under “Deal,” “Sugaree,” “Cats Under the Stars,” “Mission in the Rain.” Where Merl Saunders started the side band's sound, Melvin made it church. Since Garcia's passing he has carried the JGB songbook on the road for three decades as JGB with Melvin Seals — the living keeper of Jerry's other band, and DeadDance royalty." }
    ],

    // the keyboard succession — the chair and its price. Each hands off overlapping the next; Chimenti holds it now.
    keysChain: ["ron-pigpen-mckernan","tom-constanten","keith-godchaux","brent-mydland","vince-welnick","jeff-chimenti"],

    // Archive.org — the taper covenant. Its own group.
    archive: { slug:"archive-org", name:"Archive.org — The People’s Vault", ic:"📼",
      syn:"The Internet Archive, and its Live Music Archive, is where the Grateful Dead's thirty-year taper legacy lives — free, forever. The band did what almost no one else did: they let fans record the shows, and the tapers built a gift economy that became the largest live-recording collection in history. etree, the Live Music Archive, the soundboards and the audience tapes — this is the people's vault, music freely traded and never sold. A group for the Archive is a group for the covenant itself. Subscribe, and add your own photos, tapes, and memories to the pile." },

    // JGB keyboard lineage — the side band's chair: Merl started it, Melvin made it church.
    jgbKeys: ["merl-saunders","melvin-seals"],

    // The family bands — each its own group with a synthesis.
    bands: [
      { slug:"jgb", name:"JGB — The Jerry Garcia Band", role:"Jerry's other band", years:"1975–1995 · carried on", ic:"🌹", band:true,
        syn:"Jerry Garcia's other band — the loose, soulful, gospel-and-R&B outfit he ran alongside the Grateful Dead for over twenty years, where he covered Dylan, Motown, and reggae and stretched out with no arena to fill. Its keyboard chair tells the whole story: Merl Saunders started it in the early '70s (Garcia-Saunders, Legion of Mary); Melvin Seals made it church from 1980 to the end. Today JGB with Melvin Seals carries the songbook forward — the direct living line to Jerry's other voice." },
      { slug:"ratdog", name:"RatDog — Bob Weir's Band", role:"Weir after the Dead", years:"1995–2014", ic:"🐕", band:true,
        syn:"Bob Weir's band after the Grateful Dead — founded in 1995 with bassist Rob Wasserman just before Garcia's death, and Weir's main vehicle for nearly two decades. RatDog reworked the Dead songbook and Weir's own catalog with a jazzy, exploratory looseness, and it's where a young Jeff Chimenti earned the keyboard chair he'd carry into Furthur, Dead & Company, and Wolf Bros. RatDog was the bridge that kept Weir on the road — and the proving ground for the modern Dead family." }
    ],

    // The next generation — the sons of the scene who play with everyone and carry it forward.
    nextgen: [
      { slug:"grahame-lesh", name:"Grahame Lesh", role:"Guitar · vocals — Phil's son", years:"2012–present", ic:"🌱",
        tour:"grahame_lesh_tour.html", verifier:"Grahame Lesh — verifies his own group and his dad Phil’s",
        syn:"Phil Lesh's son, and the clearest proof the music has a next generation. A Stanford-trained guitarist and singer, Grahame founded Midnight North in 2012 and became a fixture of his father's Terrapin Family Band and Phil Lesh & Friends — the heir who traveled the world beside Phil, trading songs on stage with Warren Haynes, John Scofield, Bob Weir, and a hundred others. Like John Kimock, he's a son of the scene who plays with everyone, threading the whole community together. When Phil passed in 2024, Grahame became one of the surest hands keeping the family music alive." },
      { slug:"john-morgan-kimock", name:"John Morgan Kimock", role:"Drums — Steve's son", years:"2010s–present", ic:"🥁",
        tour:"oteil_kimock_summer.html", verifier:"John Kimock",
        syn:"Steve Kimock's son, and one of the busiest drummers in the Dead diaspora — the pulse behind Mike Gordon's band, Oteil & Friends, the new Spirit Guide trio with Jason Crosby, and the Jerry Garcia Symphonic Celebration, where he sits in with a full orchestra. Like Grahame Lesh, he's a legacy kid who became a first-call player on his own merits, threading through the whole scene. The next generation, holding the beat." },

      { slug:"zion-godchaux", name:"Zion Godchaux", role:"Multi-instrumentalist — Keith & Donna's son", years:"1990s–present", ic:"🌱",
        verifier:"Zion Godchaux — verifies his own and his parents’ (Keith & Donna) groups",
        syn:"The rarest legacy of all — the son of TWO Grateful Dead members, Keith and Donna Jean Godchaux. Zion was on drums at age two and onstage with his mother at seven. After his father's death he played in his parents' Heart of Gold Band, then co-founded the electronic-jam act BoomBox and became a touring musician and producer in his own right — carrying both the piano seat and the voice of the '70s Dead into a whole new sound. A double-legacy child, and proof the bloodline runs deep." }
    ],

    // The families & estates — the keepers of the legacy, and the authorities who verify.
    families: [
      { slug:"jerry-garcia-family", name:"The Jerry Garcia Family (JGF)", role:"Keepers of Jerry’s legacy", years:"1995–present", ic:"🌹", family:true,
        verifier:"the Jerry Garcia Family — verifies their own group and Jerry’s",
        syn:"The Garcia family — who steward Jerry's name, music, and art through the Jerry Garcia Family LLC. They curate the Jerry Garcia Symphonic Celebration, protect his likeness and songbook, and keep the man's memory true. On DeadDance the family is the authority on what's real: they verify their own group and Jerry's, straight from the source. Every legacy in this bloodline has its keepers — the Garcias, the Weirs (Monet & Chloe), the Leshes (Grahame), the Godchaux line (Zion) — the families who confirm the stories and guard the flame." }
    ],

    // 🍪 Cookie Monster's crowdsourcing questions — one engaging prompt per group. Answer, keep score.
    questions: {
      "jerry-garcia":"Which Jerry solo turned you into a Deadhead for life — and where were you when it hit you?",
      "bob-weir":"Cowboy Bob or cosmic Bob — which Weir tune could you not live without?",
      "phil-lesh":"When did a Phil bomb rearrange your insides? Name the show.",
      "bill-kreutzmann":"One drummer Billy, or the two-drummer Rhythm Devils — which groove do you feel deeper?",
      "ron-pigpen-mckernan":"“Lovelight” or “Midnight Hour” — which Pigpen sermon do you most wish you'd caught live?",
      "mickey-hart":"Drums→Space: transcendent journey, or your cue for a beer run? Defend it.",
      "tom-constanten":"TC's far-out era (Anthem, Aoxomoxoa) — genius or too weird? Make your case.",
      "keith-godchaux":"What was your favorite keyboard era and why? Argue for Keith's jazzy ’72–’74 piano.",
      "donna-jean-godchaux":"Donna's harmonies — soaring or hit-or-miss? Drop your favorite Donna moment.",
      "brent-mydland":"Which Brent original wrecks you every time — “I Will Take You Home,” “Blow Away,” or…?",
      "vince-welnick":"The ’90s Dead with Vince — underrated? What show changed your mind?",
      "bruce-hornsby":"Bruce's grand piano, ’90–’92 — your all-time favorite Hornsby sit-in?",
      "jeff-chimenti":"Chimenti held the chair and lived — your favorite modern-era moment (RatDog → Dead & Co)?",
      "robert-hunter":"Which Hunter lyric do you live by? Quote it for the group.",
      "john-perry-barlow":"“Cassidy,” “Estimated,” “Looks Like Rain” — which Barlow line hits hardest, and why?",
      "merl-saunders":"Garcia-Saunders club nights — what's the deepest cut you love?",
      "melvin-seals":"Melvin's B-3 on “Deal” — where and when did it move you?",
      "jgb":"JGB or the Dead — which Jerry do you reach for more, and why?",
      "ratdog":"Favorite RatDog reinvention of a Dead tune?",
      "grahame-lesh":"Midnight North, Terrapin, or Phil & Friends — where is Grahame at his very best?",
      "john-morgan-kimock":"Behind Mike Gordon or Oteil & Friends — where do you love John's drumming most?",
      "zion-godchaux":"BoomBox or Heart of Gold — which side of Zion do you spin?",
      "jerry-garcia-family":"What one piece of Jerry's art or legacy would you want kept forever?",
      "archive-org":"Your desert-island Dead date from the Archive — and why that night?"
    }
  };
})(window);
