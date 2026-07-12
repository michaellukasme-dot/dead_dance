/* dd_media.js — a band's "Listen / Watch" media section, modeled on the best band sites
   (hat tip: Jerry's Middle Finger). A band pastes their Spotify + YouTube links; we render
   clean native embeds — no Squarespace bill. Paste-anything: album/artist/track/playlist
   Spotify URLs, and YouTube video/playlist/channel URLs. Channels can't iframe, so they
   become a "Watch on YouTube" button. Pure parsers are unit-tested. */
(function (root) {
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ---- SPOTIFY: any share/embed URL -> the embed player URL ----
  function spotifyEmbed(url){
    try{
      var m = String(url).match(/spotify\.com\/(?:embed\/)?(album|artist|track|playlist|show|episode)\/([A-Za-z0-9]+)/);
      if(!m) return null;
      return { type:m[1], id:m[2], embed:'https://open.spotify.com/embed/'+m[1]+'/'+m[2] };
    }catch(e){ return null; }
  }
  // ---- YOUTUBE: video/playlist -> embeddable; channel -> link-out ----
  function youtube(url){
    try{
      var u=String(url), m;
      if((m=u.match(/[?&]list=([A-Za-z0-9_-]+)/))) return { type:'playlist', id:m[1], embed:'https://www.youtube.com/embed/videoseries?list='+m[1], link:u };
      if((m=u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{11})/))) return { type:'video', id:m[1], embed:'https://www.youtube.com/embed/'+m[1], link:u };
      if((m=u.match(/youtube\.com\/(channel\/[A-Za-z0-9_-]+|@[\w.\-]+|c\/[\w.\-]+|user\/[\w.\-]+)/))) return { type:'channel', id:m[1], embed:null, link:'https://www.youtube.com/'+m[1] };
      return null;
    }catch(e){ return null; }
  }

  function listenHTML(spotifyUrls){
    var items=(spotifyUrls||[]).map(spotifyEmbed).filter(Boolean);
    if(!items.length) return '';
    var h='<div class="ddm-h">Listen</div><div class="ddm-listen">';
    items.forEach(function(it){ var tall=(it.type==='album'||it.type==='playlist'||it.type==='artist');
      h+='<iframe class="ddm-sp" style="border-radius:12px" src="'+esc(it.embed)+'" width="100%" height="'+(tall?352:152)+'" frameborder="0" allowfullscreen loading="lazy" allow="autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture"></iframe>';
    });
    return h+'</div>';
  }
  function watchHTML(youtubeUrls, watchLabel){
    var items=(youtubeUrls||[]).map(youtube).filter(Boolean);
    if(!items.length) return '';
    var h='<div class="ddm-h">Watch'+(watchLabel?(' <span class="ddm-sub">'+esc(watchLabel)+'</span>'):'')+'</div><div class="ddm-watch">';
    items.forEach(function(it){
      if(it.embed) h+='<div class="ddm-yt"><iframe src="'+esc(it.embed)+'" frameborder="0" allowfullscreen loading="lazy" allow="accelerometer;clipboard-write;encrypted-media;gyroscope;picture-in-picture"></iframe></div>';
      else h+='<a class="ddm-ch" href="'+esc(it.link)+'" target="_blank" rel="noopener">▶ Watch on YouTube ↗</a>';
    });
    return h+'</div>';
  }
  var CSS='.ddm-wrap{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif}'+
    '.ddm-h{font-size:22px;font-weight:800;letter-spacing:.02em;margin:22px 0 12px;color:var(--ddm-ink,#1b1226)}'+
    '.ddm-sub{font-size:13px;font-weight:600;color:var(--ddm-muted,#6a6280);margin-left:6px}'+
    '.ddm-listen{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}'+
    '.ddm-watch{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}'+
    '.ddm-yt{position:relative;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#000}'+
    '.ddm-yt iframe{position:absolute;inset:0;width:100%;height:100%}'+
    '.ddm-ch{display:flex;align-items:center;justify-content:center;padding:16px;border-radius:12px;background:#b8002e;color:#fff;font-weight:800;text-decoration:none}';

  function render(container, opts){
    if(!container) return;
    opts=opts||{};
    var body=listenHTML(opts.spotify)+watchHTML(opts.youtube, opts.watchLabel);
    if(!body){ container.innerHTML='<div class="ddm-h">Media</div><div style="color:var(--ddm-muted,#b9a9e0);font-size:14px">Paste your Spotify and YouTube links to fill this in.</div>'; }
    else container.innerHTML='<div class="ddm-wrap">'+body+'</div>';
    if(!document.getElementById('ddm-css')){ var st=document.createElement('style'); st.id='ddm-css'; st.textContent=CSS; document.head.appendChild(st); }
  }
  root.DDMedia={ render:render, listenHTML:listenHTML, watchHTML:watchHTML, _spotify:spotifyEmbed, _youtube:youtube };
})(typeof window!=='undefined'?window:this);
