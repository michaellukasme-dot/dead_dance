/* dd_notify_schedule.js — DeadDance PHASE 4 reminder BRAIN (pure logic + guarded runtime)
   ============================================================================
   HONEST STATUS (House Law, first lines):
     • The PURE logic here (fire-time math from a show/setlist model, lead-time
       config, quiet-hours guard, past-time skip, stable-id dedupe, and the
       cancel/reschedule DIFF a scheduler runs when a show changes) is deterministic
       and Node-tested — see dd_native/dd_notify_schedule.test.js.
     • NOTHING here proves an on-device notification actually fired. The one runtime
       function that talks to the OS (`applyPlan`) is a GUARDED hand-off to
       DDShell.localNotifications (@capacitor/local-notifications). In a plain browser
       DDShell.isNative() is false → it NO-OPS and reports { native:false } honestly.
       Real "it buzzed my phone at 8:50" is a DEVICE test on Michael's Mac.
     • This module NEVER sends a remote push. On-device scheduled reminders (doors,
       "band on in 10", set-break-over) are LOCAL notifications that fire OFFLINE with
       NO server. REMOTE push (APNs/FCM) is only for things the server must trigger
       LIVE (a schedule change, "band on NOW") — that path is dd_push_client.js +
       functions/send_push, and it is a SKELETON (501 until keys set).

   WHY LOCAL, NOT REMOTE, FOR SCHEDULED REMINDERS: a fan at a festival is often in a
   dead zone. A reminder that depends on a live push would silently never arrive. So
   the known, time-based reminders are scheduled ON the device up front and fire with
   no radio. The server is reserved for genuinely-live changes it alone knows.

   EXPORTS: module.exports (Node) AND window.DDNotifySchedule (browser) — dual, guarded.
   No I/O, no globals mutated, no network in the pure core. The shell is INJECTED.
   ============================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") { if (!window.DDNotifySchedule) window.DDNotifySchedule = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ==========================================================================
  // 0. CONFIG — lead times (minutes) and quiet-hours. All tune-able defaults.
  // ==========================================================================
  var DEFAULT_LEADS = {
    doors: 30,       // "Doors in 30"
    bandOn: 10,      // "BAND on in 10"
    breakOver: 5     // "Set break's ending"
  };
  // Quiet hours default OFF (null). When set, {start,end} are LOCAL hours [0..24);
  // start<end is a same-day window, start>end wraps midnight (e.g. 23→8).
  var DEFAULT_QUIET = null;

  // ==========================================================================
  // 1. TIME HELPERS — deterministic. ISO → ms; local-hour extraction with an
  //    explicit tz offset so tests are not host-timezone dependent.
  // ==========================================================================
  function toMs(v) {
    if (v == null) return NaN;
    if (typeof v === "number") return isFinite(v) ? v : NaN;
    var t = Date.parse(String(v));
    return isNaN(t) ? NaN : t;
  }
  // fractional local hour at ms, given tzOffsetMinutes (minutes to ADD to UTC).
  // tz 0 → treat the instant as UTC (what the tests use with 'Z' ISO strings).
  function localHourAt(ms, tzOffsetMinutes) {
    var d = new Date(ms + (tzOffsetMinutes || 0) * 60000);
    return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  }
  function inQuietHours(ms, quiet, tzOffsetMinutes) {
    if (!quiet || quiet.start == null || quiet.end == null) return false;
    var h = localHourAt(ms, tzOffsetMinutes);
    var s = +quiet.start, e = +quiet.end;
    if (s === e) return false;                 // zero-length window = disabled
    if (s < e) return h >= s && h < e;         // same-day window
    return h >= s || h < e;                    // wraps midnight
  }

  // ==========================================================================
  // 2. STABLE IDS — the dedupe/reschedule backbone. The id is derived from the
  //    show + reminder KIND + target key ONLY (never the fire time), so a moved
  //    set time keeps the SAME id: the scheduler cancels the old fire and
  //    schedules the new one, instead of leaking a duplicate.
  // ==========================================================================
  function stableId(showId, kind, targetKey) {
    return "dd.notif|" + String(showId == null ? "?" : showId) +
           "|" + String(kind) + "|" + String(targetKey == null ? "-" : targetKey);
  }
  // Capacitor LocalNotifications needs an INTEGER id. Derive a stable 31-bit
  // positive int from the string id (djb2). Same string → same int (idempotent).
  function numericId(strId) {
    var h = 5381, s = String(strId);
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 2147483647;
  }

  // ==========================================================================
  // 3. SHOW MODEL → RAW REMINDERS. Reuses the show/setlist time model (a show
  //    has a doors time, and one-or-more bands each with a set START; optional
  //    set-BREAK end times). We do NOT reinvent setlist timing — a caller can
  //    feed DDSetlist.schedule() output or a plain model. Fields accepted:
  //      show.id / show.showId / show.slug         → stable show id
  //      show.venue / show.venueName               → copy for the body
  //      show.doorsISO / show.doorsAt / show.doors → doors instant
  //      show.bands: [ { key|slug, name, stage|stageName, setStartISO|setStart } ]
  //      show.breaks: [ { key, band, overISO|endISO } ]   (optional)
  //    A single-band show may put name/setStartISO at the top level.
  //   Returns [{ id, numId, kind, targetKey, fireAtMs, targetMs, leadMin,
  //              title, body, refId }] BEFORE any filtering.
  // ==========================================================================
  function showIdOf(show) {
    return show && (show.id != null ? show.id : (show.showId != null ? show.showId : (show.slug != null ? show.slug : "show")));
  }
  function bandsOf(show) {
    if (show && Array.isArray(show.bands) && show.bands.length) return show.bands;
    // single-band shorthand
    if (show && (show.setStartISO || show.setStart || show.name)) {
      return [{ key: show.bandKey || show.slug || "band", name: show.name, stage: show.stage || show.stageName, setStartISO: show.setStartISO || show.setStart }];
    }
    return [];
  }
  function fmtLead(min) {
    min = Math.max(0, Math.round(min));
    if (min === 0) return "now";
    if (min < 60) return "in " + min;
    var h = Math.floor(min / 60), m = min % 60;
    return "in " + h + "h" + (m ? " " + m + "m" : "");
  }

  function computeReminders(show, opts) {
    opts = opts || {};
    var leads = {};
    for (var k in DEFAULT_LEADS) leads[k] = DEFAULT_LEADS[k];
    if (opts.leads) for (var lk in opts.leads) if (opts.leads[lk] != null) leads[lk] = +opts.leads[lk];

    var out = [];
    var sid = showIdOf(show);
    var venue = (show && (show.venue || show.venueName)) || null;

    // --- doors ----------------------------------------------------------------
    var doorsMs = toMs(show && (show.doorsISO || show.doorsAt || show.doors));
    if (!isNaN(doorsMs)) {
      var leadD = leads.doors;
      var fire = doorsMs - leadD * 60000;
      out.push({
        id: stableId(sid, "doors", "doors"),
        numId: numericId(stableId(sid, "doors", "doors")),
        kind: "doors", targetKey: "doors",
        fireAtMs: fire, targetMs: doorsMs, leadMin: leadD,
        title: "🚪 Doors " + fmtLead(leadD),
        body: (venue ? venue + " — " : "") + "doors open soon. Head over.",
        refId: sid
      });
    }

    // --- band on --------------------------------------------------------------
    bandsOf(show).forEach(function (b) {
      var key = b.key || b.slug || b.name || "band";
      var setMs = toMs(b.setStartISO || b.setStart);
      if (isNaN(setMs)) return;
      var leadB = (b.leadMin != null ? +b.leadMin : leads.bandOn);
      var name = b.name || "Your band";
      var stage = b.stage || b.stageName;
      out.push({
        id: stableId(sid, "band_on", key),
        numId: numericId(stableId(sid, "band_on", key)),
        kind: "band_on", targetKey: key,
        fireAtMs: setMs - leadB * 60000, targetMs: setMs, leadMin: leadB,
        title: "🎸 " + name + " on " + fmtLead(leadB),
        body: name + (stage ? " hits " + stage : " on") + " soon. Don't miss the opener.",
        refId: sid, band: key
      });
    });

    // --- set-break over -------------------------------------------------------
    (show && Array.isArray(show.breaks) ? show.breaks : []).forEach(function (br, i) {
      var overMs = toMs(br.overISO || br.endISO || br.over);
      if (isNaN(overMs)) return;
      var key = br.key || br.band || ("break" + i);
      var leadO = (br.leadMin != null ? +br.leadMin : leads.breakOver);
      out.push({
        id: stableId(sid, "break_over", key),
        numId: numericId(stableId(sid, "break_over", key)),
        kind: "break_over", targetKey: key,
        fireAtMs: overMs - leadO * 60000, targetMs: overMs, leadMin: leadO,
        title: "⏳ Set break's ending",
        body: (br.band ? br.band + " " : "The band ") + "back on " + fmtLead(leadO) + ". Get back to the rail.",
        refId: sid, band: br.band || null
      });
    });

    return out;
  }

  // ==========================================================================
  // 4. FILTER — past-time skip + quiet-hours guard. PURE. Returns the keepers
  //    plus a skipped[] with reasons (so the caller/tests can see WHY).
  //    Past = fireAt <= nowMs (already gone → never schedule a stale buzz).
  //    Quiet = fire lands inside quiet hours. Default: SKIP (don't wake people).
  //      opts.deferToQuietEnd → instead shift the fire to the quiet-window end
  //      (only if that is still BEFORE the target event; else skip).
  //      A reminder carrying quietExempt:true bypasses the quiet guard.
  // ==========================================================================
  function quietEndMs(fireMs, quiet, tz) {
    // next instant at hour == quiet.end (local), on/after fireMs.
    var d = new Date(fireMs + (tz || 0) * 60000);
    var target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Math.floor(quiet.end), Math.round((quiet.end % 1) * 60), 0));
    var endMs = target.getTime() - (tz || 0) * 60000;
    if (endMs <= fireMs) endMs += 24 * 3600000;  // roll to next day if already past
    return endMs;
  }
  function filterReminders(list, opts) {
    opts = opts || {};
    var nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
    var quiet = opts.quietHours !== undefined ? opts.quietHours : DEFAULT_QUIET;
    var tz = opts.tzOffsetMinutes || 0;
    var kept = [], skipped = [];
    (list || []).forEach(function (r) {
      var fire = r.fireAtMs;
      if (!(fire > nowMs)) { skipped.push({ id: r.id, reason: "past" }); return; }
      if (!r.quietExempt && inQuietHours(fire, quiet, tz)) {
        if (opts.deferToQuietEnd && quiet) {
          var shifted = quietEndMs(fire, quiet, tz);
          if (shifted < r.targetMs && shifted > nowMs) {
            var rr = clone(r); rr.fireAtMs = shifted; rr.deferred = true; kept.push(rr); return;
          }
        }
        skipped.push({ id: r.id, reason: "quiet" }); return;
      }
      kept.push(r);
    });
    return { scheduled: kept, skipped: skipped };
  }
  function clone(o) { var c = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k]; return c; }

  // ==========================================================================
  // 5. DEDUPE — collapse to one reminder per stable id (the id already encodes
  //    uniqueness). Guards against a caller that fed the same band twice.
  // ==========================================================================
  function dedupe(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (r) {
      if (seen[r.id]) return;   // never schedule the same reminder twice
      seen[r.id] = true; out.push(r);
    });
    return out;
  }

  // Convenience: full pure pipeline show → the reminders to schedule NOW.
  function planReminders(show, opts) {
    var raw = dedupe(computeReminders(show, opts));
    return filterReminders(raw, opts);
  }

  // ==========================================================================
  // 6. SCHEDULER — stateful DIFF engine for cancel/reschedule on show change.
  //    Holds the DESIRED set (id → fireAtMs). plan(show) returns the delta vs the
  //    last plan: which ids to schedule (new OR moved), which to cancel (gone OR
  //    moved-so-cancel-old-first), which are unchanged. This is what makes
  //    "the set time slipped 20 min" cancel the old buzz and set the new one,
  //    with NO duplicate. Stateful, but does no I/O (that is applyPlan).
  // ==========================================================================
  function createScheduler(opts) {
    opts = opts || {};
    var current = {};   // id → { fireAtMs, numId }

    function plan(show, callOpts) {
      var merged = mergeOpts(opts, callOpts);
      var res = planReminders(show, merged);
      var desiredList = res.scheduled;
      var desired = {};
      desiredList.forEach(function (r) { desired[r.id] = r; });

      var toSchedule = [], toCancel = [], unchanged = [];
      // new or moved
      desiredList.forEach(function (r) {
        var cur = current[r.id];
        if (!cur) { toSchedule.push(r); }
        else if (cur.fireAtMs !== r.fireAtMs) { toCancel.push({ id: r.id, numId: cur.numId }); toSchedule.push(r); }
        else { unchanged.push(r); }
      });
      // gone
      Object.keys(current).forEach(function (id) {
        if (!desired[id]) toCancel.push({ id: id, numId: current[id].numId });
      });

      // commit desired as the new current
      current = {};
      desiredList.forEach(function (r) { current[r.id] = { fireAtMs: r.fireAtMs, numId: r.numId }; });

      return { schedule: toSchedule, cancel: toCancel, unchanged: unchanged, skipped: res.skipped };
    }
    function scheduled() { return Object.keys(current); }
    function reset() { current = {}; }
    return { plan: plan, scheduled: scheduled, reset: reset, _current: function () { return current; } };
  }
  function mergeOpts(a, b) {
    var o = {}, k;
    for (k in (a || {})) o[k] = a[k];
    for (k in (b || {})) if (b[k] !== undefined) o[k] = b[k];
    return o;
  }

  // ==========================================================================
  // 7. RUNTIME HAND-OFF (GUARDED) — turn a plan into real OS calls via DDShell.
  //  This is the ONLY impure function. In a browser DDShell.isNative() is false
  //  → it no-ops and returns { native:false } HONESTLY (no fake "scheduled").
  //  The shell is INJECTED (arg), never imported, so the core stays pure/testable.
  //  Returns Promise<{ scheduled, cancelled, native }>.
  // ==========================================================================
  function toCapacitorNotification(r) {
    // shape @capacitor/local-notifications expects; schedule.at is a Date.
    return {
      id: r.numId,
      title: r.title,
      body: r.body,
      schedule: { at: new Date(r.fireAtMs), allowWhileIdle: true },
      extra: { ddId: r.id, kind: r.kind, refId: r.refId || null, band: r.band || null }
    };
  }
  function applyPlan(plan, shell) {
    plan = plan || {};
    shell = shell || (typeof window !== "undefined" ? window.DDShell : null);
    var ln = shell && shell.localNotifications;
    var native = !!(shell && typeof shell.isNative === "function" && shell.isNative());
    if (!ln || !native) {
      // honest no-op: nothing was scheduled on any OS here.
      return Promise.resolve({ scheduled: 0, cancelled: 0, native: false });
    }
    var cancelIds = (plan.cancel || []).map(function (c) { return c.numId; });
    var notifs = (plan.schedule || []).map(toCapacitorNotification);
    return Promise.resolve()
      .then(function () { return (cancelIds.length && ln.cancel) ? ln.cancel(cancelIds) : null; })
      .then(function () { return (notifs.length && ln.schedule) ? ln.schedule(notifs) : { scheduled: 0, native: native }; })
      .then(function (res) {
        return { scheduled: (res && res.scheduled != null) ? res.scheduled : notifs.length, cancelled: cancelIds.length, native: native };
      })
      .catch(function () { return { scheduled: 0, cancelled: 0, native: native, error: true }; });
  }

  return {
    // config
    DEFAULT_LEADS: DEFAULT_LEADS,
    // time helpers
    toMs: toMs, localHourAt: localHourAt, inQuietHours: inQuietHours,
    // ids
    stableId: stableId, numericId: numericId,
    // pure pipeline
    computeReminders: computeReminders,
    filterReminders: filterReminders,
    dedupe: dedupe,
    planReminders: planReminders,
    // scheduler + runtime
    createScheduler: createScheduler,
    toCapacitorNotification: toCapacitorNotification,
    applyPlan: applyPlan
  };
});
