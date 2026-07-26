/* dd_setlist_reminder.js — PRE-SHOW ROUTINE. Remind every band-group member to enter their
   setlist BEFORE the show, so fans get each song texted live.

   Fires within a window before the set (default 48h → set start), once per member per show
   (deduped in localStorage), and lands as a DDNotify (their feed) + an inline banner on the
   band page. Membership is respected: the auto-scan only fires for confirmed band-group members;
   the band's own page (role=band) fires explicitly. Defensive — no-ops if DDNotify/DDBandGroups
   aren't present. */
(function (root) {
  var WINDOW_H = 48; // start reminding this many hours before the set

  function to24(t){ var x=/(\d+):(\d+)\s*(AM|PM)?/i.exec(t||''); if(!x) return '12:00'; var h=+x[1],mi=x[2],ap=(x[3]||'').toUpperCase(); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0; return (h<10?'0':'')+h+':'+mi; }
  function showISO(band){ if(!band||!band.set||!band.set.date) return null; return band.set.date+'T'+to24(band.set.time)+':00'; }
  function hoursTo(iso){ if(!iso) return null; var t=new Date(iso).getTime(); if(isNaN(t)) return null; return (t-Date.now())/3600000; }
  function seen(key){ try{ return !!(JSON.parse(localStorage.getItem('dd.setlistReminded')||'{}')[key]); }catch(e){ return false; } }
  function mark(key){ try{ var s=JSON.parse(localStorage.getItem('dd.setlistReminded')||'{}'); s[key]=Date.now(); localStorage.setItem('dd.setlistReminded',JSON.stringify(s)); }catch(e){} }

  function hasSetlist(slug, band){
    try{ var ls=(JSON.parse(localStorage.getItem('dd.setlist')||'{}'))[slug]; if(ls&&ls.songs&&ls.songs.length) return true; }catch(e){}
    return !!(band&&band.setlist&&band.setlist.songs&&band.setlist.songs.length);
  }

  /* is the current profile a member of this band group? true / false / null(unknown) */
  function isMember(slug){
    try{
      if(root.DDBandGroups && DDBandGroups.members){
        var m=DDBandGroups.members(slug)||[]; var me=(root.DDMe&&DDMe.id&&DDMe.id())||null;
        if(me) return m.some(function(x){ return x===me || x.id===me; });
      }
    }catch(e){}
    return null;
  }

  /* is a reminder due for this band? returns { slug,name,whenISO,hours,key,member,seen } or null */
  function due(slug, band, opts){
    opts=opts||{}; var iso=showISO(band), h=hoursTo(iso);
    if(h==null || h>WINDOW_H || h< -0.5) return null;   // only inside the window, up to set start
    if(hasSetlist(slug,band)) return null;              // already entered → nothing to nag
    var member = (opts.forceMember!=null) ? opts.forceMember : isMember(slug);
    var key = slug+'|'+((band.set&&band.set.date)||'');
    return { slug:slug, name:band.name, whenISO:iso, hours:Math.max(0,Math.round(h)), key:key, member:member, seen:seen(key) };
  }

  /* every member id in the band group (so ALL members get the reminder, not just one) */
  function groupMembers(slug){
    try{ if(root.DDBandGroups && DDBandGroups.members){ return (DDBandGroups.members(slug)||[]).map(function(x){ return (x&&x.id)||x; }).filter(Boolean); } }catch(e){}
    return [];
  }

  /* fire the reminder: fan out a DDNotify to the WHOLE band group + mark it (deduped). */
  function fire(r){
    if(!r || r.seen) return false;
    var url=(location.origin.indexOf('http')===0?location.origin:'https://deaddance.app')+'/mf_band.html?band='+encodeURIComponent(r.slug)+'&role=band';
    var p={ type:'setlist_reminder', title:'🎵 Setlist for '+r.name+' — whenever you’ve got it',
      body:'No rush — even in the van on the way up. Just text it or tap it in when you know it, and we’ll send each song to your fans as you play it.',
      ref:url, dedupe:true };
    var members=groupMembers(r.slug), sent=0;
    try{
      if(root.DDNotify && DDNotify.add){
        if(members.length){ members.forEach(function(id){ DDNotify.add(id, p); sent++; }); }        // → the whole band group
        else { var me=(root.DDMe&&DDMe.id&&DDMe.id()); if(me){ DDNotify.add(me, p); sent++; } }       // fallback: at least the active member
      }
    }catch(e){}
    mark(r.key); r.sent=sent; return true;
  }

  /* inline banner for the band's own page */
  function banner(el, r){
    if(typeof el==='string') el=document.getElementById(el); if(!el||!r) return;
    el.innerHTML='<div class="slrem">🎵 <b>No rush</b> — text us your setlist whenever you’ve got it (even rolling up 476). We’ll send each song to your fans as you play it. '
      +'<a href="mf_band.html?band='+encodeURIComponent(r.slug)+'&role=band">Drop it here →</a></div>';
    el.style.display='';
  }

  /* app-level: scan a whole band seed and fire reminders for CONFIRMED members only. */
  function scan(bands, opts){
    var out=[]; Object.keys(bands||{}).forEach(function(slug){ var r=due(slug,bands[slug],opts);
      if(r && r.member===true){ fire(r); out.push(r); } });
    return out;
  }

  root.DDSetlistReminder = { due:due, fire:fire, banner:banner, scan:scan, hasSetlist:hasSetlist, showISO:showISO, WINDOW_H:WINDOW_H };
})(typeof window !== "undefined" ? window : this);
