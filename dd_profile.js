/* dd_profile.js — DeadDance "capture once, reuse forever" profile + autofill layer.
   Principle: any user (fan, band, venue, dealer, promoter, operator, CRM contact) enters a
   field ONCE; it pre-fills every form on every surface from then on. The user only ever
   EDITS and CONFIRMS — never re-enters.

   LEGAL by construction:
     • Only WHITELISTED public / business fields are ever captured or reused.
     • A SENSITIVE blocklist (cards, CVC, bank/routing/acct, SSN/EIN/tax, passwords, secrets,
       tokens, gov IDs, DOB, home address, phone-by-default) is NEVER stored, NEVER pre-filled —
       even if a form contains such a field. Financial data lives in Stripe (tokenized); we never touch it.
     • One-tap forget(): export/erase. Auth is OAuth-only (no passwords).

   Pure client + optional Supabase sync (feature-detected, keyed to auth id, non-blocking).
   Exposed as window.DDProfile. Never throws — a bad form can't break a page. */
(function (root) {
  "use strict";
  var KEY = "dd.profile";

  function LS() { try { return root.localStorage; } catch (e) { return null; } }
  function load() { try { var s = LS(); return s ? (JSON.parse(s.getItem(KEY) || "{}") || {}) : {}; } catch (e) { return {}; } }
  function persist(o) { try { var s = LS(); if (s) s.setItem(KEY, JSON.stringify(o || {})); } catch (e) {} }
  var STORE = load();

  /* ---- 1. WHITELIST: public / business fields only (canonical -> aliases) ---- */
  var CANON = {
    name:      ["name","fullname","yourname","displayname","contactname"],
    email:     ["email","emailaddress","youremail","contactemail"],
    handle:    ["handle","username","displayhandle","screenname"],
    band:      ["band","bandname","actname","artistname","act","artist"],
    venue:     ["venue","venuename","roomname","room"],
    city:      ["city","town"],
    region:    ["region","chapter","area","scene"],
    hometown:  ["hometown","basedin","homebase"],
    bio:       ["bio","about","description","story","blurb"],
    genre:     ["genre","style","sound"],
    website:   ["website","url","weburl","site","homepage","link"],
    instagram: ["instagram","ig","instagramhandle"],
    facebook:  ["facebook","fb","facebookpage"],
    tiktok:    ["tiktok"],
    youtube:   ["youtube","yt","channel"],
    spotify:   ["spotify"],
    bandcamp:  ["bandcamp"],
    booking:   ["booking","bookingemail","bookings","bookingcontact"],
    capacity:  ["capacity","cap","seats","roomcap"]
  };
  var ALIAS = {}; Object.keys(CANON).forEach(function (k) { ALIAS[k] = k; CANON[k].forEach(function (a) { ALIAS[a] = k; }); });

  /* ---- 2. SENSITIVE blocklist: never store, never pre-fill (defense in depth) ---- */
  var SENSITIVE = /(card|creditcard|\bcc\b|ccnum|cardnum|cvc|cvv|cvn|securitycode|expiry|\bexp\b|\bssn\b|socialsecurity|\bein\b|taxid|\btax\b|routing|accountnumber|\bacct\b|bankaccount|\biban\b|swift|password|passwd|\bpwd\b|secret|apikey|\btoken\b|passport|drivers?licen|govid|\bdob\b|birthdate|dateofbirth|homeaddress|streetaddress|\bphone\b|mobile|\bcell\b|\btel\b)/;

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }              // stripped — for exact ALIAS lookup
  // "worded" keeps real boundaries (splits camelCase + delimiters → spaces) so the SENSITIVE \b anchors
  // actually fire. "cardNumber"→"card number", "cc-number"→"cc number", while "hotel"/"experience" stay intact.
  function worded(s) { return String(s || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function isSensitive(raw) { return SENSITIVE.test(worded(raw)); }
  function canonOf(el) {
    var raw = el.getAttribute("data-profile") || el.name || el.id || el.getAttribute("autocomplete") || "";
    var n = norm(raw);
    if (!n) return null;
    if (isSensitive(raw)) return "__SENSITIVE__";
    return ALIAS[n] || null;
  }

  /* ---- 3. API ---- */
  function get(k) { return STORE[k] != null ? STORE[k] : ""; }
  function set(k, v) {
    if (!k || k === "__SENSITIVE__" || SENSITIVE.test(norm(k))) return; // hard stop
    if (!ALIAS[k]) return;                                              // only whitelisted keys
    v = (v == null ? "" : String(v)).slice(0, 4000);
    if (!v) return;
    if (STORE[k] === v) return;
    STORE[k] = v; persist(STORE); syncUp();
  }
  function all() { var o = {}; Object.keys(STORE).forEach(function (k) { o[k] = STORE[k]; }); return o; }
  function forget() { STORE = {}; persist(STORE); try { var s = LS(); if (s) s.removeItem(KEY); } catch (e) {} syncUp(true); }

  /* ---- 4. Seed the core from what we already know (OAuth / DDAuto) ---- */
  function seed() {
    try {
      if (root.DDAuto) {
        if (!STORE.email && DDAuto.email && DDAuto.email()) set("email", DDAuto.email());
        if (!STORE.name && DDAuto.myName && DDAuto.myName()) set("name", DDAuto.myName());
        if (!STORE.city && DDAuto.city && DDAuto.city()) set("city", DDAuto.city());
      }
      if (root.ME && ME.name && ME.name !== "You" && !STORE.name) set("name", ME.name);
      if (root.ME && ME.chapter && !STORE.region) set("region", ME.chapter);
    } catch (e) {}
  }

  /* ---- 5. Bind: pre-fill empty fields, write back on edit. Edit + Confirm is the whole UX. ---- */
  function bind(rootEl) {
    try {
      rootEl = rootEl || document;
      var els = rootEl.querySelectorAll("input, textarea, select");
      for (var i = 0; i < els.length; i++) {
        var el = els[i], t = (el.type || "").toLowerCase();
        if (["password","hidden","file","submit","button","checkbox","radio","range","color","image","reset"].indexOf(t) >= 0) continue;
        if (el.getAttribute("data-noprofile") != null) continue;
        if (el._ddp) continue;
        var c = canonOf(el);
        if (!c || c === "__SENSITIVE__") continue;     // unknown or sensitive → hands off
        el._ddp = c;
        // pre-fill only if empty, and mark it so the user knows to confirm/edit
        var v = get(c);
        if (v && !el.value) { el.value = v; el.classList.add("dd-prefill"); el.title = "Pre-filled from your DeadDance profile — edit to change 🌹"; }
        (function (node, key) {
          node.addEventListener("input", function () { node.classList.remove("dd-prefill"); });
          var saveIt = function () { set(key, node.value); };
          node.addEventListener("change", saveIt);
          node.addEventListener("blur", saveIt);
        })(el, c);
      }
    } catch (e) {}
  }

  /* ---- 6. Optional durable sync — Supabase row keyed to auth id, RLS-guarded, non-blocking.
     No-ops silently if the client/table aren't there. Public fields only (STORE already is). ---- */
  var _syncT = null;
  function ddClient() { try { return (root.ddClient && root.ddClient()) || null; } catch (e) { return null; } }
  function authId() { try { return (root.ddId && root.ddId()) || null; } catch (e) { return null; } }
  function syncUp(clearing) {
    try {
      var c = ddClient(), id = authId(); if (!c || !id) return;
      if (_syncT) clearTimeout(_syncT);
      _syncT = setTimeout(function () {
        try { c.from("profiles").upsert({ id: id, data: clearing ? {} : STORE, updated_at: new Date().toISOString() }).then(function () {}, function () {}); } catch (e) {}
      }, 800);
    } catch (e) {}
  }
  function syncDown() {
    try {
      var c = ddClient(), id = authId(); if (!c || !id) return;
      c.from("profiles").select("data").eq("id", id).maybeSingle().then(function (r) {
        try {
          var d = r && r.data && r.data.data; if (!d) return;
          var changed = false;
          Object.keys(d).forEach(function (k) { if (ALIAS[k] && !SENSITIVE.test(norm(k)) && d[k] && STORE[k] == null) { STORE[k] = String(d[k]); changed = true; } });
          if (changed) { persist(STORE); bind(document); }
        } catch (e) {}
      }, function () {});
    } catch (e) {}
  }

  /* ---- 7. Subtle style for pre-filled fields (inject once) ---- */
  function css() { try {
    if (document.getElementById("ddp-style")) return;
    var s = document.createElement("style"); s.id = "ddp-style";
    s.textContent = ".dd-prefill{box-shadow:inset 3px 0 0 #b8002e88;background-image:linear-gradient(90deg,#b8002e0f,transparent 14px)}";
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {} }

  root.DDProfile = { get: get, set: set, all: all, seed: seed, bind: bind, forget: forget, sync: function () { syncUp(); syncDown(); } };

  function boot() { css(); seed(); bind(document); syncDown(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : this);
