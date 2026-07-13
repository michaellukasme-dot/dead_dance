/* dd_sales.js — Autonomous Sales client: Accounts · Contacts · Pipeline · Deal-Health.
   The rep's real book, scored from real signals (dd_sales.sql). Pairs with the
   shared cadence engine (dd_gigs.js, template 'sales') for paced outreach.
   Next-best-action is computed here (guided selling). Best-effort; nothing throws. */
(function (root) {
  function client() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }
  function ready() { return !!(client() && myId()); }

  function upsertAccount(a) {
    a = a || {}; var c = client(), id = myId();
    if (!c || !id) return Promise.reject('no-backend');
    return c.rpc('dd_account_upsert', {
      p_id: a.id || null, p_member_id: id, p_name: a.name || 'New account',
      p_type: a.type || 'venue', p_city: a.city || null, p_stage: a.stage || null,
      p_value_mo: (a.value_mo != null ? a.value_mo : null)
    }).then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
  }
  function setStage(accountId, stage) {
    var c = client(), id = myId(); if (!c || !id) return Promise.reject('no-backend');
    return c.rpc('dd_account_stage', { p_account_id: accountId, p_member_id: id, p_stage: stage })
      .then(function (r) { if (r && r.error) throw r.error; return true; });
  }
  function addContact(accountId, ct) {
    ct = ct || {}; var c = client(); if (!c) return Promise.reject('no-backend');
    return c.rpc('dd_contact_add', { p_account_id: accountId, p_name: ct.name || 'Contact',
      p_role: ct.role || null, p_email: ct.email || null, p_phone: ct.phone || null, p_dm: !!ct.decision_maker })
      .then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
  }
  function logActivity(accountId, kind, note) {
    var c = client(), id = myId(); if (!c) return Promise.resolve(null);
    return c.rpc('dd_activity_log', { p_account_id: accountId, p_member_id: id, p_kind: kind || 'note', p_note: note || null })
      .then(function (r) { return (r && r.data) || null; }).catch(function () { return null; });
  }
  function pipeline() {
    var c = client(), id = myId(); if (!c || !id) return Promise.resolve([]);
    return c.rpc('dd_accounts_scored', { p_member_id: id }).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }
  function contacts(accountId) {
    var c = client(), id = myId(); if (!c || !id) return Promise.resolve([]);
    return c.rpc('dd_account_contacts', { p_account_id: accountId, p_member_id: id }).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }
  function activities(accountId) {
    var c = client(), id = myId(); if (!c || !id) return Promise.resolve([]);
    return c.rpc('dd_account_activities', { p_account_id: accountId, p_member_id: id }).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }

  // ---- next-best-action (guided selling): a concrete move per deal ----
  function daysSince(iso) { try { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); } catch (e) { return 999; } }
  function nextAction(acct) {
    var stage = acct.stage, stale = daysSince(acct.last_touch || acct.updated_at);
    var noContacts = !acct.contacts;
    if (stage === 'won') return { do: 'onboard', why: 'Won — kick off onboarding and get the calendar live.', urgent: false };
    if (stage === 'lost') return { do: 'nurture', why: 'Lost — drop into a light nurture; revisit next quarter.', urgent: false };
    if (noContacts) return { do: 'map', why: 'No decision-maker mapped yet — find who books this room.', urgent: true };
    if (stage === 'prospect') return { do: 'intro', why: 'Prospect — send the first touch and start the cadence.', urgent: stale > 3 };
    if (stage === 'contacted') return { do: 'meeting', why: 'Contacted — ask for the 20-minute meeting.', urgent: stale > 5 };
    if (stage === 'meeting') return { do: 'proposal', why: 'Met — send the proposal + pricing while it is warm.', urgent: stale > 4 };
    if (stage === 'proposal') return stale > 7
      ? { do: 'followup', why: stale + ' days since the proposal — send a value-add follow-up.', urgent: true }
      : { do: 'followup', why: 'Proposal out — follow up and ask for the decision.', urgent: false };
    return { do: 'touch', why: 'Keep it warm — log a touch.', urgent: stale > 14 };
  }
  function summary(rows) {
    rows = rows || []; var open = rows.filter(function (a) { return a.stage !== 'won' && a.stage !== 'lost'; });
    var val = open.reduce(function (s, a) { return s + (Number(a.value_mo) || 0); }, 0);
    var health = open.length ? Math.round(open.reduce(function (s, a) { return s + (a.health || 0); }, 0) / open.length) : 0;
    var atRisk = open.filter(function (a) { return (a.health || 0) < 40; }).length;
    var won = rows.filter(function (a) { return a.stage === 'won'; }).length;
    return { open: open.length, value_mo: val, avg_health: health, at_risk: atRisk, won: won };
  }

  // ---- module 3: knowledge base (add-to; grounds drafted answers) ----
  function kbAdd(category, title, body) {
    var c = client(), id = myId(); if (!c) return Promise.reject('no-backend');
    return c.rpc('dd_kb_add', { p_member_id: id, p_category: category || 'playbook', p_title: title || '', p_body: body || '' })
      .then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
  }
  function kbList(category) {
    var c = client(); if (!c) return Promise.resolve([]);
    return c.rpc('dd_kb_list', { p_category: category || null }).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }
  function kbSearch(q) {
    var c = client(); if (!c) return Promise.resolve([]);
    return c.rpc('dd_kb_search', { p_q: q || null }).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }

  // ---- module 4: collateral shelf (real assets; auto-suggest by stage) ----
  var COLLATERAL = [
    { id: 'board', name: 'THE BOARD — map exhibit', file: 'THE_BOARD_rhino_exhibit.pdf', stages: ['prospect', 'contacted'] },
    { id: 'opportunity', name: 'The Opportunity — market brief', file: 'BRIEF_The_Opportunity_market.pdf', stages: ['contacted', 'meeting'] },
    { id: 'built', name: "What We've Built — features", file: 'BRIEF_What_Weve_Built_features.pdf', stages: ['meeting', 'proposal'] },
    { id: 'positioning', name: 'Network positioning', file: 'RHINO_POSITIONING_network_karaoke.pdf', stages: ['meeting', 'proposal'] },
    { id: 'whitebox', name: 'White Box — standalone', file: 'WHITE_BOX_network_karaoke_any_catalogue.pdf', stages: ['proposal'] }
  ];
  function collateral() { return COLLATERAL.slice(); }
  function suggestCollateral(stage) { return COLLATERAL.filter(function (c) { return c.stages.indexOf(stage) >= 0; }); }
  function sendCollateral(accountId, name) { return logActivity(accountId, 'email', 'Sent collateral: ' + name); }

  // ---- module 5: quote -> pay (CPQ-lite; payment gated on Stripe) ----
  function quoteCreate(accountId, tier, priceMo) {
    var c = client(), id = myId(); if (!c || !id) return Promise.reject('no-backend');
    return c.rpc('dd_quote_create', { p_account_id: accountId, p_member_id: id, p_tier: tier || 'venue', p_price_mo: (priceMo != null ? priceMo : 0) })
      .then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
  }
  function quoteStatus(quoteId, status) {
    var c = client(), id = myId(); if (!c || !id) return Promise.reject('no-backend');
    return c.rpc('dd_quote_status', { p_quote_id: quoteId, p_member_id: id, p_status: status })
      .then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
  }
  function quotesFor(accountId) {
    var c = client(), id = myId(); if (!c || !id) return Promise.resolve([]);
    return c.rpc('dd_quotes_for', { p_account_id: accountId, p_member_id: id }).then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }
  // the fee math — Rule Zero: 15% on the room, never the band
  function feeMath(priceMo, pct) { pct = (pct == null ? 15 : pct); var house = Math.round(priceMo * pct) / 100; return { price_mo: priceMo, fee_pct: pct, house_mo: house, room_keeps: Math.round((priceMo - house) * 100) / 100 }; }

  root.DDSales = {
    ready: ready, upsertAccount: upsertAccount, setStage: setStage, addContact: addContact,
    logActivity: logActivity, pipeline: pipeline, contacts: contacts, activities: activities,
    nextAction: nextAction, summary: summary, myId: myId,
    kbAdd: kbAdd, kbList: kbList, kbSearch: kbSearch,
    collateral: collateral, suggestCollateral: suggestCollateral, sendCollateral: sendCollateral,
    quoteCreate: quoteCreate, quoteStatus: quoteStatus, quotesFor: quotesFor, feeMath: feeMath
  };
})(typeof window !== 'undefined' ? window : this);
