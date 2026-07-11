/* dd_attrib.js — the flywheel's memory. Two hops must trace back to dead.dance:
   HOP 1  our band-invite email → band lands & claims   (?claim=<bandId>&src=bandinvite&w=<wave>&b=<batch>)
   HOP 2  a band invites its fans → fan lands & joins    (?ref=<bandId> / utm_content=<band slug>)
   On every page load this captures the incoming attribution and remembers FIRST touch (the true origin),
   while also recording the latest. It writes nothing anywhere but this device's localStorage, and exposes
   DDAttrib.stamp() — a flat record the claim/signup RPC attaches the day the server records those events.
   Honest: capture is live now; the server tally (batch→claim, band→fans) is the read-side backlog. */
(function (root) {
  var KEY = 'dd.attrib';
  var IN = ['claim', 'src', 'w', 'b', 'ref'];
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  function parse() {
    try {
      var p = new (root.URLSearchParams || URLSearchParams)((root.location && root.location.search) || '');
      var o = {}; IN.concat(UTM).forEach(function (k) { var v = p.get(k); if (v) o[k] = String(v).slice(0, 120); });
      return o;
    } catch (e) { return {}; }
  }
  function load() { try { return JSON.parse(root.localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save(o) { try { root.localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  function capture() {
    var incoming = parse();
    var existing = load();
    if (!Object.keys(incoming).length) return existing;               // nothing new — keep what we have
    var now = Date.now();
    if (existing && existing.first) {                                  // FIRST touch is sacred; only update "last"
      existing.last = Object.assign({ at: now }, incoming);
      existing.touches = (existing.touches || 1) + 1;
      save(existing); return existing;
    }
    var rec = { first: Object.assign({ at: now }, incoming), last: Object.assign({ at: now }, incoming), touches: 1 };
    save(rec); return rec;
  }

  var REC = capture();

  root.DDAttrib = {
    get: function () { return load() || REC || null; },
    first: function () { var r = load() || REC; return (r && r.first) || null; },
    // flat record for attaching to a claim/signup row — the two hops made legible
    stamp: function () {
      var r = load() || REC; if (!r) return null; var f = r.first || {};
      return {
        src: f.src || f.utm_source || null,          // where it came from (bandinvite, invite, musician…)
        campaign: f.utm_campaign || null,
        wave: f.w || null,                            // hop 1: which email wave
        batch: f.b || null,                           // hop 1: which 50-band batch
        claim_band: f.claim || null,                  // hop 1: the band the email pointed at
        ref_band: f.ref || f.utm_content || null,     // hop 2: which band referred this fan
        touches: r.touches || 1,
        first_at: f.at || null
      };
    }
  };
})(typeof window !== 'undefined' ? window : this);
