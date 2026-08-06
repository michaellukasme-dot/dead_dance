/* dd_swupdate.js — DeadDance PWA update prompt (browser-only, dual-safe).

   WHAT: when a newly deployed service worker is WAITING (a real update, not the
   first install), show a small "🔄 New version — tap to refresh" toast. Tapping it
   activates the waiting worker (postMessage {type:'SKIP_WAITING'} → sw.js message
   handler → activate → controllerchange) and then reloads the page EXACTLY ONCE.

   PAIRS WITH sw.js: install no longer calls self.skipWaiting(), so a new build waits
   for the user's tap instead of taking over silently. If the user ignores the toast,
   the waiting worker still activates naturally once all tabs are closed. Standard flow.

   HARD RULES honored here:
   • NATIVE SHELL = TOTAL NO-OP. Native (Capacitor) owns cache/offline and never
     registers a SW, so this module returns immediately there.
   • This module NEVER registers a service worker — index.html / app.html do that,
     gated on !DDShell.isNative(). We only observe an existing registration.
   • NEVER shows on first install (no navigator.serviceWorker.controller yet).
   • NO reload unless the user actually taps refresh (guards the classic
     controllerchange infinite-reload bug two ways: `userTriggered` + `reloading`).
   • Stands down if a page already owns the prompt (index.html's inline
     window.ddUpdateBanner) so there is never a double toast. */
(function () {
  "use strict";

  // ---- Guards: browser + SW support + NOT native + no double-install ---------
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  try { if (window.DDShell && DDShell.isNative && DDShell.isNative()) return; } catch (e) { /* not native */ }
  // If this page already ships an inline update banner (index.html's ddUpdateBanner),
  // let it own the prompt — one code path, no double toast / double handlers.
  if (typeof window.ddUpdateBanner === "function") return;
  if (window.__ddSwUpdateLoaded) return;
  window.__ddSwUpdateLoaded = true;

  var reloading = false;      // classic controllerchange infinite-reload guard
  var userTriggered = false;  // only reload after the user taps refresh (never on passive/first-install claim)
  var busy = false;           // debounce the refresh action
  var toastEl = null;
  var newWorker = null;       // the installing/waiting worker we will activate
  var lastCheck = 0;
  var THROTTLE_MS = 3 * 60 * 1000; // don't hammer reg.update() — at most every few minutes

  // ---- Toast UI (DeadDance purple→rose, accessible) --------------------------
  function showToast(reg) {
    if (toastEl || document.getElementById("ddSwUpdate")) return; // already visible
    if (!document.body) { document.addEventListener("DOMContentLoaded", function () { showToast(reg); }); return; }

    var b = document.createElement("div");
    b.id = "ddSwUpdate";
    b.setAttribute("role", "status");
    b.setAttribute("aria-live", "polite");
    b.style.cssText =
      "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483000;" +
      "background:linear-gradient(135deg,#5a2e86,#b8002e);color:#fff;border-radius:14px;padding:11px 14px;" +
      "box-shadow:0 14px 34px rgba(10,5,20,.55);display:flex;align-items:center;gap:11px;" +
      "font:700 13.5px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;" +
      "max-width:94vw;cursor:pointer;-webkit-tap-highlight-color:transparent";

    var msg = document.createElement("span");
    msg.id = "ddSwUpdateMsg";
    msg.textContent = "🔄 New version — tap to refresh";
    msg.setAttribute("role", "button");
    msg.setAttribute("tabindex", "0");
    msg.setAttribute("aria-label", "New version available — refresh to update");

    var x = document.createElement("span");
    x.textContent = "✕";
    x.setAttribute("role", "button");
    x.setAttribute("tabindex", "0");
    x.setAttribute("aria-label", "Dismiss update notice");
    x.style.cssText = "cursor:pointer;opacity:.7;padding:0 2px 0 4px;font-size:15px;font-weight:400";

    b.appendChild(msg);
    b.appendChild(x);
    document.body.appendChild(b);
    toastEl = b;

    function doUpdate() {
      if (busy) return;
      busy = true;
      userTriggered = true;
      msg.textContent = "Updating…";
      b.style.cursor = "default";
      var w = (reg && reg.waiting) || newWorker;
      try { if (w) w.postMessage({ type: "SKIP_WAITING" }); } catch (e) {}
      // controllerchange (below) does the reload once the new SW takes control.
      // Fallback: if controllerchange never fires (rare), reload after a beat.
      setTimeout(function () {
        if (reloading) return;
        reloading = true;
        try { window.location.reload(); } catch (e) {}
      }, 2500);
    }
    function dismiss(ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      if (toastEl) { toastEl.remove(); toastEl = null; }
      // Just hide it — the waiting worker still activates on next full close. Don't fight the user.
    }

    b.addEventListener("click", doUpdate);
    msg.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doUpdate(); } });
    x.addEventListener("click", dismiss);
    x.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dismiss(e); } });
  }

  // ---- Detection -------------------------------------------------------------
  function watch(reg) {
    if (!reg) return;

    // (a) a build was already waiting when this page loaded. Only prompt if a
    //     controller already exists → it's an UPDATE, never the first install.
    if (reg.waiting && navigator.serviceWorker.controller) { newWorker = reg.waiting; showToast(reg); }

    // (b) a new worker appears while this page is open.
    reg.addEventListener("updatefound", function () {
      var nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", function () {
        // installed + existing controller = UPDATE. No controller = FIRST install → stay silent.
        if (nw.state === "installed" && navigator.serviceWorker.controller) { newWorker = nw; showToast(reg); }
      });
    });

    // Proactively look for new versions so long-open tabs don't miss a deploy.
    function maybeUpdate() {
      var now = Date.now();
      if (now - lastCheck < THROTTLE_MS) return;
      lastCheck = now;
      try { reg.update(); } catch (e) {}
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) maybeUpdate(); });
    window.addEventListener("focus", maybeUpdate);
    setInterval(maybeUpdate, THROTTLE_MS); // gentle background poll
  }

  // Reload EXACTLY ONCE when the new SW takes control — but ONLY if the user asked
  // for it. Passive activation and the first-install clients.claim() also fire
  // controllerchange; without this gate a fresh visitor would get a needless reload.
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (!userTriggered) return;
    if (reloading) return;
    reloading = true;
    try { window.location.reload(); } catch (e) {}
  });

  // Observe the existing registration (we never register one here).
  function boot(reg) { if (reg) watch(reg); }
  try {
    if (navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg) boot(reg);
        else if (navigator.serviceWorker.ready && navigator.serviceWorker.ready.then) navigator.serviceWorker.ready.then(boot);
      }, function () {
        if (navigator.serviceWorker.ready && navigator.serviceWorker.ready.then) navigator.serviceWorker.ready.then(boot);
      });
    } else if (navigator.serviceWorker.ready && navigator.serviceWorker.ready.then) {
      navigator.serviceWorker.ready.then(boot);
    }
  } catch (e) {}
})();
