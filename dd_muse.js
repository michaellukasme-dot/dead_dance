/* dd_muse.js — the Claude mark in every text box. Tap it and the words flow in your
   OWN voice (Sonnet via dd-compose), learned on-device from your past posts (dd.voice —
   the blank slate DDHyper already keeps). Nothing is ever sent for you: the draft lands
   editable in your box. Your words stay yours. */
(function (w) {
  "use strict";

  // ---- voice samples (the blank slate DDHyper learns into) ----
  function getSamples() {
    try { var v = JSON.parse(localStorage.getItem("dd.voice") || '{"samples":[]}'); return (v.samples || []).slice(0, 12); }
    catch (e) { return []; }
  }
  function nowSong() {
    try { var t = document.getElementById("npT"); var s = t ? t.textContent.replace(/^🎵\s*/, "").trim() : ""; return s && !/Tap|ambient/i.test(s) ? s : ""; }
    catch (e) { return ""; }
  }

  // ---- which boxes get the mark, and the context we hand the writer ----
  function kindOf(box) {
    var id = box.id || "";
    if (id === "composeText") return "post";
    if (id === "groupComposeInput") return "group";
    if (id === "ddm-input") return "dm";
    if (box.classList && box.classList.contains("cinput")) return "comment";
    return "";
  }
  function ctxOf(box) {
    var kind = kindOf(box), context = {};
    try {
      if (kind === "post") { var s = nowSong(); if (s) context.song = s; }
      else if (kind === "group") { context.group = (w._curGroupName || ""); }
      else if (kind === "dm") { var t = document.getElementById("ddm-title"); context.to = (t && t.textContent) || ""; }
      else if (kind === "comment") { var post = box.closest && box.closest(".post"); var body = post && post.querySelector(".body"); context.post = ((body && body.textContent) || "").slice(0, 300); }
    } catch (e) {}
    return { kind: kind, context: context };
  }

  // ---- the write call: Sonnet in your voice, with an honest heuristic fallback ----
  function fallback() { try { if (w.DDHyper && DDHyper.draft) return DDHyper.draft(); } catch (e) {} return "The bus is rolling and the family’s all here. 🌹 Who else is on this one?"; }
  function compose(box) {
    var meta = ctxOf(box), c = (w.ddClient && ddClient());
    if (c && c.functions && c.functions.invoke) {
      return c.functions.invoke("dd-compose", { body: { kind: meta.kind, context: meta.context, samples: getSamples() } })
        .then(function (r) { if (r && r.error) throw r.error; var d = r && r.data; var t = (d && (d.text || d.body)) || ""; if (!t) throw "empty"; return t; })
        .catch(function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  // ---- the "flow": type the draft in, character by character ----
  function typewriter(box, text, cb) {
    var i = 0; box.value = "";
    (function step() {
      if (i >= text.length) { try { box.focus(); } catch (e) {} if (cb) cb(); return; }
      box.value += text.slice(i, i + 2); i += 2;
      try { box.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
      try { box.scrollTop = box.scrollHeight; } catch (e) {}
      setTimeout(step, 14);
    })();
  }
  function flow(box, mark) {
    if (box.__flowing) return; box.__flowing = true;
    mark.classList.add("busy");
    var prev = box.value, prevPh = box.placeholder || "";
    box.value = ""; box.placeholder = "letting the words flow…";
    function done() { box.__flowing = false; mark.classList.remove("busy"); box.placeholder = prevPh; }
    compose(box).then(function (text) {
      text = String(text || "").trim();
      if (!text) { box.value = prev; done(); return; }
      typewriter(box, text, done);
    }).catch(function () { box.value = prev; done(); });
  }

  // ---- inject the mark inside each box (wrap so it can sit at the edge) ----
  function css() {
    if (document.getElementById("muse-css")) return;
    var s = document.createElement("style"); s.id = "muse-css";
    s.textContent =
      ".muse-wrap{position:relative;flex:1;display:flex;min-width:0}" +
      ".muse-wrap.ta{display:block;flex:none;width:100%}" +
      ".muse-wrap>input,.muse-wrap>textarea{flex:1;min-width:0}" +
      ".muse-wrap.ta>textarea{width:100%;box-sizing:border-box}" +
      ".muse-mark{position:absolute;right:7px;top:50%;transform:translateY(-50%);width:28px;height:28px;border:0;border-radius:8px;" +
      "background:#fff;box-shadow:0 2px 7px rgba(217,119,87,.55);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;z-index:6}" +
      ".muse-wrap.ta .muse-mark{top:9px;bottom:auto;transform:none;width:32px;height:32px}" +   /* top-right, clear of the resize grip */
      ".muse-mark img{width:100%;height:100%;display:block;pointer-events:none;border-radius:8px}" +
      ".muse-mark.busy{animation:musefade .7s infinite}" +
      "@keyframes musefade{0%,100%{opacity:1}50%{opacity:.4}}" +
      "@keyframes musenudge{0%,70%,100%{transform:translateY(-50%) scale(1)}82%{transform:translateY(-50%) scale(1.18)}}" +
      "@keyframes musenudgeta{0%,70%,100%{transform:scale(1)}82%{transform:scale(1.18)}}" +
      ".muse-mark.hi{animation:musenudge 1.1s ease 2}" +
      ".muse-wrap.ta .muse-mark.hi{animation:musenudgeta 1.1s ease 2}" +
      "input.muse-pad{padding-right:40px!important}" +
      "textarea.muse-pad{padding-right:14px;padding-top:12px}";
    document.head.appendChild(s);
  }
  function wrap(box) {
    if (!box || box.__muse) return; if (!kindOf(box)) return; box.__muse = 1; css();
    var isTA = box.tagName === "TEXTAREA";
    var holder = document.createElement("span"); holder.className = "muse-wrap" + (isTA ? " ta" : "");
    var p = box.parentNode; if (!p) return; p.insertBefore(holder, box); holder.appendChild(box);
    box.classList.add("muse-pad");
    var b = document.createElement("button"); b.type = "button"; b.className = "muse-mark";
    b.title = "Claude — write it in your voice"; b.setAttribute("aria-label", "Write with Claude");
    b.innerHTML = '<img src="claude-mark.svg" alt="Claude">';
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); flow(box, b); });
    holder.appendChild(b);
    b.classList.add("hi"); setTimeout(function () { try { b.classList.remove("hi"); } catch (e) {} }, 2600);
  }
  function scan() {
    ["#composeText", "#groupComposeInput", "#ddm-input"].forEach(function (sel) { var el = document.querySelector(sel); if (el) wrap(el); });
    try { document.querySelectorAll(".cinput").forEach(wrap); } catch (e) {}
  }

  w.DDMuse = { compose: compose, flow: flow, scan: scan };

  if (document.readyState !== "loading") scan(); else document.addEventListener("DOMContentLoaded", scan);
  try { new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
})(window);
