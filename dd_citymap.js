/* ============================================================================
 * dd_citymap.js — the CITY WALKING MAP brain.
 *
 * Every city gets a QR that resolves to THEIR downtown walking map — a year-round
 * proximity ad network for the ~1-mile revitalized downtown corridor ("The Corridor"). Same engine as the
 * festival map; the corridor is just the footprint. One level up the container tree:
 *     City → corridor (always-on) + festivals + farmers markets + recurring events
 *
 * The NERVOUS SYSTEM here is the ACTIVE-HOURS engine: the city configures the window
 * (9am–11pm, dinner-only, First Fridays…) and proximity ads only serve while OPEN.
 *
 * Pure + deterministic + guarded (no backend = no-op). Dual browser/node export.
 * ==========================================================================*/
;(function (root) {
  'use strict';
  var BASE = 'https://deaddance.app/';
  function slugify(n){ return String(n||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function num(x,d){ x=Number(x); return isFinite(x)?x:(d||0); }
  function hhmmToMin(s){ s=String(s||''); var m=s.match(/^(\d{1,2}):(\d{2})$/); if(!m) return null;
    var h=+m[1], mi=+m[2]; if(h>23||mi>59) return null; return h*60+mi; }
  function minToHhmm(v){ v=((v%1440)+1440)%1440; var h=Math.floor(v/60), m=v%60; return (h<10?'0':'')+h+':'+(m<10?'0':'')+m; }

  // ---- normalize a city spec ------------------------------------------------
  function norm(spec){ spec=spec||{};
    var name=spec.name||spec.city||'Downtown';
    var corridor=(spec.corridor||spec.boundary||[]).filter(function(p){ return p && (p.length>=2 || (p.lat!=null&&p.lng!=null)); })
      .map(function(p){ return p.lat!=null ? [num(p.lat),num(p.lng)] : [num(p[0]),num(p[1])]; });
    var hours=spec.hours||{};
    var open = hhmmToMin(hours.open) ; if(open==null) open=9*60;      // default 9:00am
    var close= hhmmToMin(hours.close); if(close==null) close=23*60;   // default 11:00pm
    var days = (hours.days && hours.days.length) ? hours.days.map(function(d){ return ((d%7)+7)%7; }) : [0,1,2,3,4,5,6];
    return {
      slug: spec.slug || slugify(name),
      name: name, state: spec.state||null,
      corridor: corridor, center: centroid(corridor),
      hours: { open:open, close:close, days:days, openLabel:minToHhmm(open), closeLabel:minToHhmm(close) },
      ads: { enabled: spec.ads!==false, floor: num(spec.adFloor, 0) },   // proximity ad network on by default
      claimed: !!spec.claimed, published: !!spec.published
    };
  }
  function centroid(pts){ if(!pts||!pts.length) return null; var la=0,ln=0; pts.forEach(function(p){ la+=p[0]; ln+=p[1]; }); return [la/pts.length, ln/pts.length]; }
  function lengthMeters(pts){ if(!pts||pts.length<2) return 0; var R=6371000,tot=0;
    function rad(d){return d*Math.PI/180;}
    for(var i=1;i<pts.length;i++){ var a=pts[i-1],b=pts[i]; var dLa=rad(b[0]-a[0]),dLn=rad(b[1]-a[1]);
      var s=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLn/2)*Math.sin(dLn/2);
      tot+=2*R*Math.asin(Math.min(1,Math.sqrt(s))); } return Math.round(tot); }

  // ---- THE ACTIVE-HOURS ENGINE (gates proximity ads) ------------------------
  // Handles overnight windows (e.g. open 18:00, close 02:00). Uses a Date or {day,min}.
  function isActive(city, when){ var c=norm(city);
    var day, min;
    if(when && typeof when.getDay==='function'){ day=when.getDay(); min=when.getHours()*60+when.getMinutes(); }
    else if(when && when.day!=null){ day=((when.day%7)+7)%7; min=num(when.min, 0); }
    else { var d=new Date(); day=d.getDay(); min=d.getHours()*60+d.getMinutes(); }
    if(c.hours.days.indexOf(day)<0) return { active:false, reason:'closed today' };
    var o=c.hours.open, cl=c.hours.close;
    var inWin = (o<=cl) ? (min>=o && min<cl) : (min>=o || min<cl);   // overnight-safe
    return { active:!!inWin, reason: inWin ? 'open' : 'outside hours', open:c.hours.openLabel, close:c.hours.closeLabel };
  }
  // does an OVERNIGHT window wrap past midnight?
  function overnight(city){ var c=norm(city); return c.hours.open > c.hours.close; }

  // ---- the city's permanent links (the QR resolves here) --------------------
  function mapUrl(slug){ return BASE+'city.html?city='+encodeURIComponent(slugify(slug)); }   // public walking map (QR target)
  function claimUrl(slug){ return BASE+'claim_city.html'+(slug?('?city='+encodeURIComponent(slugify(slug))):''); }
  function embedSnippet(slug, name){ var u=mapUrl(slug);                                        // paste onto the city website
    return '<a href="'+u+'" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#241535;color:#fff;font:800 14px system-ui;text-decoration:none">🗺️ '+(name||'Downtown')+' Walking Map</a>'; }

  // ---- guarded spine (claim / save / publish) — mirrors dd_fair_claim rails ---
  function C(){ try{ return root.ddClient && root.ddClient(); }catch(e){ return null; } }
  function emit(evt,p){ try{ if(root.DDTele&&root.DDTele.event) root.DDTele.event('citymap.'+evt,p||{}); }catch(e){} }
  function save(city, token){ var c=C(); if(!c||!c.rpc) return false; var s=norm(city);
    try{ c.rpc('sf_city_save',{ p_slug:s.slug, p_token:token||null, p_name:s.name, p_state:s.state, p_corridor:s.corridor,
      p_open:s.hours.open, p_close:s.hours.close, p_days:s.hours.days, p_ads:s.ads.enabled }); emit('save',{slug:s.slug}); return true; }catch(e){ return false; } }
  function claim(slug, code, email){ var c=C(); if(!c||!c.rpc) return Promise.resolve(null);
    try{ return c.rpc('sf_city_claim',{ p_slug:slugify(slug), p_claim_code:code||null, p_email:email||null })
      .then(function(r){ return (r&&r.data)||null; }).catch(function(){ return null; }); }catch(e){ return Promise.resolve(null); } }

  var api = { norm:norm, slugify:slugify, centroid:centroid, lengthMeters:lengthMeters,
    isActive:isActive, overnight:overnight, hhmmToMin:hhmmToMin, minToHhmm:minToHhmm,
    mapUrl:mapUrl, claimUrl:claimUrl, embedSnippet:embedSnippet, save:save, claim:claim };
  root.DDCityMap = api;
  if (typeof module!=='undefined' && module.exports) module.exports = api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
