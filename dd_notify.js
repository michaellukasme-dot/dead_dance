/* dd_notify.js — ONE notifications thread for the whole app (window.DDNotify).
   Home's bell and Friends' bell open the SAME merged list: friend requests,
   acceptances, check-ins, group follows, show alerts — every type, one backend
   (dd_notifications), realtime to the device. render() paints the identical modal
   body on any surface, so the two bells can never drift again.
   Degrades gracefully: if the backend isn't there, list()/unread() resolve empty. */
(function (root) {
  'use strict';
  function C() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var u = (root.DDMe && root.DDMe.id && root.DDMe.id()); if (u) return String(u); var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }
  function myName() { try { if (root.DDFeed && DDFeed.myName) { var n = DDFeed.myName(); if (n && n !== 'A head') return n; } if (root.DDMe && DDMe.name && DDMe.name()) return DDMe.name(); return (root.localStorage && localStorage.getItem('dd.myname')) || 'A head'; } catch (e) { return 'A head'; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ago(t) { try { var s = (Date.now() - new Date(t).getTime()) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; } catch (e) { return ''; } }
  var ICON = { friend_request: '🌹', friend_accept: '🌹', checkin: '📍', group_follow: '📡', show: '🎟️', miracle: '🍀', welcome: '🐝', generic: '🔔' };

  function add(member, p) {
    var c = C(); p = p || {}; if (!c || !member) return Promise.resolve(null);
    return c.rpc('dd_notify_add', { p_member: String(member), p_type: p.type || 'generic', p_actor_id: p.actor_id || myId(),
      p_actor_name: p.actor_name || myName(), p_title: p.title || null, p_body: p.body || null,
      p_ref: p.ref || null, p_icon: p.icon || null, p_dedupe: !!p.dedupe })
      .then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; }).catch(function () { return null; });
  }
  // client-side fan-out: notify each of MY accepted friends (e.g. "I checked in")
  function notifyFriends(p) {
    if (!(root.DDFriends && DDFriends.friends)) return Promise.resolve(0);
    return DDFriends.friends().then(function (fs) {
      var mine = myId(); var list = (fs || []).filter(function (f) { return f && f.id && String(f.id) !== String(mine); });
      return Promise.all(list.map(function (f) { return add(f.id, p); })).then(function () { return list.length; });
    }).catch(function () { return 0; });
  }
  function list(limit) { var c = C(), id = myId(); if (!c || !id) return Promise.resolve([]); return c.rpc('dd_notify_list', { p_member: id, p_limit: limit || 60 }).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; }); }
  function unread() { var c = C(), id = myId(); if (!c || !id) return Promise.resolve(0); return c.rpc('dd_notify_unread', { p_member: id }).then(function (r) { return Number((r && r.data) || 0); }).catch(function () { return 0; }); }
  function markRead() { var c = C(), id = myId(); if (!c || !id) return Promise.resolve(0); return c.rpc('dd_notify_mark_read', { p_member: id }).then(function (r) { return Number((r && r.data) || 0); }).catch(function () { return 0; }); }

  var chan = null;
  function subscribe(cb) { var c = C(), id = myId(); if (!c || !id || chan) return;
    try { chan = c.channel('dd_notif_live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dd_notifications' },
      function (p) { try { var n = p && p.new; if (n && String(n.member_id) === String(id)) cb && cb(n); } catch (e) {} }).subscribe(); } catch (e) {} }

  // ONE render, used by every surface's modal → the two bells can't drift.
  function rowHTML(n) {
    var ic = n.icon || ICON[n.type] || '🔔';
    var av = '<span class="ddn-ic">' + esc(ic) + '</span>';
    var when = '<i class="ddn-t">' + ago(n.created_at) + '</i>';
    var text = (n.title ? ('<b>' + esc(n.title) + '</b> ') : '') + esc(n.body || '') + when;
    if (n.type === 'friend_request' && !n.read_at) {
      return '<div class="ddn-row" data-id="' + esc(n.id) + '">' + av + '<div class="ddn-b">' + text +
        '<div class="ddn-acts"><button class="ddn-yes" onclick="DDNotify._accept(this,\'' + esc(n.ref || '') + '\',\'' + esc((n.actor_id || '')) + '\',\'' + esc((n.actor_name || '').replace(/\x27/g, '')) + '\')">✓ Accept</button>' +
        '<button class="ddn-no" onclick="DDNotify._decline(this,\'' + esc(n.ref || '') + '\')">Decline</button></div></div></div>';
    }
    return '<div class="ddn-row" data-id="' + esc(n.id) + '">' + av + '<div class="ddn-b">' + text + '</div></div>';
  }
  function injectCss() { if (document.getElementById('ddn-css')) return; var s = document.createElement('style'); s.id = 'ddn-css';
    s.textContent = '.ddn-row{display:flex;gap:11px;padding:11px 4px;border-bottom:1px solid #efeaf4;align-items:flex-start}'
      + '.ddn-ic{width:42px;height:42px;border-radius:50%;flex:none;background:linear-gradient(135deg,#7a3cc0,#3a1f57);color:#fff;display:flex;align-items:center;justify-content:center;font-size:19px}'
      + '.ddn-b{flex:1;font-size:13.5px;color:#1a1320;line-height:1.4}.ddn-b b{font-weight:800}'
      + '.ddn-t{display:block;color:#9a93a8;font-size:11px;font-style:normal;font-weight:600;margin-top:2px}'
      + '.ddn-acts{display:flex;gap:8px;margin-top:7px}'
      + '.ddn-yes{border:0;background:#2a8a4a;color:#fff;font-weight:800;font-size:12.5px;border-radius:9px;padding:7px 12px;cursor:pointer}'
      + '.ddn-no{border:0;background:#efeaf4;color:#5a2e86;font-weight:800;font-size:12.5px;border-radius:9px;padding:7px 12px;cursor:pointer}'
      + '.ddn-empty{color:#9a93a8;text-align:center;padding:26px 12px;font-size:13.5px}';
    document.head.appendChild(s); }
  function render(host) {
    if (typeof host === 'string') host = document.getElementById(host); if (!host) return;
    injectCss(); host.innerHTML = '<div class="ddn-empty">Loading…</div>';
    list(60).then(function (rows) {
      host.innerHTML = (rows && rows.length) ? rows.map(rowHTML).join('') : '<div class="ddn-empty">No notifications yet 🌹</div>';
    });
    try { markRead().then(function () { paintBadges(); }); } catch (e) {}   // opening clears the badge
  }
  // accept/decline a friend request straight from the row (uses DDFriends), then log the acceptance back
  function _accept(btn, reqId, actorId, actorName) {
    if (!(root.DDFriends && DDFriends.respond)) return;
    DDFriends.respond(reqId, true).then(function () {
      try { if (actorId) add(actorId, { type: 'friend_accept', title: myName(), body: 'and you are family now 🌹', ref: myId(), icon: '🌹' }); } catch (e) {}
      var row = btn.closest('.ddn-row'); if (row) row.querySelector('.ddn-b').innerHTML = '<b>' + esc(actorName || 'You') + '</b> and you are family now — say hi in the feed! 🎸';
      if (root.toast) toast('🌹 You and ' + (actorName || 'them') + ' are family now.');
    }).catch(function () { if (root.toast) toast('Could not accept — try again'); });
  }
  function _decline(btn, reqId) {
    if (!(root.DDFriends && DDFriends.respond)) return;
    DDFriends.respond(reqId, false).then(function () { var row = btn.closest('.ddn-row'); if (row) row.querySelector('.ddn-b').innerHTML = 'Request dismissed.'; }).catch(function () {});
  }

  // paint every bell badge on the page (Home top bell, Friends top bell, bottom Alerts) from the ONE count
  function paintBadges() {
    unread().then(function (n) {
      ['topNotifBadge', 'notifBadge', 'alertsNavBadge', 'topNotifBadgeMock'].forEach(function (idv) {
        var el = document.getElementById(idv); if (!el) return;
        if (n > 0) { el.textContent = n; el.style.display = (el.tagName === 'SPAN') ? 'grid' : 'flex'; } else { el.style.display = 'none'; }
      });
    });
  }

  root.DDNotify = { add: add, notifyFriends: notifyFriends, list: list, unread: unread, markRead: markRead,
    subscribe: subscribe, render: render, paintBadges: paintBadges, _accept: _accept, _decline: _decline };
  try { paintBadges(); subscribe(function () { paintBadges(); }); } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
