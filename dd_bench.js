/* dd_bench.js — remediation & time-outs, Facebook-style, family-toned.
   Ladder (mimics FB's graduated restrictions):
     strike 1  → friendly warning
     strike 2  → warning: "one more and you lose group posting"
     tier 1 (3 strikes)      → RESTRICTED: no posting to the family / groups for a week
                               (you can still post on your OWN page)
     tier 2 (3 more)         → BENCH: full time-out, no posting anywhere, 2 weeks
     tier 3 / 4              → BENCH 30 / 90 days (repeat offenders)
   Server (dd_moderation.sql) is the un-bypassable source of truth; this is fast UX.

   API:  DDBench.guard(text, scope)  -> { ok, message, benched, restricted, strike }
         DDBench.status()            -> { benched, restricted, benchUntil, restrictUntil, strikes, tier }
         DDBench.canPost(scope)      -> bool
         DDBench.syncServer(status)  -> adopt server truth (benchUntil/restrictUntil/tier)
         DDBench.clear() */
(function (root) {
  var KEY = "dd.bench";
  var STRIKES_TO_ESC = 3;      // strikes before the next tier
  var DAY = 86400000;
  var RESTRICT_DAYS = 7;       // tier 1
  var BENCH_DAYS = { 2: 14, 3: 30, 4: 90 };  // tier -> days benched

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function now() { return Date.now(); }
  function fmt(ts) { try { return new Date(ts).toLocaleDateString(undefined, { month: "long", day: "numeric" }); } catch (e) { return "soon"; } }
  function isGroup(scope) { return !scope || scope === "all" || scope === "local"; }   // group/community post

  function state() {
    var s = load();
    s.strikes = s.strikes || 0; s.tier = s.tier || 0;
    if (s.benchUntil && now() >= s.benchUntil) { s.benchUntil = 0; s.strikes = 0; save(s); }
    if (s.restrictUntil && now() >= s.restrictUntil) { s.restrictUntil = 0; s.strikes = 0; save(s); }
    return s;
  }
  function status() {
    var s = state();
    return { benched: !!(s.benchUntil && now() < s.benchUntil), restricted: !!(s.restrictUntil && now() < s.restrictUntil),
      benchUntil: s.benchUntil || 0, restrictUntil: s.restrictUntil || 0,
      benchLabel: s.benchUntil ? fmt(s.benchUntil) : "", restrictLabel: s.restrictUntil ? fmt(s.restrictUntil) : "",
      strikes: s.strikes, tier: s.tier };
  }
  function canPost(scope) { var st = status(); if (st.benched) return false; if (st.restricted && isGroup(scope)) return false; return true; }

  function record(reason) {
    var s = state();
    s.strikes = (s.strikes || 0) + 1;
    s.history = (s.history || []).concat([{ at: now(), reason: reason || "blocked" }]).slice(-20);
    if (s.strikes >= STRIKES_TO_ESC) {
      s.tier = (s.tier || 0) + 1; s.strikes = 0;
      if (s.tier === 1) {
        var ru = now() + RESTRICT_DAYS * DAY; s.restrictUntil = ru; save(s);
        return { restricted: true, tier: 1, until: ru,
          message: "🚫 That's three strikes — you're restricted from posting to the family & groups for a week (back on " + fmt(ru) +
                   "). You can still post on your own page. One more slip and it's a full bench. 🌹" };
      }
      var days = BENCH_DAYS[s.tier] || 90; var bu = now() + days * DAY; s.benchUntil = bu; save(s);
      var wk = days === 14 ? "two weeks" : (days === 30 ? "a month" : "three months");
      return { benched: true, tier: s.tier, until: bu,
        message: "🛑 That's it — you're on the bench for " + wk + " (no posting anywhere), back on " + fmt(bu) +
                 ". Take a breather; the family will be here when you return. 🌹" };
    }
    save(s);
    if (s.strikes === 1) return { tier: s.tier, strike: 1,
      message: "🌹 Heads up — that one didn't pass; we keep the family feed clean for everyone. Friendly first warning. (Strike 1 of 3.)" };
    if (s.strikes === 2) return { tier: s.tier, strike: 2,
      message: (s.tier === 0
        ? "⚠️ That's two strikes. One more and you lose group posting for a week. Let's keep it family. (Strike 2 of 3.)"
        : "⚠️ That's two strikes. One more and you're on the bench. Let's keep it family. (Strike 2 of 3.)") };
    return { tier: s.tier, strike: s.strikes, message: "⚠️ That didn't pass. (Strike " + s.strikes + " of 3.)" };
  }

  function guard(text, scope) {
    var st = status();
    if (st.benched) return { ok: false, benched: true,
      message: "You're on the bench until " + st.benchLabel + " 🌹 — posting's paused everywhere for now. See you back out there soon." };
    if (st.restricted && isGroup(scope)) return { ok: false, restricted: true,
      message: "🚫 You're restricted from posting to the family & groups until " + st.restrictLabel + " — you can still post on your own page. 🌹" };
    var wd = (root.DDWatchdog && root.DDWatchdog.checkText) ? root.DDWatchdog.checkText(text) : { ok: true };
    if (wd.ok) return { ok: true };
    var r = record(wd.reason || "blocked");
    return { ok: false, benched: !!r.benched, restricted: !!r.restricted, strike: r.strike, message: r.message };
  }

  // adopt the server's authoritative status (call after dd_mod_status on load)
  function syncServer(srv) {
    if (!srv) return; var s = load();
    if (srv.until || srv.bench_until) s.benchUntil = new Date(srv.until || srv.bench_until).getTime();
    if (srv.restrict_until) s.restrictUntil = new Date(srv.restrict_until).getTime();
    if (typeof srv.tier === "number") s.tier = srv.tier;
    if (typeof srv.strikes === "number") s.strikes = srv.strikes;
    save(s);
  }
  function clear() { save({ strikes: 0, tier: 0, benchUntil: 0, restrictUntil: 0, history: [] }); }

  root.DDBench = { guard: guard, status: status, canPost: canPost, record: record, syncServer: syncServer, clear: clear };
})(typeof window !== "undefined" ? window : this);
