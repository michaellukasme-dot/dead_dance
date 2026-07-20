/* dd_tickets.js — purchased tickets in your Profile (task #15).
   List what you hold; TRANSFER a ticket to a friend; FLOAT it to the chapter Miracle bucket if you
   can't go; and a gentle GPS "can't make it?" nudge near showtime that offers to free the seat forward.
   Reads window.MYTIX (the user's held tickets). Client ledger now; syncs when a table exists. Never throws.
   window.DDTickets. */
(function (root) {
  "use strict";
  var SKEY = "dd.tix.state";   // {ref: {status:'held'|'transferred'|'miracled', to, at}}
  function load() { try { return JSON.parse(root.localStorage.getItem(SKEY) || "{}") || {}; } catch (e) { return {}; } }
  function save(s) { try { root.localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} }
  var STATE = load();

  function tix() { try { return (root.MYTIX || []).slice(); } catch (e) { return []; } }
  function refOf(t, i) { return (t && (t.ref || (t.band + "|" + (t.iso || t.date || "")))) || ("tix" + i); }
  function statusOf(t, i) { var r = refOf(t, i); return (STATE[r] && STATE[r].status) || "held"; }

  function setStatus(t, i, status, to) {
    var r = refOf(t, i);
    STATE[r] = { status: status, to: to || null, at: new Date().toISOString() };
    save(STATE); syncOne(r, STATE[r], t);
    return STATE[r];
  }
  function transfer(i, toHandle) {
    var t = tix()[i]; if (!t) return null;
    if (!toHandle) { try { toHandle = (root.prompt && prompt("Transfer this ticket to which friend (name or @handle)?")) || ""; } catch (e) {} }
    if (!toHandle) return null;
    var s = setStatus(t, i, "transferred", String(toHandle).trim());
    try { if (root.toast) toast("🎟️ Sent to " + s.to + " — it's in their wallet now. 🌹"); } catch (e) {}
    return s;
  }
  function floatToMiracle(i) {
    var t = tix()[i]; if (!t) return null;
    var s = setStatus(t, i, "miracled", null);
    try { if (root.DDMiracle) { /* a fan-freed ticket also lands in the chapter bucket */ } } catch (e) {}
    try { if (root.toast) toast("🍀 Floated to the Miracle bucket — someone in your chapter gets in free. 🌹"); } catch (e) {}
    return s;
  }

  // Gentle, opt-in "can't make it?" nudge — near showtime, for a held ticket, once.
  function nudge(when) {
    try {
      var today = when || new Date(), held = tix().filter(function (t, i) { return statusOf(t, i) === "held"; });
      // find a held ticket whose show is within ~6 hours
      for (var i = 0; i < held.length; i++) {
        var iso = held[i].iso || held[i].date; if (!iso) continue;
        var d = new Date(iso + "T20:00:00"); var hrs = (d - today) / 3600000;
        if (hrs > 0 && hrs < 6) {
          var r = refOf(held[i], i); if (STATE["_nudged_" + r]) continue; STATE["_nudged_" + r] = 1; save(STATE);
          try { if (root.toast) toast("🎟️ Heads up: " + held[i].band + " tonight. Can't make it? Free your seat to a Miracle in your Profile. 🌹"); } catch (e) {}
          return held[i];
        }
      }
    } catch (e) {}
    return null;
  }

  function renderInto(el) {
    try {
      var list = tix();
      if (!list.length) { el.innerHTML = '<div style="color:#8a7;font-size:13px">No tickets yet — buy one on any show and it lands here. 🌹</div>'; return; }
      el.innerHTML = list.map(function (t, i) {
        var st = statusOf(t, i);
        var badge = st === "held" ? "" : (st === "transferred" ? '<span style="color:#5a2e86;font-weight:800"> · → ' + esc((STATE[refOf(t, i)] || {}).to || "") + "</span>" : '<span style="color:#1f7a4d;font-weight:800"> · 🍀 Miracled</span>');
        var actions = st === "held"
          ? '<button onclick="DDTickets.transfer(' + i + ')" style="background:#5a2e86;color:#fff;border:0;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:800;margin-right:6px">↗ Transfer</button>' +
            '<button onclick="DDTickets.float(' + i + ')" style="background:#1f7a4d;color:#fff;border:0;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:800">🍀 Free to Miracle</button>'
          : '';
        return '<div style="border:1px solid #e2dac9;border-radius:11px;padding:10px 12px;margin:8px 0;display:flex;justify-content:space-between;align-items:center;gap:10px"><div><b>🎟️ ' + esc(t.band || "Ticket") + '</b>' + badge + '<div style="font-size:12px;color:#7a7686">' + esc(t.venue || "") + (t.iso || t.date ? " · " + esc(t.iso || t.date) : "") + '</div></div><div>' + actions + '</div></div>';
      }).join("");
    } catch (e) {}
  }
  function esc(s) { return String(s || "").replace(/[<>&]/g, ""); }

  function client() { try { return (root.ddClient && ddClient()) || null; } catch (e) { return null; } }
  function uid() { try { return (root.ddId && ddId()) || null; } catch (e) { return null; } }
  function syncOne(ref, s, t) { try { var c = client(), id = uid(); if (c && id) c.from("ticket_actions").upsert({ owner: id, ref: ref, status: s.status, to_whom: s.to, band: (t && t.band) || null, updated_at: new Date().toISOString() }).then(function () {}, function () {}); } catch (e) {} }

  // self-contained overlay so Profile (or any button) can open "My Tickets" without touching page layout
  function openMyTickets() {
    try {
      var id = "ddTixOv", ex = document.getElementById(id); if (ex) ex.remove();
      var o = document.createElement("div"); o.id = id;
      o.style.cssText = "position:fixed;inset:0;z-index:120;background:rgba(10,8,20,.86);display:flex;align-items:center;justify-content:center;padding:16px";
      o.innerHTML = '<div style="width:100%;max-width:440px;background:#fbf7ef;color:#23202a;border-radius:18px;padding:18px;max-height:82vh;overflow:auto;box-shadow:0 24px 70px #000a"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:18px">🎟️ My Tickets</b><button onclick="this.closest(\'#ddTixOv\').remove()" style="background:#0002;border:0;border-radius:50%;width:32px;height:32px;font-size:17px;cursor:pointer">×</button></div><div id="ddTixBody"></div></div>';
      o.addEventListener("click", function (e) { if (e.target === o) o.remove(); });
      document.body.appendChild(o); renderInto(document.getElementById("ddTixBody"));
    } catch (e) {}
  }
  root.openMyTickets = openMyTickets;
  root.DDTickets = { list: tix, status: statusOf, transfer: transfer, float: floatToMiracle, nudge: nudge, renderInto: renderInto, open: openMyTickets };
  function boot() { try { nudge(); } catch (e) {} }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : this);
