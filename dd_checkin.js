/* dd_checkin.js — "Check In" in the user's OWN voice, then SELF-POST.
   The generic FB check-in ("X is at Y") is the same words for everyone. This isn't:
   each line is written in the member's voice (leans on DDHyper's learned voice samples),
   varied every time (tap ↻ for another), and the member always presses SEND themselves.

   SEND does two things (the launch spec):
     1) writes to the DD feed  (DDFeed.post — the DD post)
     2) DEFAULT MULTI-NETWORK HYPERPOST — differentiated per network:
          images present → the SPREAD (DDHyper.spread → DDSpread)
          else           → the one text (DDHyper.post)
   Reusable: any event page can call DDCheckin.open({name, band, venue}). */
(function (root) {
  'use strict';
  function _me() {
    try {
      if (root.ME && root.ME.name && root.ME.name !== 'You') return root.ME.name;
      if (root.DDMe && root.DDMe.name && root.DDMe.name()) return root.DDMe.name();
      var p = JSON.parse((root.localStorage && localStorage.getItem('dd.profile')) || '{}');
      return p.name || 'A head';
    } catch (e) { return 'A head'; }
  }
  // echo the member's own emoji habit (from the voice they've been teaching HyperPost); default the rose
  function _voiceEmoji() {
    try {
      var v = (root.DDHyper && root.DDHyper.voice && root.DDHyper.voice()) || { samples: [] };
      var joined = (v.samples || []).join(' ');
      var pool = ['🌹', '🔥', '🎶', '💀', '🐻', '✨', '🙌', '🎸', '☮️', '🌈'];
      var best = '🌹', bestN = 0;
      pool.forEach(function (e) { var n = joined.split(e).length - 1; if (n > bestN) { bestN = n; best = e; } });
      return best;
    } catch (e) { return '🌹'; }
  }
  function _pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function _myId() { try { var u = (root.DDMe && root.DDMe.id && root.DDMe.id()); if (u) return String(u); var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }

  // the line — varied phrasing, in the member's voice, band optional
  function line(ctx) {
    ctx = ctx || {};
    var name = ctx.name || _me(), band = (ctx.band || '').trim(), venue = (ctx.venue || '').trim(), emo = _voiceEmoji();
    var withBand = [
      name + ' is jamming with ' + band + ' at ' + venue,
      name + ' is dancing to ' + band + ' at ' + venue,
      name + ' is locked in on ' + band + ' — ' + venue,
      name + ' is grooving to ' + band + ' at ' + venue,
      name + ' posted up for ' + band + ' at ' + venue,
      name + ' is out here with ' + band + ' at ' + venue,
      band + ' is on at ' + venue + ' and ' + name + ' is right in it',
      name + ' caught ' + band + ' at ' + venue
    ];
    var noBand = [
      name + ' is live at ' + venue,
      name + ' just rolled into ' + venue,
      name + ' is soaking up the scene at ' + venue,
      name + ' is on the ground at ' + venue
    ];
    var tails = ['', '', ' — come find me', " — the family's here", ' — who else is here?', ' — what a set'];
    var base = (band && venue) ? _pick(withBand) : (venue ? _pick(noBand) : (name + ' is checking in'));
    return (base + _pick(tails) + ' ' + emo).replace(/\s+/g, ' ').trim();
  }

  // the SEND: DD feed + default multi-network HyperPost (spread if images, else the one)
  function send(text, images, opts) {
    opts = opts || {};
    text = (text || '').trim(); if (!text) return false;
    try {
      if (opts.group && root.DDFeed && DDFeed.groupPost) DDFeed.groupPost(opts.group, text); // 1a) festival check-ins land in that group's thread (e.g. the DD Musikfest group)
      else if (root.DDFeed && DDFeed.post) DDFeed.post(text);                                // 1b) otherwise the general DD feed
    } catch (e) {}
    try {
      if (images && images.length && root.DDHyper && DDHyper.spread) DDHyper.spread(images, text); // 2a) SPREAD (differentiated per network)
      else if (root.DDHyper && DDHyper.post) DDHyper.post(text);                            // 2b) the one, fanned to the networks
    } catch (e) {}
    try { if (root.DDHyper && DDHyper.learn) DDHyper.learn(text); } catch (e) {}            // 3) the voice learns
    return true;
  }

  var _imgs = [];
  function open(ctx) {
    ctx = ctx || {}; _imgs = [];
    var old = document.getElementById('ddCheckinOv'); if (old) old.remove();
    var ov = document.createElement('div'); ov.id = 'ddCheckinOv';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483300;background:rgba(20,12,30,.55);display:flex;align-items:flex-end;justify-content:center;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    var venueLbl = ctx.venue ? (' · ' + ctx.venue) : '';
    ov.innerHTML =
      '<div style="background:#fff;width:100%;max-width:560px;border-radius:20px 20px 0 0;box-shadow:0 -12px 44px #0006;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px))">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
          '<b style="font-size:16px;color:#1a1320">📍 Check in' + venueLbl.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</b>' +
          '<button id="ciX" aria-label="Close" style="border:0;background:#f2ecfb;color:#5a2e86;width:32px;height:32px;border-radius:9px;font-size:18px;cursor:pointer">×</button></div>' +
        '<div style="font-size:11.5px;color:#7a7285;margin-bottom:7px">Your words — edit it, or tap ↻ for another. Nothing sends until you press Check in.</div>' +
        '<textarea id="ciText" rows="3" style="width:100%;box-sizing:border-box;border:1px solid #e2dcec;border-radius:13px;padding:11px 12px;font:inherit;font-size:15px;color:#1a1320;resize:vertical"></textarea>' +
        '<div id="ciImgs" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:11px">' +
          '<button id="ciRe" style="border:1px solid #e2dcec;background:#faf7ff;color:#5a2e86;font-weight:800;font-size:13px;border-radius:11px;padding:11px 13px;cursor:pointer">↻ Rephrase</button>' +
          '<button id="ciPhoto" style="border:1px solid #e2dcec;background:#faf7ff;color:#5a2e86;font-weight:800;font-size:13px;border-radius:11px;padding:11px 13px;cursor:pointer">📷 Photo</button>' +
          '<button id="ciSend" style="flex:1;border:0;background:linear-gradient(135deg,#7a3cc0,#b8002e);color:#fff;font-weight:800;font-size:15px;border-radius:12px;padding:12px;cursor:pointer">🌹 Check in &amp; post</button>' +
        '</div>' +
        '<div style="font-size:11px;color:#9a93a8;text-align:center;margin-top:8px">Posts to your DeadDance feed + fans out to your networks — the spread if you add photos, else the one.</div>' +
        '<div id="ciDruc" style="text-align:center;margin-top:9px;font-size:12px"></div>' +
        '<input type="file" id="ciFile" accept="image/*" multiple style="display:none">' +
      '</div>';
    document.body.appendChild(ov);
    var ta = ov.querySelector('#ciText'); ta.value = line(ctx);
    function paintDruc() {
      var host = ov.querySelector('#ciDruc'); if (!host) return; var d = druc();
      if (d.on) host.innerHTML = '<span style="color:#1f8a4d;font-weight:800">✓ Auto-posting your check-ins to your networks</span> · <a id="ciDrucOff" style="color:#7a3cc0;font-weight:800;cursor:pointer;text-decoration:underline">turn off</a>';
      else host.innerHTML = '<a id="ciDrucOn" style="color:#7a3cc0;font-weight:800;cursor:pointer;text-decoration:underline">＋ Auto-post my future check-ins (set up once)</a>';
      var on = ov.querySelector('#ciDrucOn'); if (on) on.onclick = function () { drucScreen(paintDruc); };
      var off = ov.querySelector('#ciDrucOff'); if (off) off.onclick = function () { revokeDruc(); paintDruc(); if (root.toast) toast('Auto-posting off. 🌹'); };
    }
    paintDruc();
    function close() { ov.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('#ciX').onclick = close;
    ov.querySelector('#ciRe').onclick = function () { ta.value = line(ctx); ta.focus(); };
    ov.querySelector('#ciPhoto').onclick = function () { ov.querySelector('#ciFile').click(); };
    ov.querySelector('#ciFile').onchange = function () {
      var fs = this.files; if (!fs || !fs.length) return; var strip = ov.querySelector('#ciImgs');
      [].forEach.call(fs, function (f) {
        if (!/^image\//.test(f.type)) return; var im = new Image();
        im.onload = function () { _imgs.push(im); var t = document.createElement('img'); t.src = im.src; t.style.cssText = 'height:44px;border-radius:8px'; strip.appendChild(t); };
        im.src = URL.createObjectURL(f);
      });
    };
    ov.querySelector('#ciSend').onclick = function () {
      var txt = (ta.value || '').trim();
      if (!txt) { if (root.toast) toast('Say a couple words first 🌹'); return; }
      if (root.DDFeed && DDFeed.ready && !DDFeed.ready()) { if (root.toast) toast('Sign in to check in 🌹'); return; }
      send(txt, _imgs, { group: ctx.group });
      close();
      if (root.toast) toast(ctx.group ? '📍 Checked in — posted to the Musikfest group 🌹' : '📍 Checked in — on your feed and your networks 🌹');
    };
    setTimeout(function () { try { ta.focus(); } catch (e) {} }, 60);
  }

  // ===== DRUC — Default Recurring User Consent (the "recurring charge"-grade approval) =====
  // Ongoing/automatic fan-out to a member's networks is STANDING authority — it needs an
  // affirmative, double-opt-in, revocable, logged mandate. A single check-in the member taps
  // is one-time (the tap IS the consent). DRUC only governs the AUTOMATIC default.
  var DRUC_VER = '2026-07-21';
  function druc() { try { return JSON.parse((root.localStorage && localStorage.getItem('dd.druc.autopost')) || '{"on":false,"nets":[]}'); } catch (e) { return { on: false, nets: [] }; } }
  function setDruc(nets) {
    var m = { on: true, nets: nets || [], ts: new Date().toISOString(), ver: DRUC_VER };
    try { localStorage.setItem('dd.druc.autopost', JSON.stringify(m)); } catch (e) {}
    // logged mandate (DRUC element #6): record it in the server Authorization Center (dd_druc.sql)
    try { var id = _myId(); if (id && root.ddClient && root.ddClient()) root.ddClient().rpc('dd_druc_grant', { p_member_id: id, p_scope: 'checkin_autopost', p_nets: (nets || []).join(','), p_ver: DRUC_VER }).catch(function () {}); } catch (e) {}
    return m;
  }
  function revokeDruc() { try { localStorage.setItem('dd.druc.autopost', JSON.stringify({ on: false, nets: [] })); } catch (e) {}
    try { var id = _myId(); if (id && root.ddClient && root.ddClient()) root.ddClient().rpc('dd_druc_revoke', { p_member_id: id, p_scope: 'checkin_autopost' }).catch(function () {}); } catch (e) {} }

  // the one honest screen (from STANDING_authorization_consent_standard.md): boxes OFF by default, one confirm.
  function drucScreen(onGranted) {
    var old = document.getElementById('ddDrucOv'); if (old) old.remove();
    var nets = [{ id: 'facebook', n: 'Facebook' }, { id: 'instagram', n: 'Instagram' }, { id: 'x', n: 'X' }, { id: 'tiktok', n: 'TikTok' }, { id: 'email', n: 'Email' }];
    var ov = document.createElement('div'); ov.id = 'ddDrucOv';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483350;background:rgba(20,12,30,.6);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    ov.innerHTML =
      '<div style="background:#fff;width:100%;max-width:420px;border-radius:18px;box-shadow:0 20px 60px #0007;padding:18px">' +
        '<div style="font-size:17px;font-weight:800;color:#1a1320">🌹 Auto-post my check-ins?</div>' +
        '<div style="font-size:13px;color:#4a4356;line-height:1.5;margin:8px 0 12px">We’ll share <b>each check-in you make</b> to the networks you pick — credited to you, in your voice. It keeps going until you switch it off. Off anytime, one tap.</div>' +
        '<div id="drucNets" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">' +
          nets.map(function (x) { return '<label style="display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700;color:#1a1320;cursor:pointer"><input type="checkbox" value="' + x.id + '" style="width:18px;height:18px"> ' + x.n + '</label>'; }).join('') +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<button id="drucGo" style="flex:1;border:0;background:linear-gradient(135deg,#7a3cc0,#b8002e);color:#fff;font-weight:800;font-size:15px;border-radius:12px;padding:12px;cursor:pointer">Turn it on</button>' +
          '<button id="drucNo" style="border:0;background:#f2ecfb;color:#5a2e86;font-weight:800;font-size:14px;border-radius:12px;padding:12px 14px;cursor:pointer">Not now</button>' +
        '</div>' +
        '<div style="font-size:11px;color:#9a93a8;text-align:center;margin-top:9px">Off anytime — it lives in your profile’s Authorization Center. Like a subscription: on only when you say so.</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector('#drucNo').onclick = function () { ov.remove(); };
    ov.querySelector('#drucGo').onclick = function () {
      var picked = [].slice.call(ov.querySelectorAll('#drucNets input:checked')).map(function (i) { return i.value; });
      if (!picked.length) { if (root.toast) toast('Pick at least one network 🌹'); return; }
      setDruc(picked); ov.remove(); if (root.toast) toast('✓ Auto-posting on — off anytime in your profile 🌹'); if (onGranted) onGranted();
    };
  }

  // AUTOMATIC path (the recurring-approved default): only fires if DRUC is on; else falls back to the manual modal.
  function autoCheckin(ctx) {
    var d = druc();
    if (!d.on) { open(ctx); return; }                 // no standing consent → the member taps it themselves
    var txt = line(ctx); var cancelled = false;
    if (root.toast) toast('📍 Auto-checking you in: “' + txt.slice(0, 44) + '…” — tap to undo 🌹');
    var t = setTimeout(function () { if (!cancelled) send(txt, null, { group: ctx.group }); }, 4200);   // soft-send with an undo window
    try { var el = document.querySelector('.dd-toast, #mfToast'); if (el) el.onclick = function () { cancelled = true; clearTimeout(t); if (root.toast) toast('Undone — not posted.'); }; } catch (e) {}
  }

  root.DDCheckin = { line: line, open: open, send: send, druc: druc, setDruc: setDruc, revokeDruc: revokeDruc, drucScreen: drucScreen, autoCheckin: autoCheckin };
})(typeof window !== 'undefined' ? window : this);
