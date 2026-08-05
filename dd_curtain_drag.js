/* dd_curtain_drag.js — SHARED bottom-sheet "curtain" drag controller.
   ONE small, dependency-free brain for every DeadDance curtain (Musikfest map, Festival
   Event Maker, fan festival map). Makes the curtain FOLLOW THE THUMB continuously (Google-Maps
   bottom-sheet feel) instead of jumping between three fixed tap-stops.

   Model: the sheet is positioned by its CSS `top` (px). SMALLER top = sheet is HIGHER / TALLER.
     - full  = highest the sheet should go (content-adaptive: never rises past what content needs)
     - mid   = half-open
     - peek  = low (mostly map)

   ── ALL geometry is PURE + testable (see dd_curtain_drag.test.js). The DOM wiring (attach)
      is a thin shell over those pure functions. Guarded + no-op safe in Node (module.exports)
      and in browsers with no Pointer Events (touch/mouse fallback).

   HONESTY: gesture FEEL (thumb tracking, momentum, scroll hand-off) can only be truly judged
   on a device. This file proves the MATH; the touch feel is device-validated-later. */
(function (root) {
  "use strict";

  /* ── PURE GEOMETRY (no DOM; unit-tested) ─────────────────────────────────── */

  function clamp(v, lo, hi) {
    if (hi < lo) { var t = lo; lo = hi; hi = t; }
    return Math.max(lo, Math.min(hi, v));
  }

  // The sheet follows the thumb: new top = start top + (how far the thumb moved), clamped.
  // Thumb DOWN (curPointer > startPointer) → top grows → sheet lowers. Thumb UP → sheet rises.
  function dragPosition(startPos, startPointer, curPointer, minPos, maxPos) {
    return clamp(startPos + (curPointer - startPointer), minPos, maxPos);
  }

  // Content-adaptive anchors. The FULL stop adapts to how tall the current pill's content is,
  // so a short curtain doesn't open into empty space and the long Musikfest lineup can rise all
  // the way. Returns {full, mid, peek} in px (full <= mid <= peek).
  function contentAnchors(vpH, contentPx, cfg) {
    cfg = cfg || {};
    var peekVh = cfg.peekVh != null ? cfg.peekVh : 78;
    var midVh = cfg.midVh != null ? cfg.midVh : 52;
    var minTopVh = cfg.minTopVh != null ? cfg.minTopVh : 8;
    var handlePx = cfg.handlePx || 0;
    var h = vpH / 100;
    var peek = peekVh * h, mid = midVh * h, minTop = minTopVh * h;
    var full;
    if (!(contentPx > 0)) {
      full = minTop;                                  // unknown content → open fully (never stuck)
    } else {
      // top that makes the visible sheet exactly as tall as its content, capped tall at minTop
      // and never allowed to sit below mid (so "full" is always at least as open as "mid").
      full = clamp(vpH - contentPx - handlePx, minTop, mid - 1);
    }
    return { full: full, mid: mid, peek: peek };
  }

  function anchorList(anchors) { return [anchors.full, anchors.mid, anchors.peek]; }

  // Drag travel bounds: cannot rise above `full`, can fall a touch past `peek` (keeps a grab-lip).
  function dragBounds(anchors, vpH, maxTopVh) {
    var maxTop = (maxTopVh != null ? maxTopVh : 88) * (vpH / 100);
    return { min: anchors.full, max: Math.max(maxTop, anchors.peek) };
  }

  function snapToNearest(pos, anchors) {
    var arr = Array.isArray(anchors) ? anchors : anchorList(anchors);
    var best = arr[0];
    for (var i = 1; i < arr.length; i++) {
      if (Math.abs(arr[i] - pos) < Math.abs(best - pos)) best = arr[i];
    }
    return best;
  }

  // Release snap with momentum: a fast flick carries to the next anchor in the fling direction;
  // a slow release snaps to nearest. velocity is px/ms (positive = thumb moving DOWN).
  function snapByVelocity(pos, velocity, anchors, threshold) {
    var arr = (Array.isArray(anchors) ? anchors : anchorList(anchors)).slice()
      .sort(function (a, b) { return a - b; });
    if (threshold == null) threshold = 0.5;
    if (velocity > threshold) {                        // flick DOWN → first anchor below current
      for (var i = 0; i < arr.length; i++) { if (arr[i] > pos + 0.5) return arr[i]; }
      return arr[arr.length - 1];
    }
    if (velocity < -threshold) {                       // flick UP → first anchor above current
      for (var j = arr.length - 1; j >= 0; j--) { if (arr[j] < pos - 0.5) return arr[j]; }
      return arr[0];
    }
    return snapToNearest(pos, arr);
  }

  // Tap-the-handle bonus quick-action: snap to the NEXT anchor (more open); wrap when fully open.
  function tapNext(pos, anchors) {
    var arr = (Array.isArray(anchors) ? anchors : anchorList(anchors)).slice()
      .sort(function (a, b) { return a - b; });
    var near = snapToNearest(pos, arr);
    var idx = arr.indexOf(near);
    if (idx > 0) return arr[idx - 1];                  // more open (smaller top)
    return arr[arr.length - 1];                        // already fully open → back to most-closed
  }

  // px/ms from the last few pointer samples ({t,y}). Positive = moving down.
  function velocityFrom(samples) {
    if (!samples || samples.length < 2) return 0;
    var a = samples[0], b = samples[samples.length - 1];
    var dt = b.t - a.t;
    if (!(dt > 0)) return 0;
    return (b.y - a.y) / dt;
  }

  function prefersReducedMotion() {
    try {
      return !!(root && root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) { return false; }
  }

  /* ── DOM WIRING (thin shell; no-op safe) ─────────────────────────────────── */

  function noopController() {
    return {
      beginDrag: function () {}, snapTo: function () {}, setTop: function () {},
      getTop: function () { return 0; }, refresh: function () {}, destroy: function () {}
    };
  }

  // attach({ sheet, handle, config, getContentPx, onMove, onSettle, onTap, manualStart, reducedMotion })
  //   sheet   : the curtain element positioned by CSS top
  //   handle  : the drag grip (only place a drag can START — protects content scroll)
  //   config  : { peekVh, midVh, minTopVh, maxTopVh, handlePx, dragClass, velThreshold }
  //   manualStart : if true, attach does NOT bind pointerdown itself — caller invokes ctrl.beginDrag
  //                 (lets an existing inline onpointerdown handler keep the DOM byte-identical)
  function attach(opts) {
    opts = opts || {};
    var doc = (typeof document !== "undefined") ? document : null;
    var win = root;
    var sheet = opts.sheet, handle = opts.handle;
    if (!doc || !win || !sheet) return noopController();          // no-op safe (Node / missing DOM)

    var cfg = opts.config || {};
    var dragClass = cfg.dragClass || "mf-drag";
    var velThreshold = cfg.velThreshold != null ? cfg.velThreshold : 0.5;
    var reduce = (opts.reducedMotion != null) ? opts.reducedMotion : prefersReducedMotion();

    var curTop = 0, dragging = false, moved = false, startY = 0, startTop = 0, startT = 0;
    var samples = [], pid = null, capEl = null, usePointer = false;

    function vpH() { return win.innerHeight || 0; }
    function contentPx() { try { return opts.getContentPx ? opts.getContentPx() : sheet.scrollHeight; } catch (e) { return 0; } }
    function anchors() { return contentAnchors(vpH(), contentPx(), cfg); }
    function bounds() { return dragBounds(anchors(), vpH(), cfg.maxTopVh); }
    function now() { return (win.performance && win.performance.now) ? win.performance.now() : Date.now(); }

    function applyTop(px, animate) {
      curTop = px;
      sheet.style.transition = (reduce || animate === false) ? "none" : "";
      sheet.style.top = px + "px";
      if (opts.onMove) { try { opts.onMove(px); } catch (e) {} }
    }
    function settle(px) { applyTop(px, true); if (opts.onSettle) { try { opts.onSettle(px); } catch (e) {} } }

    function pointerY(e) {
      if (e == null) return null;
      if (typeof e.clientY === "number" && !e.touches) return e.clientY;
      if (e.touches && e.touches.length) return e.touches[0].clientY;
      if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientY;
      if (typeof e.clientY === "number") return e.clientY;
      return null;
    }

    function onMoveEvt(e) {
      if (!dragging) return;
      var y = pointerY(e); if (y == null) return;
      if (Math.abs(y - startY) > 3) moved = true;
      samples.push({ t: now(), y: y }); if (samples.length > 6) samples.shift();
      var b = bounds();
      applyTop(dragPosition(startTop, startY, y, b.min, b.max), false);
      if (e.cancelable && e.preventDefault) e.preventDefault();     // we own this gesture now
    }

    function bindMove() {
      if (usePointer) {
        win.addEventListener("pointermove", onMoveEvt, { passive: false });
        win.addEventListener("pointerup", endDrag);
        win.addEventListener("pointercancel", endDrag);
      } else {
        win.addEventListener("touchmove", onMoveEvt, { passive: false });
        win.addEventListener("touchend", endDrag);
        win.addEventListener("touchcancel", endDrag);
        win.addEventListener("mousemove", onMoveEvt);
        win.addEventListener("mouseup", endDrag);
      }
      win.addEventListener("blur", endDrag);                        // safety: never leave a stuck drag
    }
    function unbindMove() {
      win.removeEventListener("pointermove", onMoveEvt);
      win.removeEventListener("pointerup", endDrag);
      win.removeEventListener("pointercancel", endDrag);
      win.removeEventListener("touchmove", onMoveEvt);
      win.removeEventListener("touchend", endDrag);
      win.removeEventListener("touchcancel", endDrag);
      win.removeEventListener("mousemove", onMoveEvt);
      win.removeEventListener("mouseup", endDrag);
      win.removeEventListener("blur", endDrag);
    }

    function beginDrag(e) {
      var y = pointerY(e); if (y == null) return;
      dragging = true; moved = false; startY = y; startTop = curTop; startT = now();
      samples = [{ t: startT, y: y }];
      usePointer = !!(win.PointerEvent && e && e.pointerId != null);
      if (doc.body) doc.body.classList.add(dragClass);
      if (usePointer) {
        pid = e.pointerId; capEl = e.currentTarget || handle || sheet;
        try { if (capEl && capEl.setPointerCapture) capEl.setPointerCapture(pid); } catch (x) {}
      }
      bindMove();
      if (e && e.preventDefault) e.preventDefault();
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      unbindMove();
      if (doc.body) doc.body.classList.remove(dragClass);
      try { if (capEl && capEl.releasePointerCapture && pid != null) capEl.releasePointerCapture(pid); } catch (x) {}
      pid = null; capEl = null;
      var dt = now() - startT;
      if (!moved && dt < 400) { if (opts.onTap) { try { opts.onTap(); } catch (e) {} } return; }
      settle(snapByVelocity(curTop, velocityFrom(samples), anchorList(anchors()), velThreshold));
    }

    function startFromHandle(e) { beginDrag(e); }

    if (!opts.manualStart && handle) {
      if (win.PointerEvent) {
        handle.addEventListener("pointerdown", startFromHandle);
      } else {
        handle.addEventListener("touchstart", startFromHandle, { passive: false });
        handle.addEventListener("mousedown", startFromHandle);
      }
    }

    var ctrl = {
      beginDrag: beginDrag,
      snapTo: function (name) {
        var a = anchors();
        settle(name === "full" ? a.full : (name === "peek" ? a.peek : a.mid));
      },
      setTop: function (px) { applyTop(px, false); },               // exact restore (no animation surprise)
      getTop: function () { return curTop; },
      refresh: function () {                                        // re-clamp on resize / content change
        var b = bounds();
        applyTop(clamp(curTop, b.min, b.max), true);
      },
      destroy: function () {
        try { endDrag(); } catch (e) {}
        if (handle) {
          handle.removeEventListener("pointerdown", startFromHandle);
          handle.removeEventListener("touchstart", startFromHandle);
          handle.removeEventListener("mousedown", startFromHandle);
        }
      }
    };
    return ctrl;
  }

  var API = {
    clamp: clamp,
    dragPosition: dragPosition,
    contentAnchors: contentAnchors,
    anchorList: anchorList,
    dragBounds: dragBounds,
    snapToNearest: snapToNearest,
    snapByVelocity: snapByVelocity,
    tapNext: tapNext,
    velocityFrom: velocityFrom,
    prefersReducedMotion: prefersReducedMotion,
    attach: attach
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (root) root.DDCurtainDrag = API;

})(typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : this));
