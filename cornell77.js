/* cornell77.js — the show data for Grateful Dead · 5/8/77 · Barton Hall, Cornell.
   The most famous Dead show ever, and the one Dark Star Orchestra recreated at
   Musikfest Café on 7/15/25. Setlist order is canonical; track lengths are from the
   Betty Cantor-Jackson "Betty Board" master (the gd77-05-08 Eaton remaster on the
   Internet Archive). Facts are verified (see sources in the roadmap/notes).
   window.CORNELL77 — used by the event map (setlist + facts) and the trivia bank. */
(function (w) {
  "use strict";
  w.CORNELL77 = {
    key: "gd1977-05-08",
    band: "Grateful Dead",
    date: "1977-05-08",
    venue: "Barton Hall, Cornell University",
    city: "Ithaca, NY",
    crowd: "~8,500",
    recording: "Betty Cantor-Jackson soundboard — the legendary “Betty Board”",
    lineup: "Jerry Garcia · Bob Weir · Phil Lesh · Bill Kreutzmann · Keith Godchaux · Donna Jean Godchaux",

    // canonical order · segues marked with › · lengths from the Betty Board master
    sets: [
      { name: "Set 1", songs: [
        { t: "New Minglewood Blues", len: "6:21" },
        { t: "Loser", len: "8:52" },
        { t: "El Paso", len: "5:18" },
        { t: "They Love Each Other", len: "9:11" },
        { t: "Jack Straw", len: "8:07" },
        { t: "Deal", len: "7:26" },
        { t: "Lazy Lightning › Supplication", len: "9:00" },
        { t: "Brown-Eyed Women", len: "6:49" },
        { t: "Mama Tried", len: "3:05" }
      ]},
      { name: "Set 2", songs: [
        { t: "Row Jimmy", len: "13:44" },
        { t: "Dancing in the Street", len: "16:35" },
        { t: "Scarlet Begonias › Fire on the Mountain", len: "25:55" },
        { t: "Estimated Prophet", len: "9:46" },
        { t: "St. Stephen ›", len: "4:58" },
        { t: "Not Fade Away ›", len: "16:22" },
        { t: "St. Stephen ›", len: "1:53" },
        { t: "Morning Dew", len: "13:50" }
      ]},
      { name: "Encore", songs: [
        { t: "One More Saturday Night", len: "6:10" }
      ]}
    ],

    facts: [
      "Widely called the greatest Grateful Dead concert ever played.",
      "Recorded by Betty Cantor-Jackson — the fabled “Betty Board” whose sound quality built the show’s legend as the tapes circulated for decades.",
      "Inducted into the Library of Congress National Recording Registry (selected 2011) — deemed culturally and historically significant.",
      "Never officially released until May 2017 — 40 years later — by Rhino, after the master tapes resurfaced in late 2016.",
      "The centerpiece of the May 1977 tour, which many fans consider the band’s creative peak.",
      "The Scarlet › Fire, Morning Dew, and Dancin’ in the Streets are routinely cited as the definitive versions of each.",
      "Late-spring snow around the date is part of the mythology of the night.",
      "A decades-long friendly debate follows it: legend, or “overrated”? Heads still argue it."
    ],

    // multiple-choice bank (answer = index). Feeds Dead Karaoke / the show trivia panel.
    trivia: [
      { q: "Where did the Grateful Dead play on 5/8/77?", choices: ["Barton Hall, Cornell", "Winterland, SF", "The Spectrum, Philly", "Red Rocks"], a: 0,
        fact: "Barton Hall, Cornell University, Ithaca NY — ~8,500 fans." },
      { q: "Who recorded the famous soundboard of this show?", choices: ["Owsley Stanley", "Betty Cantor-Jackson", "Dan Healy", "Bear’s crew"], a: 1,
        fact: "Her “Betty Boards” set the standard; this one made Cornell ’77 a legend." },
      { q: "What second-set pairing from this night is called a definitive version?", choices: ["China › Rider", "Scarlet › Fire", "Help › Slip › Franklin’s", "Estimated › Eyes"], a: 1,
        fact: "The 5/8/77 Scarlet Begonias › Fire on the Mountain runs nearly 26 minutes." },
      { q: "What national institution enshrined this recording?", choices: ["Rock & Roll Hall of Fame", "Smithsonian", "Library of Congress National Recording Registry", "Grammy Hall of Fame"], a: 2,
        fact: "Selected for the National Recording Registry in 2011." },
      { q: "When was Cornell ’77 first officially released?", choices: ["1981", "1997", "2009", "2017"], a: 3,
        fact: "Rhino released it in May 2017 — 40 years later — after the masters resurfaced." },
      { q: "Which ballad closes the second set on 5/8/77?", choices: ["Stella Blue", "Morning Dew", "Wharf Rat", "Brokedown Palace"], a: 1,
        fact: "The Morning Dew here is considered one of the all-time greats." },
      { q: "What song opened the show?", choices: ["Bertha", "New Minglewood Blues", "Jack Straw", "Truckin’"], a: 1,
        fact: "New Minglewood Blues kicked off Set 1." },
      { q: "What was the encore?", choices: ["U.S. Blues", "One More Saturday Night", "Johnny B. Goode", "Casey Jones"], a: 1,
        fact: "One More Saturday Night sent everyone into the cold." },
      { q: "Which tour is 5/8/77 the crown jewel of?", choices: ["Europe ’72", "Spring 1977", "Fall 1989", "Summer 1995"], a: 1,
        fact: "May 1977 is widely regarded as the band’s creative peak." },
      { q: "Who played keyboards on this night?", choices: ["Brent Mydland", "Keith Godchaux", "Vince Welnick", "Pigpen"], a: 1,
        fact: "Keith Godchaux on keys, with Donna Jean Godchaux on vocals — the ’77 lineup." }
    ]
  };
})(window);
