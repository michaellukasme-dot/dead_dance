/* ============================================================================
 * dd_ytmatch.js — the SHOW ↔ YOUTUBE matcher brain (the correlation logic).
 *
 * PURE logic only — it never holds an API key and never calls YouTube directly
 * (that's the server edge function `dd_yt_match`, which holds YT_API_KEY). This
 * brain: builds the search query for a show, parses video ids, classifies the
 * channel (the LEGAL hinge), scores how well a video matches a show, and shapes
 * the row for sf_gd_video_set. Deterministic + guarded + dual export + tested.
 *
 * Doctrine: we correlate FACTS (which video is which show) and store a LINK.
 * Nothing hosted. Candidates land verified=false; a human/counsel blesses keepers.
 * ==========================================================================*/
;(function (root) {
  'use strict';
  function lc(s){ return String(s==null?'':s).toLowerCase(); }
  function clamp(x){ return x<0?0:(x>1?1:x); }

  // 11-char YouTube id from any common URL shape (or a bare id)
  function parseYouTubeId(url){ url=String(url||'');
    var m=url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    if(m) return m[1];
    if(/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
    return null; }
  function watchUrl(id){ return 'https://www.youtube.com/watch?v='+id; }

  // build the search query for a show: "Grateful Dead 1977-05-08 Barton Hall full concert"
  function searchQuery(show){ show=show||{};
    var date = show.date || (show.show_key||'').replace(/^gd/,'');   // 'gd1977-05-08' → '1977-05-08'
    return ['Grateful Dead', date, show.venue||'', 'full concert'].filter(Boolean).join(' ').replace(/\s+/g,' ').trim(); }

  // every plausible way the show date could appear in a title
  function dateVariants(iso){ var m=String(iso||'').match(/(\d{4})-(\d{2})-(\d{2})/); if(!m) return [];
    var y=m[1], mo=+m[2], d=+m[3], yy=y.slice(2);
    var MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
    var mon=MON[mo-1]||'';
    return [ y+'-'+m[2]+'-'+m[3], y+'.'+m[2]+'.'+m[3], m[2]+'/'+m[3]+'/'+y, mo+'/'+d+'/'+y, mo+'/'+d+'/'+yy,
             mo+'-'+d+'-'+yy, m[2]+'-'+m[3]+'-'+y, mon+' '+d+', '+y, mon+' '+d+' '+y, mon.slice(0,3)+' '+d+' '+y ]
           .map(lc); }

  // channel classification — the legal hinge (official/authorized vs fan)
  function classifyChannel(channelTitle){ var c=lc(channelTitle);
    if(!c) return 'unknown';
    if(/grateful dead|rhino|dead\.net|gratefuldeadtv|dead & company official/.test(c)) return 'official';
    if(/nugs|relix|owsley stanley foundation/.test(c)) return 'authorized';
    return 'fan'; }

  // score a video against a show → { score 0..1, reasons[] }
  function scoreMatch(video, show){ video=video||{}; show=show||{}; var t=lc(video.title); var s=0, why=[];
    var iso = show.date || (show.show_key||'').replace(/^gd/,'');
    if(dateVariants(iso).some(function(v){ return v && t.indexOf(v)>=0; })){ s+=0.45; why.push('date in title'); }
    if(show.venue && t.indexOf(lc(show.venue))>=0){ s+=0.2; why.push('venue in title'); }
    if(/\bfull (show|concert|set)\b|complete (show|concert)/.test(t)){ s+=0.15; why.push('says full show'); }
    var dur=+video.durationSec||0; if(dur>=2400){ s+=0.15; why.push('long enough to be a full show'); }
    else if(dur>0 && dur<600){ s-=0.15; why.push('too short — likely one song'); }
    var ch=classifyChannel(video.channelTitle); if(ch==='official'||ch==='authorized'){ s+=0.1; why.push(ch+' channel'); }
    if(/\bgrateful dead\b/.test(t)){ s+=0.05; }
    return { score: Math.round(clamp(s)*100)/100, reasons: why, channelType: ch }; }

  // rank a list of API videos for a show (best first)
  function rankCandidates(videos, show){ return (videos||[]).map(function(v){ var sc=scoreMatch(v, show);
      return { id:v.id||parseYouTubeId(v.url), title:v.title, url:v.url||(v.id?watchUrl(v.id):null),
               channelTitle:v.channelTitle, durationSec:+v.durationSec||null,
               score:sc.score, reasons:sc.reasons, channelType:sc.channelType }; })
    .filter(function(r){ return r.id; })
    .sort(function(a,b){ return b.score-a.score; }); }

  // shape a ranked candidate into the sf_gd_video_set payload (always verified=false — human confirms)
  function toRow(cand, show){ show=show||{}; return {
      p_show_key: show.show_key||('gd'+(show.date||'')), p_video_url: cand.url,
      p_show_date: show.date||null, p_venue: show.venue||null, p_city: show.city||null,
      p_channel_type: cand.channelType||'unknown', p_official: cand.channelType==='official',
      p_verified: false, p_note: 'auto-match score '+cand.score, p_added_by: 'yt-match' }; }

  // ingest — rank the top candidates for a show. HONEST ABOUT PERSISTENCE: the write target
  // `sf_gd_video_set` is service_role-only (see 16_gd_video.sql), and the REAL persistence path is the
  // server edge function `yt-match` (holds the service key, writes directly). An in-browser anon client
  // would 403 here, so this brain does NOT attempt/claim a client-side write — that was a silent-drop that
  // pretended to save. It returns the ranked correlation FACTS only; each row is flagged persisted:false so
  // no caller can mistake ranking for saving. To persist, POST the show to the yt-match edge function.
  function ingest(show, videos, opts){ opts=opts||{}; var top=Math.max(1, opts.top||3), min=opts.minScore!=null?opts.minScore:0.4;
    var ranked=rankCandidates(videos, show).filter(function(r){ return r.score>=min; }).slice(0, top)
      .map(function(r){ r.persisted=false; return r; });   // client-side: correlation only, never persisted here
    try{ if(root.DDTele&&root.DDTele.event) root.DDTele.event('ytmatch.rank',{count:ranked.length, persisted:false}); }catch(e){}
    return ranked; }

  var api = { parseYouTubeId:parseYouTubeId, watchUrl:watchUrl, searchQuery:searchQuery, dateVariants:dateVariants,
    classifyChannel:classifyChannel, scoreMatch:scoreMatch, rankCandidates:rankCandidates, toRow:toRow, ingest:ingest };
  root.DDYtMatch = api;
  if (typeof module!=='undefined' && module.exports) module.exports = api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
