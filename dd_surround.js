/* dd_surround.js — "Surround the Stage." Anchored on the STAGE (the physical crowd location), NOT the
   act — a bar may have 1 or 2 stages, a festival many; each stage is its own zone. When a crowd rings a
   stage the app (Cookie-Monster voice) asks everyone there for PHOTOS OR VIDEO from their angle; each
   part is tagged with the shooter's GPS BEARING to the stage, so we arrange them in a ring AROUND the
   stage — real human content, 360°, then a Reels card → HyperPost. The act/song/roster ride along as
   context (it changes through the night); the stage is the constant. One phone now; multi-phone server
   stitch drops into the same parts store later. Self-contained, no deps. */
(function (w) {
  "use strict";
  if (w.Surround) return;
  // The SHOW CONTEXT — the union of everything we know: poster, setlist, band roster, schedule.
  var S = { stage:"", act:"", song:"", songIdx:0, songTotal:0, time:"", home:"", genre:"", roster:0, poster:"", parts:[], open:false };

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function bearing(from, to){ if(!from||!to) return Math.random()*360;   // no fix → scatter it
    var y=Math.sin((to[1]-from[1])*Math.PI/180)*Math.cos(to[0]*Math.PI/180);
    var x=Math.cos(from[0]*Math.PI/180)*Math.sin(to[0]*Math.PI/180)-Math.sin(from[0]*Math.PI/180)*Math.cos(to[0]*Math.PI/180)*Math.cos((to[1]-from[1])*Math.PI/180);
    return (Math.atan2(y,x)*180/Math.PI+360)%360; }

  // THE COPY — Cookie-Monster voice. The more setlist DATA we have, the richer the ask (that's the clay).
  function songPhrase(){ if(!S.song) return 'this one';
    var pos = (S.songIdx && S.songTotal) ? (' <span style="opacity:.85">(song '+S.songIdx+' of '+S.songTotal+')</span>') : '';
    return '“'+esc(S.song)+'”'+pos; }
  function askText(){
    var act  = S.act ? (' by <b>'+esc(S.act)+'</b>') : '';
    var from = S.home ? (' <span style="opacity:.85">('+esc(S.home)+(S.genre?(' · '+esc(S.genre)):'')+')</span>') : (S.genre?(' <span style="opacity:.85">('+esc(S.genre)+')</span>'):'');
    return '🍪 Ooh — big beautiful crowd at <b>'+esc(S.stage)+'</b> right now'+((S.song||S.act)?(' for '+songPhrase()+act+from):'')+'! '+
           'Me building a collage of everybody at this stage. Grab a few <b>photos — or a quick video</b> from '+
           '<b>YOUR</b> angle, right where you stand. When me have all the parts, me stitch it together and send '+
           'it back to you. You in? 📸🎥';
  }

  function card(){
    var el=document.getElementById('ddSurround');
    if(!el){ el=document.createElement('div'); el.id='ddSurround';
      el.style.cssText='position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:280;background:#241535;color:#fff;border-radius:18px;box-shadow:0 12px 34px #0008;max-width:92%;width:440px;padding:16px 17px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
      document.body.appendChild(el); }
    el.innerHTML =
      '<div style="font-size:14px;line-height:1.45" id="ddSurTxt">'+askText()+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'+
        '<button id="ddSurYes" style="flex:1;min-width:120px;border:0;border-radius:12px;padding:12px;font-weight:900;font-size:14px;background:#f0a500;color:#3a1d00;cursor:pointer">I’m in — my angle 📸🎥</button>'+
        '<button id="ddSurBuild" style="border:0;border-radius:12px;padding:12px 14px;font-weight:900;font-size:13.5px;background:#5a2e86;color:#fff;cursor:pointer">🎨 Build it</button>'+
        '<button id="ddSurX" style="border:0;border-radius:12px;padding:12px;font-weight:800;font-size:13px;background:#3a2b52;color:#cdbfe0;cursor:pointer">later</button>'+
      '</div>'+
      '<div id="ddSurCount" style="font-size:12px;color:#b9a9d4;margin-top:9px"></div>'+
      '<input id="ddSurFile" type="file" accept="image/*,video/*" style="display:none">';   // photos AND video
    el.style.display='block'; S.open=true;
    document.getElementById('ddSurX').onclick=function(){ el.style.display='none'; S.open=false; };
    document.getElementById('ddSurYes').onclick=function(){ document.getElementById('ddSurFile').click(); };
    document.getElementById('ddSurBuild').onclick=build;
    document.getElementById('ddSurFile').onchange=function(){ addPart(this.files&&this.files[0]); this.value=''; };
    updCount();
  }
  function updCount(){ var c=document.getElementById('ddSurCount'); if(!c)return;
    c.innerHTML = S.parts.length ? ('🌹 <b>'+S.parts.length+'</b> angle'+(S.parts.length>1?'s':'')+' in the ring — add more, or tap <b>Build it</b>.')
      : 'Me need a few angles from around the stage. Confirm you’re in and snap one. 🍪'; }

  function addPart(file){ if(!file)return;
    if(/^video\//.test(file.type||'')){ addVideoPart(file); return; }               // video → grab a frame for the ring
    var img=new Image();
    img.onload=function(){ var mw=640, sc=Math.min(1,mw/img.width), c=document.createElement('canvas'); c.width=img.width*sc|0; c.height=img.height*sc|0; c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      var b = bearing(w.YOU, w.SURROUND_STAGE || null);
      var im=new Image(); im.onload=function(){ S.parts.push({img:im, bearing:b}); updCount(); }; im.src=c.toDataURL('image/jpeg',0.82);
    }; img.src=URL.createObjectURL(file); }
  // Video: pull a representative frame for the collage tile; keep the file aside for a future reel montage.
  function addVideoPart(file){ var v=document.createElement('video'); v.muted=true; v.playsInline=true; v.preload='metadata'; v.src=URL.createObjectURL(file);
    v.onloadeddata=function(){ try{ v.currentTime=Math.min(0.6,(v.duration||2)/3); }catch(e){} };
    v.onseeked=function(){ if(!v.videoWidth) return; var mw=640, sc=Math.min(1,mw/v.videoWidth), c=document.createElement('canvas'); c.width=v.videoWidth*sc|0; c.height=v.videoHeight*sc|0; c.getContext('2d').drawImage(v,0,0,c.width,c.height);
      var b=bearing(w.YOU, w.SURROUND_STAGE||null); var im=new Image(); im.onload=function(){ S.parts.push({img:im, bearing:b, video:true, file:file}); updCount(); }; im.src=c.toDataURL('image/jpeg',0.82); };
    v.onerror=function(){ toast('Couldn’t read that clip — try a photo 📸'); }; }

  // Compose: center = stage/act/song; each photo tiled in a ring, placed by its GPS bearing → surrounds it.
  function build(){
    if(!S.parts.length){ toast('Snap at least one angle first 📸'); return; }
    var N=S.parts.length, W=1080, H=1080, cx=W/2, cy=H/2, cv=document.createElement('canvas'); cv.width=W; cv.height=H; var g=cv.getContext('2d');
    var bg=g.createLinearGradient(0,0,W,H); bg.addColorStop(0,'#241535'); bg.addColorStop(1,'#3a2456'); g.fillStyle=bg; g.fillRect(0,0,W,H);
    var R = 360, tile = Math.max(150, Math.min(230, Math.round(1500/Math.max(N,1))));
    S.parts.forEach(function(p,i){
      var ang = (p.bearing!=null ? p.bearing : (i/N*360)) * Math.PI/180;
      var x = cx + Math.sin(ang)*R, y = cy - Math.cos(ang)*R;   // bearing 0 = north = top
      g.save(); g.translate(x,y); g.rotate(ang*0.12);
      g.fillStyle='#fff'; roundRect(g,-tile/2-6,-tile/2-6,tile+12,tile+12,16); g.fill();
      g.save(); roundRect(g,-tile/2,-tile/2,tile,tile,12); g.clip();
      var iw=p.img.width, ih=p.img.height, s=Math.max(tile/iw,tile/ih);
      g.drawImage(p.img,-iw*s/2,-ih*s/2,iw*s,ih*s); g.restore();
      if(p.video){ g.fillStyle='rgba(0,0,0,.5)'; g.beginPath(); g.arc(0,0,tile*0.15,0,7); g.fill();
        var tt=tile*0.08; g.fillStyle='#fff'; g.beginPath(); g.moveTo(-tt*0.4,-tt); g.lineTo(-tt*0.4,tt); g.lineTo(tt,0); g.closePath(); g.fill(); }
      g.restore();
    });
    // center medallion
    g.fillStyle='#b8002e'; g.beginPath(); g.arc(cx,cy,150,0,7); g.fill();
    g.fillStyle='#fff'; g.strokeStyle='#fff'; g.lineWidth=4; g.beginPath(); g.arc(cx,cy,150,0,7); g.stroke();
    g.textAlign='center'; g.fillStyle='#fff';
    g.font='900 30px sans-serif'; wrap(g, S.stage||'MUSIKFEST', cx, cy-30, 250, 32);
    if(S.act){ g.font='800 24px sans-serif'; g.fillStyle='#ffd76a'; g.fillText(clip(S.act,22), cx, cy+14); }
    if(S.song){ g.font='italic 21px sans-serif'; g.fillStyle='#ffe9c9';
      g.fillText('“'+clip(S.song,20)+'”'+((S.songIdx&&S.songTotal)?(' '+S.songIdx+'/'+S.songTotal):''), cx, cy+44); }
    // header — pour ALL the show data on: act, hometown · genre, time
    g.textAlign='left'; g.fillStyle='#f0a500'; g.font='900 40px sans-serif'; g.fillText('WE SURROUNDED THE STAGE 🌹', 40, 58);
    var sub=[]; if(S.home)sub.push(S.home); if(S.genre)sub.push(S.genre); if(S.time)sub.push(S.time);
    if(sub.length){ g.fillStyle='#e7ddf3'; g.font='700 24px sans-serif'; g.fillText(clip(sub.join(' · '),52), 40, 92); }
    g.fillStyle='#c9b8dd'; g.font='800 26px sans-serif'; g.fillText(N+' angles · deaddance.app/musikfest', 40, H-40);

    var cap='We surrounded '+(S.stage||'the stage')+(S.act?(' for '+S.act):'')+' at Musikfest 🌹 '+N+' angles, one crowd. deaddance.app/musikfest';
    try{ blogPush('surround', cap, cv); }catch(e){}      // every collage rains into the DeadDance blog river
    cv.toBlob(function(blob){ showDrop(cv, blob, cap, N); },'image/png');
  }
  // feed the launch blog: a small thumbnail + caption + show context. Best-effort, fire-and-forget.
  function blogPush(kind, caption, cv){
    var thumb = cv ? thumbOf(cv) : null;
    var sb=(w.ddClient && ddClient()); if(!(sb && sb.rpc)) return;
    sb.rpc('dd_blog_post',{ p_event:(w.MF_EVENT||'musikfest-2026'), p_kind:kind||'post', p_stage:S.stage||'', p_act:S.act||'', p_caption:caption||'', p_thumb:thumb }).then(function(){},function(){});
  }
  function thumbOf(cv){ try{ var s=Math.min(1,480/cv.width), t=document.createElement('canvas'); t.width=cv.width*s|0; t.height=cv.height*s|0; t.getContext('2d').drawImage(cv,0,0,t.width,t.height); return t.toDataURL('image/jpeg',0.7); }catch(e){ return null; } }

  // "Drop it ALL" — post the finished surround to: the in-app Musikfest page, the Musikfest FB page, and
  // the DeadDance Musikfest FB Group. FB posts go from the fan's OWN logged-in Facebook (we never touch
  // credentials): we save the image + copy the caption, then open the destination for them to post.
  var FB_PAGE = w.MF_FB_PAGE_URL  || 'https://www.facebook.com/Musikfest/';
  var DD_GROUP= w.DD_MF_GROUP_URL || 'https://www.facebook.com/groups/deaddance.musikfest/';
  function showDrop(cv, blob, cap, N){
    var url=URL.createObjectURL(blob), file=new File([blob],'surround-'+(S.stage||'stage').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.png',{type:'image/png'});
    function saveImg(){ if(navigator.canShare && navigator.canShare({files:[file]})){ navigator.share({files:[file],text:cap}).catch(function(){}); } else { var a=document.createElement('a'); a.href=url; a.download=file.name; a.click(); } }
    function copyCap(){ try{ navigator.clipboard.writeText(cap); }catch(e){} }
    var el=document.getElementById('ddSurround'); if(!el){ el=document.createElement('div'); el.id='ddSurround'; document.body.appendChild(el); }
    el.style.cssText='position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:280;background:#241535;color:#fff;border-radius:18px;box-shadow:0 12px 34px #0008;max-width:92%;width:440px;padding:16px 17px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    el.innerHTML=
      '<div style="text-align:center"><img src="'+url+'" style="width:150px;height:150px;object-fit:cover;border-radius:14px;box-shadow:0 6px 18px #0007"></div>'+
      '<div style="font-weight:900;font-size:15px;text-align:center;margin:10px 0 2px">🎨 Surround built — '+N+' angles 🌹</div>'+
      '<div style="font-size:12px;color:#b9a9d4;text-align:center;margin-bottom:12px">Drop it everywhere. Caption’s copied when you tap a spot.</div>'+
      '<div style="display:grid;gap:8px">'+
        '<button id="ddDropFeed" style="border:0;border-radius:12px;padding:12px;font-weight:900;font-size:13.5px;background:#b8002e;color:#fff;cursor:pointer">🌹 Post to the Musikfest page (in-app)</button>'+
        '<button id="ddDropPage" style="border:0;border-radius:12px;padding:12px;font-weight:900;font-size:13.5px;background:#1877f2;color:#fff;cursor:pointer">f  Musikfest Facebook page</button>'+
        '<button id="ddDropGroup" style="border:0;border-radius:12px;padding:12px;font-weight:900;font-size:13.5px;background:#1877f2;color:#fff;cursor:pointer">f  DeadDance Musikfest group</button>'+
        '<button id="ddDropSave" style="border:0;border-radius:12px;padding:11px;font-weight:800;font-size:13px;background:#3a2b52;color:#e7ddf3;cursor:pointer">⬇️ Just save the image</button>'+
      '</div>'+
      '<button id="ddDropX" style="display:block;width:100%;margin-top:9px;border:0;background:none;color:#9a8fb0;font-weight:800;font-size:12.5px;cursor:pointer">done</button>';
    el.style.display='block';
    document.getElementById('ddDropFeed').onclick=function(){ try{ if(w.ddMusikfestPost) w.ddMusikfestPost({image:cv.toDataURL('image/png'),caption:cap,kind:'surround'}); else if(w.ddHyperPost) w.ddHyperPost({image:cv.toDataURL('image/png'),caption:cap,kind:'surround'}); }catch(e){} toast('🌹 Posted to the Musikfest page.'); };
    document.getElementById('ddDropPage').onclick=function(){ saveImg(); copyCap(); w.open(FB_PAGE,'_blank','noopener'); toast('Image saved + caption copied — post it on the Musikfest page.'); };
    document.getElementById('ddDropGroup').onclick=function(){ saveImg(); copyCap(); w.open(DD_GROUP,'_blank','noopener'); toast('Image saved + caption copied — post it in the group.'); };
    document.getElementById('ddDropSave').onclick=saveImg;
    document.getElementById('ddDropX').onclick=function(){ el.style.display='none'; S.open=false; };
  }

  function roundRect(g,x,y,w2,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w2,y,x+w2,y+h,r); g.arcTo(x+w2,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w2,y,r); g.closePath(); }
  function wrap(g,t,x,y,maxw,lh){ var wd=String(t).split(' '),ln=[],c=''; wd.forEach(function(z){var tt=(c+' '+z).trim(); if(g.measureText(tt).width>maxw){ln.push(c);c=z;}else c=tt;}); if(c)ln.push(c); ln.slice(0,3).forEach(function(l,i){ g.fillText(l,x,y+i*lh - (Math.min(ln.length,3)-1)*lh/2); }); }
  function clip(s,n){ s=String(s); return s.length>n?s.slice(0,n-1)+'…':s; }
  function toast(m){ var t=document.getElementById('ddSurToast'); if(!t){ t=document.createElement('div'); t.id='ddSurToast'; t.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:400;background:#000d;color:#fff;font-weight:800;font-size:13px;padding:11px 17px;border-radius:999px;z-index:400'; document.body.appendChild(t);} t.textContent=m; t.style.opacity='1'; clearTimeout(t._h); t._h=setTimeout(function(){t.style.opacity='0';},2800); }

  // PUBLIC: Surround.request({stage, act, song, stageLatLng})
  w.Surround = {
    request: function(o){ o=o||{}; S.stage=o.stage||S.stage||'the stage'; S.act=o.act||''; S.song=o.song||'';
      S.songIdx=o.songIdx||0; S.songTotal=o.songTotal||0; S.time=o.time||''; S.home=o.home||''; S.genre=o.genre||''; S.roster=o.roster||0; S.poster=o.poster||'';
      if(o.stageLatLng) w.SURROUND_STAGE=o.stageLatLng; card(); },
    parts: function(){ return S.parts; },
    reset: function(){ S.parts=[]; updCount(); }
  };
})(window);
