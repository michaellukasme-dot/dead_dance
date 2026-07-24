/* dd_ava.js — real avatars EVERYWHERE. One resolver, painted into every social
   surface (posts, comments, group threads, DMs, chat, friends, PYMK, rail, stories).
   Half-wired avatars are a liability; this closes the gap.

   HOW: any avatar element that renders a placeholder initial also carries
   data-ava="<uid>" (and optionally data-ava-url="<known url>"). A MutationObserver
   batch-resolves those uids via the dd_profiles RPC (cached in memory + localStorage)
   and swaps in the real <img>. Self resolves instantly via DDMe.avatar().
   Never throws; the initial stays as the honest fallback. */
(function (w) {
  "use strict";
  var LS = "dd.ava.v1";
  var mem = {};            // uid -> url ('' = known-none)
  try { var o = JSON.parse(localStorage.getItem(LS) || "{}"); if (o && typeof o === "object") mem = o; } catch (e) {}
  var inflight = {};       // uid -> true while a batch is resolving it
  var saveT = null;

  function client() { try { return (w.ddClient && ddClient()) || null; } catch (e) { return null; } }
  function myId() { try { return (w.DDMe && DDMe.id && DDMe.id()) || null; } catch (e) { return null; } }
  function myAva() { try { var a = (w.DDMe && DDMe.avatar && DDMe.avatar()) || ""; if (a) return a;
    return localStorage.getItem("dd.me.img") || localStorage.getItem("dd.profile.img") || ""; } catch (e) { return ""; } }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function persist() { if (saveT) return; saveT = setTimeout(function () { saveT = null; try { localStorage.setItem(LS, JSON.stringify(mem)); } catch (e) {} }, 400); }

  function known(uid) {
    if (!uid) return "";
    if (myId() && String(uid) === String(myId())) return myAva();
    return mem[uid] || "";
  }

  // resolve a set of uids → fills cache, returns Promise
  function resolve(uids) {
    var c = client(); if (!c) return Promise.resolve();
    var need = [];
    (uids || []).forEach(function (u) {
      if (!u) return; u = String(u);
      if (myId() && u === String(myId())) return;               // self is instant
      if (mem.hasOwnProperty(u) || inflight[u]) return;          // cached or in progress
      inflight[u] = true; need.push(u);
    });
    if (!need.length) return Promise.resolve();
    return c.rpc("dd_profiles", { p_uids: need }).then(function (r) {
      var rows = (r && r.data) || [];
      var got = {};
      rows.forEach(function (row) { if (row && row.uid) { mem[row.uid] = row.avatar_url || ""; got[row.uid] = 1; } });
      need.forEach(function (u) { if (!got[u]) mem[u] = ""; delete inflight[u]; });   // negative-cache misses
      persist();
    }).catch(function () { need.forEach(function (u) { delete inflight[u]; }); });
  }

  function imgHTML(url) { return '<img src="' + esc(url) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block">'; }

  // paint every un-painted [data-ava] under root (default: document)
  function paint(root) {
    root = root || document;
    var els; try { els = root.querySelectorAll ? root.querySelectorAll("[data-ava]:not([data-ava-done])") : []; } catch (e) { return; }
    if (!els || !els.length) return;
    var pending = [];
    Array.prototype.forEach.call(els, function (el) {
      var uid = el.getAttribute("data-ava") || "";
      var url = el.getAttribute("data-ava-url") || known(uid);
      if (url) { el.innerHTML = imgHTML(url); el.style.background = "#fff"; el.setAttribute("data-ava-done", "1"); }
      else if (uid && !mem.hasOwnProperty(uid) && !(myId() && String(uid) === String(myId()))) pending.push(uid);
      else if (uid) el.setAttribute("data-ava-done", "1");   // self-not-ready or known-none → keep initial, stop re-checking
    });
    if (pending.length) resolve(pending).then(function () {
      Array.prototype.forEach.call((root.querySelectorAll ? root.querySelectorAll("[data-ava]:not([data-ava-done])") : []), function (el) {
        var uid = el.getAttribute("data-ava") || ""; var url = known(uid);
        if (url) { el.innerHTML = imgHTML(url); el.style.background = "#fff"; }
        el.setAttribute("data-ava-done", "1");   // resolved (even to none) — don't re-check
      });
    });
  }

  // a ready-to-drop avatar element string: initial now, real image when painted
  function chip(uid, name, cls, extraStyle) {
    var initial = esc((String(name || "?").charAt(0) || "🌹").toUpperCase());
    var u = known(uid), attr = uid ? ' data-ava="' + esc(uid) + '"' : "";
    if (u) return '<div class="' + esc(cls || "av") + '"' + (extraStyle ? ' style="' + extraStyle + ';background:#fff"' : ' style="background:#fff"') + ' data-ava-done="1">' + imgHTML(u) + "</div>";
    return '<div class="' + esc(cls || "av") + '"' + (extraStyle ? ' style="' + extraStyle + '"' : "") + attr + ">" + initial + "</div>";
  }

  w.DDAva = { url: known, resolve: resolve, paint: paint, chip: chip };

  // auto-paint: debounced, on any DOM change (new posts/comments/messages get faces)
  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; try { paint(document); } catch (e) {} }, 120); }
  if (document.readyState !== "loading") schedule(); else document.addEventListener("DOMContentLoaded", schedule);
  try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  // repaint when my own avatar loads: clear the "done" flag on my chips so they re-resolve
  try { if (w.DDMe && DDMe.onChange) DDMe.onChange(function () {
    try { var me = myId(); if (me) Array.prototype.forEach.call(document.querySelectorAll('[data-ava="' + me + '"][data-ava-done]'), function (el) { if (!el.querySelector("img")) el.removeAttribute("data-ava-done"); }); } catch (e) {}
    schedule();
  }); } catch (e) {}
})(window);
