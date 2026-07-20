/* dd_launch.js — "I Launched DeadDance" share + the Cookie Invite Contest (client layer).
   • ONE-TAP LAUNCH POST: pre-composed, shared through the OS Share Sheet (navigator.share) so it
     lands only on the networks the user actually has (TikTok/YouTube/IG/Messages/etc.) — we can't
     and shouldn't detect installed apps; the share sheet does it, privacy-safe. Facebook + X + copy
     fallbacks on desktop.
   • CONTEST INFORM: shows the rules + the user's own invite tally. Leaderboard (Top 3 per day / per
     festival) is served by Supabase (see dd_contest SQL) and rendered when present.
   Referral attribution rides the link as ?r=<id>. Never throws. Exposed as window.DDLaunch. */
(function (root) {
  "use strict";
  var LINK = "https://deaddance.app/g";
  function refId() { try { return (root.ddId && ddId()) || (root.DDProfile && DDProfile.get && DDProfile.get("handle")) || ""; } catch (e) { return ""; } }
  function link() { var r = refId(); return LINK + (r ? ("?r=" + encodeURIComponent(r)) : ""); }
  function caption() {
    return "I just launched on DeadDance 🌹 — the calendar & map of every Grateful Dead & jam show. "
         + "Come find your people: " + link();
  }
  function toast(m) { try { if (root.toast) return root.toast(m); } catch (e) {} }
  function cookie(pts, tag) { try { if (root.DDCoins && DDCoins.feed) DDCoins.feed(tag || "launch", "launch|" + Date.now()); } catch (e) {} }

  function css() { try {
    if (document.getElementById("ddl-style")) return;
    var s = document.createElement("style"); s.id = "ddl-style";
    s.textContent =
      "#ddlModal{position:fixed;inset:0;z-index:120;display:none;align-items:center;justify-content:center;background:rgba(10,8,20,.86);padding:18px}" +
      "#ddlModal.on{display:flex}" +
      ".ddl-card{width:100%;max-width:400px;background:linear-gradient(160deg,#1a1130,#120b24);border:1px solid #ffffff18;border-radius:20px;padding:20px;color:#fff;box-shadow:0 24px 70px #000a;text-align:center}" +
      ".ddl-card h2{margin:2px 0 4px;font-size:21px;font-weight:900}" +
      ".ddl-card p{margin:0 0 12px;color:#c9b8e6;font-size:13.5px;line-height:1.45}" +
      ".ddl-share{display:block;width:100%;border:0;border-radius:13px;padding:15px;font-size:16px;font-weight:900;color:#fff;background:linear-gradient(135deg,#b8002e,#5a2e86);cursor:pointer;margin:4px 0 10px}" +
      ".ddl-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px}" +
      ".ddl-row a,.ddl-row button{flex:1;min-width:92px;border:1px solid #ffffff22;background:#ffffff10;color:#fff;border-radius:11px;padding:11px 8px;font-weight:800;font-size:13px;text-decoration:none;cursor:pointer;text-align:center}" +
      ".ddl-contest{margin-top:12px;background:#2a2011;border:1px solid #f0c96b44;border-radius:13px;padding:12px;color:#ffe4a3;font-size:12.5px;line-height:1.45}" +
      ".ddl-x{position:absolute;top:14px;right:16px;background:#ffffff1a;border:0;color:#fff;width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer}";
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {} }

  function ensure() {
    css();
    var m = document.getElementById("ddlModal"); if (m) return m;
    m = document.createElement("div"); m.id = "ddlModal";
    m.innerHTML =
      '<div class="ddl-card"><button class="ddl-x" onclick="DDLaunch.close()" aria-label="Close">×</button>' +
      '<div style="font-size:40px">🌹</div>' +
      '<h2>I Launched DeadDance</h2>' +
      '<p>Post it back to the family. Your phone will offer the apps you already use — pick any of them.</p>' +
      '<button class="ddl-share" onclick="DDLaunch.share()">🚀 Share my launch</button>' +
      '<div class="ddl-row" id="ddlFallback"></div>' +
      '<div class="ddl-contest" id="ddlContest"></div></div>';
    document.body.appendChild(m);
    return m;
  }

  function fallbackHTML() {
    var u = encodeURIComponent(link()), t = encodeURIComponent(caption());
    return '' +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + u + '" target="_blank" rel="noopener" onclick="DDLaunch._did()">📘 Facebook</a>' +
      '<a href="https://twitter.com/intent/tweet?text=' + t + '" target="_blank" rel="noopener" onclick="DDLaunch._did()">\u{1D54F} X</a>' +
      '<a href="https://api.whatsapp.com/send?text=' + t + '" target="_blank" rel="noopener" onclick="DDLaunch._did()">💬 WhatsApp</a>' +
      '<button onclick="DDLaunch.copy()">🔗 Copy link</button>';
  }
  function contestHTML() {
    var n = myInvites();
    return "🍪 <b>Cookie Contest:</b> the <b>Top 3</b> who invite the most friends that actually join DeadDance win — <b>every day</b> and for the <b>whole festival</b>. " +
           "Your friends who joined so far: <b>" + n + "</b>. Every share is a chance." ;
  }
  function myInvites() { try { return (root.DDContest && DDContest.myCount && DDContest.myCount()) || 0; } catch (e) { return 0; } }

  var DDLaunch = {
    open: function () { var m = ensure(); document.getElementById("ddlFallback").innerHTML = fallbackHTML(); document.getElementById("ddlContest").innerHTML = contestHTML(); m.classList.add("on"); },
    close: function () { var m = document.getElementById("ddlModal"); if (m) m.classList.remove("on"); },
    share: function () {
      var data = { title: "DeadDance 🌹", text: caption(), url: link() };
      try {
        if (navigator.share) { navigator.share(data).then(function () { DDLaunch._did(); }, function () {}); return; }
      } catch (e) {}
      // desktop / no share sheet → keep the fallback row visible
      toast("Pick a network below 🌹");
    },
    copy: function () { try { navigator.clipboard.writeText(caption()).then(function () { toast("🔗 Copied — paste it anywhere"); DDLaunch._did(); }, function () {}); } catch (e) {} },
    _did: function () { cookie(1, "launch"); try { if (root.DDContest && DDContest.markShared) DDContest.markShared(); } catch (e) {} }
  };
  root.DDLaunch = DDLaunch;
  root.ddLaunchPost = function () { DDLaunch.open(); };
})(typeof window !== "undefined" ? window : this);
