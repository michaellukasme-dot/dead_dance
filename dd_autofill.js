/* dd_autofill.js — the "no blank fields" layer.
   BE YOU CLAUDE: wherever a member faces a form, we pre-fill what we can honestly
   derive (a name from their email, the city we already know, the links we seeded)
   and we PRE-WRITE the prose (a band bio, a first post, a venue value prop, a
   welcome, an invite) in Rosebud's voice — then hand it over EDITABLE and SAVEABLE.
   Nothing here sends, bills, or leaves the device. It only fills a box the member
   would otherwise stare at empty, and lets them change every word.

   Exposed as window.DDAuto. Pure client, deterministic templates (no server call),
   best-effort — never throws, never blocks a form. */
(function (root) {
  'use strict';
  function LS() { try { return root.localStorage; } catch (e) { return null; } }
  function get(k) { try { var s = LS(); return s ? (s.getItem(k) || '') : ''; } catch (e) { return ''; } }
  function set(k, v) { try { var s = LS(); if (s && v != null) s.setItem(k, String(v)); } catch (e) {} return v; }
  function cap(w) { return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w; }

  /* ---- email → a human name we can suggest (they edit it) ----
     "michaellukas.me@gmail.com" -> "Michael Lukas"
     "amy.berry@x.com" -> "Amy Berry"  ·  "booking@moesalley.com" -> ""  (role box, no person) */
  var ROLEISH = /^(info|booking|bookings|contact|hello|hi|admin|office|mail|email|sales|support|team|band|music|manager|mgmt|gigs|shows|press|media|events|do-?not-?reply|noreply|no-reply|me|myself|the)$/i;
  var NOISE = /^(the|and|of|at|band|music|official|real|llc|inc|co|me|myself|mine|xoxo|the-?real)$/i;
  function nameFromEmail(email) {
    email = String(email || '').trim().toLowerCase();
    var at = email.indexOf('@'); if (at < 1) return '';
    var local = email.slice(0, at)
      .replace(/\+.*/, '')          // drop +tag
      .replace(/[0-9]+/g, ' ')      // drop digit runs
      .replace(/[._\-]+/g, ' ')     // separators -> space
      .trim();
    if (!local) return '';
    var parts = local.split(/\s+/).filter(function (w) { return w && w.length > 1 && !NOISE.test(w); });
    // a single role-ish token ("booking", "info", "me") is not a person's name
    if (parts.length === 0) return '';
    if (parts.length === 1 && ROLEISH.test(parts[0])) return '';
    // keep it sane: at most 3 tokens, each looks like a word
    parts = parts.filter(function (w) { return /^[a-z]+$/.test(w); }).slice(0, 3);
    if (!parts.length) return '';
    return parts.map(cap).join(' ');
  }
  function firstName(nameOrEmail) {
    var n = (nameOrEmail && nameOrEmail.indexOf('@') >= 0) ? nameFromEmail(nameOrEmail) : String(nameOrEmail || '');
    n = n.trim(); return n ? n.split(/\s+/)[0] : '';
  }

  /* ---- carry the email once, reuse it everywhere ---- */
  function rememberEmail(email) {
    email = String(email || '').trim();
    if (email && email.indexOf('@') > 0) {
      set('dd.email', email);
      if (!get('dd.myname')) { var n = nameFromEmail(email); if (n) set('dd.myname.suggested', n); }
    }
    return email;
  }
  function email() { return get('dd.email'); }
  function myName() {
    var n = get('dd.myname'); if (n && n.trim()) return n.trim();
    try { if (root.ME && root.ME.name && root.ME.name !== 'You') return root.ME.name; } catch (e) {}
    return '';
  }
  function city() { return get('dd.city') || get('dd.chapterCity') || ''; }

  /* ============================================================
     THE WRITER — Rosebud drafts the words so the box is never blank.
     Every draft is a starting point the member edits. Deterministic,
     voice-consistent, and honest (no invented facts beyond what's given).
     ============================================================ */
  function pick(arr, seed) { return arr[Math.abs(hash(seed || '')) % arr.length]; }
  function hash(s) { s = String(s); var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }

  function bandBio(ctx) {
    ctx = ctx || {};
    var name = (ctx.band || ctx.name || 'the band').trim();
    var where = (ctx.city ? ctx.city + (ctx.state ? ', ' + ctx.state : '') : '').trim();
    var loc = where ? ' out of ' + where : '';
    var lead = pick([
      name + ' keeps the Grateful Dead songbook alive and dancing',
      name + ' plays the Dead the way it was meant to be played — loose, live, and in the moment',
      name + ' carries the torch for the Dead'
    ], name);
    return lead + loc + '. Every show is its own thing — no two setlists the same, always room to stretch out and jam. ' +
      'Come dance, sing along, and find your people. 🌹';
  }

  function firstPost(ctx) {
    ctx = ctx || {};
    var name = (ctx.band || ctx.name || myName() || 'us').trim();
    var next = ctx.nextShow ? ('\n\n🎸 Next up: ' + ctx.nextShow) : '';
    return 'Hey folks —\n\n' +
      'We\'re on dead.dance now: the whole calendar, the merch, and every show in one place — and it comes right back here so you never miss a night. 🌹' +
      next + '\n\n📅 Calendar → %BAND_CALENDAR%\n🛍️ Store → %ARTIST_MERCH_STORE%\n\nCome dance.\n— ' + name;
  }

  function venueValueProp(ctx) {
    ctx = ctx || {};
    var v = (ctx.venue || 'your room').trim();
    var night = ctx.night || 'a slow Tuesday';
    return v + ' has the room and the taps — dead.dance brings the night. We book a Dead act from a calendar of 900+ working bands, ' +
      'write and place the show ad to the Deadheads within 50 miles, and fill ' + night + ' without you lifting a finger. ' +
      'You keep your bar; we take a small share of the ticket, never a dime of your door on the nights you already sell out. 🌹';
  }

  function memberWelcome(ctx) {
    ctx = ctx || {};
    var fn = ctx.first || firstName(myName() || email()) || 'friend';
    return 'Welcome home, ' + fn + '. 🌹 This is your family — the shows, the archive, the karaoke, and every head who ever spun down the same road. Make yourself at home.';
  }

  function inviteText(ctx) {
    ctx = ctx || {};
    var from = (ctx.from || myName() || 'a friend').trim();
    var what = ctx.band ? (' Come follow ' + ctx.band + ' with me') : ' Come find your people';
    return from + ' saved you a spot on dead.dance. 🌹' + what + ' — the shows, the archive, the karaoke, all of it. See you in there.';
  }

  var WRITERS = { bandBio: bandBio, bio: bandBio, firstPost: firstPost, post: firstPost,
    venueValueProp: venueValueProp, valueProp: venueValueProp, welcome: memberWelcome, invite: inviteText };
  function write(kind, ctx) {
    try { var fn = WRITERS[kind]; return fn ? fn(ctx || {}) : ''; } catch (e) { return ''; }
  }

  /* ============================================================
     THE FILLER — set a field's value AND fire the events the page
     already listens on (oninput/onchange), so existing save() logic
     persists it. Only fills EMPTY fields unless force:true. Everything
     stays fully editable.
     ============================================================ */
  function el(ref) {
    if (!ref) return null;
    if (typeof ref !== 'string') return ref;
    try {
      var d = root.document; if (!d) return null;
      return d.getElementById(ref) || d.querySelector(ref);
    } catch (e) { return null; }
  }
  function fire(node, type) {
    try {
      var ev; if (typeof root.Event === 'function') { ev = new root.Event(type, { bubbles: true }); }
      else { ev = root.document.createEvent('Event'); ev.initEvent(type, true, true); }
      node.dispatchEvent(ev);
    } catch (e) {}
  }
  function fillOne(ref, value, force) {
    var node = el(ref); if (!node || value == null) return false;
    var cur = ('value' in node) ? node.value : node.textContent;
    if (cur && String(cur).trim() && !force) return false;   // never clobber what a member typed
    if ('value' in node) { node.value = value; fire(node, 'input'); fire(node, 'change'); }
    else { node.textContent = value; }
    return true;
  }
  // fill({ '#name':'Amy Berry', bio:{write:'bandBio', ctx:{...}} }) — value can be a literal or a writer spec
  function fill(map, force) {
    var n = 0; if (!map) return 0;
    Object.keys(map).forEach(function (k) {
      var v = map[k];
      if (v && typeof v === 'object' && v.write) v = write(v.write, v.ctx || {});
      if (fillOne(k, v, force)) n++;
    });
    return n;
  }

  /* Convenience: from the email we have, prefill the usual suspects on THIS page.
     Only touches fields that exist and are empty. Returns the derived name. */
  function prefillFromEmail(em, opts) {
    opts = opts || {};
    em = rememberEmail(em || email());
    var nm = myName() || nameFromEmail(em) || get('dd.myname.suggested');
    var map = {};
    // common id/name conventions across the app's forms
    if (nm) { map['#ddNameIn'] = nm; map['#name'] = nm; map['#contactName'] = nm; map['#cname'] = nm; map['#yourname'] = nm; }
    if (em) { map['#email'] = em; map['#em'] = em; map['#contactEmail'] = em; map['#cemail'] = em; }
    var c = city(); if (c) { map['#city'] = c; map['#vcity'] = c; }
    if (opts.extra) Object.keys(opts.extra).forEach(function (k) { map[k] = opts.extra[k]; });
    fill(map, false);
    return nm;
  }

  root.DDAuto = {
    nameFromEmail: nameFromEmail, firstName: firstName,
    rememberEmail: rememberEmail, email: email, myName: myName, city: city,
    write: write, fill: fill, fillOne: fillOne, prefillFromEmail: prefillFromEmail
  };
})(typeof window !== 'undefined' ? window : this);
