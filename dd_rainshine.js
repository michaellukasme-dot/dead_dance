/* dd_rainshine.js — the RAIN-OR-SHINE fan feature.
   MusikFest and every big outdoor festival run the show "rain or shine": when it rains, the crowd
   moves UNDER the big tents. This surfaces the covered / rain-or-shine venues and routes fans there.

   Data comes from the Festival Maker doc (tents flagged covered:true). Weather is live from Open-Meteo
   (free, no key). When it's raining at the grounds we throw an alert banner + a "head for cover" list;
   when it's clear the same covered-venues list stays one tap away (rain OR shine — always reachable).

   Usage:
     DDRain.mount({
       hostId:'rainbox',                 // container to render into
       center:[lat,lng],                 // festival center (weather point)
       tents:[{id,name,platz,covered,center:[lat,lng]}],
       map: leafletMapOrNull             // optional — tap a venue to focus it
     });
   Test overrides: ?rain=1 forces the rain state, ?rain=0 forces clear. */
(function(){
  "use strict";
  var qp=new URLSearchParams(location.search);
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function dirLink(c){ return 'https://www.google.com/maps/dir/?api=1&destination='+c[0]+','+c[1]+'&travelmode=walking'; }
  function haversine(a,b){ if(!a||!b)return null; var R=6371000,dLat=(b[0]-a[0])*Math.PI/180,dLng=(b[1]-a[1])*Math.PI/180,
      s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return 2*R*Math.asin(Math.min(1,Math.sqrt(s))); }
  function feet(m){ if(m==null)return ''; var ft=m*3.28084; return ft<1000?(Math.round(ft/10)*10)+' ft':(Math.round(ft/528)/10)+' mi'; }

  // Open-Meteo "current" weather codes that mean precipitation is falling.
  var WET=new Set([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99]);

  function injectCSS(){ if(document.getElementById('ddrainCSS'))return; var s=document.createElement('style'); s.id='ddrainCSS';
    s.textContent=''
    +'.ddr-card{border-radius:14px;padding:12px 14px;margin:8px 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}'
    +'.ddr-rain{background:linear-gradient(135deg,#12324f,#1e5aa8);color:#fff;box-shadow:0 6px 22px #12324f44}'
    +'.ddr-clear{background:#f4f6fb;border:1px solid #e2e7f0;color:#31405e}'
    +'.ddr-head{display:flex;align-items:center;gap:9px;cursor:pointer;font-weight:900;font-size:15px}'
    +'.ddr-sub{font-size:12.5px;opacity:.92;margin-top:2px;font-weight:600}'
    +'.ddr-list{margin-top:10px;display:none}.ddr-list.open{display:block}'
    +'.ddr-v{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #ffffff2e}'
    +'.ddr-clear .ddr-v{border-top:1px solid #e7ebf3}'
    +'.ddr-v .n{flex:1;min-width:0}.ddr-v .n b{font-size:14px;font-weight:800;display:block}'
    +'.ddr-v .n span{font-size:11.5px;opacity:.8}'
    +'.ddr-go{border:0;border-radius:999px;padding:7px 12px;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap;text-decoration:none}'
    +'.ddr-rain .ddr-go{background:#fff;color:#12324f}.ddr-clear .ddr-go{background:#1e5aa8;color:#fff}'
    +'.ddr-caret{margin-left:auto;font-size:13px;opacity:.8}';
    document.head.appendChild(s); }

  function render(o, raining, user){
    var host=document.getElementById(o.hostId); if(!host) return;
    injectCSS();
    var covered=o.tents.filter(function(t){return t.covered && t.center;});
    if(!covered.length){ host.innerHTML=''; return; }   // nothing covered → nothing to show
    // nearest-first if we know where the fan is
    covered.forEach(function(t){ t._d = user? haversine(user,t.center):null; });
    covered.sort(function(a,b){ return (a._d==null?1e12:a._d)-(b._d==null?1e12:b._d); });

    var open = raining;   // rain → expanded by default; clear → collapsed toggle
    var head = raining
      ? '☔ <span>Rain? The show’s still on — head for cover</span>'
      : '⛺ <span>Rain-or-shine venues</span>';
    var sub = raining
      ? 'These stages are under cover. The music doesn’t stop — move under a tent and stay dry.'
      : 'Covered tents that run rain or shine. Tap to see them.';
    var rows = covered.map(function(t){
      return '<div class="ddr-v"><div class="n"><b>⛺ '+esc(t.name)+'</b>'
        +'<span>'+(t.platz?esc(t.platz)+' · ':'')+'covered · rain-or-shine'+(t._d!=null?(' · '+feet(t._d)):'')+'</span></div>'
        +'<a class="ddr-go" href="'+dirLink(t.center)+'" target="_blank" rel="noopener" data-focus="'+esc(t.id||'')+'">walk here ›</a></div>';
    }).join('');

    host.innerHTML='<div class="ddr-card '+(raining?'ddr-rain':'ddr-clear')+'">'
      +'<div class="ddr-head" id="ddrHead">'+head+'<span class="ddr-caret" id="ddrCaret">'+(open?'▲':'▼')+'</span></div>'
      +'<div class="ddr-sub">'+sub+'</div>'
      +'<div class="ddr-list'+(open?' open':'')+'" id="ddrList">'+rows+'</div></div>';

    var list=document.getElementById('ddrList'), caret=document.getElementById('ddrCaret');
    document.getElementById('ddrHead').onclick=function(){ var o2=list.classList.toggle('open'); caret.textContent=o2?'▲':'▼'; };
    // tap a venue → focus it on the map (still lets the "walk here" link open directions)
    if(o.map){ host.querySelectorAll('.ddr-go').forEach(function(a){ a.addEventListener('click',function(e){
      var id=a.getAttribute('data-focus'); var t=covered.filter(function(x){return String(x.id)===id;})[0];
      if(t&&t.center){ try{ o.map.setView(t.center, Math.max(o.map.getZoom(),18)); }catch(x){} }
      // don't preventDefault — the directions link should still open in a new tab
    }); }); }
  }

  var DDRain={
    mount:function(o){
      o=o||{}; o.tents=o.tents||[]; if(!o.hostId) return;
      var forced=qp.get('rain');
      var proceed=function(raining, user){ render(o, raining, user); };
      var withUser=function(raining){
        if(!navigator.geolocation){ proceed(raining,null); return; }
        navigator.geolocation.getCurrentPosition(
          function(p){ proceed(raining,[p.coords.latitude,p.coords.longitude]); },
          function(){ proceed(raining,null); }, {timeout:6000,maximumAge:300000});
      };
      if(forced==='1'){ withUser(true); return; }
      if(forced==='0'){ withUser(false); return; }
      if(!o.center){ withUser(false); return; }
      // Scale guard: cache the grounds' weather ~10 min in localStorage so a crowd at one festival
      // (and repeat page views) share a single Open-Meteo call instead of hammering the free tier.
      var ckey='ddrain_'+(+o.center[0]).toFixed(2)+'_'+(+o.center[1]).toFixed(2);
      try{ var cv=JSON.parse(localStorage.getItem(ckey)||'null'); if(cv&&(Date.now()-cv.t)<600000){ withUser(!!cv.r); return; } }catch(e){}
      // live weather at the grounds — fail SAFE (no false rain alarm) on any error
      var url='https://api.open-meteo.com/v1/forecast?latitude='+o.center[0]+'&longitude='+o.center[1]
             +'&current=precipitation,weather_code&timezone=auto';
      var done=false, t=setTimeout(function(){ if(!done){ done=true; withUser(false); } },7000);
      fetch(url).then(function(r){ return r.json(); }).then(function(j){
        if(done) return; done=true; clearTimeout(t);
        var c=(j&&j.current)||{}; var precip=+c.precipitation||0, code=+c.weather_code;
        var raining=(precip>0 || WET.has(code));
        try{ localStorage.setItem(ckey, JSON.stringify({t:Date.now(),r:raining})); }catch(e){}   // cache only real results
        withUser(raining);
      }).catch(function(){ if(done)return; done=true; clearTimeout(t); withUser(false); });
    }
  };
  window.DDRain=DDRain;
})();
