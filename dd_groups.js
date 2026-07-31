/* ============================================================================
 * dd_groups.js — the community / festival / palette / membership brain.
 *
 * Model (locked with Michael):
 *   • The NEUTRAL StageFill rail is where buying happens (WHEN·WHERE·BUY).
 *   • Behind it sit branded SOCIAL communities. Two are live:
 *       1. DeadDance     — a genre/scene community (purple/rose).
 *       2. FestivalDance — a FORMAT community. Festivals live INSIDE it:
 *          MusikFest (first), BaconFest, Allentown Fair … → the 800.
 *   • ONE community palette; each festival SUB-TINTS it (MusikFest = ArtsQuest).
 *   • OVERLAP IS A FEATURE: one ticket can belong to many communities and
 *     surfaces in each wallet (no dedupe of the surfacing). For accurate fan
 *     COUNTS, dedupe by holder (uniqueFans).
 *   • "Claim My Festival" = the single uptake door for all 800.
 *
 * Guarded + local-first: no backend? every spine call is a silent no-op.
 * Instrumented: emit() sends ids/counts ONLY — never names/emails/holders.
 * Dual export: browser (window.ddGroups) and node (module.exports).
 * ==========================================================================*/
;(function (root) {
  'use strict';

  var FESTIVAL_GOAL = 800; // the universe we're going after

  // ---- Communities behind the neutral StageFill rail -----------------------
  var COMMUNITIES = {
    stagefill: { id:'stagefill', name:'StageFill', neutral:true, badge:'🎫',
      palette:{ bg:'#eef1f6', bar:'#ffffff', barInk:'#141018', ink:'#141018', accent:'#2f6feb', accent2:'#2b3242', chip:'#f2f5fa' } },
    deaddance: { id:'deaddance', name:'DeadDance', badge:'🌹',
      palette:{ bg:'#f5f0fb', bar:'#2b1640', barInk:'#ffffff', ink:'#241535', accent:'#7a3cc0', accent2:'#b8002e', chip:'#efe4fb' } },
    festivaldance: { id:'festivaldance', name:'FestivalDance', badge:'🎪',
      // ONE community palette — festival grounds green + marigold. Festivals sub-tint over this.
      palette:{ bg:'#eef4ef', bar:'#173a24', barInk:'#ffffff', ink:'#173a24', accent:'#2f8f4e', accent2:'#f0a500', chip:'#e2f0e6' } }
  };

  // ---- Festivals INSIDE FestivalDance (registry; scales to the 800) --------
  //   tint = the sub-tint overrides applied over the FestivalDance palette.
  function seedFestivals(){ return [
    { id:'musikfest',     name:'MusikFest',      city:'Bethlehem, PA', community:'festivaldance', order:1,
      tint:{ bar:'#12345f', accent:'#1b5fa8', accent2:'#f2b705' }, claimed:true,  claimant:'ArtsQuest' }, // already ours
    { id:'baconfest',     name:'BaconFest',      city:'Easton, PA',    community:'festivaldance', order:2,
      tint:{ bar:'#5a2416', accent:'#b4471f', accent2:'#e0a33a' }, claimed:false, claimant:null },
    { id:'allentownfair', name:'Allentown Fair', city:'Allentown, PA', community:'festivaldance', order:3,
      tint:{ bar:'#1d2a52', accent:'#c0392b', accent2:'#e6b422' }, claimed:false, claimant:null }
  ]; }
  var FESTIVALS = seedFestivals();

  var state = { home:'deaddance', memberships:{}, tickets:[] };

  // ---- palette / theme -----------------------------------------------------
  function community(id){ return COMMUNITIES[id] || null; }
  function paletteFor(id){
    var c = COMMUNITIES[id];
    return Object.assign({}, (c ? c.palette : COMMUNITIES.stagefill.palette)); // unknown → neutral rail
  }
  function festival(id){ for (var i=0;i<FESTIVALS.length;i++){ if (FESTIVALS[i].id===id) return FESTIVALS[i]; } return null; }
  function festivals(){ return FESTIVALS.map(function(f){ var c=Object.assign({}, f); c.tint=Object.assign({}, f.tint||{}); return c; }); } // deep-copy tint so callers can't corrupt the registry
  function tintFor(festId){ var f=festival(festId); return (f && f.tint) ? Object.assign({}, f.tint) : {}; } // unknown → {} (no crash)
  function resolveTheme(communityId, festId){
    var base = paletteFor(communityId);                 // community base (or neutral fallback)
    if (festId){ var t=tintFor(festId); for (var k in t){ if (Object.prototype.hasOwnProperty.call(t,k)) base[k]=t[k]; } }
    return base;                                          // sub-tint overrides base; unknown fest = base unchanged
  }

  // ---- membership (overlap allowed; join is idempotent) --------------------
  function join(communityId){ if (COMMUNITIES[communityId]){ state.memberships[communityId]=true; emit('group_join',{community:communityId}); } return memberships(); }
  function leave(communityId){ delete state.memberships[communityId]; return memberships(); }
  function memberships(){ return Object.keys(state.memberships); }
  function setHome(communityId){ if (COMMUNITIES[communityId]){ state.home=communityId; join(communityId); emit('home_set',{community:communityId}); } return state.home; }
  function home(){ return state.home; }

  // ---- tickets + overlap ---------------------------------------------------
  function addTicket(t){
    if (!t || !t.id) return null;
    t.communities = (t.communities && t.communities.length) ? t.communities.slice() : ['stagefill'];
    for (var i=0;i<state.tickets.length;i++){ if (state.tickets[i].id===t.id){ state.tickets[i]=t; return t; } } // no dup by id
    state.tickets.push(t);
    emit('ticket_add', { ticket:t.id, communities:t.communities }); // ids only
    return t;
  }
  // OVERLAP: the SAME ticket surfaces in every community it belongs to.
  function walletFor(communityId){ return state.tickets.filter(function(t){ return t.communities.indexOf(communityId)>=0; }); }
  // For accurate COUNTS, dedupe by holder (a fan in two wallets is one fan).
  function uniqueFans(communityId){
    var list = communityId ? walletFor(communityId) : state.tickets, seen={}, n=0;
    list.forEach(function(t){ var h=t.holder||t.id; if (!seen[h]){ seen[h]=1; n++; } });
    return n;
  }

  // ---- claim + uptake (the 800 front door) ---------------------------------
  function claimedCount(){ var n=0; FESTIVALS.forEach(function(f){ if (f.claimed) n++; }); return n; }
  function uptakeStats(){ var c=claimedCount(); return { goal:FESTIVAL_GOAL, claimed:c, remaining: Math.max(0, FESTIVAL_GOAL - c) }; }
  function claimFestival(festId, claimant){
    if (!festId) return { ok:false, reason:'no id' };
    var f = festival(festId);
    if (!f){ // a brand-new festival off the 800 list — register it
      f = { id:festId, name:festId, city:'', community:'festivaldance', order:FESTIVALS.length+1, tint:{}, claimed:false, claimant:null };
      FESTIVALS.push(f);
    }
    if (f.claimed){ return { ok:true, already:true, festival:f.id, uptake:uptakeStats() }; } // idempotent — no double count
    f.claimed = true; f.claimant = claimant || null;
    guardSpine('sf_festival_claim', { fest:f.id, claimant:f.claimant }); // backend (consented) — may carry claimant
    emit('festival_claim', { festival:f.id });                           // telemetry — id ONLY, no claimant
    return { ok:true, already:false, festival:f.id, uptake:uptakeStats() };
  }

  // ---- instrumentation (guarded; NO PII — ids & counts only) ---------------
  function emit(evt, payload){
    payload = payload || {};
    try{
      if (root.DDTele && typeof root.DDTele.event==='function'){ root.DDTele.event('groups.'+evt, payload); return; }
      if (typeof root.ddEvent==='function'){ root.ddEvent('groups.'+evt, payload); return; }
    }catch(e){}
    // no sink → silent no-op
  }
  // ---- guarded spine (local-first; no backend = no-op) ---------------------
  function guardSpine(rpc, args){
    try{ if (typeof root.ddClient==='function'){ var c=root.ddClient(); if (c && c.rpc){ c.rpc(rpc, args); return true; } } }catch(e){}
    return false;
  }

  var api = {
    FESTIVAL_GOAL: FESTIVAL_GOAL, COMMUNITIES: COMMUNITIES,
    community: community, paletteFor: paletteFor, resolveTheme: resolveTheme,
    festival: festival, festivals: festivals, tintFor: tintFor,
    join: join, leave: leave, memberships: memberships, setHome: setHome, home: home,
    addTicket: addTicket, walletFor: walletFor, uniqueFans: uniqueFans,
    claimFestival: claimFestival, uptakeStats: uptakeStats,
    _reset: function(){ state={home:'deaddance',memberships:{},tickets:[]}; FESTIVALS.length=0; seedFestivals().forEach(function(f){ FESTIVALS.push(f); }); }
  };

  root.ddGroups = api;
  if (typeof module!=='undefined' && module.exports) module.exports = api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
