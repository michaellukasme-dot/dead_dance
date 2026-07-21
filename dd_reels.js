/* dd_reels.js — Reels: gathered + original video clips (video only).
   The card autoplays the centered clip MUTED; a tap unmutes/expands. Clips are URLs
   (Storage or hosted). Best-effort: quiet [] when backend/identity isn't ready. */
(function (root) {
  function client(){ try{ return root.ddClient && root.ddClient(); }catch(e){ return null; } }
  function myId(){ try{ var i=root.ddId&&root.ddId(); return (i&&i.id)?String(i.id):null; }catch(e){ return null; } }

  // o = { video_url, poster_url?, band?, caption?, kind? ('gathered'|'original') }
  function add(o){ o=o||{}; var c=client(); if(!c||!o.video_url) return Promise.reject('need video');
    return c.rpc('dd_reel_add',{ p_video_url:o.video_url, p_poster_url:o.poster_url||null,
      p_band:o.band||null, p_caption:o.caption||null, p_kind:o.kind||'original', p_member:myId() })
      .then(function(r){ if(r&&r.error) throw r.error; return (r&&r.data)||null; }); }

  function list(limit){ var c=client(); if(!c) return Promise.resolve([]);
    return c.rpc('dd_reels_list',{ p_limit:limit||24 })
      .then(function(r){ return (r&&r.data)||[]; }).catch(function(){ return []; }); }

  // upload a video File to the public 'reels' storage bucket -> resolves its public URL
  function upload(file){ var c=client(); if(!c||!file) return Promise.reject('no-file');
    var ext=((file.name||'').split('.').pop()||'mp4').toLowerCase();
    var path=(myId()||'anon')+'/'+Date.now()+'_'+Math.random().toString(36).slice(2,7)+'.'+ext;
    return c.storage.from('reels').upload(path,file,{upsert:true,contentType:file.type||'video/mp4'})
      .then(function(r){ if(r&&r.error) throw r.error;
        var pub=c.storage.from('reels').getPublicUrl(path); return (pub&&pub.data&&pub.data.publicUrl)||null; }); }

  // one call: upload the file, then record the reel
  function post(file, meta){ meta=meta||{}; return upload(file).then(function(url){ if(!url) throw 'upload-failed';
    return add({ video_url:url, poster_url:meta.poster_url, band:meta.band, caption:meta.caption, kind:meta.kind||'original' }).then(function(){ return url; }); }); }

  var chan=null;
  function subscribe(onChange){ var c=client(); if(!c||chan) return;
    try{ chan=c.channel('dd_reels_live').on('postgres_changes',{event:'*',schema:'public',table:'dd_reels'},
      function(){ try{ onChange&&onChange(); }catch(e){} }).subscribe(); }catch(e){} }

  root.DDReels = { add:add, list:list, upload:upload, post:post, subscribe:subscribe };
})(typeof window!=='undefined'?window:this);
