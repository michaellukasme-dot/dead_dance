/* dd_friends.js — real-time friend system client.
   Talks to Supabase via the app's existing ddClient() + ddId() (LukasChat identity),
   using the dd_friend_* RPCs (see 00_Admin/read_side/dd_friends.sql). Realtime updates
   arrive through a postgres_changes subscription filtered to this user.
   Everything is best-effort: if the backend/identity isn't ready, calls resolve empty
   so the UI can fall back to its demo state — nothing throws. A human still clicks Accept. */
(function (root) {
  function client() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }
  function myName() { try { return (root.ME && root.ME.name && root.ME.name !== 'You') ? root.ME.name : 'A friend'; } catch (e) { return 'A friend'; } }
  function ready() { return !!(client() && myId()); }

  function send(toId, toName) {
    var c = client(), id = myId();
    if (!c || !id) return Promise.reject('no-backend');
    return c.rpc('dd_friend_send', { p_from_id: id, p_from_name: myName(), p_to_id: String(toId), p_to_name: toName || null })
      .then(function (r) { if (r && r.error) throw r.error; return r && r.data; });
  }
  function respond(reqId, accept) {
    var c = client(), id = myId();
    if (!c || !id) return Promise.reject('no-backend');
    return c.rpc('dd_friend_respond', { p_req_id: reqId, p_to_id: id, p_accept: !!accept })
      .then(function (r) { if (r && r.error) throw r.error; return r && r.data; });
  }
  function incoming() {
    var c = client(), id = myId();
    if (!c || !id) return Promise.resolve([]);
    return c.rpc('dd_friends_incoming', { p_to_id: id }).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }
  function friends() {
    var c = client(), id = myId();
    if (!c || !id) return Promise.resolve([]);
    return c.rpc('dd_friends_list', { p_id: id }).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }

  var chan = null;
  function subscribe(onChange) {
    var c = client(), id = myId();
    if (!c || !id || chan) return;
    try {
      chan = c.channel('dd_friends_' + id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dd_friend_requests', filter: 'to_id=eq.' + id }, function () { try { onChange && onChange('incoming'); } catch (e) {} })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dd_friend_requests', filter: 'from_id=eq.' + id }, function () { try { onChange && onChange('outgoing'); } catch (e) {} })
        .subscribe();
    } catch (e) {}
  }
  function unsubscribe() { try { if (chan) { client().removeChannel(chan); } } catch (e) {} chan = null; }

  root.DDFriends = { ready: ready, myId: myId, myName: myName, send: send, respond: respond, incoming: incoming, friends: friends, subscribe: subscribe, unsubscribe: unsubscribe };
})(typeof window !== 'undefined' ? window : this);
