/* dd_style.js — THE ART ENGINE, blank palette (client).
   Artist-independent. Ships empty. Everything here works with ZERO art in it — it just
   waits for an artist's samples. The ONE external seam is generate(): it posts the
   artist's brief + kit to the image engine and files the candidates for the artist to
   approve or delete. Until DD_ART_ENGINE_URL is set, generate() reports 'engine not wired'
   (honest — nothing pretends to paint). */
(function (root) {
  function client(){ try{ return root.ddClient && root.ddClient(); }catch(e){ return null; } }
  function rpc(fn,args){ var c=client(); if(!c) return Promise.resolve(null); return c.rpc(fn,args).then(function(r){ if(r&&r.error) throw r.error; return r?r.data:null; }); }

  function optIn(slug,name,on,miracle){ return rpc('dd_style_optin',{p_slug:slug,p_name:name||null,p_on:on!==false,p_miracle:!!miracle}); }
  function addSample(slug,imageUrl,caption){ return rpc('dd_style_sample_add',{p_slug:slug,p_image:imageUrl,p_caption:caption||null}); }
  function setBrief(slug,brief){ return rpc('dd_style_brief_set',{p_slug:slug,p_brief:brief||{}}); }
  function addOutput(slug,o){ o=o||{}; return rpc('dd_style_out_add',{p_slug:slug,p_band:o.band||null,p_venue:o.venue||null,p_city:o.city||null,p_date:o.date||null,p_image:o.image_url||null,p_poster:o.poster_url||null,p_price:(o.price!=null?+o.price:null)}); }
  function decide(id,slug,decision){ return rpc('dd_style_out_decide',{p_id:id,p_slug:slug,p_decision:(decision==='approve'?'approve':'delete')}); }
  function inventory(slug,limit){ return rpc('dd_style_inventory',{p_slug:slug,p_limit:limit||60}).then(function(r){return r||[];}); }

  // readiness meter — the blank palette's gauge (min 15, optimal 40)
  function readiness(slug){ return rpc('dd_style_readiness',{p_slug:slug}).then(function(r){
    var k=(r&&r[0])||{samples:0,min_samples:15,optimal_samples:40,status:'blank',opt_in:false,miracle_opt_in:false};
    var n=k.samples||0, mn=k.min_samples||15, op=k.optimal_samples||40;
    return { samples:n, min:mn, optimal:op, status:k.status||'blank', opt_in:!!k.opt_in, miracle_opt_in:!!k.miracle_opt_in,
             pct:Math.min(100,Math.round(100*n/op)),
             need:(n<mn ? (mn-n)+' more to start' : (n<op ? (op-n)+' more for the sweet spot' : 'ready')) };
  }); }

  // THE MODEL HOOK — the only external seam. Posts brief + kit → image engine → candidates.
  function generate(slug, show){
    var url = root.DD_ART_ENGINE_URL;
    if(!url) return Promise.reject('engine not wired — set DD_ART_ENGINE_URL (image model + Storage)');
    return fetch(url, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ artist_slug:slug, show:show||{} }) })
      .then(function(r){ return r.json(); })
      .then(function(res){ var outs=(res&&res.candidates)||[]; // each: {image_url, poster_url}
        return Promise.all(outs.map(function(o){ return addOutput(slug, Object.assign({}, show, o)); })); });
  }

  root.DDStyle = { optIn:optIn, addSample:addSample, readiness:readiness, setBrief:setBrief,
                   generate:generate, addOutput:addOutput, decide:decide, inventory:inventory };
})(typeof window !== 'undefined' ? window : this);
