/* dd_bandgroups.js — a community GROUP for every marquee act in the calendar's band dropdown.
   The group shows the band's own logo (guessed from their Facebook now; the REAL one once they
   accept; the band can change it any time). Each group carries a QR the band puts on their own
   Facebook Page to send fans straight in — legal, one tap, the band does it themselves.
   State is local-first (localStorage) and merges the DDLogoGuess map + VIP overrides. */
(function (root) {
  // the acts that appear in the Calendar band dropdown (#calAct) — one group each
  var MARQUEE = [
    { name: "Steve Kimock",             ic: "🎸",
      syn: "Garcia's own favorite guitarist — a tone-obsessed, patient improviser who held chairs in Zero, KVHW, and Bob Weir's RatDog. He never chased the spotlight; the spotlight chased his sound. On DeadDance he is the king, and the throne is his. 🌹" },
    { name: "John Mayer",               ic: "🎶",
      syn: "The pop-blues virtuoso who became Garcia's improbable heir in Dead & Company — reverent, fluid, and single-handedly responsible for pulling a new generation into the songbook. Proof the music keeps finding its next hands." },
    { name: "Melvin Seals and JGB",     ic: "🎹", disp: "JGB with Melvin Seals",
      syn: "The Hammond B-3 thunder of the Jerry Garcia Band. Melvin took the JGB chair around 1980 and, since Garcia's passing, has carried the songbook on the road for three decades. When you want the church of Jerry, it's Melvin." },
    { name: "Dark Star Orchestra",      ic: "🌌",
      syn: "The show-recreation pioneers — they don't just play the songs, they perform an entire historic Grateful Dead setlist, era-accurate, night by night. The closest thing anyone has built to a time machine." },
    { name: "Joe Russo's Almost Dead",  ic: "🔥", disp: "Joe Russo's Almost Dead (JRAD)",
      syn: "The Brooklyn powerhouse that reimagined the songbook loud, tight, and fearless — the tribute band that made it cool to be young and Dead again. The songbook's rowdiest, most electric second life." },
    { name: "Sages And Spirits",        ic: "🌀", disp: "Sages & Spirits",
      syn: "A scene supergroup — John Kimock, original Dark Star Orchestra players, and Melvin Seals — playing the music with pedigree in every seat. Lineage you can hear." },
    { name: "Jerry's Middle Finger",    ic: "🖐",
      syn: "West Coast JGB torchbearers — a loving, note-perfect celebration of the Jerry Garcia Band songbook, named with a wink. Pure devotion to Jerry's other band." }
  ];
  // stable synthetic member counts (until the real join numbers exist)
  var SEED_MEMBERS = { "dark-star-orchestra": 4820, "joe-russo-s-almost-dead": 3610, "jerry-s-middle-finger": 940,
    "steve-kimock": 1275, "melvin-seals-and-jgb": 2180, "sages-and-spirits": 512, "john-mayer": 9100 };

  function slug(n) { return String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function store() { try { return JSON.parse(localStorage.getItem("dd.bandgroups") || "{}"); } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem("dd.bandgroups", JSON.stringify(o)); } catch (e) {} }
  function rec(n) { return store()[slug(n)] || {}; }
  function put(n, patch) { var s = store(), k = slug(n); s[k] = s[k] || {}; for (var p in patch) if (patch.hasOwnProperty(p)) s[k][p] = patch[p]; save(s); return s[k]; }

  function guessLogo(n) { try { return (root.DDLogoGuess || {})[slug(n)] || ""; } catch (e) { return ""; } }
  function logo(n) { var r = rec(n); return r.logo || guessLogo(n) || ""; }   // custom → FB guess → "" (emoji fallback in UI)
  function accepted(n) { return !!rec(n).accepted; }
  function tuned(n) { return !!rec(n).tuned; }
  function members(n) { return (SEED_MEMBERS[slug(n)] || 300) + (accepted(n) ? 250 : 0); }

  // called when the band accepts ("Is this your band? — Yes"): stamp the real logo on the group
  function accept(n, logoUrl) { return put(n, logoUrl ? { accepted: true, logo: logoUrl } : { accepted: true }); }
  function setLogo(n, url) { return put(n, { logo: url || "" }); }     // band changes their logo later
  function setTuned(n, on) { return put(n, { tuned: !!on }); }
  function qrUrl(n) { return "https://deaddance.app/" + slug(n); }     // the QR the band drops on Facebook to funnel fans

  function meta(m) { return { name: m.name, disp: m.disp || m.name, ic: m.ic, slug: slug(m.name), syn: m.syn || "",
    logo: logo(m.name), accepted: accepted(m.name), tuned: tuned(m.name), members: members(m.name), qr: qrUrl(m.name) }; }
  function list() { return MARQUEE.map(function (m, i) { var o = meta(m); o.rose = (i === 0); return o; }); }  // #1 carries the Rose
  function get(n) { for (var i = 0; i < MARQUEE.length; i++) if (slug(MARQUEE[i].name) === slug(n)) return meta(MARQUEE[i]); return null; }

  root.DDBandGroups = { list: list, get: get, slug: slug, logo: logo, accepted: accepted, accept: accept,
    setLogo: setLogo, tuned: tuned, setTuned: setTuned, qrUrl: qrUrl };
})(typeof window !== "undefined" ? window : this);
