/* dd_dm.js — DeadDance friend-to-friend DIRECT MESSAGES (window.DDDM).
   A self-contained, self-mounting DM panel (bottom-right, mirrors LukasChat's look) that talks to
   the DeadDance-native dd_dm_* RPCs (see dd_dm.sql) on the auth.uid() spine — it does NOT touch
   LukasChat internals or chat_messages.

   SHIPPED DARK: window.DD_DM_ENABLED defaults to FALSE. Until age verification is wired,
   DDDM.open() only toasts "coming soon" and never renders. Nothing user-facing goes live.

   API (window.DDDM):
     enabled()                 -> bool (window.DD_DM_ENABLED === true; default false)
     open(friendUid, name)     -> opens the thread (or toasts "coming soon" when disabled)
     close()

   Identity = DDMe.id() (auth.uid). Everything is best-effort — nothing throws. */
(function (w) {
  "use strict";

  // ---- the flag: ships DARK. Defined once, here. ----
  if (typeof w.DD_DM_ENABLED === "undefined") { w.DD_DM_ENABLED = false; }

  var mounted = false, chan = null, poll = null;
  var curThread = null, curUid = "", curName = "";

  function enabled() { return w.DD_DM_ENABLED === true; }
  function client() {
    try { if (w.ddClient) { var c = w.ddClient(); if (c) return c; } } catch (e) {}
    try { return (w.LukasChat && LukasChat.getClient) ? LukasChat.getClient() : null; } catch (e) { return null; }
  }
  function myId() { try { return (w.DDMe && DDMe.id && DDMe.id()) || null; } catch (e) { return null; } }
  function myName() { try { return (w.DDMe && DDMe.name && DDMe.name()) || "you"; } catch (e) { return "you"; } }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function toast(m) {
    try { if (typeof w.toast === "function") return w.toast(m); } catch (e) {}
    try { if (w.LukasChat && LukasChat.toast) return LukasChat.toast(m); } catch (e) {}
    try { console.log(m); } catch (e) {}
  }

  // =========================================================================
  // CSS + DOM (self-mounting; no host markup required) — mirrors LukasChat's panel
  // =========================================================================
  function injectCss() {
    if (document.getElementById("ddm-css")) return;
    var ac = "#b8002e";
    var css = "" +
      "#ddm-panel{position:fixed;right:16px;bottom:80px;z-index:9999;width:min(380px,92vw);height:min(560px,72vh);background:#fff;color:#1a1a1a;" +
      "border-radius:16px;box-shadow:0 14px 44px rgba(0,0,0,.34);display:none;flex-direction:column;overflow:hidden;font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}" +
      "#ddm-panel.open{display:flex}" +
      "#ddm-hd{display:flex;align-items:center;gap:8px;padding:11px 13px;background:" + ac + ";color:#fff}" +
      "#ddm-hd .ddm-ttl{font-weight:700;flex:1;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#ddm-hd button{background:rgba(255,255,255,.18);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:15px}" +
      "#ddm-msgs{flex:1;overflow:auto;padding:8px}" +
      ".ddm-empty{color:#999;text-align:center;padding:26px 14px}" +
      ".ddm-msg{margin:7px 4px;max-width:84%}.ddm-msg.mine{margin-left:auto;text-align:right}" +
      ".ddm-m-top{display:flex;gap:6px;align-items:center;font-size:11px;color:#999;margin-bottom:2px}.ddm-msg.mine .ddm-m-top{justify-content:flex-end}" +
      ".ddm-m-nm{font-weight:600;color:#555}" +
      ".ddm-m-body{display:inline-block;background:#f1f1f3;border-radius:12px;padding:7px 11px;white-space:pre-wrap;word-break:break-word}" +
      ".ddm-msg.mine .ddm-m-body{background:" + ac + ";color:#fff}" +
      "#ddm-comp{display:flex;padding:7px 8px;border-top:1px solid #eee;gap:6px;align-items:center;background:#fff}" +
      "#ddm-input{flex:1;min-width:0;border:1px solid #e7e0d2;border-radius:20px;padding:9px 13px;font-size:14px;outline:none}" +
      "#ddm-send{background:" + ac + ";color:#fff;border:0;border-radius:50%;width:38px;height:38px;font-size:16px;cursor:pointer;flex:none;font-weight:600}" +
      "#ddm-send:active{transform:scale(.94)}";
    var s = document.createElement("style"); s.id = "ddm-css"; s.textContent = css; document.head.appendChild(s);
  }
  function buildDom() {
    if (mounted) return; mounted = true; injectCss();
    var panel = document.createElement("div"); panel.id = "ddm-panel";
    panel.innerHTML =
      '<div id="ddm-hd"><div class="ddm-ttl" id="ddm-title">Direct message</div>' +
      '<button title="Close" onclick="DDDM.close()">×</button></div>' +
      '<div id="ddm-msgs"></div>' +
      '<div id="ddm-comp">' +
        '<input id="ddm-input" placeholder="Message…" onkeydown="if(event.key===\'Enter\')DDDM._send()">' +
        '<button id="ddm-send" title="Send" onclick="DDDM._send()">↑</button>' +
      '</div>';
    try { document.body.appendChild(panel); } catch (e) {}
  }

  // =========================================================================
  // MESSAGES
  // =========================================================================
  function render(list) {
    var box = document.getElementById("ddm-msgs"); if (!box) return;
    var me = myId(), html = "";
    if (!list || !list.length) { box.innerHTML = '<div class="ddm-empty">Say hello — this is just between you two. 🌹</div>'; return; }
    list.forEach(function (m) {
      var mine = me && String(m.sender_id) === String(me);
      var when = new Date(m.created_at);
      var tm = "";
      try { tm = when.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); } catch (e) {}
      var nm = mine ? myName() : (curName || "friend");
      html += '<div class="ddm-msg' + (mine ? " mine" : "") + '"><div class="ddm-m-top">' +
        '<span class="ddm-m-nm">' + esc(nm) + '</span><span class="ddm-m-tm">' + esc(tm) + '</span></div>' +
        '<div class="ddm-m-body">' + esc(m.body) + '</div></div>';
    });
    box.innerHTML = html; box.scrollTop = box.scrollHeight;
  }
  function loadMsgs() {
    var c = client(); if (!c || !curThread) return;
    try {
      c.rpc("dd_dm_thread_messages", { p_thread: curThread, p_limit: 200 }).then(function (r) {
        if (r && r.error) { return; }
        render((r && r.data) || []);
      }).catch(function () {});
    } catch (e) {}
  }
  function send() {
    var inp = document.getElementById("ddm-input"); if (!inp) return;
    var txt = (inp.value || "").trim(); if (!txt) return;
    var c = client(); if (!c || !curThread) { toast("Message didn’t send — try again"); return; }
    inp.disabled = true;
    try {
      c.rpc("dd_dm_send", { p_thread: curThread, p_body: txt }).then(function (r) {
        inp.disabled = false;
        if (r && r.error) { toast("Didn’t send — " + (r.error.message || "try again")); return; }
        inp.value = ""; loadMsgs();
      }).catch(function () { inp.disabled = false; toast("Didn’t send — try again"); });
    } catch (e) { inp.disabled = false; }
  }

  // ---- realtime (filtered to this thread) with a poll fallback ----
  function sub() {
    unsub(); var c = client(); if (!c || !c.channel || !curThread) { startPoll(); return; }
    try {
      chan = c.channel("ddm-" + curThread)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "dd_dm_messages", filter: "thread_id=eq." + curThread },
            function () { loadMsgs(); })
        .subscribe(function (status) {
          if (status === "SUBSCRIBED") stopPoll();
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") startPoll();
        });
    } catch (e) { startPoll(); }
  }
  function unsub() { if (chan) { try { var c = client(); if (c && c.removeChannel) c.removeChannel(chan); } catch (e) {} chan = null; } }
  function startPoll() { stopPoll(); poll = setInterval(function () {
    var p = document.getElementById("ddm-panel");
    if (p && p.classList.contains("open") && curThread) loadMsgs(); else stopPoll();
  }, 25000); }
  function stopPoll() { if (poll) { clearInterval(poll); poll = null; } }

  // =========================================================================
  // PUBLIC
  // =========================================================================
  function open(friendUid, friendName) {
    try {
      if (!enabled()) {
        toast("💬 Friend messaging is coming soon — unlocks with age verification 🌹");
        return;
      }
      if (!myId()) { toast("Sign in to message your friends"); return; }
      if (!friendUid) { toast("This friend isn’t on the DM spine yet"); return; }
      var c = client(); if (!c) { toast("Messaging needs a connection — try again with signal"); return; }
      curUid = String(friendUid); curName = friendName || "friend";
      buildDom();
      var panel = document.getElementById("ddm-panel"); if (panel) panel.classList.add("open");
      var ttl = document.getElementById("ddm-title"); if (ttl) ttl.textContent = curName;
      var box = document.getElementById("ddm-msgs"); if (box) box.innerHTML = '<div class="ddm-empty">Opening…</div>';
      c.rpc("dd_dm_open", { p_other: curUid }).then(function (r) {
        if (r && r.error) {
          if (box) box.innerHTML = '<div class="ddm-empty">' + esc(r.error.message || "Couldn’t open this conversation.") + '</div>';
          return;
        }
        curThread = (r && r.data) || null;
        if (!curThread) { if (box) box.innerHTML = '<div class="ddm-empty">Couldn’t open this conversation.</div>'; return; }
        loadMsgs(); sub();
        var inp = document.getElementById("ddm-input"); if (inp) try { inp.focus(); } catch (e) {}
      }).catch(function () {
        if (box) box.innerHTML = '<div class="ddm-empty">Couldn’t open this conversation.</div>';
      });
    } catch (e) {}
  }
  function close() {
    try {
      unsub(); stopPoll(); curThread = null;
      var p = document.getElementById("ddm-panel"); if (p) p.classList.remove("open");
    } catch (e) {}
  }

  w.DDDM = { enabled: enabled, open: open, close: close, _send: send };
})(window);
