/* dd_me.js — THE SPINE (robust). One account, server-persisted, follows you across devices.
   No shortcuts: the account key is the AUTHENTICATED user (Supabase auth.uid()), never a
   client-passed id. Row-Level Security (dd_profile.sql) enforces that you can read/write ONLY
   your own row; your email stays private; other people can see only your name + avatar.

   This is what makes DeadDance behave like Facebook instead of a static page: sign in once with
   the magic link (a real Supabase auth session that persists across reloads and restarts), and
   your name, email, photo, chapter — your whole "you" — hydrate from the server on every open and
   write through on every change. Nothing lives loose on a single device.

   API (window.DDMe):
     signedIn() -> bool          id() -> auth uid or null      ready() -> bool (hydrated yet)
     name()/email()/avatar()/get(field)
     set(field,value) -> Promise (RLS-authenticated write-through + local cache + notify)
     load() -> Promise<me>       onChange(fn)   signIn()   signOut()
     publicProfile(uid) -> Promise<{uid,name,avatar_url}>   // safe fields of ANOTHER account
*/
(function (w) {
  "use strict";
  var CACHE = "dd.me.cache";
  var me = null, loaded = false, subs = [];

  function client() { try { return w.ddClient && w.ddClient(); } catch (e) { return null; } }
  function cache() { try { return JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (e) { return null; } }
  function save(m) { try { localStorage.setItem(CACHE, JSON.stringify(m || {})); } catch (e) {} }
  function notify() { for (var i = 0; i < subs.length; i++) { try { subs[i](me); } catch (e) {} } }

  function authUser() {
    var c = client(); if (!c || !c.auth || !c.auth.getUser) return Promise.resolve(null);
    return c.auth.getUser().then(function (r) { return (r && r.data && r.data.user) || null; }).catch(function () { return null; });
  }

  // hydrate from the server profile of the CURRENTLY authenticated user (RLS returns only your row)
  function hydrate() {
    me = cache(); notify();
    var c = client(); if (!c) { loaded = true; return Promise.resolve(me); }
    return authUser().then(function (u) {
      if (!u) { me = null; save({}); loaded = true; notify(); return null; }          // signed out
      var uid = u.id, email = u.email || "";
      return c.from("dd_profile").select("*").eq("uid", uid).maybeSingle().then(function (r) {
        var row = (r && r.data) || null;
        me = { uid: uid, email: email };
        if (row) { me.name = row.name || ""; me.email = row.email || email; me.avatar = row.avatar_url || ""; me.chapter = row.chapter || ""; me.role = row.role || ""; me.home = row.home || ""; }
        if (!row) {                                                                     // first sign-in on this account → seed the row
          var localName = ""; try { localName = localStorage.getItem("dd.myname") || ""; } catch (e) {}
          me.name = me.name || localName;
          c.from("dd_profile").upsert({ uid: uid, email: email, name: me.name || null }).then(function () {}, function () {});
        }
        save(me); loaded = true; notify(); return me;
      }).catch(function () { me = { uid: uid, email: email }; save(me); loaded = true; notify(); return me; });
    });
  }

  // write-through: instant local update + notify, then an RLS-authenticated upsert of just this field
  function set(field, val) {
    if (!me) me = cache() || {};
    me[field] = val; save(me); notify();
    var c = client(); if (!c) return Promise.resolve(me);
    return authUser().then(function (u) {
      if (!u) return me;
      var patch = { uid: u.id }; patch[field === "avatar" ? "avatar_url" : field] = val;
      return c.from("dd_profile").upsert(patch).then(function () { return me; }, function () { return me; });
    });
  }

  w.DDMe = {
    signedIn: function () { return !!(me && me.uid); },
    id: function () { return (me && me.uid) || null; },
    ready: function () { return loaded; },
    get: function (f) { return (me || cache() || {})[f]; },
    name: function () { return (me || cache() || {}).name || ""; },
    email: function () { return (me || cache() || {}).email || ""; },
    avatar: function () { return (me || cache() || {}).avatar || ""; },
    set: set,
    load: hydrate,
    onChange: function (fn) { if (typeof fn === "function") { subs.push(fn); if (loaded) try { fn(me); } catch (e) {} } },
    signIn: function () { try { if (w.LukasChat && LukasChat.open) LukasChat.open(); } catch (e) {} },
    signOut: function () { var c = client(); if (c && c.auth) c.auth.signOut().then(function () { me = null; save({}); notify(); }); },
    publicProfile: function (uid) {   // safe fields of another account (name + avatar only; never email)
      var c = client(); if (!c || !uid) return Promise.resolve(null);
      return c.rpc("dd_public_profile", { p_uid: uid }).then(function (r) { return (r && r.data && r.data[0]) || null; }).catch(function () { return null; });
    }
  };

  // hydrate on load, and re-hydrate whenever the auth session changes (sign in / out, another tab)
  try { if (document.readyState !== "loading") hydrate(); else document.addEventListener("DOMContentLoaded", hydrate); } catch (e) {}
  try { var c0 = client(); if (c0 && c0.auth && c0.auth.onAuthStateChange) c0.auth.onAuthStateChange(function () { setTimeout(hydrate, 200); }); } catch (e) {}
})(window);
