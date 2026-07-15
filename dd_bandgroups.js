/* dd_bandgroups.js — a community GROUP for every marquee act in the calendar's band dropdown.
   The group shows the band's own logo (guessed from their Facebook now; the REAL one once they
   accept; the band can change it any time). Each group carries a QR the band puts on their own
   Facebook Page to send fans straight in — legal, one tap, the band does it themselves.
   State is local-first (localStorage) and merges the DDLogoGuess map + VIP overrides. */
(function (root) {
  // the acts that appear in the Calendar band dropdown (#calAct) — one group each
  var MARQUEE = [
    { name: "Dark Star Orchestra",      ic: "🌌" },
    { name: "Joe Russo's Almost Dead",  ic: "🔥", disp: "Joe Russo's Almost Dead (JRAD)" },
    { name: "Jerry's Middle Finger",    ic: "🖐" },
    { name: "Steve Kimock",             ic: "🎸" },
    { name: "Melvin Seals and JGB",     ic: "🎹", disp: "Melvin Seals & JGB" },
    { name: "Sages And Spirits",        ic: "🌀", disp: "Sages & Spirits" },
    { name: "John Mayer",               ic: "🎶" }
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

  function meta(m) { return { name: m.name, disp: m.disp || m.name, ic: m.ic, slug: slug(m.name),
    logo: logo(m.name), accepted: accepted(m.name), tuned: tuned(m.name), members: members(m.name), qr: qrUrl(m.name) }; }
  function list() { return MARQUEE.map(meta); }
  function get(n) { for (var i = 0; i < MARQUEE.length; i++) if (slug(MARQUEE[i].name) === slug(n)) return meta(MARQUEE[i]); return null; }

  root.DDBandGroups = { list: list, get: get, slug: slug, logo: logo, accepted: accepted, accept: accept,
    setLogo: setLogo, tuned: tuned, setTuned: setTuned, qrUrl: qrUrl };
})(typeof window !== "undefined" ? window : this);
