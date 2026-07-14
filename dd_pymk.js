/* dd_pymk.js — People You May Know ("you were both there") + show attendance.
   Attendance is a ladder of evidence: ticket > gps > tapped > rsvp (see dd_pymk.sql).
   GPS is PRIVATE: the phone measures its own distance to the venue and, only if close,
   records the FACT ("attended via gps"). Raw coordinates never leave the device. */
(function (root) {
  function client(){ try{ return root.ddClient && root.ddClient(); }catch(e){ return null; } }
  function myId(){ try{ var i=root.ddId&&root.ddId(); return (i&&i.id)?String(i.id):null; }catch(e){ return null; } }
  function myName(){ try{ if(root.ME&&root.ME.name&&root.ME.name!=='You') return root.ME.name;
    var n=root.localStorage&&localStorage.getItem('dd.myname'); return (n&&n.trim())||null; }catch(e){ return null; } }

  // mark attendance. via = 'ticket' | 'gps' | 'tapped' | 'rsvp'
  function attend(showId, via){ var c=client(); if(!c||!showId) return Promise.resolve(false);
    return c.rpc('dd_attend',{p_show_id:showId,p_member:myId(),p_name:myName(),p_via:via||'tapped'})
      .then(function(r){ return !(r&&r.error); }).catch(function(){ return false; }); }
  function unattend(showId){ var c=client(); if(!c||!showId) return Promise.resolve(false);
    return c.rpc('dd_unattend',{p_show_id:showId,p_member:myId()}).then(function(){return true;}).catch(function(){return false;}); }
  function count(showId){ var c=client(); if(!c||!showId) return Promise.resolve(0);
    return c.rpc('dd_attend_count',{p_show_id:showId}).then(function(r){ return Number((r&&r.data)||0); }).catch(function(){ return 0; }); }

  // suggestions -> [{kind:'person', id, name, shared, mutual, band, venue, date, reason}]
  function suggestions(limit){ var c=client(); if(!c) return Promise.resolve([]);
    return c.rpc('dd_pymk',{p_member:myId(),p_limit:limit||12}).then(function(r){
      return ((r&&r.data)||[]).map(function(row){
        var reason;
        if(row.shared_shows>0 && row.sample_band){
          var d=row.sample_date?(' · '+fmt(row.sample_date)):'';
          reason='You were both at '+row.sample_band+(row.sample_venue?(' · '+row.sample_venue):'')+d;
        } else if(row.mutual_friends>0){ reason=row.mutual_friends+' mutual friend'+(row.mutual_friends>1?'s':''); }
        else reason='In your scene';
        return {kind:'person', id:row.member_id, name:row.member_name||'A Deadhead',
                shared:row.shared_shows, mutual:row.mutual_friends, band:row.sample_band,
                venue:row.sample_venue, date:row.sample_date, reason:reason};
      });
    }).catch(function(){ return []; }); }

  // ---- private GPS geofence: only records the FACT if the phone is near the venue ----
  function haversine(aLat,aLng,bLat,bLng){ var R=6371000, t=Math.PI/180;
    var dLat=(bLat-aLat)*t, dLng=(bLng-aLng)*t;
    var x=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(aLat*t)*Math.cos(bLat*t)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return 2*R*Math.asin(Math.min(1,Math.sqrt(x))); }
  // geofence(showId, venueLat, venueLng, radiusMeters=500) -> resolves 'gps' | 'far' | 'unavailable'
  function geofence(showId, vlat, vlng, radius){ radius=radius||500;
    return new Promise(function(resolve){
      if(!(root.navigator&&navigator.geolocation)||vlat==null||vlng==null) return resolve('unavailable');
      navigator.geolocation.getCurrentPosition(function(pos){
        var d=haversine(pos.coords.latitude,pos.coords.longitude,vlat,vlng); // computed HERE, on the phone
        if(d<=radius){ attend(showId,'gps').then(function(){ resolve('gps'); }); }
        else resolve('far');
        // note: pos coordinates are used only for this local distance check and are never sent anywhere.
      }, function(){ resolve('unavailable'); }, {enableHighAccuracy:true, timeout:8000, maximumAge:60000});
    }); }

  function fmt(iso){ try{ var d=new Date(String(iso).slice(0,10)+'T12:00:00'); if(isNaN(d))return iso;
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }catch(e){ return iso; } }

  var chan=null;
  function subscribe(onChange){ var c=client(); if(!c||chan) return;
    try{ chan=c.channel('dd_attend_live').on('postgres_changes',{event:'*',schema:'public',table:'dd_show_attend'},
      function(){ try{ onChange&&onChange(); }catch(e){} }).subscribe(); }catch(e){} }

  root.DDPymk={ attend:attend, unattend:unattend, count:count, suggestions:suggestions, geofence:geofence, subscribe:subscribe };
})(typeof window!=='undefined'?window:this);
