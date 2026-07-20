/* dd_native.js — "feel native to the fullest extent the web platform legally allows."
   Every capability here is STANDARDS-BASED and CONSENT-GATED. No fingerprinting, no app-sniffing,
   no covert data. Each feature is capability-detected and degrades silently. Never throws.

   Provides: install prompt (A2HS), standalone detection + safe-area class, haptics, screen wake-lock
   (keep the screen on during a show/walk), app-icon badging, and a shortcut-intent hook.
   Sharing lives in dd_launch.js (OS Share Sheet). Exposed as window.DDNative. */
(function (root) {
  "use strict";
  var installEvt = null;

  function standalone() {
    try { return (root.matchMedia && matchMedia("(display-mode: standalone)").matches) || root.navigator.standalone === true; } catch (e) { return false; }
  }

  // ---- Install (Add to Home Screen) ----
  try {
    root.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; try { document.dispatchEvent(new CustomEvent("dd:installable")); } catch (x) {} });
    root.addEventListener("appinstalled", function () { installEvt = null; try { if (root.toast) toast("🌹 DeadDance is on your home screen."); } catch (x) {} });
  } catch (e) {}

  // ---- Haptics (no permission needed; user-gesture only) ----
  function buzz(pattern) { try { if (root.navigator && navigator.vibrate) navigator.vibrate(pattern || 12); } catch (e) {} }

  // ---- Screen Wake Lock (keep the screen awake during a set / a walk to the stage) ----
  var _wake = null;
  function keepAwake(on) {
    try {
      if (on === false) { if (_wake) { _wake.release().catch(function () {}); _wake = null; } return; }
      if (!navigator.wakeLock) return;
      navigator.wakeLock.request("screen").then(function (w) { _wake = w; w.addEventListener("release", function () { _wake = null; }); }, function () {});
    } catch (e) {}
  }
  // re-acquire if the tab comes back and we wanted it awake
  try { document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && root.DDNative && DDNative._wantAwake) keepAwake(true); }); } catch (e) {}

  // ---- App icon badge (unread alerts) — where supported ----
  function badge(n) { try { if (navigator.setAppBadge) { if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge && navigator.clearAppBadge(); } } catch (e) {} }

  // ---- Shortcut / share-target intent (?go=… or shared text) — non-breaking hook ----
  function intent() { try { var p = new URLSearchParams(location.search); return p.get("go") || null; } catch (e) { return null; } }

  var DDNative = {
    _wantAwake: false,
    isInstalled: standalone,
    canInstall: function () { return !!installEvt; },
    promptInstall: function () {
      try { if (!installEvt) { if (root.toast) toast("Use your browser's “Add to Home Screen” to install. 🌹"); return; }
        installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; }); } catch (e) {}
    },
    buzz: buzz,
    tap: function () { buzz(10); },
    keepAwake: function (on) { this._wantAwake = (on !== false); keepAwake(on); },
    badge: badge,
    intent: intent
  };
  root.DDNative = DDNative;

  // mark the body so CSS can lean into safe-area insets + app chrome when installed
  function mark() { try { if (standalone()) document.documentElement.classList.add("dd-standalone"); } catch (e) {} }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mark); else mark();
})(typeof window !== "undefined" ? window : this);
