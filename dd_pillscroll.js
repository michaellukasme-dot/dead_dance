/* dd_pillscroll.js — on-screen scroll affordance for a horizontally-scrollable pill/tab bar.
   Mirrors the Apple/Google Maps category-pill chevrons:
     • right arrow only  = bar is fully scrolled LEFT  (start)  → more content to the RIGHT
     • both arrows       = partially scrolled          (middle) → more content BOTH ways
     • left arrow only   = fully scrolled RIGHT         (end)    → more content to the LEFT
     • no arrows         = the bar isn't overflowing at all
   Tapping an arrow scrolls the bar that direction (nice-to-have).

   TWO halves, cleanly split:
     1. arrowState(...)  — a PURE function (no DOM). Unit-tested in dd_pillscroll.test.js.
     2. attach(barEl)    — a thin browser shell that renders/toggles the chevrons over the bar
                           edges with a soft fade, throttled on scroll/resize via rAF.

   HONESTY: the MATH (which arrow shows when) is proven here + in the harness. The VISUAL feel
   — do the chevrons appear/hide at the exact edges on a real touch device, do they overlap the
   pills acceptably — can only be judged on a device. This file cannot run a browser; that part
   is device-validated-later. Said plainly, not buried.

   Dependency-free. Dual export (Node module.exports for the test + browser global DDPillScroll).
   Guarded + no-op safe: attach touches the DOM only when called in a browser. */
(function (root) {
  "use strict";

  /* ── PURE: which arrows should show, given the bar's scroll geometry ─────────
     scrollLeft   = current horizontal scroll offset (LTR, >= 0)
     scrollWidth  = full scrollable content width
     clientWidth  = visible width of the bar
     epsilon      = sub-pixel / zoom-rounding tolerance (default 1px)
     → { left:bool, right:bool }                                                */
  function arrowState(scrollLeft, scrollWidth, clientWidth, epsilon) {
    var eps = (epsilon == null || epsilon < 0) ? 1 : epsilon;
    // guard against NaN / bad input → show nothing rather than lie
    if (!isFinite(scrollLeft) || !isFinite(scrollWidth) || !isFinite(clientWidth)) {
      return { left: false, right: false };
    }
    var maxScroll = scrollWidth - clientWidth;
    // No overflow (content fits, or is smaller than the viewport) → no arrows.
    if (maxScroll <= eps) return { left: false, right: false };
    var atStart = scrollLeft <= eps;                 // pinned to the left edge
    var atEnd = scrollLeft >= (maxScroll - eps);      // pinned to the right edge
    return {
      left: !atStart,   // there's hidden content to the LEFT  → offer to go left
      right: !atEnd     // there's hidden content to the RIGHT → offer to go right
    };
  }

  /* ── BROWSER shell ───────────────────────────────────────────────────────── */

  var STYLE_ID = "ddps-style";
  var CSS =
    ".ddps-arrow{position:sticky;align-self:stretch;display:flex;align-items:center;" +
      "width:0;min-width:0;flex:0 0 0;z-index:5;pointer-events:none;overflow:visible;" +
      "opacity:0;transition:opacity .18s ease}" +
    ".ddps-arrow.ddps-on{opacity:1}" +
    ".ddps-arrow.ddps-l{left:0;order:-1;margin-right:calc(-1 * var(--ddps-gap,0px))}" +
    ".ddps-arrow.ddps-r{right:0;order:9999;margin-left:calc(-1 * var(--ddps-gap,0px))}" +
    ".ddps-fade{position:absolute;top:0;bottom:0;width:56px;pointer-events:none;z-index:0}" +
    ".ddps-l .ddps-fade{left:0;background:linear-gradient(90deg,var(--ddps-bg,#faf8fc) 34%,transparent)}" +
    ".ddps-r .ddps-fade{right:0;background:linear-gradient(270deg,var(--ddps-bg,#faf8fc) 34%,transparent)}" +
    ".ddps-btn{position:absolute;top:50%;transform:translateY(-50%);width:30px;height:30px;" +
      "border-radius:999px;border:1px solid var(--line,#e6e0f0);background:#fff;color:var(--purple,#5a2e86);" +
      "box-shadow:0 1px 6px rgba(27,18,38,.16);display:flex;align-items:center;justify-content:center;" +
      "font:900 16px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;cursor:pointer;padding:0;z-index:1}" +
    ".ddps-arrow.ddps-on .ddps-btn{pointer-events:auto}" +      // only tappable when actually shown
    ".ddps-arrow:not(.ddps-on) .ddps-btn{pointer-events:none}" + // never blocks the pill underneath when hidden
    ".ddps-l .ddps-btn{left:2px}.ddps-r .ddps-btn{right:2px}" +
    ".ddps-btn:active{transform:translateY(-50%) scale(.9)}" +
    "@media (prefers-reduced-motion:reduce){.ddps-arrow{transition:none}}";

  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement("style");
    s.id = STYLE_ID;
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function makeArrow(doc, side, label) {
    var a = doc.createElement("div");
    a.className = "ddps-arrow ddps-" + side;
    a.setAttribute("aria-hidden", "true");        // decorative affordance; not a landmark
    var fade = doc.createElement("span");
    fade.className = "ddps-fade";
    var btn = doc.createElement("button");
    btn.className = "ddps-btn";
    btn.type = "button";
    btn.tabIndex = -1;
    btn.setAttribute("aria-label", label);
    btn.textContent = side === "l" ? "‹" : "›";  // ‹  ›  (matches the app's back chevron)
    a.appendChild(fade);
    a.appendChild(btn);
    return { el: a, btn: btn };
  }

  // attach(barEl, opts): render/toggle the chevrons over `barEl` (a horizontally-scrollable
  // flex row). opts.epsilon (px), opts.step (0..1 fraction of clientWidth per arrow tap),
  // opts.scrollOnTap (default true). Returns { update, destroy } or null (guarded no-op).
  function attach(barEl, opts) {
    opts = opts || {};
    if (!barEl || barEl.nodeType !== 1) return null;
    var doc = barEl.ownerDocument;
    if (!doc || !doc.defaultView) return null;          // not a live DOM → no-op
    if (barEl.getAttribute("data-ddps")) return null;   // already attached — never double-wire
    var win = doc.defaultView;

    var eps = (typeof opts.epsilon === "number") ? opts.epsilon : 1;
    var step = (typeof opts.step === "number") ? opts.step : 0.72;
    var scrollOnTap = opts.scrollOnTap !== false;

    injectStyle(doc);
    barEl.setAttribute("data-ddps", "1");

    // Neutralise the flex `gap` around our zero-width anchors so pills DON'T shift.
    try {
      var cs = win.getComputedStyle(barEl);
      var gap = cs.columnGap;
      if (!gap || gap === "normal") gap = cs.gap;
      if (!gap || gap === "normal") gap = "0px";
      // gap can be a two-value string ("7px 7px"); take the column (last token)
      barEl.style.setProperty("--ddps-gap", String(gap).split(" ").pop());
      var bg = cs.backgroundColor;
      // only pin the fade colour when the bar has an opaque background (else keep the CSS fallback)
      if (bg && bg !== "transparent" && !/rgba\([^)]*,\s*0\s*\)$/.test(bg.replace(/\s+/g, ""))) {
        barEl.style.setProperty("--ddps-bg", bg);
      }
    } catch (e) {}

    // RTL best-effort: the app ships LTR; RTL scrollLeft semantics vary by engine and is
    // device-validated-later. We normalise to a non-negative logical offset so the pure fn
    // stays LTR, and flip the tap direction.
    var rtl = false;
    try { rtl = /rtl/i.test(win.getComputedStyle(barEl).direction); } catch (e2) {}

    var left = makeArrow(doc, "l", "Scroll pills left");
    var right = makeArrow(doc, "r", "Scroll pills right");
    barEl.appendChild(left.el);
    barEl.appendChild(right.el);

    function logicalScrollLeft() {
      var sl = barEl.scrollLeft;
      return rtl ? Math.abs(sl) : sl;
    }

    function update() {
      var st = arrowState(logicalScrollLeft(), barEl.scrollWidth, barEl.clientWidth, eps);
      // In RTL the physical chevrons swap meaning; flip so the physically-left chevron still
      // points at the physically-left hidden content.
      var showL = rtl ? st.right : st.left;
      var showR = rtl ? st.left : st.right;
      left.el.classList.toggle("ddps-on", showL);
      right.el.classList.toggle("ddps-on", showR);
    }

    var rafId = 0;
    var raf = win.requestAnimationFrame ? win.requestAnimationFrame.bind(win)
                                        : function (f) { return win.setTimeout(f, 16); };
    var caf = win.cancelAnimationFrame ? win.cancelAnimationFrame.bind(win)
                                       : function (id) { win.clearTimeout(id); };
    function schedule() {                         // throttle: at most one update per frame
      if (rafId) return;
      rafId = raf(function () { rafId = 0; update(); });
    }

    function doScroll(dir) {                       // dir: -1 left, +1 right (physical)
      var amt = Math.max(120, barEl.clientWidth * step) * dir * (rtl ? -1 : 1);
      try { barEl.scrollBy({ left: amt, behavior: "smooth" }); }
      catch (e3) { barEl.scrollLeft += amt; }      // old-browser fallback (no smooth-scroll object)
    }
    function onLeftTap(e) { e.preventDefault(); e.stopPropagation(); if (scrollOnTap) doScroll(-1); }
    function onRightTap(e) { e.preventDefault(); e.stopPropagation(); if (scrollOnTap) doScroll(1); }
    left.btn.addEventListener("click", onLeftTap);
    right.btn.addEventListener("click", onRightTap);

    barEl.addEventListener("scroll", schedule, { passive: true });
    win.addEventListener("resize", schedule);
    win.addEventListener("orientationchange", schedule);

    var ro = null;
    if (win.ResizeObserver) {
      try { ro = new win.ResizeObserver(schedule); ro.observe(barEl); } catch (e4) { ro = null; }
    }

    // initial paint (now + after layout settles, in case fonts/pills load late)
    update();
    win.setTimeout(update, 60);
    win.setTimeout(update, 400);

    var destroyed = false;
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (rafId) { caf(rafId); rafId = 0; }
      left.btn.removeEventListener("click", onLeftTap);
      right.btn.removeEventListener("click", onRightTap);
      barEl.removeEventListener("scroll", schedule);
      win.removeEventListener("resize", schedule);
      win.removeEventListener("orientationchange", schedule);
      if (ro) { try { ro.disconnect(); } catch (e5) {} }
      if (left.el.parentNode) left.el.parentNode.removeChild(left.el);
      if (right.el.parentNode) right.el.parentNode.removeChild(right.el);
      barEl.removeAttribute("data-ddps");
      barEl.style.removeProperty("--ddps-gap");
      barEl.style.removeProperty("--ddps-bg");
    }

    return { update: schedule, destroy: destroy };
  }

  var API = { arrowState: arrowState, attach: attach };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (root) root.DDPillScroll = API;

})(typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : this));
