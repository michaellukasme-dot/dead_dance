/* dd_festguide.js — Festival Waze: comfort nudges + Crowd Pulse (safety-governed) + crowd ALERT.
   Ports the TCTP map primitive to festivals (WATER→misting, SHELTER→rain cover, BEAR→ALERT, COORDINATES→POIs).
   window.DDFestGuide. Local-first + guarded spine (dd_festalert_* RPCs). Cookies via DDCoins. Never throws.
   SAFETY LAW: Crowd Pulse NEVER steers people toward a stage at/over capacity (the Astroworld guardrail). */
(function (root) {
  'use strict';
  function C(){ try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function fid(){
    try { if (root.DDSetlistCrowd && DDSetlistCrowd.fanId) return DDSetlistCrowd.fanId(); } catch (e) {}
    try { if (root.DDFlywheel && DDFlywheel.fanId) return DDFlywheel.fanId(); } catch (e) {}
    try { var k='dd.fanid', v=localStorage.getItem(k); if(!v){ v=(root.crypto&&crypto.randomUUID)?crypto.randomUUID():('fan-'+Date.now()); localStorage.setItem(k,v);} return v; } catch (e) { return 'anon'; }
  }
  function distM(aLat,aLng,bLat,bLng){ var R=6371000, x=(bLat-aLat)*Math.PI/180, y=(bLng-aLng)*Math.PI/180,
    s=Math.sin(x/2)*Math.sin(x/2)+Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(y/2)*Math.sin(y/2);
    return 2*R*Math.asin(Math.sqrt(s)); }
  function ftFromM(m){ return Math.round(m*3.28084/10)*10; }

  // ---- POI palette registry (TCTP way-stations → festival) ----
  var CATEGORY = {
    stage:'stage', platz:'stage', tent:'stage',
    misting:'comfort', water:'comfort', shelter:'comfort', restroom:'comfort', firstaid:'comfort', shade:'comfort', seating:'comfort', charging:'comfort', family:'comfort', lostfound:'comfort',
    food:'commerce', bar:'commerce', merch:'commerce', vendor:'commerce', atm:'commerce', topup:'commerce',
    alert:'safety', security:'safety', police:'safety', fire:'safety', exit:'safety',
    gate:'nav', parking:'nav', rideshare:'nav', shuttle:'nav', meetup:'nav', info:'nav'
  };
  function category(type){ return CATEGORY[String(type||'').toLowerCase()] || 'other'; }

  var NUDGE = {
    misting: function(ft){ return '💧 Misting station ~'+ft+' ft away — want to cool off?'; },
    water:   function(ft){ return '🚰 Water refill ~'+ft+' ft away.'; },
    shelter: function(ft){ return '☔ It’s raining — nearest cover ~'+ft+' ft away.'; },
    restroom:function(ft){ return '🚻 Restroom ~'+ft+' ft away.'; },
    firstaid:function(ft){ return '⛑️ First aid ~'+ft+' ft away.'; },
    shade:   function(ft){ return '⛱️ Shade & seating ~'+ft+' ft away — take a breather.'; }
  };

  // ---- Comfort nudge: nearest in-range comfort POI, with per-POI cooldown ----
  function nudge(loc, pois, opts){
    opts = opts||{}; var range = opts.rangeM||150;
    if(!loc || loc.lat==null) return null;
    var best=null, bestD=Infinity;
    (pois||[]).forEach(function(p){ if(!p || !NUDGE[p.type]) return; var d=distM(loc.lat,loc.lng,p.lat,p.lng);
      if(d<=range && d<bestD){ bestD=d; best=p; } });
    if(!best) return null;
    if(!opts.noCooldown){ var k='dd.nudge.'+best.id, last=0; try{ last=+localStorage.getItem(k)||0; }catch(e){}
      if(Date.now()-last < (opts.cooldownMs||600000)) return null;
      try{ localStorage.setItem(k, String(Date.now())); }catch(e){} }
    var ft=ftFromM(bestD);
    return { poi:best, type:best.type, distFt:ft, message: NUDGE[best.type](ft) };
  }

  // ---- Crowd Pulse — the SAFETY GOVERNOR ----
  function crowdStatus(count, capacity){
    if(!(capacity>0)) return { count:count, capacity:capacity, ratio:null, level:'unknown' };  // CLAUDINE FIX: unknown capacity is NEVER treated as safe → not promotable (fail-safe)
    var ratio = count/capacity;
    var level = ratio>=0.90 ? 'over' : ratio>=0.70 ? 'approaching' : 'promote';
    return { count:count, capacity:capacity, ratio:Math.round(ratio*100)/100, level:level };
  }
  // pick the HOTTEST *safe* stage to flash-mob; WARN on any at/over capacity; never promote a crowded one.
  function pulse(stages){
    var ws = (stages||[]).map(function(s){ var st=crowdStatus(s.count,s.capacity); st.stage=s.stage; return st; });
    var promotable = ws.filter(function(s){ return s.level==='promote'; });
    var flash=null;
    if(promotable.length){ var h=promotable.slice().sort(function(a,b){ return b.count-a.count; })[0];
      flash={ stage:h.stage, count:h.count, message:'🔥 '+h.stage+' is popping — the crowd’s over there.' }; }
    var alts = promotable.slice().sort(function(a,b){ return a.ratio-b.ratio; });
    var warnings = ws.filter(function(s){ return s.level==='over'; }).map(function(s){
      var alt=alts.filter(function(a){ return a.stage!==s.stage; })[0];
      return { stage:s.stage, level:'over', flagOps:true, message:'⚠️ '+s.stage+' is packed — '+(alt?('room at '+alt.stage):'give it space')+'.' }; });
    return { flash:flash, warnings:warnings, stages:ws };
  }

  // ---- ALERT (crowd-sourced safety) ----
  function alertReward(ordinal){ ordinal=ordinal||1; if(ordinal<=1) return 5; if(ordinal===2) return 2; if(ordinal<=4) return 1; return 0; }
  function alertStatus(t){ t=t||{}; var still=t.stillGoing||0, pol=t.police||0, no=t.noLonger||0;
    if(no>=2 && no>=still) return 'cleared';
    if(pol>=1) return 'police_on_scene';
    return 'active'; }
  function escalates(type){ return /^(fire|medical|fight|weapon|crush|missing)/i.test(String(type||'')); }

  function _read(k){ try{ var v=JSON.parse(localStorage.getItem(k)||'null'); return (v&&v.length!=null)?v:[]; }catch(e){ return []; } }
  function _write(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  function _spine(rpc,args){ try{ var c=C(); if(c&&c.rpc) c.rpc(rpc,args); }catch(e){} }
  function _reward(fan, ordinal, fest, id){ var c=alertReward(ordinal); if(c<=0) return;
    try{ if(root.DDCoins && DDCoins.feed) DDCoins.feed('safety','safety|'+String(fest||'')+'|'+id+'|'+fan); }catch(e){}
    try{ if(root.DDCoins && DDCoins.pop) DDCoins.pop(1); }catch(e){} }

  function raise(fest, type, loc, fan){
    fan = fan || fid();
    var key='dd.alerts.'+String(fest||''), list=_read(key), norm=String(type||'').toLowerCase(), now=Date.now();
    // dedupe: an OPEN same-type alert within 60m + last 30 min → this is a CONFIRM, not a new incident
    var near=null;
    list.forEach(function(a){ if(a.status==='cleared'||a.type!==norm) return;
      if(now-a.ts > 1800000) return;
      // CLAUDINE FIX: only MERGE→confirm when BOTH locations are known and within 60m; otherwise capture as a distinct incident (safety: never hide a report behind a missing GPS fix)
      if(loc && loc.lat!=null && a.lat!=null && distM(loc.lat,loc.lng,a.lat,a.lng)<=60) near=a; });
    if(near) return confirm(fest, near.id, 'stillGoing', fan);
    var id='al-'+now+'-'+Math.random().toString(36).slice(2,7);
    var a={ id:id, type:norm, lat:loc?loc.lat:null, lng:loc?loc.lng:null, ts:now, by:fan,
            reports:[fan], confirms:{stillGoing:0,police:0,noLonger:0}, status:'active', escalate:escalates(norm) };
    list.push(a); _write(key,list);
    _reward(fan, 1, fest, id);
    _spine('dd_festalert_raise',{p_fest:String(fest||''),p_type:norm,p_lat:a.lat,p_lng:a.lng,p_fan:fan});
    return { id:id, status:'active', escalate:a.escalate, reward:alertReward(1) };
  }
  function confirm(fest, id, vote, fan){
    fan=fan||fid(); var key='dd.alerts.'+String(fest||''), list=_read(key), a=null;
    for(var i=0;i<list.length;i++){ if(list[i].id===id){ a=list[i]; break; } }
    if(!a) return { error:'no such alert' };
    if(a.reports.indexOf(fan)<0){ a.reports.push(fan);
      var v=(vote==='police')?'police':(vote==='noLonger')?'noLonger':'stillGoing';
      a.confirms[v]=(a.confirms[v]||0)+1;
      _reward(fan, a.reports.length, fest, id);
    }
    a.status=alertStatus(a.confirms); _write(key,list);
    _spine('dd_festalert_confirm',{p_fest:String(fest||''),p_id:id,p_vote:vote||'stillGoing',p_fan:fan});
    return { id:id, status:a.status, confirms:a.confirms };
  }
  function active(fest){ return _read('dd.alerts.'+String(fest||'')).filter(function(a){ return a.status!=='cleared'; })
    .map(function(a){ return { id:a.id, type:a.type, lat:a.lat, lng:a.lng, status:a.status, reports:a.reports.length, escalate:a.escalate, ts:a.ts }; }); }

  root.DDFestGuide = {
    category:category, nudge:nudge, crowdStatus:crowdStatus, pulse:pulse,
    alertReward:alertReward, alertStatus:alertStatus, escalates:escalates,
    raise:raise, confirm:confirm, active:active, distM:distM, fanId:fid
  };
})(typeof window !== 'undefined' ? window : this);
