/* dd_tixnotify.js — the standard "purchase → reminder routine" (window.DDTixNotify).
   Buy a ticket and you auto-fall into a reminder routine with TWO reminders per show:
     1) 3 days before — fires ~10:00 local that day.
     2) day-of — a distance-aware number of hours before showtime (farther = remind earlier).
   Pushes the ticket onto window.MYTIX (so it shows in My Tickets), persists an enrollment
   record to localStorage, best-effort asks for Notification permission, and fires reminders
   while the app is OPEN or when it's reopened (check-on-load + 10-min interval + precise
   setTimeout for anything due inside 24h). Distance math is 100% local — coordinates are
   NEVER sent anywhere (privacy). Never throws.

   NOTE: true BACKGROUND push while the app is CLOSED needs a server push layer
   (Supabase Edge Function + web-push + a stored PushSubscription). This client module only
   covers reminders while the app is open or reopened — the server push layer is the
   follow-up (Michael's backend). */
(function (root) {
  "use strict";
  var EKEY = "dd.tix.enrolled";   // [ {ref, band, venue, city, date, time, coords, fired:{d3,day}} ]
  var GKEY = "dd.geo.last";       // {lat,lng,at} — last local geolocation fix, cached
  var DAY = 86400000, HOUR = 3600000;
  var timers = {};                // ref+slot -> setTimeout id (so we don't double-arm)

  function load() { try { return JSON.parse(root.localStorage.getItem(EKEY) || "[]") || []; } catch (e) { return []; } }
  function save(a) { try { root.localStorage.setItem(EKEY, JSON.stringify(a || [])); } catch (e) {} }

  function refOf(show) { return String((show && (show.band || "?")) + "|" + (show && (show.date || show.iso || ""))); }

  // ----- geolocation (best-effort, cached, never blocks, never leaves the device) -----
  function lastGeo() { try { return JSON.parse(root.localStorage.getItem(GKEY) || "null"); } catch (e) { return null; } }
  function refreshGeo() {
    try {
      if (!root.navigator || !root.navigator.geolocation) return;
      root.navigator.geolocation.getCurrentPosition(function (p) {
        try { root.localStorage.setItem(GKEY, JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude, at: Date.now() })); } catch (e) {}
      }, function () {}, { enableHighAccuracy: false, maximumAge: 3600000, timeout: 8000 });
    } catch (e) {}
  }

  function haversineKm(a, b) {
    try {
      var R = 6371, toR = Math.PI / 180;
      var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
      var la1 = a.lat * toR, la2 = b.lat * toR;
      var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    } catch (e) { return null; }
  }

  // ----- time helpers -----
  function parseShowtime(date, time) {
    // returns a Date at showtime; if no time, assume 20:00 local
    try {
      var hh = 20, mm = 0;
      if (time) {
        var m = String(time).trim().match(/(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i);
        if (m) {
          hh = parseInt(m[1], 10) || 0; mm = m[2] ? parseInt(m[2], 10) : 0;
          var ap = (m[3] || "").toLowerCase();
          if (ap.indexOf("p") === 0 && hh < 12) hh += 12;
          if (ap.indexOf("a") === 0 && hh === 12) hh = 0;
        }
      }
      var d = new Date(date + "T00:00:00");
      d.setHours(hh, mm, 0, 0);
      return d;
    } catch (e) { return null; }
  }

  function leadHours(rec) {
    // distance-aware day-of lead: travel(km/72 ≈ 45mph) + 2h buffer, clamped [2,8]; default 3h.
    try {
      var here = lastGeo();
      if (rec && rec.coords && here && typeof rec.coords.lat === "number") {
        var km = haversineKm(here, rec.coords);
        if (km != null && isFinite(km)) {
          var lead = km / 72 + 2;
          return Math.max(2, Math.min(8, lead));
        }
      }
    } catch (e) {}
    return 3;
  }

  function fireTimes(rec) {
    var out = {};
    try {
      // 3-day: 10:00 local, three days before the show date
      var d3 = new Date(rec.date + "T10:00:00"); d3 = new Date(d3.getTime() - 3 * DAY);
      out.d3 = d3.getTime();
      // day-of: showtime minus distance-aware lead
      var st = parseShowtime(rec.date, rec.time);
      if (st) out.day = st.getTime() - leadHours(rec) * HOUR;
    } catch (e) {}
    return out;
  }

  // ----- firing -----
  function bodyFor(rec, slot) {
    var where = rec.venue ? (" · " + rec.venue) : "";
    if (slot === "d3") return "🎟️ " + (rec.band || "Your show") + " is in 3 days" + where + ". Plan your ride & who you're bringing. 🌹";
    var lh = Math.round(leadHours(rec));
    return "🎟️ " + (rec.band || "Your show") + " is tonight" + where + " — leave in time (about " + lh + "h to spare). See you there. 🌹";
  }
  function fire(rec, slot) {
    var title = slot === "d3" ? "3 days out 🌹" : "Showtime soon 🎟️";
    var body = bodyFor(rec, slot);
    var sent = false;
    try {
      if (root.Notification && root.Notification.permission === "granted") { new root.Notification(title, { body: body }); sent = true; }
    } catch (e) {}
    if (!sent) { try { if (root.toast) root.toast(body); } catch (e) {} }
    rec.fired = rec.fired || { d3: false, day: false };
    rec.fired[slot] = true;
  }

  function schedule(rec) {
    // arm a precise setTimeout for any reminder due within the next 24h (fires exactly on time while open)
    try {
      var now = Date.now(), t = fireTimes(rec);
      ["d3", "day"].forEach(function (slot) {
        var when = t[slot]; if (when == null) return;
        if (rec.fired && rec.fired[slot]) return;
        var dt = when - now;
        if (dt > 0 && dt <= DAY) {
          var key = rec.ref + "|" + slot;
          if (timers[key]) return;
          timers[key] = setTimeout(function () {
            try { timers[key] = null; var cur = byRef(rec.ref); if (cur && !(cur.fired && cur.fired[slot])) { fire(cur, slot); save(load2(cur)); } } catch (e) {}
          }, dt);
        }
      });
    } catch (e) {}
    return rec;
  }

  function byRef(ref) { var a = load(); for (var i = 0; i < a.length; i++) if (a[i].ref === ref) return a[i]; return null; }
  function load2(cur) { // persist a mutated record back into the stored array
    var a = load(); for (var i = 0; i < a.length; i++) if (a[i].ref === cur.ref) { a[i] = cur; return a; } a.push(cur); return a;
  }

  // ----- public: enroll a just-bought ticket -----
  function onPurchase(show) {
    try {
      show = show || {};
      // 1) push onto MYTIX so it appears in My Tickets
      try {
        if (!root.MYTIX) root.MYTIX = [];
        root.MYTIX.push({ band: show.band, venue: show.venue, city: show.city, iso: show.date || show.iso || "", date: show.date || show.iso || "", time: show.time || "" });
      } catch (e) {}

      // 2) persist an enrollment record (dedupe by ref)
      var ref = refOf(show), a = load(), rec = null;
      for (var i = 0; i < a.length; i++) if (a[i].ref === ref) { rec = a[i]; break; }
      if (!rec) {
        rec = { ref: ref, band: show.band || "", venue: show.venue || "", city: show.city || "", date: show.date || show.iso || "", time: show.time || "", coords: show.coords || null, fired: { d3: false, day: false } };
        a.push(rec);
      } else {
        // enrich in place if new info arrived
        rec.venue = rec.venue || show.venue || ""; rec.city = rec.city || show.city || "";
        rec.time = rec.time || show.time || ""; rec.coords = rec.coords || show.coords || null;
      }
      save(a);

      // 3) best-effort Notification permission + a local geo fix (never blocks)
      try { if (root.Notification && root.Notification.requestPermission && root.Notification.permission === "default") root.Notification.requestPermission(); } catch (e) {}
      refreshGeo();

      // 4) schedule its reminders
      schedule(rec);
      try { if (root.toast) root.toast("🔔 You're set — we'll remind you 3 days out and again on show day. 🌹"); } catch (e) {}
      return rec;
    } catch (e) { return null; }
  }

  // ----- public: scan + fire anything due; arm 24h timers -----
  function check() {
    try {
      var a = load(), now = Date.now(), changed = false;
      for (var i = 0; i < a.length; i++) {
        var rec = a[i]; rec.fired = rec.fired || { d3: false, day: false };
        var t = fireTimes(rec);
        ["d3", "day"].forEach(function (slot) {
          var when = t[slot]; if (when == null) return;
          if (!rec.fired[slot] && when <= now) { fire(rec, slot); changed = true; }
        });
        schedule(rec);
      }
      if (changed) save(a);
    } catch (e) {}
  }

  function list() { return load(); }

  root.DDTixNotify = { onPurchase: onPurchase, check: check, list: list, schedule: schedule };
  root.ddTicketPurchased = onPurchase;   // convenient global alias

  function boot() {
    try { refreshGeo(); } catch (e) {}
    try { check(); } catch (e) {}
    try { setInterval(check, 600000); } catch (e) {}   // 10 min
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : this);
