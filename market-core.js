/* ============================================================================
 * market-core — the INVISIBLE ENGINE of the Market Surface. Headless. No DOM.
 * Portable (browser + node), framework-free, offline-first. ONE implementation.
 * Server (edex-class market.* + Edge Functions) is the source of truth; this is
 * the client mirror: take math, license/entitlement pre-checks, event ledger +
 * offline queue, and reporting rollups. v0.1 · 2026-06-22
 * ========================================================================== */
(function (root) {
  "use strict";

  /* ---- storage shim (localStorage in browser, memory in node) ---- */
  var mem = {};
  var store = (typeof localStorage !== "undefined") ? localStorage : {
    getItem: function (k) { return k in mem ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); }
  };

  /* ---- money ---- */
  function fmt(cents, cur) { cur = cur || "USD"; return (cur === "USD" ? "$" : cur + " ") + (cents / 100).toFixed(2).replace(/\.00$/, ""); }

  /* ---- THE TAKE ENGINE (pure) — a piece of everything, or NOTHING by choice ---- */
  function computeTake(amountCents, policy) {
    if (!policy || policy.mode === "none") return 0;            // waived — but the caller still records 0
    if (policy.mode === "flat") return Math.max(0, Math.min(policy.flat_cents || 0, amountCents));
    if (policy.mode === "percent") return Math.round(amountCents * (policy.value_bps || 0) / 10000);
    return 0;
  }

  /* ---- license + entitlement pre-checks (server re-checks authoritatively) ---- */
  function hasValidLicense(channel, account, nowMs) {
    nowMs = nowMs || Date.now();
    var region = account && account.region;
    return (channel.licenses || []).some(function (l) {
      var ts = l.term_start ? Date.parse(l.term_start) : 0;
      var te = l.term_end ? Date.parse(l.term_end) : Infinity;
      var inTerm = l.status === "active" && ts <= nowMs && nowMs <= te;
      var inTerr = !l.territory || l.territory.length === 0 || l.territory.indexOf(region) >= 0;
      return inTerm && inTerr;
    });
  }
  function holdsSubscription(account, type, id) {
    return !!(account && (account.subs || []).some(function (s) {
      return s.target_type === type && s.target_id === id && s.status === "active";
    }));
  }
  /* content is served ONLY with a valid license AND an active subscription (default-deny) */
  function canViewContent(channel, account) {
    return hasValidLicense(channel, account) && holdsSubscription(account, "channel", channel.id);
  }

  /* ---- event ledger + offline queue (idempotent) ----
   * outbound QUEUE (cleared once sent) is separate from the local LEDGER mirror
   * (kept for instant Reports even after events flush to the server). */
  var QKEY = "mc.queue.v1", LKEY = "mc.ledger.v1", adapter = null;
  function queue() { try { return JSON.parse(store.getItem(QKEY) || "[]"); } catch (e) { return []; } }
  function setQueue(q) { store.setItem(QKEY, JSON.stringify(q)); }
  function ledger() { try { return JSON.parse(store.getItem(LKEY) || "[]"); } catch (e) { return []; } }
  function setLedger(l) { store.setItem(LKEY, JSON.stringify(l)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function emit(ev) {
    ev.idempotency_key = ev.idempotency_key || (ev.type + "-" + uid());
    ev.at = ev.at || new Date().toISOString();
    var q = queue(); q.push(ev); setQueue(q);
    var l = ledger(); l.push(ev); setLedger(l);          /* mirror (never auto-cleared) */
    flush(); return ev;
  }
  function setAdapter(a) { adapter = a; flush(); }
  function flush() {
    if (!adapter || !adapter.sendEvents) return;
    var q = queue(); if (!q.length) return;
    try {
      adapter.sendEvents(q).then(function (res) {
        /* clear ONLY when the server confirms it landed (or de-duped). A hard
           failure (res.ok === false) keeps events queued so nothing vanishes. */
        if (res && res.ok === false) return;
        setQueue([]);
      }).catch(function () { /* network/offline → keep queued, retry on next flush */ });
    } catch (e) { /* keep queued */ }
  }

  /* ---- recorders: take is ALWAYS computed + recorded (even $0 waived) ---- */
  function recordSale(market, listing, account) {
    var take = computeTake(listing.price_cents, market.take_policy);
    return emit({ type: "sale", market_id: market.id, listing_id: listing.id,
      actor_account: account && account.id, amount_cents: listing.price_cents,
      take_cents: take, currency: listing.currency || "USD", region: account && account.region, rail: market.rail });
  }
  function recordSubscribe(node, account) {
    var amt = node.sub_price_cents || 0, take = computeTake(amt, node.take_policy);
    return emit({ type: "subscribe", market_id: node.id, actor_account: account && account.id,
      amount_cents: amt, take_cents: take, region: account && account.region, rail: node.rail });
  }

  /* ---- reporting rollups (mirror of the SQL views) ---- */
  function rollup(events) {
    var byMarket = {}, byVendor = {}, house = { gross: 0, take: 0, units: 0, markets: {} };
    (events || []).forEach(function (e) {
      var m = byMarket[e.market_id] || (byMarket[e.market_id] = { market_id: e.market_id, gross: 0, take: 0, units: 0, subs: 0 });
      var gross = (e.type === "sale" || e.type === "subscribe" || e.type === "renew") ? (e.amount_cents || 0) : 0;
      m.gross += gross; m.take += (e.take_cents || 0);
      if (e.type === "sale") m.units++; if (e.type === "subscribe") m.subs++;
      house.gross += gross; house.take += (e.take_cents || 0); if (e.type === "sale") house.units++;
      house.markets[e.market_id] = true;
      if (e.listing_vendor) { var v = byVendor[e.listing_vendor] || (byVendor[e.listing_vendor] = { vendor: e.listing_vendor, gross: 0, take: 0, units: 0 }); v.gross += gross; v.take += (e.take_cents || 0); if (e.type === "sale") v.units++; }
    });
    house.marketCount = Object.keys(house.markets).length;
    return { byMarket: Object.keys(byMarket).map(function (k) { return byMarket[k]; }), byVendor: Object.keys(byVendor).map(function (k) { return byVendor[k]; }), house: house };
  }

  var MC = { fmt: fmt, computeTake: computeTake, hasValidLicense: hasValidLicense, holdsSubscription: holdsSubscription,
    canViewContent: canViewContent, emit: emit, setAdapter: setAdapter, flush: flush, queue: queue, ledger: ledger,
    recordSale: recordSale, recordSubscribe: recordSubscribe, rollup: rollup, VERSION: "0.1" };

  if (typeof module !== "undefined" && module.exports) module.exports = MC;
  root.MarketCore = MC;
})(typeof window !== "undefined" ? window : globalThis);
