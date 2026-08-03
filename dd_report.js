/* ============================================================================
 * dd_report.js — the DeadDance DATA REPORT brain (the free LESS-tier teaser
 * that sells the paid MORE/MOST tiers in data_module.html).
 *
 * HOUSE LAW (honesty is legally load-bearing — we SELL this data):
 *   • REAL aggregates are pulled from anon-granted read RPCs, guarded .then/.catch,
 *     with honest empty states ("no data yet / live so far") when the server is
 *     empty or unreachable. sample:false on those sections.
 *   • Anything we do NOT have a live server pipeline for is marked sample:true and
 *     rendered under a plain "SAMPLE / preview" label — a preview of what Complete
 *     Access delivers. We NEVER present a fabricated number as real festival data.
 *
 *   HONEST FRAMING for the app-measured numbers (the pitch to ArtsQuest):
 *     Today DeadDance is NOT MusikFest's official app, so attendance/admits are an
 *     OPT-IN SAMPLE — "measured by the DeadDance map" — NOT true festival
 *     attendance. coverage:'sample'. At an official event (StageFill as THE map)
 *     coverage → 100% and the same pipeline reports real total attendance.
 *
 *   What is REAL, app-measured today (all from anon-granted, cohort-SUPPRESSED RPCs):
 *     - Verified admits         → sf_report_festival(festival)  (21_report_aggregates.sql)
 *     - Unique devices          → sf_report_festival(festival)
 *     - Verified admits by stage→ sf_report_festival(festival)  (each cell suppressed <20)
 *     - Street-team reach       → sf_report_festival(festival)  +  sf_st_leaderboard (detail)
 *     - Per-act/stage slice     → sf_report_act(festival, stage)
 *     - Incident / safety       → dd_festalert_report(festival) (04_festival_safety.sql)
 *   PRIVACY: every count < 20 is SUPPRESSED server-side (returned null + *_suppressed)
 *     and rendered as "not enough data yet" — never a raw small number, never a zero.
 *
 *   What is STILL SAMPLE (no real server pipeline yet — clearly labeled preview):
 *     - dwell MINUTES per stage, peak-hour curve, weather correlation,
 *       top-acts-by-draw, crowd flow in/out, fans-gained.
 *
 * Pure + deterministic derivation/formatting (unit-tested) + guarded data fetch.
 * Dual browser/node export. No backend = honest empty real sections, sample stays sample.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  // The one honest label every app-measured (REAL, opt-in) metric carries.
  var APP_MEASURED_NOTE = '📡 Measured by the DeadDance map — an opt-in sample today; 100% coverage as your official app.';
  // What a suppressed (<20) cohort cell says — never a zero, never a guess.
  var SUPPRESSED_TEXT = 'Not enough data yet';

  // ---------------------------------------------------------------- formatting
  function fmtInt(n){ n=Math.round(+n||0); return n.toLocaleString('en-US'); }
  function money(n){ return '$'+fmtInt(n); }
  function pct(part, whole){ whole=+whole||0; if(!whole) return 0; return Math.round((+part||0)/whole*1000)/10; }
  function hourLabel(h){ h=((Math.round(+h||0))%24+24)%24; var ap=h<12?'AM':'PM'; var hh=h%12; if(hh===0) hh=12; return hh+' '+ap; }
  function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function titleCase(s){ return String(s||'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g,function(c){return c.toUpperCase();}); }

  // ------------------------------------------------------------- pure derivers
  // peak hour from an array of {hour, count}
  function peakHour(hourly){
    if(!hourly || !hourly.length) return null;
    var best=null;
    hourly.forEach(function(p){ if(!best || (+p.count||0) > (+best.count||0)) best=p; });
    if(!best) return null;
    return { hour:+best.hour||0, count:Math.round(+best.count||0), label:hourLabel(best.hour) };
  }
  // normalize a set of points into 0..100 bar heights (for the arrival/departure curve)
  function curve(points){
    points = points || [];
    var max=0; points.forEach(function(p){ var v=+(p&&p.count!=null?p.count:p)||0; if(v>max) max=v; });
    return points.map(function(p){
      var v=+(p&&p.count!=null?p.count:p)||0;
      return { label:(p&&p.label!=null)?p.label:'', count:Math.round(v), h: max? Math.round(v/max*100):0 };
    });
  }
  // rank stages by dwell (desc); input [{name, dwell}]
  function rankByDwell(stages){
    return (stages||[]).slice().map(function(s){ return { name:s.name, dwell:+s.dwell||0 }; })
      .sort(function(a,b){ return b.dwell-a.dwell; })
      .map(function(s,i){ s.rank=i+1; return s; });
  }
  // top acts by draw (desc); input [{act, draw}]
  function topActs(acts){
    return (acts||[]).slice().map(function(a){ return { act:a.act, draw:+a.draw||0, stage:a.stage||null }; })
      .sort(function(a,b){ return b.draw-a.draw; })
      .map(function(a,i){ a.rank=i+1; return a; });
  }
  // a plain-English weather note (illustrative correlation copy)
  function weatherNote(tempF, cond){
    tempF = (tempF==null? null : Math.round(+tempF));
    cond = String(cond||'').toLowerCase();
    var wet = /rain|storm|shower/.test(cond);
    var hot = tempF!=null && tempF>=88;
    if(wet) return 'Rain in the window — dwell shifts to covered Platzes & tents.';
    if(hot) return 'Hot & clear — shade + water lines run heavy, evening sets draw hardest.';
    if(tempF!=null && tempF<=55) return 'Cool & dry — crowd clusters tight around stages.';
    return 'Clear & mild — steady flow, peak builds into the evening headliners.';
  }

  // ------------------------------------------------ REAL app-measured helpers
  // Turn a (value, suppressed) pair from a suppressed RPC into a display cell.
  // suppressed OR null value → the honest "not enough data yet" string (never 0).
  function metricCell(value, suppressed){
    if(suppressed || value==null) return { v: SUPPRESSED_TEXT, suppressed:true };
    return { v: fmtInt(value), suppressed:false, n: Math.round(+value||0) };
  }
  // Parse the jsonb payload from sf_report_festival() into a normalized model.
  // Defensive: bad/empty/failed payload → an all-suppressed, honest shell.
  function parseFestivalAggregate(payload){
    var p = payload || {};
    var ok = !!p.ok && p.app_measured===true;
    var byStage = Array.isArray(p.by_stage) ? p.by_stage.map(function(s){
      var supp = (s && s.suppressed) || s==null || s.admits==null;
      return { stage: (s&&s.stage)||'—', admits: supp?null:Math.round(+s.admits||0), suppressed:!!supp };
    }) : [];
    return {
      ok: ok,
      appMeasured: true,
      coverage: (p.coverage==='sample' || p.coverage==='full') ? p.coverage : 'sample',
      threshold: (+p.threshold||20),
      admits:            metricCell(p.admits, p.admits_suppressed),
      devices:           metricCell(p.unique_devices, p.unique_devices_suppressed),
      streetTeamReach:   metricCell(p.street_team_reach, p.street_team_reach_suppressed),
      byStage: byStage,
      // an aggregate is "empty" (nothing to show yet) when EVERY headline cell is suppressed
      // AND there is no visible per-stage cell — i.e. genuinely no data measured yet.
      empty: (function(){
        var anyStage = byStage.some(function(s){ return !s.suppressed; });
        return !ok || (p.admits==null && p.unique_devices==null && p.street_team_reach==null && !anyStage);
      })()
    };
  }
  // Parse sf_report_act() → a single suppressed admits cell + coverage.
  function parseActAggregate(payload){
    var p = payload || {};
    var ok = !!p.ok && p.app_measured===true;
    return {
      ok: ok, appMeasured:true,
      coverage: (p.coverage==='sample' || p.coverage==='full') ? p.coverage : 'sample',
      admits: metricCell(p.admits, p.admits_suppressed),
      empty: (!ok || p.admits==null)
    };
  }

  // REAL: reach from sf_st_leaderboard() jsonb array [{member, cookies}]
  function reachFromLeaderboard(rows){
    if(!Array.isArray(rows)) return { members:0, cookies:0, top:[] };
    var cookies=0;
    var top=rows.map(function(r){ var c=Math.round(+(r&&r.cookies)||0); cookies+=c; return { member:(r&&r.member)||'—', cookies:c }; });
    return { members:top.length, cookies:cookies, top:top };
  }
  // REAL: incident summary from dd_festalert_report() rows
  function incidentSummary(rows){
    if(!Array.isArray(rows) || !rows.length) return { count:0, cleared:0, avgMinutes:null };
    var cleared=0, mins=0, mc=0;
    rows.forEach(function(r){
      if(r && (r.status==='cleared' || r.cleared_at)) cleared++;
      var m = r && r.minutes_to_clear;
      if(m!=null && !isNaN(+m)){ mins+=(+m); mc++; }
    });
    return { count:rows.length, cleared:cleared, avgMinutes: mc? Math.round(mins/mc*10)/10 : null };
  }

  // ------------------------------------------------ deterministic sample maker
  // seeded so the "preview" is stable per-festival/act, and is ALWAYS labeled sample.
  function seed(str){ var h=2166136261>>>0; str=String(str||''); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0); }
  function rng(s){ var x=s||123456789; return function(){ x^=x<<13; x^=x>>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }

  var SAMPLE_STAGES = ['Wind Creek Steel Stage','PNC Stadtplatz','Guardian Life Zinzenplatz','Americaplatz (Levitt)','Yuengling Lagerplatz','Plaza Tropical','Liederplatz','Festplatz'];

  function sampleFestival(slug){
    var r=rng(seed('fest|'+slug));
    var attendance = 180000 + Math.round(r()*120000);
    var redemptions = Math.round(attendance*(0.42+r()*0.12));
    var devices = Math.round(attendance*(0.5+r()*0.15));
    var stages = SAMPLE_STAGES.map(function(n){ return { name:n, dwell: 18+Math.round(r()*46) }; });
    var hourly=[]; for(var h=11;h<=23;h++){ var base = h<18? (h-11) : (23-h)+6; hourly.push({ hour:h, count: Math.round((base+1)*(600+r()*500)) }); }
    var acts = ['Steve Kimock','Dark Star Orchestra','Joe Russo’s Almost Dead','Melvin Seals & JGB','John Mayer','Jerry’s Middle Finger']
      .map(function(a){ return { act:a, draw: 3000+Math.round(r()*14000), stage: SAMPLE_STAGES[Math.floor(r()*SAMPLE_STAGES.length)] }; });
    return { attendance:attendance, redemptions:redemptions, devices:devices,
      dwell: rankByDwell(stages), hourly:hourly, peak:peakHour(hourly),
      topActs: topActs(acts), weather:{ tempF: 78+Math.round(r()*14), cond:(r()<0.25?'Showers':'Clear') } };
  }
  function sampleAct(slug, act){
    var r=rng(seed('act|'+slug+'|'+slugify(act)));
    var stageAttend = 2200 + Math.round(r()*16000);
    var pts=[]; ['−60m','−30m','set start','+30m','+60m','+90m','after'].forEach(function(lab,i){
      var shape=[0.15,0.45,0.9,1.0,0.8,0.5,0.2][i];
      pts.push({ label:lab, count: Math.round(stageAttend*shape*(0.85+r()*0.3)) });
    });
    return {
      stageAttend: stageAttend,
      curve: curve(pts),
      dwellMin: 22+Math.round(r()*38),
      proximityDraw: Math.round(stageAttend*(0.2+r()*0.25)),
      crowdFlowIn: Math.round(stageAttend*(0.5+r()*0.3)),
      crowdFlowOut: Math.round(stageAttend*(0.4+r()*0.3)),
      fansGained: 40+Math.round(r()*260),
      weather:{ tempF: 76+Math.round(r()*16), cond:(r()<0.25?'Showers':'Clear') }
    };
  }

  // ----------------------------------------------------------- guarded client
  function C(client){ try{ if(client && client.rpc) return client; if(typeof root.ddClient==='function'){ var c=root.ddClient(); if(c && c.rpc) return c; } }catch(e){} return null; }

  // ------------------------------------------------------------- the builders
  // festivalReport(slug, cb, client) → returns a model synchronously; cb(model)
  // fires once the guarded REAL reads settle (or immediately if there is no client).
  function festivalReport(festivalSlug, cb, client){
    var slug = slugify(festivalSlug) || String(festivalSlug||'');
    var samp = sampleFestival(slug);
    var model = {
      kind:'festival', tier:'less', festival:slug, title: titleCase(slug),
      generatedAt: new Date().toISOString(),
      sections: [
        // --- REAL (app-measured, opt-in sample): attendance / admits + reach ---
        { id:'attendance', label:'Attendance — verified admits', sample:false, real:true, appMeasured:true,
          coverage:'sample', loaded:false, empty:true,
          note:'Live so far — measured by the DeadDance map as fans verify at the show.', metrics:[] },
        // --- REAL (app-measured): unique devices ---
        { id:'devices', label:'Unique devices on the map', sample:false, real:true, appMeasured:true,
          coverage:'sample', loaded:false, empty:true,
          note:'Live so far — counts opt-in devices, never identities.', metrics:[] },
        // --- REAL (app-measured): verified admits BY STAGE (each cell suppressed <20) ---
        { id:'stage_admits', label:'Verified admits by stage', sample:false, real:true, appMeasured:true,
          coverage:'sample', loaded:false, empty:true,
          note:'Live so far — fills in per stage as fans verify. Small stages read “'+SUPPRESSED_TEXT+'” until the cohort is large enough to show safely.', rows:[] },
        // --- REAL: street-team reach detail (sf_st_leaderboard, anon) ---
        { id:'reach', label:'Street-team reach', sample:false, real:true, appMeasured:true,
          coverage:'sample', loaded:false, empty:true,
          note:'Live so far — fills in as the street team logs cookies during the festival.', metrics:[] },
        // --- SAMPLE sections (no real server pipeline yet) ---
        { id:'dwell', label:'Dwell by stage (avg minutes)', sample:true, rows:
            samp.dwell.map(function(s){ return { name:s.name, v:s.dwell+' min', rank:s.rank }; }) },
        { id:'peak', label:'Peak hours', sample:true, metrics:[
            { k:'Busiest hour', v: samp.peak? samp.peak.label : '—' },
            { k:'Peak-hour presence', v: samp.peak? fmtInt(samp.peak.count) : '—' } ],
          bars: curve(samp.hourly.map(function(h){ return { label:hourLabel(h.hour), count:h.count }; })) },
        { id:'weather', label:'Weather correlation', sample:true, metrics:[
            { k:'Conditions', v: samp.weather.tempF+'°F · '+samp.weather.cond },
            { k:'Read', v: weatherNote(samp.weather.tempF, samp.weather.cond) } ] },
        { id:'topacts', label:'Top acts by draw', sample:true, rows:
            samp.topActs.map(function(a){ return { name:a.act, v:fmtInt(a.draw)+' drawn', sub:a.stage, rank:a.rank }; }) },
        // --- REAL section: incident / safety report (dd_festalert_report, anon) ---
        { id:'safety', label:'Incident & safety report', sample:false, real:true, loaded:false, empty:true,
          note:'Live so far — populated by the on-site alert & confirm feed.', metrics:[] }
      ],
      cta: { href:'data_module.html', label:'🔓 Unlock Complete Access — full filterable data + raw feed' }
    };

    function sec(id){ for(var i=0;i<model.sections.length;i++){ if(model.sections[i].id===id) return model.sections[i]; } return null; }
    var c = C(client);
    if(!c){ // no client — REAL sections stay honestly empty; sample stays sample
      if(cb) try{ cb(model); }catch(e){}
      return model;
    }

    var pending=3, done=function(){ pending--; if(pending<=0 && cb){ try{ cb(model); }catch(e){} } };

    // REAL read #1 — app-measured aggregate (admits / devices / reach / by-stage)
    try{
      c.rpc('sf_report_festival', { p_festival: slug }).then(function(res){
        var A = parseFestivalAggregate(res && res.data);
        var att = sec('attendance'), dev = sec('devices'), st = sec('stage_admits'), reach = sec('reach');
        att.loaded=true; dev.loaded=true; st.loaded=true;
        att.coverage=dev.coverage=st.coverage=A.coverage;
        if(A.ok && !A.empty){
          att.empty=false;
          att.metrics=[ { k:'Verified admits (opt-in sample)', v:A.admits.v },
                        { k:'Street-team reach', v:A.streetTeamReach.v } ];
          dev.empty=false;
          dev.metrics=[ { k:'Distinct devices', v:A.devices.v },
                        { k:'Never identities', v:'privacy-safe' } ];
          st.empty = (A.byStage.length===0);
          st.rows = A.byStage.map(function(s,i){
            return { name:s.stage, v: s.suppressed ? SUPPRESSED_TEXT : (fmtInt(s.admits)+' admits'), rank:i+1 };
          });
          if(st.empty) st.note='No stage has enough verified admits yet — this fills in live during the festival.';
        } else {
          att.empty=true; dev.empty=true; st.empty=true;
          att.note=dev.note=st.note='No verified admits measured yet — this fills in live as fans opt in during the festival.';
        }
        done();
      }).catch(function(){
        var att=sec('attendance'), dev=sec('devices'), st=sec('stage_admits');
        att.loaded=dev.loaded=st.loaded=true; att.empty=dev.empty=st.empty=true;
        att.note=dev.note=st.note='Couldn’t reach StageFill for app-measured data right now — shows live during the festival.';
        done();
      });
    }catch(e){ var att=sec('attendance'), dev=sec('devices'), st=sec('stage_admits');
      att.loaded=dev.loaded=st.loaded=true; att.empty=dev.empty=st.empty=true; done(); }

    // REAL read #2 — street-team reach detail (recruiter leaderboard)
    try{
      c.rpc('sf_st_leaderboard', { p_festival: slug }).then(function(res){
        var reach = sec('reach');
        var rows = res && res.data;
        var r = reachFromLeaderboard(Array.isArray(rows)?rows:[]);
        if(r.members){ reach.loaded=true; reach.empty=false;
          reach.metrics=[ { k:'Recruiters active today', v:fmtInt(r.members) },
                          { k:'Cookies earned (reach signal)', v:fmtInt(r.cookies) } ];
          reach.rows = r.top.map(function(t,i){ return { name:'Recruiter '+t.member, v:fmtInt(t.cookies)+' 🍪', rank:i+1 }; });
        } else { reach.loaded=true; reach.empty=true; reach.note='No street-team cookies logged yet today — this fills in live during the festival.'; }
        done();
      }).catch(function(){ var reach=sec('reach'); reach.loaded=true; reach.empty=true;
        reach.note='Couldn’t reach StageFill for street-team data right now — shows live during the festival.'; done(); });
    }catch(e){ var reach=sec('reach'); reach.loaded=true; reach.empty=true; done(); }

    // REAL read #3 — incident / safety report
    try{
      c.rpc('dd_festalert_report', { p_fest: slug }).then(function(res){
        var safety = sec('safety');
        var rows = res && res.data;
        var s = incidentSummary(Array.isArray(rows)?rows:[]);
        if(s.count){ safety.loaded=true; safety.empty=false;
          safety.metrics=[ { k:'Incidents logged', v:fmtInt(s.count) },
                           { k:'Cleared', v:fmtInt(s.cleared) },
                           { k:'Avg time to clear', v: s.avgMinutes!=null ? s.avgMinutes+' min' : '—' } ];
        } else { safety.loaded=true; safety.empty=true; safety.note='No incidents logged — a clean festival, or the feed is live-so-far.'; }
        done();
      }).catch(function(){ var safety=sec('safety'); safety.loaded=true; safety.empty=true;
        safety.note='Couldn’t reach StageFill for the incident feed right now — shows live during the festival.'; done(); });
    }catch(e){ var safety=sec('safety'); safety.loaded=true; safety.empty=true; done(); }

    return model;
  }

  // actReport(slug, act, cb, client) → per-act slice. The verified at-this-stage
  // admits count is now REAL (app-measured, suppressed) via sf_report_act; every
  // OTHER per-act metric has no real pipeline yet and stays a labeled SAMPLE. cb(model).
  function actReport(festivalSlug, act, cb, client){
    var slug = slugify(festivalSlug) || String(festivalSlug||'');
    var actName = titleCase(act);
    var s = sampleAct(slug, act);
    var model = {
      kind:'act', tier:'less', festival:slug, act:actName, title: actName+' — Festival Report',
      generatedAt: new Date().toISOString(),
      allSample:false,   // one section (verified admits) is REAL app-measured
      sections: [
        // --- REAL (app-measured, opt-in sample): verified admits at their stage ---
        { id:'verified', label:'Verified at their stage', sample:false, real:true, appMeasured:true,
          coverage:'sample', loaded:false, empty:true,
          note:'Live so far — measured by the DeadDance map as fans verify at this stage. Shows “'+SUPPRESSED_TEXT+'” until the cohort is large enough to show safely.', metrics:[] },
        // --- SAMPLE sections (no real per-act pipeline) ---
        { id:'stage_attend', label:'Their stage — attendance', sample:true, metrics:[
            { k:'Drawn to the stage', v:fmtInt(s.stageAttend) },
            { k:'Proximity draw (walked-by)', v:fmtInt(s.proximityDraw) } ] },
        { id:'curve', label:'Arrival / departure curve', sample:true, bars:s.curve },
        { id:'dwell', label:'Dwell during their set', sample:true, metrics:[
            { k:'Avg dwell', v: s.dwellMin+' min' } ] },
        { id:'flow', label:'Crowd flow', sample:true, metrics:[
            { k:'Flowed in', v:fmtInt(s.crowdFlowIn) },
            { k:'Flowed out', v:fmtInt(s.crowdFlowOut) } ] },
        { id:'weather', label:'Weather at their set', sample:true, metrics:[
            { k:'Conditions', v: s.weather.tempF+'°F · '+s.weather.cond },
            { k:'Read', v: weatherNote(s.weather.tempF, s.weather.cond) } ] },
        { id:'fans', label:'Fans gained', sample:true, metrics:[
            { k:'New fans (est.)', v:fmtInt(s.fansGained) } ] }
      ],
      cta: { href:'data_module.html', label:'🔓 Unlock Complete Access — full filterable data + raw feed' }
    };

    function sec(id){ for(var i=0;i<model.sections.length;i++){ if(model.sections[i].id===id) return model.sections[i]; } return null; }
    var c = C(client);
    if(!c){ if(cb) try{ cb(model); }catch(e){} return model; }

    // REAL read — per-act/stage verified admits (suppressed <20)
    try{
      c.rpc('sf_report_act', { p_festival: slug, p_act: slugify(act) }).then(function(res){
        var v = sec('verified');
        var A = parseActAggregate(res && res.data);
        v.loaded=true; v.coverage=A.coverage;
        if(A.ok && !A.empty){ v.empty=false;
          v.metrics=[ { k:'Verified at this stage (opt-in sample)', v:A.admits.v } ];
        } else { v.empty=true;
          v.note='No verified admits at this stage yet — this fills in live as fans opt in during the set.'; }
        if(cb) try{ cb(model); }catch(e){}
      }).catch(function(){ var v=sec('verified'); v.loaded=true; v.empty=true;
        v.note='Couldn’t reach StageFill for app-measured data right now — shows live during the set.';
        if(cb) try{ cb(model); }catch(e){} });
    }catch(e){ var v=sec('verified'); v.loaded=true; v.empty=true; if(cb) try{ cb(model); }catch(e){} }

    return model;
  }

  var api = {
    // constants (honest labels)
    APP_MEASURED_NOTE:APP_MEASURED_NOTE, SUPPRESSED_TEXT:SUPPRESSED_TEXT,
    // formatting
    fmtInt:fmtInt, money:money, pct:pct, hourLabel:hourLabel, slugify:slugify, titleCase:titleCase,
    // derivers
    peakHour:peakHour, curve:curve, rankByDwell:rankByDwell, topActs:topActs, weatherNote:weatherNote,
    reachFromLeaderboard:reachFromLeaderboard, incidentSummary:incidentSummary,
    // REAL app-measured parsing + suppression
    metricCell:metricCell, parseFestivalAggregate:parseFestivalAggregate, parseActAggregate:parseActAggregate,
    // sample makers (always labeled sample when rendered)
    sampleFestival:sampleFestival, sampleAct:sampleAct,
    // builders
    festivalReport:festivalReport, actReport:actReport
  };
  root.DDReport = api;
  if (typeof module!=='undefined' && module.exports) module.exports = api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
