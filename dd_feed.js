/* dd_feed.js — the REAL feed / HyperPost client.
   A post written in the composer PERSISTS (dd_post_create) and everyone's feed
   reads it back (dd_feed) + gets it live (postgres_changes on dd_posts).
   Best-effort: if backend/identity isn't ready, post() rejects quietly and
   feed() resolves []. The UI keeps its seed posts so a new user never sees an
   empty/broken feed. External-network fan-out stays a human tap elsewhere. */
(function (root) {
  function client() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }
  function myName() {
    try {
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
    return c.rpc('dd_post_create', {
      p_author_id: id, p_author_name: myName(), p_role: myRole(),
      p_body: b, p_scope: opts.scope || 'all', p_region: opts.region || null
    }).then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
  }

  function feed(limit) {
    var c = client(); if (!c) return Promise.resolve([]);
    return c.rpc('dd_feed', { p_limit: limit || 50 })
      .then(function (r) { return (r && r.data) || []; })
      .catch(function () { return []; });
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

  root.DDFeed = { ready: ready, post: post, feed: feed, subscribe: subscribe, unsubscribe: unsubscribe, myName: myName, myRole: myRole };
})(typeof window !== 'undefined' ? window : this);
