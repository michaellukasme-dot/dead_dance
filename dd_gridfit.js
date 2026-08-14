/*
 * dd_gridfit.js — the LAYOUT agent (window.DDGridFit). CORE to the container strategy:
 * the finest container is the rentable booth. Give it a bounded space and it packs vendor
 * spaces of MULTIPLE sizes (10x10, 25x25, food-truck, …) in several configurations —
 * densest (maximize) → comfortable (aisles) → mixed — and returns each booth as real geometry.
 *
 *   • Works INDOORS and OUT: pass a GEO ring ([lat,lng]…) OR a PLANE ring ([x,y]… in feet).
 *     Outdoor projects lat/lng→feet around the centroid; indoor uses the floor units directly.
 *     Output booths come back in the SAME space you passed in (so they drop straight onto the map).
 *   • Node-safe (pure math, no DOM) — testable, and drives the business model per configuration.
 *
 *   DDGridFit.layout(ring, opts) -> { space, angle, area_ft2, configs:[ {name, items, counts, total} ] }
 *   DDGridFit.model(config, pricing) -> revenue breakdown (fees per size + premium + proximity ads + StageFill take)
 */
(function (root) {
  var FT_PER_DEG_LAT = 364567;                                  // feet per degree latitude (~111,132 m * 3.28084)
  function ftPerDegLng(lat0){ return FT_PER_DEG_LAT * Math.cos(lat0*Math.PI/180); }
  function centroid(poly){ var a=0,b=0; poly.forEach(function(p){a+=p[0];b+=p[1];}); return [a/poly.length,b/poly.length]; }
  function rot(x,y,a){ var c=Math.cos(a),s=Math.sin(a); return [x*c - y*s, x*s + y*c]; }
  function inRing(x,y,ring){ var ins=false; for(var i=0,j=ring.length-1;i<ring.length;j=i++){ var xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1]; if(((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/((yj-yi)||1e-9)+xi)) ins=!ins; } return ins; }
  function ringArea(ring){ var s=0; for(var i=0,j=ring.length-1;i<ring.length;j=i++){ s += (ring[j][0]+ring[i][0])*(ring[j][1]-ring[i][1]); } return Math.abs(s/2); }
  function dominantAngle(ring){ var best=0,bl=-1; for(var i=0;i<ring.length;i++){ var a=ring[i],b=ring[(i+1)%ring.length]; var dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy); if(L>bl){bl=L;best=Math.atan2(dy,dx);} } return best; }
  function bbox(ring){ var mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity; ring.forEach(function(p){ if(p[0]<mnx)mnx=p[0]; if(p[0]>mxx)mxx=p[0]; if(p[1]<mny)mny=p[1]; if(p[1]>mxy)mxy=p[1]; }); return {mnx:mnx,mny:mny,mxx:mxx,mxy:mxy}; }
  function overlaps(a,b){ return !(a.mxx<=b.mnx || a.mnx>=b.mxx || a.mxy<=b.mny || a.mny>=b.mxy); }

  // pack w x d booths into an axis-aligned (already rotated) ring, avoiding `occupied` bboxes.
  function packAligned(rr, w, d, opts, occupied){
    var gap=opts.gap!=null?opts.gap:2, aisle=opts.aisle||0, aisleEvery=opts.aisleEvery||0, pad=opts.pad||1;
    var bb=bbox(rr), out=[], row=0, guard=0;
    for(var y=bb.mny+pad; y+d<=bb.mxy && guard<100000; ){
      for(var x=bb.mnx+pad; x+w<=bb.mxx && guard<100000; x+=(w+gap)){
        guard++;
        var cx=x+w/2, cy=y+d/2;
        var cell={mnx:x,mny:y,mxx:x+w,mxy:y+d};
        if(!inRing(cx,cy,rr)) continue;
        if(!inRing(x,y,rr) || !inRing(x+w,y,rr) || !inRing(x+w,y+d,rr) || !inRing(x,y+d,rr)) continue;
        var clash=false; for(var k=0;k<occupied.length;k++){ if(overlaps(cell,occupied[k])){ clash=true; break; } }
        if(clash) continue;
        out.push(cell); occupied.push(cell);
      }
      row++; y += d + gap; if(aisleEvery && (row%aisleEvery===0)) y += aisle;
    }
    return out;
  }

  // convert an aligned cell -> 4 corners in the ORIGINAL space (feet or geo)
  function cellToCorners(cell, ang, o, space){
    var pts=[[cell.mnx,cell.mny],[cell.mxx,cell.mny],[cell.mxx,cell.mxy],[cell.mnx,cell.mxy]].map(function(p){ return rot(p[0],p[1],ang); });
    if(space==='geo'){ return pts.map(function(p){ return [ o[0] + p[1]/FT_PER_DEG_LAT, o[1] + p[0]/ftPerDegLng(o[0]) ]; }); }
    return pts; // plane: already feet
  }
  function cellCenter(cell){ return [ (cell.mnx+cell.mxx)/2, (cell.mny+cell.mxy)/2 ]; }

  function layout(ring, opts){
    opts = opts || {};
    var space = opts.space || (ring[0] && Math.abs(ring[0][0])<=90 && Math.abs(ring[0][1])<=180 && Math.abs(ring[0][1])>10 ? 'geo' : 'plane');
    var fpu = opts.feetPerUnit || 1;
    // ring in FEET (planar). geo → project around centroid.
    var o = centroid(ring), ringFt;
    if(space==='geo'){ ringFt = ring.map(function(p){ return [ (p[1]-o[1])*ftPerDegLng(o[0]), (p[0]-o[0])*FT_PER_DEG_LAT ]; }); }
    else { ringFt = ring.map(function(p){ return [ p[0]*fpu, p[1]*fpu ]; }); }
    var ang = (opts.align===false)?0:dominantAngle(ringFt);
    var rr = ringFt.map(function(p){ return rot(p[0],p[1],-ang); });
    var area = ringArea(ringFt);

    var SIZES = opts.sizes || [ {name:'10×10',w:10,d:10,fee:40}, {name:'25×25',w:25,d:25,fee:120} ];
    var byName={}; SIZES.forEach(function(s){ byName[s.name]=s; });

    // margin-of-perimeter test for "premium" (frontage / corner foot-traffic)
    var bb=bbox(rr); function premium(cell){ var m=18; return (cell.mnx-bb.mnx<m)||(bb.mxx-cell.mxx<m)||(cell.mny-bb.mny<m)||(bb.mxy-cell.mxy<m); }

    function mkItems(sizeName, cells){ var s=byName[sizeName]; return cells.map(function(c){ return {
      type:sizeName, w:s.w, d:s.d,
      corners: (space==='geo') ? cellToCorners(c,ang,o,'geo') : cellToCorners(c,ang,o,'plane').map(function(p){return [p[0]/fpu,p[1]/fpu];}),
      center: (function(){ var cc=cellCenter(c); var g=rot(cc[0],cc[1],ang); return (space==='geo')?[o[0]+g[1]/FT_PER_DEG_LAT,o[1]+g[0]/ftPerDegLng(o[0])]:[g[0]/fpu,g[1]/fpu]; })(),
      premium: premium(c)
    }; }); }

    function config(name, plan){
      var occupied=[], items=[], counts={};
      plan.forEach(function(step){ var cells=packAligned(rr, byName[step.size].w, byName[step.size].d, step, occupied); counts[step.size]=(counts[step.size]||0)+cells.length; items=items.concat(mkItems(step.size, cells)); });
      return { name:name, items:items, counts:counts, total:items.length };
    }

    var tenName = SIZES[0].name, bigName = (SIZES[1]||SIZES[0]).name;
    var configs = [
      config('Max ' + tenName + ' (densest)',      [ {size:tenName, gap:2} ]),
      config('Max ' + bigName,                      [ {size:bigName, gap:3} ]),
      config('Mixed — ' + bigName + ' core + ' + tenName + ' fill', [ {size:bigName, gap:3}, {size:tenName, gap:2} ]),
      config('Shopper aisles (' + tenName + ')',    [ {size:tenName, gap:2, aisle:10, aisleEvery:2} ])
    ];

    return { space:space, angle:ang, area_ft2:Math.round(area), sizes:SIZES, configs:configs };
  }

  // Business model for a chosen configuration.
  function model(config, pricing){
    pricing = pricing || {};
    var fees = pricing.fees || {'10×10':40,'25×25':120};
    var premiumMult = pricing.premiumMult!=null?pricing.premiumMult:1.5;
    var events = pricing.events!=null?pricing.events:26;               // e.g., a weekly market season
    var take = pricing.take!=null?pricing.take:0.06;                    // StageFill margin on booth fees
    var adEvery = pricing.adUnitsPer!=null?pricing.adUnitsPer:20;       // 1 proximity-ad unit per N booths
    var adPrice = pricing.adPrice!=null?pricing.adPrice:150;            // per ad unit, per event
    var gross_event=0, premium_count=0, byType={};
    (config.items||[]).forEach(function(it){ var base=fees[it.type]||0; var f = it.premium ? base*premiumMult : base;
      gross_event += f; if(it.premium)premium_count++; byType[it.type]=(byType[it.type]||0)+1; });
    var ad_units = Math.max(1, Math.round((config.total||0)/adEvery));
    var ad_event = ad_units*adPrice;
    var total_event = gross_event + ad_event;
    return {
      booths: config.total||0, byType: byType, premium_count: premium_count,
      booth_gross_event: Math.round(gross_event),
      ad_units: ad_units, ad_revenue_event: ad_event,
      gross_event: Math.round(total_event),
      gross_season: Math.round(total_event*events),
      stagefill_take_event: Math.round(total_event*take),
      stagefill_take_season: Math.round(total_event*take*events)
    };
  }

  // PSEUDO-COUNT parking, WITH SUGGESTED CONFIGS (like the booths). A standard space is 9x18 ft.
  // Double-loaded rows with a drive aisle every 2 rows (~60-ft module → industry ~300-330 sq ft/space
  // incl. aisles). Draw a lot/field → estimated car count for each layout + every space as geometry.
  function parking(ring, opts){
    opts = opts || {};
    var space = opts.space || (ring[0] && Math.abs(ring[0][0])<=90 && Math.abs(ring[0][1])<=180 && Math.abs(ring[0][1])>10 ? 'geo':'plane');
    var fpu = opts.feetPerUnit||1, o=centroid(ring), ringFt;
    if(space==='geo'){ ringFt = ring.map(function(p){ return [ (p[1]-o[1])*ftPerDegLng(o[0]), (p[0]-o[0])*FT_PER_DEG_LAT ]; }); }
    else { ringFt = ring.map(function(p){ return [ p[0]*fpu, p[1]*fpu ]; }); }
    var ang = (opts.align===false)?0:dominantAngle(ringFt);
    var rr = ringFt.map(function(p){ return rot(p[0],p[1],-ang); });
    var area = ringArea(ringFt);
    // CARVE-OUTS: a designated Shakedown area / vendor zone / reserved tailgate block CONSUMES spots.
    // Each carve-out ring is projected + rotated and its bbox is treated as occupied → cars pack around it.
    function projFt(rng){ return (space==='geo') ? rng.map(function(p){ return [ (p[1]-o[1])*ftPerDegLng(o[0]), (p[0]-o[0])*FT_PER_DEG_LAT ]; }) : rng.map(function(p){ return [ p[0]*fpu, p[1]*fpu ]; }); }
    var carve = [], carveArea = 0;
    (opts.carveouts||[]).forEach(function(cr){ var cf=projFt(cr); carve.push(bbox(cf.map(function(p){ return rot(p[0],p[1],-ang); }))); carveArea += ringArea(cf); });
    function recipe(name, W, D, aisle){
      var cells = packAligned(rr, W, D, { gap:0, aisle:aisle, aisleEvery:2, pad:(opts.pad!=null?opts.pad:2) }, carve.slice());
      var items = cells.map(function(c){ return {
        corners: (space==='geo') ? cellToCorners(c,ang,o,'geo') : cellToCorners(c,ang,o,'plane').map(function(p){return [p[0]/fpu,p[1]/fpu];}),
        center: (function(){ var cc=cellCenter(c); var g=rot(cc[0],cc[1],ang); return (space==='geo')?[o[0]+g[1]/FT_PER_DEG_LAT,o[1]+g[0]/ftPerDegLng(o[0])]:[g[0]/fpu,g[1]/fpu]; })()
      }; });
      return { name:name, stall:{w:W,d:D,aisle:aisle}, count:cells.length, sqft_per_space: cells.length?Math.round(area/cells.length):0, items:items };
    }
    var configs = [
      recipe('Compact 90° (8.5×16, densest)', 8.5, 16, 22),
      recipe('Standard 90° (9×18)',            9,   18, 24),
      recipe('Event / generous (10×20)',       10,  20, 26)
    ];
    return { space:space, area_ft2:Math.round(area), carveout_area_ft2:Math.round(carveArea), configs:configs, note:'pseudo-count (geometry estimate) — suggests configs; carve-outs (Shakedown/tailgate/vendor) consume spots' };
  }

  // Parking revenue — because we can SELL PARKING TICKETS (a parking pass = a ticket on the StageFill rail).
  function parkingRevenue(config, opts){
    opts = opts || {};
    var price = opts.price!=null?opts.price:15, events = opts.events!=null?opts.events:1, take = opts.take!=null?opts.take:0.06;
    var spaces = (config && config.count) || 0, g = spaces*price;
    return { spaces:spaces, price:price, gross_event:Math.round(g), gross_season:Math.round(g*events),
             stagefill_take_event:Math.round(g*take), stagefill_take_season:Math.round(g*take*events) };
  }

  root.DDGridFit = { layout: layout, model: model, parking: parking, parkingRevenue: parkingRevenue, _util:{ ringArea:ringArea, inRing:inRing } };
  if (typeof module!=='undefined' && module.exports) module.exports = root.DDGridFit;
})(typeof window!=='undefined'?window:globalThis);
