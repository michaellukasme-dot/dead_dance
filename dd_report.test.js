/* dd_report.test.js — node harness for the report brain.
   Run: node dd_report.test.js   (expects "ALL GREEN").
   Covers: pure derivers/formatting, REAL-fetch honesty (mock client), and the
   sample-vs-real labeling contract the House Law requires. */
'use strict';
var R = require('./dd_report.js');
var pass=0, fail=0;
function ok(name, cond){ if(cond){ pass++; console.log('  ok  '+name); } else { fail++; console.log(' FAIL '+name); } }
function eq(name, a, b){ ok(name+'  ('+JSON.stringify(a)+' === '+JSON.stringify(b)+')', a===b); }

// ---- formatting ----
eq('fmtInt groups thousands', R.fmtInt(1234567), '1,234,567');
eq('money prefixes $', R.money(3500), '$3,500');
eq('pct rounds to 1dp', R.pct(45, 100), 45);
eq('pct guards zero whole', R.pct(5, 0), 0);
eq('hourLabel noon', R.hourLabel(12), '12 PM');
eq('hourLabel midnight', R.hourLabel(0), '12 AM');
eq('hourLabel 15 → 3 PM', R.hourLabel(15), '3 PM');
eq('slugify', R.slugify('Joe Russo’s Almost Dead'), 'joe-russo-s-almost-dead');
eq('titleCase from slug', R.titleCase('dark-star-orchestra'), 'Dark Star Orchestra');

// ---- derivers ----
var ph = R.peakHour([{hour:14,count:100},{hour:20,count:500},{hour:11,count:50}]);
ok('peakHour picks max', ph && ph.hour===20 && ph.label==='8 PM' && ph.count===500);
ok('peakHour null on empty', R.peakHour([])===null);
var cv = R.curve([{label:'a',count:0},{label:'b',count:50},{label:'c',count:100}]);
ok('curve normalizes to 0..100', cv[0].h===0 && cv[1].h===50 && cv[2].h===100);
ok('curve empty is []', R.curve([]).length===0);
var dw = R.rankByDwell([{name:'X',dwell:10},{name:'Y',dwell:40},{name:'Z',dwell:25}]);
ok('rankByDwell sorts desc + ranks', dw[0].name==='Y' && dw[0].rank===1 && dw[2].name==='X');
var ta = R.topActs([{act:'A',draw:100},{act:'B',draw:900},{act:'C',draw:500}]);
ok('topActs sorts by draw', ta[0].act==='B' && ta[0].rank===1);
ok('weatherNote rain path', /covered/.test(R.weatherNote(70,'Showers')));
ok('weatherNote hot path', /shade/.test(R.weatherNote(92,'Clear')));

// ---- REAL: reach from leaderboard jsonb ----
var reach = R.reachFromLeaderboard([{member:'st-a',cookies:120},{member:'st-b',cookies:80}]);
ok('reachFromLeaderboard sums cookies', reach.members===2 && reach.cookies===200 && reach.top.length===2);
ok('reachFromLeaderboard empty-safe', R.reachFromLeaderboard(null).members===0);

// ---- REAL: incident summary ----
var inc = R.incidentSummary([
  {status:'cleared', cleared_at:'x', minutes_to_clear:10},
  {status:'active', minutes_to_clear:null},
  {status:'cleared', cleared_at:'y', minutes_to_clear:20}
]);
ok('incidentSummary counts + clears + avg', inc.count===3 && inc.cleared===2 && inc.avgMinutes===15);
ok('incidentSummary empty', R.incidentSummary([]).count===0 && R.incidentSummary([]).avgMinutes===null);

// ---- sample determinism ----
var sf1 = JSON.stringify(R.sampleFestival('musikfest-2026'));
var sf2 = JSON.stringify(R.sampleFestival('musikfest-2026'));
ok('sampleFestival deterministic', sf1===sf2);
ok('sampleFestival differs by slug', sf1 !== JSON.stringify(R.sampleFestival('baconfest')));

// ---- festivalReport structure + labeling (NO client) ----
var fm = R.festivalReport('musikfest-2026');
ok('festivalReport kind=festival tier=less', fm.kind==='festival' && fm.tier==='less');
ok('festivalReport CTA → data_module.html', fm.cta && fm.cta.href==='data_module.html');
var reachSec = fm.sections.filter(function(s){return s.id==='reach';})[0];
var attendSec = fm.sections.filter(function(s){return s.id==='attendance';})[0];
ok('reach section is REAL (sample:false)', reachSec.sample===false && reachSec.real===true);
ok('attendance section is now REAL app-measured (was SAMPLE)', attendSec.sample===false && attendSec.appMeasured===true && attendSec.coverage==='sample');
ok('no-client: real section honestly empty', reachSec.empty===true && reachSec.metrics.length===0 && /live so far|fills in/i.test(reachSec.note));

// every section must carry an explicit boolean sample flag (no ambiguous labeling)
ok('every section has explicit sample flag', fm.sections.every(function(s){ return typeof s.sample==='boolean'; }));

// ---- actReport: all sample, labeled, CTA present ----
var am = R.actReport('musikfest-2026','Steve Kimock');
ok('actReport builds for an act', am.kind==='act' && am.act==='Steve Kimock');
ok('actReport: verified is REAL, all others SAMPLE (allSample:false)', am.allSample===false && am.sections.filter(function(s){return s.id!=='verified';}).every(function(s){return s.sample===true;}) && am.sections.filter(function(s){return s.id==='verified';})[0].sample===false);
ok('actReport CTA → data_module.html', am.cta && am.cta.href==='data_module.html');

// ================= NEW: app-measured REAL vs SAMPLE + SUPPRESSION =================

// ---- suppression: metricCell (<20 → "not enough data", ≥20 → real number) ----
ok('metricCell suppressed flag → SUPPRESSED_TEXT', R.metricCell(7, true).v===R.SUPPRESSED_TEXT && R.metricCell(7,true).suppressed===true);
ok('metricCell null value → SUPPRESSED_TEXT (never a 0)', R.metricCell(null, false).v===R.SUPPRESSED_TEXT && R.metricCell(null,false).v!=='0');
ok('metricCell >=20 → real formatted number', R.metricCell(1500, false).v==='1,500' && R.metricCell(1500,false).suppressed===false);
eq('SUPPRESSED_TEXT is the honest empty phrase', R.SUPPRESSED_TEXT, 'Not enough data yet');

// ---- honest framing: the app-measured label says opt-in sample + 100% official ----
ok('APP_MEASURED_NOTE names the DeadDance map', /DeadDance map/.test(R.APP_MEASURED_NOTE));
ok('APP_MEASURED_NOTE says opt-in sample today', /opt-in sample/i.test(R.APP_MEASURED_NOTE));
ok('APP_MEASURED_NOTE says 100% coverage as official app', /100% coverage/i.test(R.APP_MEASURED_NOTE) && /official app/i.test(R.APP_MEASURED_NOTE));

// ---- parseFestivalAggregate: coverage + per-cell suppression, no raw small number leaks ----
var agg = R.parseFestivalAggregate({ ok:true, app_measured:true, coverage:'sample', threshold:20,
  admits:1500, admits_suppressed:false,
  unique_devices:1200, unique_devices_suppressed:false,
  street_team_reach:null, street_team_reach_suppressed:true,
  by_stage:[ {stage:'steel', admits:300, suppressed:false}, {stage:'tiny', admits:null, suppressed:true} ] });
eq('aggregate coverage is sample framing', agg.coverage, 'sample');
ok('aggregate admits real when >=20', agg.admits.v==='1,500' && agg.admits.suppressed===false);
ok('aggregate reach suppressed → not-enough-data', agg.streetTeamReach.v===R.SUPPRESSED_TEXT);
ok('aggregate by_stage keeps real cell', agg.byStage[0].admits===300 && agg.byStage[0].suppressed===false);
ok('aggregate by_stage suppressed cell → null admits (never raw small n)', agg.byStage[1].admits===null && agg.byStage[1].suppressed===true);
ok('aggregate not empty when real data present', agg.empty===false);

// ---- parseFestivalAggregate: all suppressed / failed → honest empty, coverage still sample ----
var aggEmpty = R.parseFestivalAggregate({ ok:true, app_measured:true, coverage:'sample',
  admits:null, admits_suppressed:true, unique_devices:null, unique_devices_suppressed:true,
  street_team_reach:null, street_team_reach_suppressed:true, by_stage:[] });
ok('all-suppressed aggregate is honestly empty', aggEmpty.empty===true && aggEmpty.coverage==='sample');
ok('failed/garbage aggregate → empty, defaults to sample coverage', R.parseFestivalAggregate(null).empty===true && R.parseFestivalAggregate(null).coverage==='sample');

// ---- parseActAggregate: suppressed vs real ----
ok('act aggregate suppressed → not-enough-data + empty', (function(){ var a=R.parseActAggregate({ok:true,app_measured:true,coverage:'sample',admits:null,admits_suppressed:true}); return a.admits.v===R.SUPPRESSED_TEXT && a.empty===true; })());
ok('act aggregate real >=20 → number, not empty', (function(){ var a=R.parseActAggregate({ok:true,app_measured:true,coverage:'sample',admits:88,admits_suppressed:false}); return a.admits.v==='88' && a.empty===false; })());

// ---- festivalReport labeling contract: REAL app-measured vs still-SAMPLE ----
var fm2 = R.festivalReport('musikfest-2026');
function fmSec(id){ return fm2.sections.filter(function(s){return s.id===id;})[0]; }
ok('attendance now REAL app-measured (sample:false, appMeasured, coverage sample)',
   fmSec('attendance').sample===false && fmSec('attendance').appMeasured===true && fmSec('attendance').coverage==='sample');
ok('unique devices now REAL app-measured', fmSec('devices').sample===false && fmSec('devices').appMeasured===true);
ok('by-stage admits now REAL app-measured', fmSec('stage_admits').sample===false && fmSec('stage_admits').appMeasured===true);
ok('street-team reach REAL app-measured', fmSec('reach').sample===false && fmSec('reach').appMeasured===true);
ok('dwell-MINUTES stays SAMPLE (no real pipeline)', fmSec('dwell').sample===true);
ok('peak hours stays SAMPLE', fmSec('peak').sample===true);
ok('weather stays SAMPLE', fmSec('weather').sample===true);
ok('top acts by draw stays SAMPLE', fmSec('topacts').sample===true);
ok('no-client: app-measured attendance honestly empty (no fake numbers)',
   fmSec('attendance').empty===true && fmSec('attendance').metrics.length===0);

// ---- actReport: verified-at-stage is REAL app-measured, rest SAMPLE ----
var am2 = R.actReport('musikfest-2026','Steve Kimock');
var vSec = am2.sections.filter(function(s){return s.id==='verified';})[0];
ok('actReport verified section is REAL app-measured', vSec.sample===false && vSec.appMeasured===true);
ok('actReport no longer allSample (one real section)', am2.allSample===false);
ok('actReport other sections stay SAMPLE', am2.sections.filter(function(s){return s.id!=='verified';}).every(function(s){return s.sample===true;}));

// ---- REAL fetch honesty via MOCK client (exercise .then path) ----
function mockClient(byName){
  return { rpc:function(name){ return Promise.resolve({ data: byName[name]!==undefined ? byName[name] : null, error:null }); } };
}
var withData = mockClient({
  sf_st_leaderboard: [{member:'st-1',cookies:300},{member:'st-2',cookies:150}],
  dd_festalert_report: [{status:'cleared',cleared_at:'z',minutes_to_clear:12}]
});
R.festivalReport('musikfest-2026', function(m){
  var rs = m.sections.filter(function(s){return s.id==='reach';})[0];
  var ss = m.sections.filter(function(s){return s.id==='safety';})[0];
  ok('MOCK: reach loaded from server data', rs.loaded===true && rs.empty===false && rs.metrics.length>0);
  ok('MOCK: reach still labeled REAL (sample:false)', rs.sample===false);
  ok('MOCK: safety loaded from server data', ss.loaded===true && ss.empty===false && ss.metrics.length>0);

  // empty-server client → honest empty, still real
  var emptyClient = mockClient({ sf_st_leaderboard: [], dd_festalert_report: [] });
  R.festivalReport('musikfest-2026', function(m2){
    var rs2 = m2.sections.filter(function(s){return s.id==='reach';})[0];
    ok('MOCK empty: reach honest empty state', rs2.loaded===true && rs2.empty===true && /no .*cookies|live/i.test(rs2.note));
    runAggregateMocks(finish);
  }, emptyClient);
}, withData);

function runAggregateMocks(next){
  // REAL app-measured aggregate with data >=20 → real numbers, coverage sample, per-cell suppression
  var aggClient = mockClient({
    sf_report_festival: { ok:true, app_measured:true, coverage:'sample', threshold:20,
      admits:1500, admits_suppressed:false, unique_devices:1200, unique_devices_suppressed:false,
      street_team_reach:45, street_team_reach_suppressed:false,
      by_stage:[ {stage:'steel', admits:300, suppressed:false}, {stage:'tiny', admits:null, suppressed:true} ] },
    sf_st_leaderboard: [], dd_festalert_report: []
  });
  R.festivalReport('musikfest-2026', function(m){
    var att = m.sections.filter(function(s){return s.id==='attendance';})[0];
    var st  = m.sections.filter(function(s){return s.id==='stage_admits';})[0];
    ok('MOCK agg: attendance loaded REAL admits', att.loaded===true && att.empty===false && /1,500/.test(JSON.stringify(att.metrics)));
    ok('MOCK agg: attendance still labeled app-measured REAL', att.sample===false && att.appMeasured===true);
    ok('MOCK agg: by-stage real cell shows admits', /300 admits/.test(JSON.stringify(st.rows)));
    ok('MOCK agg: by-stage suppressed cell shows "'+R.SUPPRESSED_TEXT+'" (not a 0)', st.rows.some(function(r){return r.v===R.SUPPRESSED_TEXT;}) && !/\b0 admits\b/.test(JSON.stringify(st.rows)));

    // suppressed aggregate (<20 everywhere) → honest empty, never fake numbers
    var suppClient = mockClient({
      sf_report_festival: { ok:true, app_measured:true, coverage:'sample',
        admits:null, admits_suppressed:true, unique_devices:null, unique_devices_suppressed:true,
        street_team_reach:null, street_team_reach_suppressed:true, by_stage:[] },
      sf_st_leaderboard: [], dd_festalert_report: []
    });
    R.festivalReport('musikfest-2026', function(m2){
      var att2 = m2.sections.filter(function(s){return s.id==='attendance';})[0];
      ok('MOCK suppressed agg: attendance honest empty, no fabricated number', att2.empty===true && att2.metrics.length===0 && att2.sample===false);

      // act slice: suppressed → "not enough data", real → number
      var actSupp = mockClient({ sf_report_act:{ ok:true, app_measured:true, coverage:'sample', admits:null, admits_suppressed:true } });
      R.actReport('musikfest-2026','Steve Kimock', function(a){
        var v=a.sections.filter(function(s){return s.id==='verified';})[0];
        ok('MOCK act suppressed: verified section honest empty', v.loaded===true && v.empty===true);
        var actReal = mockClient({ sf_report_act:{ ok:true, app_measured:true, coverage:'sample', admits:120, admits_suppressed:false } });
        R.actReport('musikfest-2026','Steve Kimock', function(a2){
          var v2=a2.sections.filter(function(s){return s.id==='verified';})[0];
          ok('MOCK act real: verified section shows REAL admits', v2.empty===false && /120/.test(JSON.stringify(v2.metrics)) && v2.appMeasured===true);
          next();
        }, actReal);
      }, actSupp);
    }, suppClient);
  }, aggClient);
}

function finish(){
  console.log('\n'+(fail===0?'ALL GREEN':'RED')+' — '+pass+' passed, '+fail+' failed  ('+(pass+fail)+' assertions)');
  process.exit(fail===0?0:1);
}
