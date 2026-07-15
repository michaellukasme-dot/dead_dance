/* dd_watchdog.js — the family gatekeeper. Nothing explicit reaches the feed.
   First-pass, client-side screen for posts: hard profanity, slurs, sexual-explicit
   language, and contact-dump spam. Photos can't be judged by pixels here, so images
   are flagged "held for review" — the server / a human pass clears them before they land.
   This is a FIRST line of defense, not the last: real moderation runs server-side too.
   API:  DDWatchdog.checkText(str)  -> { ok, level, reason, hits }
         DDWatchdog.checkPost({text, photos}) -> { ok, level, reason, review }
   level: 'clean' | 'block' (hard stop) | 'review' (photos held). */
(function (root) {
  // categories kept compact; matched on word boundaries, case-insensitive, light leet-normalize.
  // We block the hard stuff; mild venting ("damn", "hell") passes — this is a music family, not a nunnery.
  var HARD = [
    // sexual-explicit
    "fuck", "fucking", "motherfucker", "cock", "cunt", "pussy", "dick", "blowjob", "cum",
    "porn", "porno", "xxx", "nude", "nudes", "nsfw", "onlyfans", "handjob", "deepthroat",
    "jizz", "creampie", "gangbang", "milf", "hentai", "camgirl", "escort service",
    // slurs (represented; any hit is a hard block)
    "nigger", "n1gger", "faggot", "f4ggot", "retard", "kike", "spic", "chink", "tranny", "wetback",
    // hate / violence-incitement
    "kill yourself", "kys", "gas the", "lynch",
    // hard drugs solicitation (dealing, not culture talk)
    "buy meth", "sell meth", "selling coke", "acid for sale", "molly for sale"
  ];
  // spam / contact-dumps we don't want polluting the feed
  var SPAM = [/\bwhats?app\s*[:+]?\s*\+?\d[\d\-\s]{6,}/i, /\btelegram\s*@?\w{3,}/i, /\b(?:venmo|cashapp|paypal)\s*@?\w{2,}/i,
    /(?:https?:\/\/)?bit\.ly\/\w+/i, /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b.*\b(?:text|call|dm)\b/i];

  function norm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[@]/g, "a").replace(/[$]/g, "s").replace(/[!|]/g, "i").replace(/[0]/g, "o").replace(/[3]/g, "e")
      .replace(/[^a-z0-9\s:+@._\/-]/g, " ");
  }
  function esc(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function checkText(str) {
    var raw = String(str == null ? "" : str), n = norm(raw), hits = [];
    for (var i = 0; i < HARD.length; i++) {
      var w = HARD[i], re = /\s/.test(w) ? new RegExp(esc(w), "i") : new RegExp("\\b" + esc(w) + "\\b", "i");
      if (re.test(n)) hits.push(w);
    }
    if (hits.length) return { ok: false, level: "block", hits: hits,
      reason: "Let's keep it family — that language won't fly on the feed. Give it another pass. 🌹" };
    for (var j = 0; j < SPAM.length; j++) if (SPAM[j].test(raw)) return { ok: false, level: "block", hits: ["contact/spam"],
      reason: "Looks like a contact drop or off-site link — the feed's for the family, not solicitations. Trim it and try again. 🌹" };
    return { ok: true, level: "clean" };
  }

  function checkPost(post) {
    post = post || {};
    var t = checkText(post.text || "");
    if (!t.ok) return t;
    var photos = post.photos || post.images || [];
    if (photos && photos.length) return { ok: true, level: "review", review: true,
      reason: "Your words are good to go. Photos get a quick review before they reach the family — standard for everyone. 🌹" };
    return { ok: true, level: "clean" };
  }

  root.DDWatchdog = { checkText: checkText, checkPost: checkPost };
})(typeof window !== "undefined" ? window : this);
