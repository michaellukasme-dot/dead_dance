/* ============================================================================
 * dd_geo_analytics.js — DeadDance PHASE 2 festival GEO-ANALYTICS brain
 * (pure, deterministic client logic + guarded fetch + labeled synthetic demo).
 *
 * HONEST STATUS (House Law, first lines):
 *   • The PURE logic here (time-bucketing, the ≥20 cohort-suppression guard,
 *     point-in-geofence tests, dwell math, O/D flow-matrix formatting, the demo
 *     dataset generator) is deterministic and Node-tested — see
 *     dd_geo_analytics.test.js. It performs NO I/O and mutates no globals.
 *   • This module reads AGGREGATE, cohort-suppressed analytics ONLY. It never
 *     requests, receives, or renders an individual journey, a token, or a lat/lng.
 *     The client-side floor here MIRRORS the server floor in 23_geo_analytics.sql
 *     (defense in depth) — it is NOT the only gate; the RPC already suppresses.
 *   • NO real device data exists yet (native GPS is unproven on-device — see
 *     NATIVE_GPS_PLAN.md). buildDemoDataset() returns clearly-labeled SYNTHETIC
 *     data so the festival pitch can be DEMOED. isDemo:true rides on every demo
 *     payload; the view must show the [DEMO DATA] banner and NEVER present these
 *     numbers as real. The moment the RPCs return real rows, the same view reads
 *     live via fetchGeoMetric() and the demo is switched off.
 *   • Every Supabase .rpc() call is chained .then().catch() (the silent-drop law)
 *     and reports an honest status: ✅ live / ⚠️ reached-but-error / 📴 offline.
 *
 * EXPORTS: window.DDGeoAnalytics (browser) AND module.exports (node) — dual, guarded.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  // K-anon floor — reused verbatim from 22_geo.sql / 23_geo_analytics.sql.
  var K_PRESENCE = 20;
  var SUPPRESSED_TEXT = 'Not enough data yet';
  var STATUS = { LIVE: '✅', ERR: '⚠️', OFFLINE: '📴' };
  var DEMO_LABEL = '[DEMO DATA — synthetic, replaced by live data once native GPS is validated on device]';

  // ------------------------------------------------------------- geo math
  function toRad(d){ return (+d || 0) * Math.PI / 180; }
  // haversine metres between two lat/lon points. Mirrors dd_geo_haversine_m in SQL.
  function haversineM(lat1, lon1, lat2, lon2){
    if(lat1==null||lon1==null||lat2==null||lon2==null) return null;
    var R = 6371000;
    var dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  // circle test: is (lat,lon) within fence.radius_m of fence center?
  function pointInCircle(lat, lon, fence){
    if(!fence || fence.center_lat==null || fence.center_lon==null) return false;
    var d = haversineM(lat, lon, fence.center_lat, fence.center_lon);
    return d!=null && d <= (+fence.radius_m || 0);
  }
  // ray-cast: is (lat,lon) inside the polygon ring [[lat,lon]...]? Mirrors the SQL.
  function pointInPolygon(lat, lon, ring){
    if(!Array.isArray(ring) || ring.length < 3) return false;
    var inside = false;
    for(var i=0, j=ring.length-1; i<ring.length; j=i++){
      var yi = +ring[i][0], xi = +ring[i][1];
      var yj = +ring[j][0], xj = +ring[j][1];
      var denom = (yj - yi) || 1e-12;
      if(((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / denom + xi)){
        inside = !inside;
      }
    }
    return inside;
  }
  // fence membership: polygon ray-cast if a ring is authored, else circle.
  function inFence(lat, lon, fence){
    if(!fence || lat==null || lon==null) return false;
    if(Array.isArray(fence.polygon) && fence.polygon.length >= 3) return pointInPolygon(lat, lon, fence.polygon);
    return pointInCircle(lat, lon, fence);
  }

  // ------------------------------------------------------------- time buckets
  // bucket start (epoch ms) for a point, given a bucket width in minutes.
  function timeBucket(epochMs, bucketMin){
    var w = Math.max(1, Math.round(+bucketMin || 15)) * 60000;
    return Math.floor((+epochMs || 0) / w) * w;
  }
  function bucketISO(epochMs, bucketMin){ return new Date(timeBucket(epochMs, bucketMin)).toISOString(); }
  function clockLabel(epochMs){
    var d = new Date(+epochMs || 0);
    var h = d.getHours(), m = d.getMinutes();
    var ap = h < 12 ? 'AM' : 'PM'; var hh = h % 12; if(hh===0) hh = 12;
    return hh + ':' + (m<10?'0':'') + m + ' ' + ap;
  }

  // ------------------------------------------------------- suppression guard
  function passesFloor(n, floor){ return (+n || 0) >= (floor==null ? K_PRESENCE : floor); }
  // Drop every row whose cohort field is below the floor. Returns kept rows +
  // the count withheld. NEVER returns a partial/nulled sub-floor row.
  function suppressRows(rows, opts){
    opts = opts || {};
    var field = opts.field || 'cohort_n';
    var floor = opts.floor==null ? K_PRESENCE : opts.floor;
    var kept = [], suppressed = 0;
    (rows || []).forEach(function(r){
      var n = r && r[field];
      if(passesFloor(n, floor)) kept.push(r); else suppressed++;
    });
    return { rows: kept, suppressed: suppressed };
  }

  // --------------------------------------------------------------- dwell math
  function median(nums){
    var a = (nums || []).map(Number).filter(function(x){ return !isNaN(x); }).sort(function(p,q){ return p-q; });
    if(!a.length) return 0;
    var mid = Math.floor(a.length/2);
    return a.length % 2 ? a[mid] : (a[mid-1] + a[mid]) / 2;
  }
  // dwell minutes for ONE token's ordered points inside one fence: (last-first)/60000.
  // points: [{t:epochMs}, ...] (already filtered to the fence). Ordered or not.
  function dwellMinutes(points){
    if(!Array.isArray(points) || points.length < 2) return 0;
    var min = Infinity, max = -Infinity;
    points.forEach(function(p){ var t = +(p && p.t); if(isNaN(t)) return; if(t<min) min=t; if(t>max) max=t; });
    if(min===Infinity || max===-Infinity) return 0;
    return Math.max(0, (max - min) / 60000);
  }
  // median dwell (minutes) across a cohort. perToken: array of per-token point arrays.
  // Returns { cohort_n, median_dwell_min } — cohort_n = number of distinct tokens.
  function cohortDwell(perToken){
    var mins = (perToken || []).map(function(pts){ return dwellMinutes(pts); });
    return { cohort_n: mins.length, median_dwell_min: Math.round(median(mins) * 10) / 10 };
  }

  // ------------------------------------------------------- O/D flow matrix
  // Build an origin/destination matrix from suppressed flow rows
  // [{origin,dest,cohort_n}]. Returns node list + cell lookup + dense matrix.
  // Only rows already at/above the floor should be passed (call suppressRows first).
  function buildFlowMatrix(flowRows){
    var rows = flowRows || [];
    var nodeSet = {};
    rows.forEach(function(r){ if(r){ nodeSet[r.origin] = 1; nodeSet[r.dest] = 1; } });
    var nodes = Object.keys(nodeSet).sort();
    var index = {}; nodes.forEach(function(n,i){ index[n] = i; });
    var cells = {};
    var matrix = nodes.map(function(){ return nodes.map(function(){ return 0; }); });
    rows.forEach(function(r){
      if(!r) return;
      var i = index[r.origin], j = index[r.dest];
      var n = Math.round(+r.cohort_n || 0);
      if(i==null || j==null) return;
      matrix[i][j] += n;
      cells[r.origin + '>' + r.dest] = (cells[r.origin + '>' + r.dest] || 0) + n;
    });
    return { nodes: nodes, matrix: matrix, cells: cells };
  }

  // ------------------------------------------------- normalize server payloads
  // A read RPC returns { ok, metric, coverage, threshold, suppressed_rows, rows }.
  // Normalize defensively AND re-apply the client floor (defense in depth): if a
  // buggy/old server ever returned a sub-floor row, we still drop it here.
  function normalizeMetric(payload){
    var p = payload || {};
    var raw = Array.isArray(p.rows) ? p.rows : [];
    var field = (p.metric === 'stage_attendance') ? 'headcount' : 'cohort_n';
    var guard = suppressRows(raw, { field: field });
    return {
      ok: !!p.ok,
      metric: p.metric || 'unknown',
      coverage: p.coverage || 'opt-in-sample',
      threshold: (+p.threshold || K_PRESENCE),
      rows: guard.rows,
      suppressedRows: (Math.round(+p.suppressed_rows || 0)) + guard.suppressed,
      isDemo: false
    };
  }

  // ------------------------------------------------------- guarded live fetch
  function C(client){ try{ if(client && client.rpc) return client; if(typeof root.ddClient==='function'){ var c=root.ddClient(); if(c && c.rpc) return c; } }catch(e){} return null; }

  // fetchGeoMetric — the ONE guarded reader. Chains .then().catch() (never a
  // silent drop). cb(result) where result carries an honest status + icon.
  //   rpcName: 'dd_geo_attendance' | 'dd_geo_dwell' | 'dd_geo_flow' |
  //            'dd_geo_attribution' | 'dd_geo_heat'
  //   params : { p_venue, p_from, p_to }
  function fetchGeoMetric(rpcName, params, cb, client){
    var c = C(client);
    var offline = { ok:false, status:STATUS.OFFLINE, statusText:'Offline / no backend — showing nothing live.',
      metric: rpcName, rows:[], suppressedRows:0, coverage:'opt-in-sample', isDemo:false };
    if(!c){ if(cb) try{ cb(offline); }catch(e){} return; }
    try{
      c.rpc(rpcName, params || {}).then(function(res){
        if(res && res.error){
          if(cb) try{ cb({ ok:false, status:STATUS.ERR,
            statusText:'Reached StageFill but the read failed — nothing shown live.',
            metric: rpcName, rows:[], suppressedRows:0, coverage:'opt-in-sample', isDemo:false }); }catch(e){}
          return;
        }
        var m = normalizeMetric(res && res.data);
        m.status = STATUS.LIVE;
        m.statusText = m.rows.length ? 'Live — cohort-suppressed festival data.'
                                     : 'Live — no cohort is large enough to show yet.';
        if(cb) try{ cb(m); }catch(e){}
      }).catch(function(){
        if(cb) try{ cb({ ok:false, status:STATUS.ERR,
          statusText:'Could not reach StageFill for this metric — nothing shown live.',
          metric: rpcName, rows:[], suppressedRows:0, coverage:'opt-in-sample', isDemo:false }); }catch(e){}
      });
    }catch(e){
      if(cb) try{ cb({ ok:false, status:STATUS.ERR,
        statusText:'Read threw before it reached StageFill — nothing shown live.',
        metric: rpcName, rows:[], suppressedRows:0, coverage:'opt-in-sample', isDemo:false }); }catch(e2){}
    }
  }

  // fetchAllMetrics — convenience: pull all five, call cb(map) when all settle.
  function fetchAllMetrics(venueId, from, to, cb, client){
    var params = { p_venue: venueId, p_from: from || null, p_to: to || null };
    var want = ['dd_geo_attendance','dd_geo_dwell','dd_geo_flow','dd_geo_attribution','dd_geo_heat'];
    var out = {}, pending = want.length;
    want.forEach(function(rpc){
      fetchGeoMetric(rpc, params, function(r){ out[rpc] = r; if(--pending<=0 && cb){ try{ cb(out); }catch(e){} } }, client);
    });
  }

  // ------------------------------------------------ deterministic SYNTHETIC demo
  // seeded so the pitch is stable; ALWAYS carries isDemo:true + DEMO_LABEL. Some
  // cohorts are intentionally BELOW the floor to prove suppression visibly.
  function seed(str){ var h=2166136261>>>0; str=String(str||''); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0); }
  function rng(s){ var x=s||123456789; return function(){ x^=x<<13; x^=x>>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }

  var DEMO_STAGES  = ['Main Stage','River Stage','Grove Stage','Liederplatz'];
  var DEMO_VENDORS = ['Beer Garden','Taco Truck','Merch Tent','Funnel Cake'];
  var DEMO_GATES   = ['North Gate','South Gate'];

  // Build the five metric datasets for a festival slug. Returns the SAME shape a
  // live fetch produces (rows/suppressedRows/coverage) so the view is switch-ready,
  // plus isDemo:true and demoLabel on every metric.
  function buildDemoDataset(slug){
    var r = rng(seed('geo-demo|' + (slug || 'demo')));
    var t0 = Date.UTC(2026, 7, 4, 17, 0, 0); // a fixed demo evening
    var bucketMin = 30;
    function bkt(i){ return new Date(t0 + i*bucketMin*60000).toISOString(); }

    // helper: wrap raw rows through the SAME suppression the live path uses
    function metric(name, rawRows, field){
      var g = suppressRows(rawRows, { field: field || 'cohort_n' });
      return { ok:true, metric:name, coverage:'opt-in-sample', threshold:K_PRESENCE,
        rows:g.rows, suppressedRows:g.suppressed, isDemo:true, demoLabel:DEMO_LABEL,
        status:STATUS.LIVE, statusText: DEMO_LABEL };
    }

    // 1) attendance over time (headcount by stage by bucket) — includes a sub-floor cell
    var attRaw = [];
    for(var i=0;i<6;i++){
      DEMO_STAGES.forEach(function(st, si){
        var base = [420,260,180,17][si]; // last stage stays under 20 → suppressed
        var n = Math.max(0, Math.round(base * (0.5 + r()) ) );
        attRaw.push({ stage: st, window_start: bkt(i), headcount: n });
      });
    }

    // 2) dwell (median minutes by zone) — one small cohort suppressed
    var dwellRaw = DEMO_STAGES.concat(DEMO_VENDORS).map(function(z, zi){
      var n = zi===DEMO_STAGES.length ? 640 : Math.round(30 + r()*400);
      if(zi === (DEMO_STAGES.length + DEMO_VENDORS.length - 1)) n = 12; // last vendor sub-floor
      return { zone: z, window_start: bkt(2), cohort_n: n,
               median_dwell_min: Math.round((12 + r()*46) * 10)/10 };
    });

    // 3) corridor flow (O/D cohort counts) — a couple of small O/D pairs suppressed
    var flowRaw = [];
    DEMO_GATES.forEach(function(g){ flowRaw.push({ origin:g, dest:'Main Stage', window_start:bkt(0), cohort_n: Math.round(120 + r()*300) }); });
    flowRaw.push({ origin:'Main Stage', dest:'River Stage', window_start:bkt(1), cohort_n: Math.round(80 + r()*260) });
    flowRaw.push({ origin:'Main Stage', dest:'Beer Garden', window_start:bkt(1), cohort_n: Math.round(60 + r()*180) });
    flowRaw.push({ origin:'River Stage', dest:'Grove Stage', window_start:bkt(2), cohort_n: Math.round(40 + r()*120) });
    flowRaw.push({ origin:'Grove Stage', dest:'Liederplatz', window_start:bkt(3), cohort_n: 14 }); // sub-floor
    flowRaw.push({ origin:'Liederplatz', dest:'South Gate', window_start:bkt(4), cohort_n: 9 });   // sub-floor

    // 4) stage→vendor attribution — headline pair large, a niche pair suppressed
    var attrRaw = [
      { stage:'Main Stage', vendor:'Beer Garden', within_min:30, window_start:bkt(1), cohort_n: Math.round(150 + r()*250) },
      { stage:'Main Stage', vendor:'Merch Tent',  within_min:30, window_start:bkt(1), cohort_n: Math.round(70 + r()*160) },
      { stage:'River Stage', vendor:'Taco Truck', within_min:30, window_start:bkt(2), cohort_n: Math.round(40 + r()*90) },
      { stage:'Grove Stage', vendor:'Funnel Cake',within_min:30, window_start:bkt(3), cohort_n: 11 } // sub-floor
    ];

    // 5) zone heat — density is relative to the max PUBLISHED cell
    var heatRaw = DEMO_STAGES.concat(DEMO_VENDORS, DEMO_GATES).map(function(z, zi){
      var n = Math.round(30 + r()*600);
      if(zi === (DEMO_STAGES.length + DEMO_VENDORS.length + DEMO_GATES.length - 1)) n = 8; // one sub-floor zone
      return { zone: z, window_start: bkt(2), cohort_n: n };
    });
    // attach relative density over published cells only
    var heatMetric = metric('heat', heatRaw);
    var maxN = heatMetric.rows.reduce(function(m,x){ return Math.max(m, +x.cohort_n||0); }, 0);
    heatMetric.rows = heatMetric.rows.map(function(x){
      x.density = maxN>0 ? Math.round((x.cohort_n / maxN) * 1000)/1000 : 0; return x;
    });

    return {
      isDemo: true, demoLabel: DEMO_LABEL, festival: slug || 'demo',
      generatedAt: new Date().toISOString(), bucketMin: bucketMin,
      attendance:  metric('stage_attendance', attRaw, 'headcount'),
      dwell:       metric('dwell', dwellRaw),
      flow:        metric('flow', flowRaw),
      attribution: metric('attribution', attrRaw),
      heat:        heatMetric
    };
  }

  // ------------------------------------------------------------------- api
  var api = {
    K_PRESENCE: K_PRESENCE, SUPPRESSED_TEXT: SUPPRESSED_TEXT, STATUS: STATUS, DEMO_LABEL: DEMO_LABEL,
    // geo math
    haversineM: haversineM, pointInCircle: pointInCircle, pointInPolygon: pointInPolygon, inFence: inFence,
    // time
    timeBucket: timeBucket, bucketISO: bucketISO, clockLabel: clockLabel,
    // suppression
    passesFloor: passesFloor, suppressRows: suppressRows,
    // dwell
    median: median, dwellMinutes: dwellMinutes, cohortDwell: cohortDwell,
    // flow
    buildFlowMatrix: buildFlowMatrix,
    // payload normalize + guarded fetch
    normalizeMetric: normalizeMetric, fetchGeoMetric: fetchGeoMetric, fetchAllMetrics: fetchAllMetrics,
    // synthetic demo
    buildDemoDataset: buildDemoDataset
  };
  root.DDGeoAnalytics = api;
  if (typeof module!=='undefined' && module.exports) module.exports = api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
