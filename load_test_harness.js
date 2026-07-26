#!/usr/bin/env node
/* load_test_harness.js — MusikFest map end-to-end GROWTH + LOAD simulation.
 * Simulates 0 → 1.5M users across the 10 MusikFest days (Jul 31–Aug 9, 2026) driven by phone-to-phone
 * (street-team) viral invitations, with the two-weekend Fri/Sat spikes. Maps every map/curtain action to
 * its REAL backend cost (from the shipped code), instruments per-second load on each component, compares
 * to realistic capacity ceilings, and reports WHERE SHE BREAKS.
 *
 * This is an analytical/deterministic simulation (no live traffic fired at Supabase — 1.5M real sessions
 * would DoS the project). Assumptions are labeled; tune them to your instance.
 */

// ───────────────────────── CONFIG (assumptions — tune to your Supabase tier) ─────────────────────────
const CFG = {
  targetUsers: 1_500_000,           // cumulative registered by end of festival
  days: [                           // MusikFest 2026: Jul 31 (Fri) → Aug 9 (Sun)
    { d:'Jul31', dow:'Fri', mult:1.7 },
    { d:'Aug01', dow:'Sat', mult:2.3 },   // peak weekend 1
    { d:'Aug02', dow:'Sun', mult:1.3 },
    { d:'Aug03', dow:'Mon', mult:0.8 },
    { d:'Aug04', dow:'Tue', mult:0.8 },
    { d:'Aug05', dow:'Wed', mult:0.9 },
    { d:'Aug06', dow:'Thu', mult:1.0 },
    { d:'Aug07', dow:'Fri', mult:1.8 },
    { d:'Aug08', dow:'Sat', mult:2.4 },   // peak weekend 2 — biggest day
    { d:'Aug09', dow:'Sun', mult:1.2 },
  ],
  // diurnal shape (24h) — festival gates ~ noon, music peaks 7–10pm
  diurnal: [0.02,0.01,0.01,0.01,0.01,0.02,0.03,0.05,0.07,0.09,0.12,0.18,   // 0–11
            0.28,0.36,0.42,0.48,0.55,0.68,0.85,0.98,1.00,0.92,0.70,0.40],  // 12–23  (peak=1.0 at 8pm)
  onsiteAppOpenFraction: 0.55,      // of on-site attendees, share with the map open at a given moment
  streetActiveFraction: 0.09,       // of concurrent map users, share actively on the street/invite page (polling)
  ticketBuyersPerHourPeakPct: 0.004,// of concurrent, buying a ticket in a peak hour (hot on-sales)
  rsvpPerHourPeakPct: 0.02,         // of concurrent, doing a free RSVP in a peak hour

  // client cadences (from shipped code)
  occupancyPingSec: 60,             // event/map pings occupancy geofence batch ~ every 60s while open
  streetPollSec: 4.5,               // street.html polls sf_street_me + sf_street_contest + sf_friend_pending every 4.5s
  streetPollRpcs: 3,                // 3 RPCs per poll cycle (1 of them is the CONTEST AGGREGATE)

  // capacity ceilings (req/s) — realistic for a single small–medium Supabase instance
  ceilings: {
    apiGateway:      2500,   // total PostgREST/API sustained req/s before saturation
    authSignups:      150,   // anonymous sign-ins/s (auth server)
    pingWrites:      2000,   // sf_ping_batch security-definer calls/s (insert + geofence lookups)
    contestAggPerSec:  30,   // sf_street_contest: GROUP BY over the growing sf_referral table — sustainable QPS
    hotRowLockPerSec: 500,   // FOR UPDATE on ONE ticket type row (sf_reserve/sf_rsvp) — serialized tx/s
    joinWrites:      1500,   // sf_street_join (referral insert + referrer row update + friend insert)/s
  },
};

// ───────────────────────── growth curve: cumulative registered over the 10 days ─────────────────────────
// Weight each day by its multiplier; distribute the 1.5M target across days∝mult, then within a day∝diurnal.
const dayWeight = CFG.days.map(d => d.mult);
const totalWeight = dayWeight.reduce((a,b)=>a+b,0);
const dayTarget = dayWeight.map(w => Math.round(CFG.targetUsers * w/totalWeight)); // new registrations that day

// hourly series over 240 hours
const H = [];
let cumUsers = 0;
for (let di=0; di<CFG.days.length; di++){
  const day = CFG.days[di];
  const diSum = CFG.diurnal.reduce((a,b)=>a+b,0);
  for (let h=0; h<24; h++){
    const share = CFG.diurnal[h]/diSum;
    const newRegs = Math.round(dayTarget[di]*share);              // new registrations this hour (viral + arrivals)
    cumUsers += newRegs;
    // on-site attendees present this hour ~ scales with day mult × diurnal; concurrency of the app:
    const onsite = Math.round( (dayTarget[di]) * (CFG.diurnal[h]) * 1.6 ); // present bodies (not cumulative)
    const concurrentMap = Math.round(onsite * CFG.onsiteAppOpenFraction);
    const concurrentStreet = Math.round(concurrentMap * CFG.streetActiveFraction);
    H.push({
      t:`${day.d} ${String(h).padStart(2,'0')}:00`, dow:day.dow, hourIndex: di*24+h,
      newRegs, cumUsers: Math.min(cumUsers, CFG.targetUsers),
      concurrentMap, concurrentStreet,
    });
  }
}

// ───────────────────────── instrumentation: per-component load per hour ─────────────────────────
function loads(row){
  const perSec = 3600;
  return {
    // every new device signs in anonymously once
    authSignups:   row.newRegs / perSec,
    // every open map session pings occupancy every 60s
    pingWrites:    row.concurrentMap / CFG.occupancyPingSec,
    // street pages poll 3 RPCs every 4.5s
    streetPollRps: row.concurrentStreet * CFG.streetPollRpcs / CFG.streetPollSec,
    // ONE of those 3 is the contest aggregate → its own hot metric
    contestAgg:    row.concurrentStreet / CFG.streetPollSec,
    // viral join writes: new referred users hit sf_street_join
    joinWrites:    row.newRegs / perSec,
    // ticket buyers / RSVPs converge on hot ticket-type rows (FOR UPDATE)
    hotRowLock:    (row.concurrentMap * (CFG.ticketBuyersPerHourPeakPct + CFG.rsvpPerHourPeakPct)) / perSec
                    * 30,  // 30× concentration: a single popular ticket/RSVP row absorbs a big share in a burst
    // total API req/s through the gateway (everything funnels here)
    get apiTotal(){ return this.authSignups + this.pingWrites + this.streetPollRps + this.joinWrites + this.hotRowLock; }
  };
}

// ───────────────────────── find first breach per component ─────────────────────────
const comps = [
  ['contestAgg',   'contestAggPerSec', 'sf_street_contest aggregate polled every 4.5s (unindexed GROUP BY over sf_referral)'],
  ['streetPollRps','apiGateway',       'street.html polling (sf_street_me + contest + friends) — total RPC firehose'],
  ['pingWrites',   'pingWrites',       'occupancy sf_ping_batch writes (every open map session, /60s)'],
  ['authSignups',  'authSignups',      'anonymous sign-ins (every new device)'],
  ['joinWrites',   'joinWrites',       'sf_street_join viral writes (referral + referrer row update + friend)'],
  ['hotRowLock',   'hotRowLockPerSec', 'FOR UPDATE lock on a hot ticket/RSVP row (sf_reserve / sf_rsvp)'],
  ['apiTotal',     'apiGateway',       'API gateway total (PostgREST saturation)'],
];
const breaches = {};
for (const row of H){
  const L = loads(row);
  for (const [metric, ceilKey, desc] of comps){
    if (breaches[metric]) continue;
    const val = L[metric], ceil = CFG.ceilings[ceilKey];
    if (val > ceil){
      breaches[metric] = { t: row.t, dow: row.dow, val: Math.round(val), ceil, desc,
        cumUsers: row.cumUsers, concurrentMap: row.concurrentMap, concurrentStreet: row.concurrentStreet };
    }
  }
}

// ───────────────────────── peak snapshot ─────────────────────────
let peak = H[0]; for (const r of H) if (r.concurrentMap > peak.concurrentMap) peak = r;
const peakL = loads(peak);

// ───────────────────────── report ─────────────────────────
const M = n => n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(0)+'k':String(Math.round(n));
console.log('\n══════════════════════════════════════════════════════════════════════');
console.log('  MUSIKFEST MAP — 0 → 1.5M END-TO-END GROWTH / LOAD SIMULATION');
console.log('══════════════════════════════════════════════════════════════════════');
console.log(`  Target: ${M(CFG.targetUsers)} registered over 10 days · driven by phone-to-phone invites`);
console.log(`  Peak concurrency: ${M(peak.concurrentMap)} on map / ${M(peak.concurrentStreet)} on street  @ ${peak.t} (${peak.dow})`);
console.log(`  Peak API load: ${M(peakL.apiTotal)} req/s  (ceiling ${M(CFG.ceilings.apiGateway)} req/s)`);

console.log('\n  ── WHERE SHE BREAKS (first breach of each component, in order) ──');
const ordered = Object.entries(breaches).sort((a,b)=>H.findIndex(r=>r.t===a[1].t)-H.findIndex(r=>r.t===b[1].t));
let firstBreak = null;
for (const [metric, b] of ordered){
  if (!firstBreak) firstBreak = b;
  console.log(`\n  ✖ ${metric}`);
  console.log(`     ${b.desc}`);
  console.log(`     breaks at ${b.t} (${b.dow})  ·  load ${M(b.val)}/s  vs  ceiling ${M(b.ceil)}/s  (${(b.val/b.ceil).toFixed(1)}× over)`);
  console.log(`     at that moment: ${M(b.cumUsers)} registered · ${M(b.concurrentMap)} on map · ${M(b.concurrentStreet)} on street`);
}
const notBroken = comps.filter(c=>!breaches[c[0]]).map(c=>c[0]);
if (notBroken.length) console.log(`\n  ✓ never breached in this run: ${notBroken.join(', ')}`);

console.log('\n  ── VERDICT ──');
if (firstBreak){
  console.log(`  She breaks FIRST at ${firstBreak.t} (${firstBreak.dow}) — only ${M(firstBreak.cumUsers)} of ${M(CFG.targetUsers)} registered`);
  console.log(`  (${(100*firstBreak.cumUsers/CFG.targetUsers).toFixed(1)}% of target). The 1.5M curve NEVER completes — the system`);
  console.log(`  collapses on the first busy evening, long before scale.`);
} else {
  console.log('  No breach — survives to 1.5M.');
}

// day-by-day cumulative + peak-hour API load table
console.log('\n  ── DAILY ROLLUP (cumulative registered · peak-hour concurrency · peak API req/s) ──');
console.log('  day     dow  cum users   peak map   peak street   peak API/s   status');
for (let di=0; di<CFG.days.length; di++){
  const dayRows = H.filter(r=>r.hourIndex>=di*24 && r.hourIndex<di*24+24);
  const cum = dayRows[dayRows.length-1].cumUsers;
  let pk = dayRows[0]; for (const r of dayRows) if (r.concurrentMap>pk.concurrentMap) pk=r;
  const pl = loads(pk);
  const broke = pl.apiTotal > CFG.ceilings.apiGateway || pl.contestAgg > CFG.ceilings.contestAggPerSec;
  console.log(`  ${CFG.days[di].d}  ${CFG.days[di].dow}  ${M(cum).padStart(8)}   ${M(pk.concurrentMap).padStart(7)}   ${M(pk.concurrentStreet).padStart(9)}   ${M(pl.apiTotal).padStart(9)}   ${broke?'✖ DOWN':'✓ ok'}`);
}
console.log('\n══════════════════════════════════════════════════════════════════════\n');

// ───────────────────────── HARDENED scenario: apply the fixes, re-check ─────────────────────────
// Fixes: (1) contest board = incremented counter (sf_streeter.signups), indexed read — NOT an aggregate;
//        served cached + polled at 30s (or Realtime push). (2) street polls at 30s (Realtime ideally).
//        (3) occupancy ping 120s, append-only insert, trusted geofence (no per-row lookup). (4) scale the
//        API tier + PgBouncer + a read replica for the hot reads. (5) shard/queue hot ticket rows.
const HFIX = {
  streetPollSec: 30, occupancyPingSec: 120,
  ceil: { apiGateway:12000, authSignups:600, pingWrites:8000, contestReadPerSec:12000, hotRowLockPerSec:2000, joinWrites:6000 },
};
function loadsH(row){
  const perSec=3600;
  const streetReads = row.concurrentStreet * 2 / HFIX.streetPollSec;   // me + counter-board (both indexed reads), 30s
  const contestRead = row.concurrentStreet / HFIX.streetPollSec;        // cheap indexed counter read (cached)
  const ping = row.concurrentMap / HFIX.occupancyPingSec;
  const auth = row.newRegs/perSec, join = row.newRegs/perSec;
  const hot = (row.concurrentMap*(CFG.ticketBuyersPerHourPeakPct+CFG.rsvpPerHourPeakPct))/perSec*30;
  const apiTotal = streetReads+contestRead+ping+auth+join+hot;
  return {contestRead,streetReads,ping,auth,join,hot,apiTotal};
}
const hComps=[['contestRead','contestReadPerSec'],['ping','pingWrites'],['auth','authSignups'],['join','joinWrites'],['hot','hotRowLockPerSec'],['apiTotal','apiGateway']];
const hBreak={};
for(const row of H){ const L=loadsH(row); for(const [m,c] of hComps){ if(hBreak[m])continue; if(L[m]>HFIX.ceil[c]) hBreak[m]={t:row.t,val:Math.round(L[m]),ceil:HFIX.ceil[c],cumUsers:row.cumUsers}; } }
const hPeakL = loadsH(peak);
console.log('  ── HARDENED SCENARIO (fixes applied) ──');
console.log(`  Peak API load now: ${M(hPeakL.apiTotal)} req/s  (ceiling ${M(HFIX.ceil.apiGateway)} req/s)`);
if(Object.keys(hBreak).length===0){
  console.log(`  ✓ SURVIVES the full curve to ${M(CFG.targetUsers)} — no component breaches.`);
  console.log('  Reaches 1.5M across all 10 days incl. both peak Saturdays.');
} else {
  console.log('  Still breaks:');
  for(const [m,b] of Object.entries(hBreak)) console.log(`   ✖ ${m} @ ${b.t}: ${M(b.val)}/s vs ${M(b.ceil)}/s (${M(b.cumUsers)} users)`);
}
console.log('\n══════════════════════════════════════════════════════════════════════\n');

// ───────────────────────── CROWD MOVEMENT + ENGAGEMENT model (per day) ─────────────────────────
// Every active user walks the site: platzes, potties, shops, first aid, stages — plus crowdsourced
// PHOTOS and HYPERPOSTS. Rates per unique app-user per day (labeled assumptions).
const MOVE = {
  onsiteAdoption: 0.55,      // of attendees, share carrying the map
  uniquePerPeak: 3.4,        // day unique maps ≈ peak concurrent × this
  pottyPerUser: 1.6,         // ≥2-min restroom dwells / user / day
  firstAidRate: 0.004,       // share of users with a first-aid visit
  shopPassBysPerUser: 8.0,   // 15 m frontage crossings / user / day
  photoTakerRate: 0.25, photosPerTaker: 3.0,     // crowdsourced photos
  hyperposterRate: 0.06, postsPerPoster: 1.4,    // HyperPost shares
  actDrawPeakFrac: 0.5,      // biggest single act ≈ this × peak concurrent
};
const festivalAttendance = 1_200_000;  // ~MusikFest 10-day gate (assumption)
const daily = CFG.days.map((day, di) => {
  const attend = Math.round(festivalAttendance * day.mult / totalWeight);
  const uniqueMaps = Math.round(attend * MOVE.onsiteAdoption);
  const dayRows = H.filter(r => r.hourIndex >= di*24 && r.hourIndex < di*24+24);
  let pk = dayRows[0]; for (const r of dayRows) if (r.concurrentMap > pk.concurrentMap) pk = r;
  return {
    d: day.d, dow: day.dow, attend, uniqueMaps,
    peakConcurrent: pk.concurrentMap,
    pottyUses: Math.round(uniqueMaps * MOVE.pottyPerUser),
    firstAid: Math.round(uniqueMaps * MOVE.firstAidRate),
    shopPassBys: Math.round(uniqueMaps * MOVE.shopPassBysPerUser),
    photos: Math.round(uniqueMaps * MOVE.photoTakerRate * MOVE.photosPerTaker),
    hyperposts: Math.round(uniqueMaps * MOVE.hyperposterRate * MOVE.postsPerPoster),
    actDrawPeak: Math.round(pk.concurrentMap * MOVE.actDrawPeakFrac),
  };
});
const tot = k => daily.reduce((a,d)=>a+d[k],0);
console.log('  ── 10-DAY CROWD MOVEMENT + ENGAGEMENT (occupancy report inputs) ──');
console.log('  day        dow  attendance  uniqueMaps  potty   firstAid  shopPassBys   photos   hyperposts');
for (const d of daily){
  console.log(`  ${d.d}  ${d.dow}  ${M(d.attend).padStart(8)}  ${M(d.uniqueMaps).padStart(9)}  ${M(d.pottyUses).padStart(6)}  ${M(d.firstAid).padStart(7)}  ${M(d.shopPassBys).padStart(10)}  ${M(d.photos).padStart(7)}  ${M(d.hyperposts).padStart(9)}`);
}
console.log(`  TOTALS           ${M(tot('attend')).padStart(8)}  ${M(tot('uniqueMaps')).padStart(9)}  ${M(tot('pottyUses')).padStart(6)}  ${M(tot('firstAid')).padStart(7)}  ${M(tot('shopPassBys')).padStart(10)}  ${M(tot('photos')).padStart(7)}  ${M(tot('hyperposts')).padStart(9)}`);
console.log('\n══════════════════════════════════════════════════════════════════════\n');

// export for the widget/report
module.exports = { H, breaches, peak, CFG, daily, loadsAt: (i)=>loads(H[i]) };
