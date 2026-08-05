/* dd_images_curtain.js — "Browse In-App Images" curtain for the DeadDance walking map.
   Design reference (Michael, NOTES_MAP_UI 2026-08-05 §3): Google Maps "Browse Street View
   images" bottom filmstrip — a horizontally-scrollable strip of LABELLED image cards, a
   "Layers"-style left cap, and an "Explore" header with an expand/collapse chevron. Our
   version swaps Street-View tiles for the USER'S OWN in-app captured photos (dd_photos.js),
   each pinned on the walking map at the spot it was taken — in the same visual family as the
   %USER% %AVATAR% marker (the green .mfyou dot in musikfest.html).

   ── STATUS / HONESTY (read this first) ────────────────────────────────────────────────────
   • This is a REVIEWABLE module + preview page. It is NOT yet wired into musikfest.html / the
     live festival map. Live-wiring is the post-review step (see WIRING NOTES at bottom).
   • I (Claudine) cannot run a browser here. All PURE functions below are node-proven by
     dd_images_curtain.test.js. The VISUAL feel — curtain drag, filmstrip scroll, pin sizing,
     modal on a touch device — is DEVICE-VALIDATED-LATER. Said plainly, not buried.
   • OPEN DESIGN QUESTIONS for Michael (also in the return report):
       1. Small⟷Big slider — I ASSUMED it sizes the on-map photo pins (sliderToSize below).
          Confirm that's the intent (vs. e.g. filmstrip card size, or zoom).
       2. CAPTION SOURCE — dd_photos.js records DO carry lat/lng + ts, but they DO NOT store a
          place name or note. So a card's caption is synthesized from time (+ optional `cell`).
          The Google reference shows real place names ("Dutch Springs"). Confirm where captions
          should come from (reverse-geocode? a note field added to dd_photos.save?).
       3. AFTER-WALK export format — composeAfterWalk() builds the testable marker-set + bounds;
          the actual raster/share render is a STUB pending your call on format (PNG canvas like
          postWalk() in musikfest.html? share sheet? print?).

   ── MISSING-GEO IS HANDLED HONESTLY ─────────────────────────────────────────────────────────
   A photo with lat==null / lng==null CANNOT be pinned. It is NOT dropped: it still appears in
   the filmstrip, labelled "No location", and simply has no map pin. projectPhotos() splits the
   two sets so the UI never fakes a pin at (0,0).

   Dependency-free beyond Leaflet (already loaded by the host page) and the two sibling
   controllers it REUSES rather than reinventing:
     • DDCurtainDrag (dd_curtain_drag.js) — thumb-follow min/max drag of the curtain.
     • DDPillScroll  (dd_pillscroll.js)   — edge chevrons when the filmstrip overflows.
   Both are optional: if absent, the curtain degrades to a tap toggle and native scroll.

   Dual export: browser global window.DDImagesCurtain + Node module.exports (guarded no-op DOM).
*/
(function (root) {
  "use strict";

  /* ════════════════════════════════════════════════════════════════════════════
     PURE, TESTABLE CORE  (no DOM — unit-tested in dd_images_curtain.test.js)
     ════════════════════════════════════════════════════════════════════════════ */

  function clamp(v, lo, hi) {
    if (!(hi >= lo)) { var t = lo; lo = hi; hi = t; }
    if (!isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function isNum(n) { return typeof n === "number" && isFinite(n); }

  // A record HAS usable geo only if BOTH lat & lng are finite numbers in-range.
  function hasGeo(p) {
    return !!p && isNum(p.lat) && isNum(p.lng) &&
      p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;
  }

  // photoToPin(photo) → a flat pin descriptor, or null when the photo has no usable geo.
  // Never invents coordinates; null is the honest answer for a geo-less photo.
  function photoToPin(p) {
    if (!hasGeo(p)) return null;
    return {
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      url: p.url || p.localUrl || "",
      ts: isNum(p.ts) ? p.ts : 0,
      exif: !!p.exif
    };
  }

  // orderByTime(list) → new array sorted OLDEST→NEWEST by ts (filmstrip reads left→right in
  // capture order, mirroring the walk). Stable-ish; missing ts sorts as 0. Non-mutating.
  function orderByTime(list) {
    if (!Array.isArray(list)) return [];
    return list.slice().sort(function (a, b) {
      var ta = (a && isNum(a.ts)) ? a.ts : 0;
      var tb = (b && isNum(b.ts)) ? b.ts : 0;
      return ta - tb;
    });
  }

  // projectPhotos(list) → { pins:[…geo…], noGeo:[…missing…] }. Deterministic, time-ordered.
  // This is THE honest split that keeps the map truthful when photos lack location.
  function projectPhotos(list) {
    var ordered = orderByTime(list);
    var pins = [], noGeo = [];
    for (var i = 0; i < ordered.length; i++) {
      var pin = photoToPin(ordered[i]);
      if (pin) pins.push(pin); else noGeo.push(ordered[i]);
    }
    return { pins: pins, noGeo: noGeo };
  }

  // sliderToSize(value, opts) → integer pin diameter in px. MONOTONIC non-decreasing in value
  // and CLAMPED to [sizeMin, sizeMax]. value defaults to a 0..1 range (Small=0 … Big=1) but any
  // input range can be supplied. ⚠️ ASSUMED FUNCTION — confirm Small⟷Big controls pin size.
  function sliderToSize(value, opts) {
    opts = opts || {};
    var inMin = isNum(opts.inMin) ? opts.inMin : 0;
    var inMax = isNum(opts.inMax) ? opts.inMax : 1;
    var sizeMin = isNum(opts.sizeMin) ? opts.sizeMin : 28;
    var sizeMax = isNum(opts.sizeMax) ? opts.sizeMax : 64;
    if (inMax === inMin) return Math.round(clamp(sizeMin, sizeMin, sizeMax));
    var t = clamp((value - inMin) / (inMax - inMin), 0, 1);   // normalised 0..1, clamped
    return Math.round(sizeMin + t * (sizeMax - sizeMin));
  }

  // ── caption formatting ──────────────────────────────────────────────────────
  // deterministic clock from a ts, with an explicit tz offset (minutes east of UTC) so tests
  // don't depend on the runner's timezone. Returns "h:mm AM/PM".
  function formatClock(ts, tzOffsetMin) {
    if (!isNum(ts)) return "";
    var off = isNum(tzOffsetMin) ? tzOffsetMin : 0;
    var d = new Date(ts + off * 60000);
    var h = d.getUTCHours(), m = d.getUTCMinutes();
    var ap = h < 12 ? "AM" : "PM";
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ":" + (m < 10 ? "0" + m : m) + " " + ap;
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function formatDay(dayStr) {                        // dd_photos stores day as "YYYY-MM-DD"
    if (!dayStr || typeof dayStr !== "string") return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayStr);
    if (!m) return "";
    var mo = parseInt(m[2], 10) - 1;
    return (MONTHS[mo] || "?") + " " + parseInt(m[3], 10);
  }

  // formatCaption(photo, opts) → { title, subtitle, hasGeo }. The card label.
  //   title    : a place if the record ever carries one (future-proof: photo.place / .caption /
  //              .name), else a kind-aware fallback ("My photo" / "Profile").
  //   subtitle : "Aug 5 · 8:42 PM" from day + ts, or "No location" flagged when geo is missing.
  // ⚠️ dd_photos.js records currently carry NO place text — title falls back until a caption
  //    source is confirmed (see OPEN QUESTIONS #2).
  function formatCaption(photo, opts) {
    opts = opts || {};
    var p = photo || {};
    var title = p.place || p.caption || p.name || "";
    if (!title) title = (p.kind === "profile") ? "Profile photo" : "My photo";
    var day = formatDay(p.day);
    var clock = formatClock(p.ts, opts.tzOffsetMin);
    var when = [day, clock].filter(Boolean).join(" · ");
    var geo = hasGeo(p);
    var subtitle = geo ? (when || "Pinned on map") : (when ? (when + " · No location") : "No location");
    return { title: title, subtitle: subtitle, hasGeo: geo };
  }

  // activeState(orderedList, activeId) → { index, id, prevId, nextId }. The single source of
  // truth that keeps the highlighted PIN and the highlighted CARD in sync, and drives modal
  // prev/next. index === -1 when nothing / an unknown id is active.
  function activeState(ordered, activeId) {
    var arr = Array.isArray(ordered) ? ordered : [];
    var idx = -1;
    for (var i = 0; i < arr.length; i++) { if (arr[i] && arr[i].id === activeId) { idx = i; break; } }
    if (idx === -1) return { index: -1, id: null, prevId: null, nextId: null };
    return {
      index: idx,
      id: arr[idx].id,
      prevId: idx > 0 ? arr[idx - 1].id : null,
      nextId: idx < arr.length - 1 ? arr[idx + 1].id : null
    };
  }

  // clusterByProximity(pins, epsDeg) → [{ lat, lng, items:[pin…] }] grouping pins whose coords
  // are within epsDeg degrees (crude same-spot merge so N overlapping photos render as ONE pin
  // with a count badge instead of an unreadable stack). Representative coord = the group's
  // first (oldest) member. NOTE: degree-space, not pixel-space — good enough to de-stack exact
  // duplicates; true zoom-aware clustering is device-validated-later.
  function clusterByProximity(pins, epsDeg) {
    var eps = isNum(epsDeg) && epsDeg >= 0 ? epsDeg : 0.00005;   // ~5.5 m at the equator
    var out = [];
    for (var i = 0; i < (pins || []).length; i++) {
      var p = pins[i], placed = false;
      for (var j = 0; j < out.length; j++) {
        var c = out[j];
        if (Math.abs(c.lat - p.lat) <= eps && Math.abs(c.lng - p.lng) <= eps) {
          c.items.push(p); placed = true; break;
        }
      }
      if (!placed) out.push({ lat: p.lat, lng: p.lng, items: [p] });
    }
    return out;
  }

  // boundsOf(coords) → { minLat,minLng,maxLat,maxLng } | null. coords = [[lat,lng],…].
  function boundsOf(coords) {
    var pts = (coords || []).filter(function (c) { return c && isNum(c[0]) && isNum(c[1]); });
    if (!pts.length) return null;
    var minLat = pts[0][0], maxLat = pts[0][0], minLng = pts[0][1], maxLng = pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var la = pts[i][0], ln = pts[i][1];
      if (la < minLat) minLat = la; if (la > maxLat) maxLat = la;
      if (ln < minLng) minLng = ln; if (ln > maxLng) maxLng = ln;
    }
    return { minLat: minLat, minLng: minLng, maxLat: maxLat, maxLng: maxLng };
  }

  // composeAfterWalk(photos, walkPath, opts) → the TESTABLE half of the "after-walk printout"
  // (NOTES §4, TCTP after-hike style): the composed marker set + the map bounds that a
  // renderer would fit. The actual raster/share/print render is a STUB (renderAfterWalk below)
  // pending Michael's call on export format (OPEN QUESTION #3).
  //   photos   : dd_photos records (geo-less ones are excluded from markers, counted separately)
  //   walkPath : [[lat,lng],…] the walked polyline (optional)
  function composeAfterWalk(photos, walkPath, opts) {
    opts = opts || {};
    var split = projectPhotos(photos);
    var markers = split.pins.map(function (pin) {
      return { id: pin.id, lat: pin.lat, lng: pin.lng, url: pin.url, ts: pin.ts };
    });
    var path = Array.isArray(walkPath) ? walkPath.filter(function (c) {
      return c && isNum(c[0]) && isNum(c[1]);
    }) : [];
    var coords = markers.map(function (m) { return [m.lat, m.lng]; }).concat(path);
    return {
      markers: markers,
      path: path,
      bounds: boundsOf(coords),
      photoCount: markers.length,
      noGeoCount: split.noGeo.length,
      rendered: false,                 // honest: nothing has been rasterised
      note: "STUB — composition only; export format pending review (OPEN QUESTION #3)"
    };
  }

  // detectDoubleTap(state, now, thresholdMs) → { double:bool, state } — pure double-tap timer
  // used by both cards and (as a fallback) touch pins. `state` is caller-held ({ last:ts }).
  function detectDoubleTap(state, now, thresholdMs) {
    var th = isNum(thresholdMs) ? thresholdMs : 320;
    var last = state && isNum(state.last) ? state.last : -Infinity;
    var isDouble = (now - last) <= th;
    return { double: isDouble, state: { last: isDouble ? -Infinity : now } };  // consume on double
  }

  var PURE = {
    clamp: clamp, isNum: isNum, hasGeo: hasGeo,
    photoToPin: photoToPin, projectPhotos: projectPhotos, orderByTime: orderByTime,
    sliderToSize: sliderToSize, formatClock: formatClock, formatDay: formatDay,
    formatCaption: formatCaption, activeState: activeState,
    clusterByProximity: clusterByProximity, boundsOf: boundsOf,
    composeAfterWalk: composeAfterWalk, detectDoubleTap: detectDoubleTap
  };

  /* ════════════════════════════════════════════════════════════════════════════
     DOM SHELL  (thin; guarded + no-op safe in Node / missing DOM)
     ════════════════════════════════════════════════════════════════════════════ */

  var STYLE_ID = "ddic-style";
  var CSS =
    ".ddic{position:absolute;left:0;right:0;bottom:0;top:auto;z-index:600;pointer-events:none;font:14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif}" +
    ".ddic-sheet{position:fixed;left:0;right:0;top:78vh;pointer-events:auto;background:#fff;" +
      "border-radius:16px 16px 0 0;box-shadow:0 -6px 26px rgba(27,18,38,.18);" +
      "will-change:top;transition:top .22s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column;" +
      "max-height:62vh}" +
    ".ddic-head{display:flex;align-items:center;gap:10px;padding:9px 12px 6px;cursor:grab;touch-action:none;" +
      "user-select:none;-webkit-user-select:none;position:relative}" +
    ".ddic-head:active{cursor:grabbing}" +
    ".ddic-grip{position:absolute;left:50%;top:5px;transform:translateX(-50%);width:38px;height:4px;" +
      "border-radius:3px;background:#d8d0e6}" +
    ".ddic-layers{flex:0 0 auto;width:38px;height:38px;border-radius:11px;border:1px solid #e6e0f0;background:#faf8fc;" +
      "display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;padding:0;color:#5a2e86}" +
    ".ddic-title{flex:1 1 auto;font-weight:800;color:#1b1226;font-size:15px;letter-spacing:.01em}" +
    ".ddic-count{font-weight:700;color:#9a90ad;font-size:12px;margin-left:6px}" +
    ".ddic-toggle{flex:0 0 auto;width:34px;height:34px;border-radius:999px;border:1px solid #e6e0f0;background:#fff;" +
      "color:#5a2e86;font-size:17px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}" +
    ".ddic-sizer{display:flex;align-items:center;gap:8px;padding:2px 14px 8px;color:#6a6280;font-size:11px;font-weight:700}" +
    ".ddic-sizer input[type=range]{flex:1 1 auto;accent-color:#b8002e}" +
    ".ddic-strip{display:flex;gap:9px;overflow-x:auto;overflow-y:hidden;padding:4px 12px 14px;" +
      "-webkit-overflow-scrolling:touch;scroll-behavior:smooth;scrollbar-width:thin;touch-action:pan-x}" +
    ".ddic-strip::-webkit-scrollbar{height:6px}.ddic-strip::-webkit-scrollbar-thumb{background:#e6e0f0;border-radius:3px}" +
    ".ddic-card{flex:0 0 auto;width:118px;cursor:pointer;border-radius:12px;background:#f6f4fa;border:1px solid #e6e0f0;" +
      "overflow:hidden;transition:border-color .15s,transform .12s;padding:0}" +
    ".ddic-card:active{transform:scale(.97)}" +
    ".ddic-card.ddic-active{border-color:#b8002e;box-shadow:0 0 0 2px rgba(184,0,46,.18)}" +
    ".ddic-thumb{width:118px;height:82px;object-fit:cover;display:block;background:#e8e2f2}" +
    ".ddic-cap{padding:6px 8px 8px;text-align:left}" +
    ".ddic-cap b{display:block;font-size:12.5px;font-weight:800;color:#1b1226;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".ddic-cap span{display:block;font-size:11px;color:#6a6280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".ddic-cap span.ddic-nogeo{color:#b07d17}" +
    ".ddic-empty{padding:18px 14px 26px;color:#9a90ad;font-size:13px;text-align:center}" +
    ".ddic-min .ddic-sizer{display:none}.ddic-min .ddic-strip{padding-bottom:8px}" +
    /* map pin — SAME visual family as the %USER% %AVATAR% (.mfyou): round, ringed thumbnail */
    ".ddic-pin{border-radius:50%;overflow:visible;box-shadow:0 1px 6px #0007;position:relative}" +
    ".ddic-pin img{width:100%;height:100%;object-fit:cover;border-radius:50%;border:3px solid #b8002e;display:block;background:#e8e2f2}" +
    ".ddic-pin.ddic-pin-active img{border-color:#1f9e6b}" +
    ".ddic-pin .ddic-badge{position:absolute;right:-4px;top:-4px;min-width:17px;height:17px;padding:0 3px;border-radius:9px;" +
      "background:#5a2e86;color:#fff;font:900 11px/17px sans-serif;text-align:center;box-shadow:0 1px 3px #0006}" +
    /* modal — mirrors the app's poster/admodal look (backdrop + centered panel + ×) */
    ".ddic-modal{position:fixed;inset:0;z-index:900;display:none;align-items:center;justify-content:center;padding:18px;" +
      "background:rgba(20,12,34,.92)}" +
    ".ddic-modal.ddic-open{display:flex}" +
    ".ddic-modal .ddic-x{position:absolute;top:14px;right:16px;border:0;background:#ffffff26;color:#fff;width:42px;height:42px;" +
      "border-radius:21px;font-size:23px;cursor:pointer;z-index:2}" +
    ".ddic-modal .ddic-nav{position:absolute;top:50%;transform:translateY(-50%);border:0;background:#ffffff26;color:#fff;" +
      "width:44px;height:44px;border-radius:22px;font-size:24px;font-weight:900;cursor:pointer;z-index:2}" +
    ".ddic-modal .ddic-prev{left:14px}.ddic-modal .ddic-next{right:14px}" +
    ".ddic-modal figure{margin:0;max-width:100%;max-height:94vh;display:flex;flex-direction:column;align-items:center}" +
    ".ddic-modal img.ddic-full{max-width:100%;max-height:84vh;border-radius:10px;box-shadow:0 20px 60px #000a;background:#241535}" +
    ".ddic-modal figcaption{color:#e0cdf5;font-size:13px;font-weight:700;margin-top:10px;text-align:center}" +
    "@media (prefers-reduced-motion:reduce){.ddic-sheet{transition:none}}";

  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement("style");
    s.id = STYLE_ID; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function el(doc, tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function noopController() {
    return {
      refresh: function () {}, setSize: function () {}, open: function () {},
      openModal: function () {}, closeModal: function () {}, destroy: function () {},
      isNoop: true
    };
  }

  // mount(opts) — build the curtain, pins, slider, modal. Returns a controller.
  //   opts.map          : the Leaflet map (required for pins; strip works without it)
  //   opts.L            : the Leaflet global (defaults to root.L)
  //   opts.container    : element the curtain mounts into (defaults to document.body)
  //   opts.getPhotos    : () => [dd_photos records]  (called on refresh)
  //   opts.pinLayer     : optional existing L.layerGroup for pins (else one is created)
  //   opts.startMaximized, opts.tzOffsetMin, opts.title
  function mount(opts) {
    opts = opts || {};
    var doc = (typeof document !== "undefined") ? document : null;
    var win = root;
    if (!doc || !win) return noopController();               // Node / no DOM → honest no-op
    var L = opts.L || win.L || null;
    var map = opts.map || null;
    var container = opts.container || doc.body;
    if (!container) return noopController();

    injectStyle(doc);

    var tzOffsetMin = PURE.isNum(opts.tzOffsetMin) ? opts.tzOffsetMin
      : (function () { try { return -new Date().getTimezoneOffset(); } catch (e) { return 0; } })();

    /* ── build shell ─────────────────────────────────────────────────────── */
    var wrap = el(doc, "div", "ddic");
    var sheet = el(doc, "div", "ddic-sheet");
    var grip = el(doc, "div", "ddic-grip");
    var head = el(doc, "div", "ddic-head");
    var layers = el(doc, "button", "ddic-layers", "▦"); layers.type = "button";
    layers.setAttribute("aria-label", "Toggle photo pins on the map");
    var title = el(doc, "div", "ddic-title", (opts.title || "Explore") + '<span class="ddic-count"></span>');
    var toggle = el(doc, "button", "ddic-toggle", "⌄"); toggle.type = "button";
    toggle.setAttribute("aria-label", "Expand or collapse the image curtain");
    head.appendChild(grip); head.appendChild(layers); head.appendChild(title); head.appendChild(toggle);

    var sizer = el(doc, "div", "ddic-sizer");
    // ⚠️ ASSUMED: this slider sizes the on-map pins. Confirm intent (OPEN QUESTION #1).
    var range = doc.createElement("input");
    range.type = "range"; range.min = "0"; range.max = "100"; range.value = "62";  // pulled toward Big, per the reference screenshot
    range.setAttribute("aria-label", "On-map photo size, small to big");
    sizer.appendChild(el(doc, "span", null, "Small"));
    sizer.appendChild(range);
    sizer.appendChild(el(doc, "span", null, "Big"));

    var strip = el(doc, "div", "ddic-strip");
    strip.setAttribute("role", "list");

    sheet.appendChild(head); sheet.appendChild(sizer); sheet.appendChild(strip);
    wrap.appendChild(sheet);
    container.appendChild(wrap);

    var countEl = title.querySelector(".ddic-count");

    /* ── modal ───────────────────────────────────────────────────────────── */
    var modal = el(doc, "div", "ddic-modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Photo viewer");
    var mx = el(doc, "button", "ddic-x", "×"); mx.type = "button"; mx.setAttribute("aria-label", "Close");
    var mprev = el(doc, "button", "ddic-nav ddic-prev", "‹"); mprev.type = "button"; mprev.setAttribute("aria-label", "Previous photo");
    var mnext = el(doc, "button", "ddic-nav ddic-next", "›"); mnext.type = "button"; mnext.setAttribute("aria-label", "Next photo");
    var fig = el(doc, "figure");
    var fullImg = el(doc, "img", "ddic-full"); fullImg.alt = "Captured photo";
    var figCap = el(doc, "figcaption");
    fig.appendChild(fullImg); fig.appendChild(figCap);
    modal.appendChild(mx); modal.appendChild(mprev); modal.appendChild(mnext); modal.appendChild(fig);
    container.appendChild(modal);

    /* ── state ───────────────────────────────────────────────────────────── */
    var ordered = [];               // time-ordered dd_photos records currently shown
    var cardById = {};              // id → card element
    var markerById = {};            // id → { marker, cluster } (geo photos only)
    var pinLayer = opts.pinLayer || (L && map ? L.layerGroup().addTo(map) : null);
    var pinLayerOwned = !(opts.pinLayer);
    var activeId = null;
    var modalId = null;
    var pinSize = PURE.sliderToSize(+range.value, { inMin: 0, inMax: 100 });
    var destroyed = false;
    var lastFocus = null;
    var tapTimer = { last: -Infinity };   // shared double-tap state for card taps

    /* ── pin rendering (avatar family) ───────────────────────────────────── */
    function makePinIcon(url, size, count, active) {
      if (!L) return null;
      var badge = count > 1 ? '<span class="ddic-badge">' + count + '</span>' : '';
      var safe = String(url || "").replace(/"/g, "&quot;");
      return L.divIcon({
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: '<div class="ddic-pin' + (active ? ' ddic-pin-active' : '') + '" style="width:' + size + 'px;height:' + size + 'px">' +
              '<img src="' + safe + '" alt="">' + badge + '</div>'
      });
    }

    function clearMarkers() {
      Object.keys(markerById).forEach(function (id) {
        var rec = markerById[id];
        try { rec.marker.off(); if (pinLayer) pinLayer.removeLayer(rec.marker); } catch (e) {}
      });
      markerById = {};
    }

    function drawPins() {
      if (!L || !map || !pinLayer) return;
      clearMarkers();
      var split = PURE.projectPhotos(ordered);
      var clusters = PURE.clusterByProximity(split.pins);
      clusters.forEach(function (c) {
        var rep = c.items[0];
        var icon = makePinIcon(rep.url, pinSize, c.items.length, activeId === rep.id);
        var m = L.marker([c.lat, c.lng], { icon: icon, keyboard: false,
          title: c.items.length > 1 ? (c.items.length + " photos here") : "Photo" });
        m.addTo(pinLayer);
        // double-click / double-tap on a pin → modal. stop so the MAP doesn't also zoom.
        m.on("dblclick", function (ev) {
          try { if (L && L.DomEvent) L.DomEvent.stop(ev.originalEvent || ev); } catch (e) {}
          openModal(rep.id);
        });
        // single click → select + sync card (no modal — matches Google's tap-to-highlight)
        m.on("click", function () { setActive(rep.id, true); });
        markerById[rep.id] = { marker: m, cluster: c };
      });
    }

    function refreshPinSizes() {
      if (!L || !map || !pinLayer) return;
      Object.keys(markerById).forEach(function (id) {
        var rec = markerById[id];
        var rep = rec.cluster.items[0];
        rec.marker.setIcon(makePinIcon(rep.url, pinSize, rec.cluster.items.length, activeId === rep.id));
      });
    }

    /* ── filmstrip cards ─────────────────────────────────────────────────── */
    function buildCard(rec) {
      var card = el(doc, "button", "ddic-card"); card.type = "button";
      card.setAttribute("role", "listitem");
      card.setAttribute("data-id", rec.id);
      var cap = PURE.formatCaption(rec, { tzOffsetMin: tzOffsetMin });
      var img = el(doc, "img", "ddic-thumb");
      img.loading = "lazy"; img.decoding = "async"; img.alt = cap.title;
      img.src = rec.url || rec.localUrl || "";
      var capBox = el(doc, "div", "ddic-cap");
      var b = el(doc, "b"); b.textContent = cap.title;
      var s = el(doc, "span", cap.hasGeo ? null : "ddic-nogeo"); s.textContent = cap.subtitle;
      capBox.appendChild(b); capBox.appendChild(s);
      card.appendChild(img); card.appendChild(capBox);

      // single click → select + fly map to the pin; double-click/double-tap → modal.
      card.addEventListener("click", function () {
        var r = PURE.detectDoubleTap(tapTimer, Date.now(), 320);
        tapTimer = r.state;
        if (r.double) { openModal(rec.id); }
        else { setActive(rec.id, true); flyTo(rec.id); }
      });
      card.addEventListener("dblclick", function () { openModal(rec.id); });   // desktop dblclick
      return card;
    }

    function renderStrip() {
      strip.innerHTML = "";
      cardById = {};
      if (!ordered.length) {
        strip.appendChild(el(doc, "div", "ddic-empty",
          "No photos yet — snap one from the map and it lands here."));
        if (countEl) countEl.textContent = "";
        return;
      }
      ordered.forEach(function (rec) {
        var card = buildCard(rec);
        cardById[rec.id] = card;
        strip.appendChild(card);
      });
      if (countEl) {
        var split = PURE.projectPhotos(ordered);
        var geoTxt = split.noGeo.length ? (" · " + split.noGeo.length + " no-loc") : "";
        countEl.textContent = " " + ordered.length + geoTxt;
      }
    }

    /* ── selection sync (pin ⟷ card) ─────────────────────────────────────── */
    function setActive(id, scrollCardIntoView) {
      activeId = id;
      Object.keys(cardById).forEach(function (cid) {
        cardById[cid].classList.toggle("ddic-active", cid === id);
      });
      if (scrollCardIntoView && cardById[id]) {
        try { cardById[id].scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); } catch (e) {}
      }
      refreshPinSizes();   // re-tints the active pin green
    }

    function flyTo(id) {
      if (!map) return;
      var rec = markerById[id];
      if (rec) { try { map.panTo(rec.marker.getLatLng(), { animate: true }); } catch (e) {} }
    }

    /* ── modal (Esc + backdrop + × + focus trap + prev/next) ─────────────── */
    function focusables() {
      return [mprev, mnext, mx].filter(function (b) { return b && b.offsetParent !== null; });
    }
    function onKey(e) {
      if (!modal.classList.contains("ddic-open")) return;
      if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); stepModal(-1); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); stepModal(1); return; }
      if (e.key === "Tab") {                       // focus trap
        var f = focusables(); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    function paintModal() {
      var st = PURE.activeState(ordered, modalId);
      if (st.index === -1) return;
      var rec = ordered[st.index];
      var cap = PURE.formatCaption(rec, { tzOffsetMin: tzOffsetMin });
      // full image = the stored (already-compressed ≤1600px) image. dd_photos keeps ONE size,
      // so thumb and full share a src today; a distinct thumbnail is a later optimisation.
      fullImg.src = rec.url || rec.localUrl || "";
      figCap.textContent = cap.title + " — " + cap.subtitle;
      mprev.style.visibility = st.prevId ? "visible" : "hidden";
      mnext.style.visibility = st.nextId ? "visible" : "hidden";
    }
    function stepModal(dir) {
      var st = PURE.activeState(ordered, modalId);
      var nid = dir < 0 ? st.prevId : st.nextId;
      if (nid) { modalId = nid; setActive(nid, true); flyTo(nid); paintModal(); }
    }
    function openModal(id) {
      var st = PURE.activeState(ordered, id);
      if (st.index === -1) return;
      modalId = id;
      setActive(id, true);
      paintModal();
      lastFocus = doc.activeElement;
      modal.classList.add("ddic-open");
      doc.addEventListener("keydown", onKey, true);
      try { mx.focus(); } catch (e) {}
    }
    function closeModal() {
      modal.classList.remove("ddic-open");
      doc.removeEventListener("keydown", onKey, true);
      modalId = null;
      fullImg.src = "";   // release the (possibly large) image so it isn't held decoded
      try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
      lastFocus = null;
    }
    function onBackdrop(e) { if (e.target === modal) closeModal(); }
    modal.addEventListener("click", onBackdrop);
    mx.addEventListener("click", closeModal);
    mprev.addEventListener("click", function () { stepModal(-1); });
    mnext.addEventListener("click", function () { stepModal(1); });

    /* ── slider → pin size ───────────────────────────────────────────────── */
    function onRange() {
      pinSize = PURE.sliderToSize(+range.value, { inMin: 0, inMax: 100 });
      refreshPinSizes();
    }
    range.addEventListener("input", onRange);

    /* ── curtain min/max (REUSE dd_curtain_drag.js; degrade to CSS-top toggle) ── */
    var maximized = opts.startMaximized !== false;
    var curtain = null;
    function applyFallbackTop() {          // used ONLY when DDCurtainDrag is absent
      sheet.style.top = maximized ? "40vh" : "78vh";
    }
    function setMin(min) {
      maximized = !min;
      sheet.classList.toggle("ddic-min", min);
      toggle.innerHTML = min ? "⌃" : "⌄";
    }
    // CLAUDINE FIX: the layers/toggle buttons live INSIDE the drag handle. Without this, a tap
    // on a button both (a) fires its click AND (b) registers as a handle "tap" in DDCurtainDrag
    // → double-toggle = net no-op. Stop the drag from ever starting on a button press.
    function stopDragStart(e) { try { e.stopPropagation(); } catch (x) {} }
    ["pointerdown", "mousedown", "touchstart"].forEach(function (evt) {
      layers.addEventListener(evt, stopDragStart);
      toggle.addEventListener(evt, stopDragStart);
    });
    if (win.DDCurtainDrag && win.DDCurtainDrag.attach) {
      curtain = win.DDCurtainDrag.attach({
        sheet: sheet, handle: head,
        config: { peekVh: 84, midVh: 84, minTopVh: 40, maxTopVh: 90, dragClass: "ddic-drag" },
        getContentPx: function () { return sheet.scrollHeight; },
        onSettle: function (top) {
          // classify: nearer the top (smaller `top`) = maximized.
          var mid = (win.innerHeight || 0) * 0.62;
          setMin(top > mid);
        },
        onTap: function () { toggleCurtain(); }   // bare-handle tap (not a button) toggles
      });
    }
    function toggleCurtain() {
      if (curtain && curtain.snapTo) { curtain.snapTo(maximized ? "peek" : "full"); setMin(maximized); }
      else { setMin(maximized); applyFallbackTop(); }   // no drag controller → move via CSS top
    }
    toggle.addEventListener("click", toggleCurtain);

    /* ── filmstrip overflow chevrons (REUSE dd_pillscroll.js) ────────────── */
    var pill = null;
    if (win.DDPillScroll && win.DDPillScroll.attach) {
      try { pill = win.DDPillScroll.attach(strip, { step: 0.7 }); } catch (e) { pill = null; }
    }

    /* ── layers cap (placeholder toggle: pins on/off) ────────────────────── */
    var pinsShown = true;
    function onLayers() {
      pinsShown = !pinsShown;
      if (pinLayer && map) { if (pinsShown) pinLayer.addTo(map); else map.removeLayer(pinLayer); }
      layers.style.opacity = pinsShown ? "1" : ".5";
    }
    layers.addEventListener("click", onLayers);

    /* ── public refresh: pull latest photos, re-render strip + pins ──────── */
    function refresh() {
      if (destroyed) return;
      var list = [];
      try { list = opts.getPhotos ? (opts.getPhotos() || []) : []; } catch (e) { list = []; }
      ordered = PURE.orderByTime(list);
      renderStrip();
      drawPins();
      if (activeId && !PURE.activeState(ordered, activeId).id) activeId = null;
      if (pill && pill.update) pill.update();
    }

    /* ── initial paint ───────────────────────────────────────────────────── */
    setMin(!maximized);
    refresh();
    // Put the curtain at its declared start position. With the drag controller this needs
    // layout (scrollHeight), so snap on the next frame; without it, set the CSS top now.
    if (curtain && curtain.snapTo) {
      var snapInit = function () { curtain.snapTo(maximized ? "full" : "peek"); };
      if (win.requestAnimationFrame) win.requestAnimationFrame(snapInit); else win.setTimeout(snapInit, 0);
    } else {
      applyFallbackTop();
    }

    /* ── controller ──────────────────────────────────────────────────────── */
    return {
      isNoop: false,
      refresh: refresh,
      setSize: function (v) { range.value = String(v); onRange(); },
      open: toggleCurtain,
      openModal: openModal,
      closeModal: closeModal,
      getActiveId: function () { return activeId; },
      _pure: PURE,
      destroy: function () {
        if (destroyed) return; destroyed = true;
        // 1. modal + document listeners
        try { doc.removeEventListener("keydown", onKey, true); } catch (e) {}
        try { modal.removeEventListener("click", onBackdrop); } catch (e) {}
        // 2. our own control listeners
        try { range.removeEventListener("input", onRange); } catch (e) {}
        try { toggle.removeEventListener("click", toggleCurtain); } catch (e) {}
        try { layers.removeEventListener("click", onLayers); } catch (e) {}
        try {
          ["pointerdown", "mousedown", "touchstart"].forEach(function (evt) {
            layers.removeEventListener(evt, stopDragStart);
            toggle.removeEventListener(evt, stopDragStart);
          });
        } catch (e) {}
        // 3. markers + their Leaflet listeners
        clearMarkers();
        if (pinLayer && pinLayerOwned && map) { try { map.removeLayer(pinLayer); } catch (e) {} }
        // 4. sibling controllers
        try { if (curtain && curtain.destroy) curtain.destroy(); } catch (e) {}
        try { if (pill && pill.destroy) pill.destroy(); } catch (e) {}
        // 5. our own nodes
        try { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); } catch (e) {}
        try { if (modal.parentNode) modal.parentNode.removeChild(modal); } catch (e) {}
        cardById = {}; ordered = [];
      }
    };
  }

  /* ── after-walk printout: TESTABLE composition + honest render STUB ──────── */
  // renderAfterWalk(map, photos, walkPath, opts) — STUB. composeAfterWalk() gives the marker
  // set + bounds a renderer needs; the actual raster/share/print output is NOT built pending
  // Michael's call on format (OPEN QUESTION #3). Returns the composition + rendered:false so a
  // caller can NEVER mistake it for a finished image.
  function renderAfterWalk(map, photos, walkPath, opts) {
    var composed = PURE.composeAfterWalk(photos, walkPath, opts);
    return {
      composed: composed,
      rendered: false,
      stub: true,
      note: "after-walk export is a STUB — format pending review (PNG canvas like postWalk()? " +
            "share sheet? print?). composeAfterWalk() is proven + ready to feed a renderer."
    };
  }

  /* ════════════════════════════════════════════════════════════════════════════
     WIRING NOTES (post-review) — what live-wiring into musikfest.html will entail:
       1. Replace updatePhotos()/renderPhotoStrip() in musikfest.html with a single
          DDImagesCurtain.mount({ map: LMAP, getPhotos: () => window.PHOTOS, ... }) call, and
          call ctrl.refresh() where restorePhotos()/pushPhoto() currently repaint.
       2. Reconcile the existing LG_PHOTO layer (musikfest draws its own photo markers) — either
          pass pinLayer:LG_PHOTO or drop the old updatePhotos() so pins aren't double-drawn.
       3. Decide the Small⟷Big binding (OQ#1), caption source (OQ#2), after-walk format (OQ#3).
       4. Register in sw.js ASSETS (done for the module + preview) and bump CACHE (parent bumps).
     ════════════════════════════════════════════════════════════════════════════ */

  var API = {
    // pure core
    clamp: clamp, isNum: isNum, hasGeo: hasGeo,
    photoToPin: photoToPin, projectPhotos: projectPhotos, orderByTime: orderByTime,
    sliderToSize: sliderToSize, formatClock: formatClock, formatDay: formatDay,
    formatCaption: formatCaption, activeState: activeState,
    clusterByProximity: clusterByProximity, boundsOf: boundsOf,
    composeAfterWalk: composeAfterWalk, detectDoubleTap: detectDoubleTap,
    // dom
    mount: mount, renderAfterWalk: renderAfterWalk,
    _pure: PURE
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (root) root.DDImagesCurtain = API;

})(typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : this));
