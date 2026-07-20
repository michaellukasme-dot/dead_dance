/* dd_miracle.js — Band Miracle-Pledge automation (task #11).
   A band pledges N free tickets per month into the chapter Miracle bucket. Runs on the DRUC
   standing-authorization pattern (affirmative opt-in, disclosed, revocable, logged). Auto-allocates
   monthly and keeps a write-off record (date, count, est. value) for the band's accounting.

   Client layer (localStorage ledger now; syncs to Supabase when a `miracle_pledges` table exists).
   Never throws. window.DDMiracle. */
(function (root) {
  "use strict";
  var PKEY = "dd.miracle.pledge", LKEY = "dd.miracle.ledger";
  function load(k, d) { try { return JSON.parse(root.localStorage.getItem(k) || d); } catch (e) { try { return JSON.parse(d); } catch (x) { return null; } } }
  function save(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function ym(d) { d = d || new Date(); return d.getFullYear() + "-" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1); }

  var pledge = load(PKEY, "{}") || {};        // {on, perMonth, band, avgValue, since, discloseVer}
  var ledger = load(LKEY, "[]") || [];        // [{ym, count, band, valueEst, at}]

  function get() { return { on: !!pledge.on, perMonth: pledge.perMonth || 0, band: pledge.band || "", avgValue: pledge.avgValue || 0, since: pledge.since || null }; }

  // DRUC affirmative opt-in: must pass on=true explicitly + a per-month count. No pre-check.
  function setPledge(o) {
    o = o || {};
    if (o.on) {
      pledge = { on: true, perMonth: Math.max(1, parseInt(o.perMonth || 1, 10)), band: String(o.band || pledge.band || ""), avgValue: Math.max(0, +o.avgValue || +pledge.avgValue || 0), since: pledge.since || new Date().toISOString(), discloseVer: o.discloseVer || "v1", at: new Date().toISOString() };
    } else {
      pledge = { on: false, perMonth: 0, band: pledge.band || "", avgValue: pledge.avgValue || 0, since: null };  // one-tap revoke
    }
    save(PKEY, pledge); syncPledge(); return get();
  }

  // Idempotent monthly allocation — records one row per month, never double-allocates.
  function allocate(when) {
    if (!pledge.on || !pledge.perMonth) return null;
    var m = ym(when);
    if (ledger.some(function (r) { return r.ym === m && r.band === pledge.band; })) return null;  // already done this month
    var row = { ym: m, count: pledge.perMonth, band: pledge.band, valueEst: pledge.perMonth * (pledge.avgValue || 0), at: new Date().toISOString() };
    ledger.push(row); save(LKEY, ledger); syncLedger(row);
    try { if (root.toast) toast("🍀 " + row.count + " Miracle tickets pledged for " + m + " — logged for your records. 🌹"); } catch (e) {}
    return row;
  }

  function writeoffRecord() {
    var total = ledger.reduce(function (a, r) { return a + (r.valueEst || 0); }, 0);
    var tix = ledger.reduce(function (a, r) { return a + (r.count || 0); }, 0);
    return { rows: ledger.slice(), totalTickets: tix, totalValueEst: total, band: pledge.band || "" };
  }

  // optional Supabase sync (feature-detected, non-blocking, RLS band-owns-own)
  function client() { try { return (root.ddClient && ddClient()) || null; } catch (e) { return null; } }
  function uid() { try { return (root.ddId && ddId()) || null; } catch (e) { return null; } }
  function syncPledge() { try { var c = client(), id = uid(); if (c && id) c.from("miracle_pledges").upsert({ id: id, pledge: pledge, updated_at: new Date().toISOString() }).then(function () {}, function () {}); } catch (e) {} }
  function syncLedger(row) { try { var c = client(), id = uid(); if (c && id) c.from("miracle_ledger").insert({ band_id: id, ym: row.ym, count: row.count, value_est: row.valueEst }).then(function () {}, function () {}); } catch (e) {} }

  // DRUC affirmative opt-in card (off by default; one tap on; revocable). Self-contained overlay.
  function openPledge() {
    try {
      var g = get(), id = "ddMirOv", ex = document.getElementById(id); if (ex) ex.remove();
      var o = document.createElement("div"); o.id = id;
      o.style.cssText = "position:fixed;inset:0;z-index:121;background:rgba(10,8,20,.86);display:flex;align-items:center;justify-content:center;padding:16px";
      var wo = writeoffRecord();
      o.innerHTML = '<div style="width:100%;max-width:420px;background:#fbf7ef;color:#23202a;border-radius:18px;padding:20px;box-shadow:0 24px 70px #000a">' +
        '<div style="font-size:34px;text-align:center">🍀</div><b style="font-size:19px;display:block;text-align:center;margin:2px 0 6px">Pledge Miracle tickets</b>' +
        '<p style="font-size:13.5px;color:#55505f;text-align:center;margin:0 0 12px">Give a set number of free tickets each month to your chapter\'s Miracle bucket. Ongoing until you switch it off — one tap. We log every allocation for your records.</p>' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin:6px 0"><input type="checkbox" id="ddMirOn"' + (g.on ? " checked" : "") + '> Auto-pledge each month</label>' +
        '<div style="display:flex;gap:10px;margin:6px 0 12px"><label style="font-size:13px;flex:1">Tickets / month<input type="number" id="ddMirN" min="1" value="' + (g.perMonth || 2) + '" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px"></label><label style="font-size:13px;flex:1">Est. value each ($)<input type="number" id="ddMirV" min="0" value="' + (g.avgValue || 0) + '" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px"></label></div>' +
        '<button onclick="DDMiracle._confirm()" style="width:100%;background:linear-gradient(135deg,#1f7a4d,#0f5a34);color:#fff;border:0;border-radius:12px;padding:13px;font-weight:900;font-size:15px;cursor:pointer">Turn it on 🌹</button>' +
        '<button onclick="this.closest(\'#ddMirOv\').remove()" style="width:100%;background:transparent;border:0;color:#7a7686;padding:9px;margin-top:4px;cursor:pointer">Not now</button>' +
        (wo.rows.length ? '<div style="font-size:11.5px;color:#7a7686;text-align:center;margin-top:8px">On record: ' + wo.totalTickets + ' tickets' + (wo.totalValueEst ? " · ~$" + wo.totalValueEst + " write-off" : "") + '</div>' : '') +
        '</div>';
      o.addEventListener("click", function (e) { if (e.target === o) o.remove(); });
      document.body.appendChild(o);
    } catch (e) {}
  }
  root.DDMiracle = { get: get, setPledge: setPledge, allocate: allocate, writeoff: writeoffRecord, ledger: function () { return ledger.slice(); }, open: openPledge,
    _confirm: function () { try { var on = document.getElementById("ddMirOn").checked; setPledge({ on: on, perMonth: +document.getElementById("ddMirN").value, avgValue: +document.getElementById("ddMirV").value }); if (on) allocate(); var ov = document.getElementById("ddMirOv"); if (ov) ov.remove(); if (root.toast) toast(on ? "🍀 Miracle pledge on — thank you. 🌹" : "Pledge off."); } catch (e) {} } };
  root.openMiraclePledge = openPledge;

  // auto-run this month's allocation on load if pledged (idempotent)
  function boot() { try { allocate(); } catch (e) {} }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : this);
