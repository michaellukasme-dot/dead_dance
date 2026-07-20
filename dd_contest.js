/* dd_contest.js — the Cookie Invite Contest (client read-layer).
   Awards for INVITES THAT CONVERT to registered DeadDance users, across several boards:
     • Daily (global)            • Festival (global)
     • By STATE / DD CHAPTER      (e.g. Wisconsin champion)
     • Count MILESTONES           (invite N who register → a cookie badge)
   Cross-user counts live in Supabase (see the SQL in CONTEST spec). This layer READS the standings
   and the signed-in user's own tally via RPC, caches them, and degrades gracefully to 0 / empty when
   the backend isn't there yet — never a broken card, never a throw. Exposed as window.DDContest. */
(function (root) {
  "use strict";
  var _my = 0, _byState = {}, _boards = {}, _ready = false;

  function client() { try { return (root.ddClient && ddClient()) || null; } catch (e) { return null; } }
  function meState() { try { return (root.DDProfile && DDProfile.get && (DDProfile.get("region") || DDProfile.get("city"))) || (root.ME && ME.chapter) || ""; } catch (e) { return ""; } }
  function festival() { try { return root.DD_FESTIVAL || "musikfest-2026"; } catch (e) { return "musikfest-2026"; } }

  function rpc(name, args) { var c = client(); if (!c || !c.rpc) return Promise.resolve(null); try { return c.rpc(name, args || {}).then(function (r) { return (r && r.data) || null; }, function () { return null; }); } catch (e) { return Promise.resolve(null); } }

  function refresh() {
    var c = client(); if (!c) return;                 // no backend yet → stay at defaults, no error
    try {
      rpc("contest_my_count", { p_festival: festival() }).then(function (n) { if (n != null) { _my = (typeof n === "number") ? n : (n[0] && n[0].cnt) || 0; _ready = true; paint(); } });
      rpc("contest_top", { p_scope: "day", p_key: "", p_festival: festival() }).then(function (r) { _boards.day = r || []; paint(); });
      rpc("contest_top", { p_scope: "festival", p_key: "", p_festival: festival() }).then(function (r) { _boards.festival = r || []; paint(); });
      var st = meState(); if (st) rpc("contest_top", { p_scope: "state", p_key: st, p_festival: festival() }).then(function (r) { _boards.state = r || []; _boards.stateKey = st; paint(); });
    } catch (e) {}
  }

  function paint() { try { var el = document.getElementById("ddContestBoard"); if (el && root.DDContest.renderInto) root.DDContest.renderInto(el); } catch (e) {} }

  root.DDContest = {
    myCount: function () { return _my; },
    ready: function () { return _ready; },
    standings: function (scope) { return _boards[scope] || []; },
    stateName: function () { return _boards.stateKey || meState() || ""; },
    markShared: function () { try { rpc("contest_mark_share", { p_festival: festival() }); } catch (e) {} },
    refresh: refresh,
    renderInto: function (el) {
      try {
        function rows(list, label) {
          if (!list || !list.length) return "";
          var medal = ["🥇", "🥈", "🥉"];
          var h = '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;color:#8f7bbf;margin:8px 0 4px">' + label + "</div>";
          h += list.slice(0, 3).map(function (r, i) {
            return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span>' + (medal[i] || "") + " " + esc(r.handle || r.name || "a head") + '</span><b style="color:#b8002e">🍪 ' + (r.cnt || r.count || 0) + "</b></div>";
          }).join("");
          return h;
        }
        function esc(s) { return String(s || "").replace(/[<>&]/g, ""); }
        var st = root.DDContest.stateName();
        el.innerHTML =
          '<div style="font-weight:900;font-size:14px;margin-bottom:2px">🍪 Cookie Contest — your friends who joined: <span style="color:#b8002e">' + _my + "</span></div>" +
          rows(_boards.day, "TODAY — TOP 3") +
          rows(_boards.festival, "MUSIKFEST — TOP 3") +
          (st ? rows(_boards.state, (String(st).toUpperCase()) + " — TOP 3") : "") +
          '<div style="font-size:11px;color:#8f7bbf;margin-top:6px">Invite friends who register and climb the boards — win your day, your state, and the festival. 🌹</div>';
      } catch (e) {}
    }
  };

  function boot() { refresh(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  try { if (root.DDMe && DDMe.onChange) DDMe.onChange(refresh); } catch (e) {}
})(typeof window !== "undefined" ? window : this);
