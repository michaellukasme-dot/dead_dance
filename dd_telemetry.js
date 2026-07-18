/* dd_telemetry.js — the firehose to PAPA BEAR, built to SERVICE THE BIG. Bulletproof:
   • DURABLE: every event is queued in localStorage first — nothing is lost if offline / the tab dies.
   • BATCHED: events debounce and flush in batches (one RPC per ~100 events), so a 100k-phone
     festival never becomes 100k round-trips. Distributed load, no chokepoint.
   • IDEMPOTENT: each event carries a client-generated eid; the server dedups on it, so retries
     (offline→online, failed flush) can never double-count.
   • SELF-HEALING: retries on failure, drains on 'online' and on tab-hide.
   Anonymized: a per-device pseudonym only. No name, no lat/lng, no stored path.

   API (window.DDTele): event(kind,district,ref,meta) · gate · reach · toast · redeem · content · flush()
*/
(function (w) {
  if (w.DDTele) return;
  var QK = "dd.tele.q", MAX = 2000, BATCH = 100;   // festival-scale buffer
  function client() { try { return w.ddClient && w.ddClient(); } catch (e) { return null; } }
  function uid() { try { return (w.crypto && crypto.randomUUID) ? crypto.randomUUID() : ("e-" + Date.now() + Math.random().toString(36).slice(2)); } catch (e) { return "e-" + Date.now(); } }
  function token() {
    try {
      if (typeof w.mfToken === "function") return w.mfToken();
      var k = "dd.tele.tok", v = localStorage.getItem(k);
      if (!v) { v = "t-" + uid(); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return "anon"; }
  }
  function q() { try { return JSON.parse(localStorage.getItem(QK) || "[]"); } catch (e) { return []; } }
  function setQ(a) { try { localStorage.setItem(QK, JSON.stringify(a.slice(-MAX))); } catch (e) {} }

  var _last = {}, flushing = false, _t = null;
  function throttled(sig, ms) { var t = Date.now(); if (_last[sig] && t - _last[sig] < (ms || 3000)) return true; _last[sig] = t; return false; }
  function schedule() { if (_t) return; _t = setTimeout(function () { _t = null; flush(); }, 1500); }   // debounce → batch
  function enqueue(ev) { var a = q(); a.push(ev); setQ(a); schedule(); }

  var _fails = {};
  function drop(batch) { var s = {}; batch.forEach(function (e) { if (e && e.eid) s[e.eid] = 1; }); setQ(q().filter(function (x) { return !(x && x.eid && s[x.eid]); })); }  // remove EXACTLY the sent eids → cross-tab safe (no blind slice)
  function flush() {
    if (flushing) return;
    var a = q(); if (!a.length) return;
    var c = client(); if (!c || !c.rpc) return;
    flushing = true;
    var batch = a.slice(0, BATCH), head = (batch[0] && batch[0].eid) || "b";
    var p = c.rpc("dd_event_batch", { p_events: batch });
    if (!p || !p.then) { flushing = false; return; }
    p.then(function (r) {
      flushing = false;
      if (r && r.error) {                                // server rejected — maybe a poison batch
        _fails[head] = (_fails[head] || 0) + 1;
        if (_fails[head] >= 3) { drop(batch); delete _fails[head]; schedule(); }   // give up on a bad batch — never wedge the whole queue
        return;
      }
      delete _fails[head];
      drop(batch);                                       // success → remove the sent eids
      if (q().length) schedule();
    }, function () { flushing = false; });               // network fail → stays queued, retried on 'online'/hide
  }

  var API = {
    event: function (kind, district, ref, meta) {
      try {
        if (throttled(kind + "|" + (district || "") + "|" + (ref || ""), 3000)) return;   // district-aware throttle (same act, different districts ≠ collapsed)
        enqueue({ eid: uid(), token: token(), kind: String(kind || ""), district: String(district || ""),
          ref: (ref == null ? null : String(ref)), meta: (meta || null), ts: new Date().toISOString() });
      } catch (e) {}
    },
    gate:    function (d, ref)          { API.event("gate", d, ref || "entry"); },
    reach:   function (d, shop)         { API.event("reach", d, shop); },
    toast:   function (d, shop)         { API.event("toast", d, shop); },
    redeem:  function (d, shop, coupon) { API.event("redeem", d, shop, coupon ? { coupon: coupon } : null); },
    content: function (d, kind)         { API.event("content", d, kind || "post"); },
    flush:   flush
  };
  w.DDTele = API;

  // self-healing drains
  try { w.addEventListener("online", flush); } catch (e) {}
  try { document.addEventListener("visibilitychange", function () { if (document.hidden) flush(); }); } catch (e) {}
  try { if (document.readyState !== "loading") flush(); else document.addEventListener("DOMContentLoaded", flush); } catch (e) {}
})(window);
