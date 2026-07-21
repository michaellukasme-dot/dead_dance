/* dd_feed.js — the REAL feed / HyperPost client.
   A post written in the composer PERSISTS (dd_post_create) and everyone's feed
   reads it back (dd_feed) + gets it live (postgres_changes on dd_posts).
   Best-effort: if backend/identity isn't ready, post() rejects quietly and
   feed() resolves []. The UI keeps its seed posts so a new user never sees an
   empty/broken feed. External-network fan-out stays a human tap elsewhere. */
(function (root) {
  function client() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var u = (root.DDMe && root.DDMe.id && root.DDMe.id()); if (u) return String(u); var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }
  function myName() {
    try {
      var dm = (root.DDMe && root.DDMe.name && root.DDMe.name()); if (dm) return dm;
      if (root.ME && root.ME.name && root.ME.name !== 'You') return root.ME.name;
      var n = root.localStorage && localStorage.getItem('dd.myname'); return n || 'A head';
    } catch (e) { return 'A head'; }
  }
  function myRole() { try { return (root.DDJoin && root.DDJoin.role && root.DDJoin.role()) || (root.localStorage && localStorage.getItem('dd.role')) || null; } catch (e) { return null; } }
  function ready() { return !!(client() && myId()); }

  function post(body, opts) {
    opts = opts || {};
    var c = client(), id = myId();
    if (!c || !id) return Promise.reject('no-backend');
    var b = String(body == null ? '' : body).trim();
    if (!b) return Promise.reject('empty');
    var base = { p_author_id: id, p_author_name: myName(), p_role: myRole(),
      p_body: b, p_scope: opts.scope || 'all', p_region: opts.region || null };
    var args = opts.pinned ? Object.assign({ p_pinned: true }, base) : base;   // artist notes ride the top
    return c.rpc('dd_post_create', args).then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; })
      .catch(function (e) {
        // the pinned overload may not be migrated yet — retry UNpinned so the note still posts
        if (opts.pinned) return c.rpc('dd_post_create', base).then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
        throw e;
      });
  }

  function feed(limit) {
    var c = client(); if (!c) return Promise.resolve([]);
    return c.rpc('dd_feed', { p_limit: limit || 50 })
      .then(function (r) { return (r && r.data) || []; })
      .catch(function () { return []; });
  }

  // toggle a like on/off; resolves the true new count
  function react(postId, on, kind) {
    var c = client(), id = myId();
    if (!c || !id || !postId) return Promise.reject('no-backend');
    return c.rpc('dd_post_react', { p_post_id: postId, p_member_id: id, p_kind: kind || 'like', p_on: !!on })
      .then(function (r) { if (r && r.error) throw r.error; return Number((r && r.data) || 0); });
  }
  // { postId: { kind: count, ... } } for a batch of post ids — EVERY emotion, its own counter
  function reactCounts(ids) {
    var c = client(); if (!c || !ids || !ids.length) return Promise.resolve({});
    return c.rpc('dd_post_react_counts', { p_ids: ids })
      .then(function (r) { var out = {}; ((r && r.data) || []).forEach(function (row) {
        var p = row.post_id; (out[p] || (out[p] = {}))[row.kind] = Number(row.n || 0); }); return out; })
      .catch(function () { return {}; });
  }
  // { postId: { kind: true } } — THIS device's own reactions (so chips highlight + toggle off after reload)
  function myReactions(ids) {
    var c = client(), id = myId(); if (!c || !id || !ids || !ids.length) return Promise.resolve({});
    return c.rpc('dd_post_my_reactions', { p_ids: ids, p_member: id })
      .then(function (r) { var out = {}; ((r && r.data) || []).forEach(function (row) {
        var p = row.post_id; (out[p] || (out[p] = {}))[row.kind] = true; }); return out; })
      .catch(function () { return {}; });
  }

  // backfill: rewrite the author name on all of MY past posts (resolves rows changed)
  function renameMine(name) {
    var c = client(), id = myId(); name = String(name || '').trim();
    if (!c || !id || !name) return Promise.resolve(0);
    return c.rpc('dd_posts_rename_author', { p_author_id: id, p_new_name: name })
      .then(function (r) { if (r && r.error) return 0; return Number((r && r.data) || 0); })
      .catch(function () { return 0; });
  }

  // ---- REAL comments (dd_post_comments) ----
  function comment(postId, body) {
    var c = client(), id = myId();
    if (!c || !id || !postId) return Promise.reject('no-backend');
    var b = String(body == null ? '' : body).trim();
    if (!b) return Promise.reject('empty');
    return c.rpc('dd_comment_add', { p_post_id: String(postId), p_author_id: id, p_author_name: myName(), p_body: b })
      .then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
  }
  function comments(postId) {
    var c = client(); if (!c || !postId) return Promise.resolve([]);
    return c.rpc('dd_comments_get', { p_post_id: String(postId) })
      .then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }
  function commentCounts(ids) {
    var c = client(); if (!c || !ids || !ids.length) return Promise.resolve({});
    return c.rpc('dd_comment_counts', { p_ids: ids.map(String) })
      .then(function (r) { var o = {}; ((r && r.data) || []).forEach(function (row) { o[row.post_id] = Number(row.n || 0); }); return o; })
      .catch(function () { return {}; });
  }
  var cchan = null;
  function subscribeComments(onChange) {
    var c = client(); if (!c || cchan) return;
    try { cchan = c.channel('dd_comments_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dd_post_comments' },
        function (p) { try { onChange && onChange(p && p.new); } catch (e) {} })
      .subscribe(); } catch (e) {}
  }

  var chan = null;
  function subscribe(onChange) {
    var c = client(); if (!c || chan) return;
    try {
      chan = c.channel('dd_posts_live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dd_posts' },
          function (payload) { try { onChange && onChange(payload && payload.new); } catch (e) {} })
        .subscribe();
    } catch (e) {}
  }
  function unsubscribe() { try { if (chan) client().removeChannel(chan); } catch (e) {} chan = null; }

  // live reactions: when ANY head reacts (or un-reacts), fire onChange so the feed re-pulls true counts
  var rchan = null;
  function subscribeReactions(onChange) {
    var c = client(); if (!c || rchan) return;
    try {
      rchan = c.channel('dd_reacts_live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dd_post_reactions' },
          function (payload) { try { onChange && onChange(payload && (payload.new || payload.old)); } catch (e) {} })
        .subscribe();
    } catch (e) {}
  }

  root.DDFeed = { ready: ready, post: post, feed: feed, react: react, reactCounts: reactCounts, myReactions: myReactions, renameMine: renameMine, subscribe: subscribe, subscribeReactions: subscribeReactions, unsubscribe: unsubscribe, myName: myName, myRole: myRole, comment: comment, comments: comments, commentCounts: commentCounts, subscribeComments: subscribeComments };
})(typeof window !== 'undefined' ? window : this);
