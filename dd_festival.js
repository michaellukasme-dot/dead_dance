/* dd_festival.js — cloud spine for the Festival Maker.
   Non-breaking: with NO ?festival= param the maker stays a pure-local tool (unchanged).
   With ?festival=<slug> it becomes the cloud-backed editor for that map:
     • hydrates the doc from Supabase (dd_festival_get)
     • ☁ Save pushes the whole maker state up (dd_festival_save, owner-token gated)
     • 👁 Publish / Unpublish (owner)  · ↻ Pull latest
     • ?claim=<code> runs Claim-my-Fair (dd_fair_claim) → issues the owner token
   Security mirrors the setlist loop: reads open, writes need the per-map owner token (?key=). */
(function(){
  "use strict";
  var SB_URL="https://vmbqfzxhrqxpwgidogfm.supabase.co",
      SF_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtYnFmenhocnF4cHdnaWRvZ2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDUzODUsImV4cCI6MjA5Nzk4MTM4NX0.aa2guYvXJ7SLAEdYOpDKb6xzHP-ypMpZFPFSdwLc6xM";
  var LS='dd.festivalmaker';
  var q=new URLSearchParams(location.search);
  var slug=(q.get('festival')||'').trim(), key=(q.get('key')||'').trim(), claim=(q.get('claim')||'').trim();

  var C=null; try{ C=window.supabase&&window.supabase.createClient(SB_URL, SF_ANON); }catch(e){}
  if(!window.ddClient) window.ddClient=function(){ return C; };
  window.DD_FEST={ slug:slug, key:key, owner:false, published:false, name:'' };

  // ---- helpers ------------------------------------------------------------
  function localState(){ try{ return JSON.parse(localStorage.getItem(LS)||'null'); }catch(e){ return null; } }
  function centroid(fp){ if(!fp||!fp.length) return null; var la=0,ln=0; fp.forEach(function(p){la+=p[0];ln+=p[1];}); return [la/fp.length, ln/fp.length]; }
  function toast(msg,ok){ var t=document.getElementById('ddfToast'); if(!t){ t=document.createElement('div'); t.id='ddfToast';
      t.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2000;background:#0b1220;color:#fff;padding:11px 16px;border-radius:12px;font:600 13px system-ui;box-shadow:0 8px 30px #0006;max-width:88vw;text-align:center'; document.body.appendChild(t); }
    t.style.background = ok===false ? '#8a1330' : '#0b1220'; t.textContent=msg; t.style.opacity='1';
    clearTimeout(t._h); t._h=setTimeout(function(){ t.style.transition='opacity .5s'; t.style.opacity='0'; },2600); }

  // ---- the cloud bar (only shown when a slug is in play) ------------------
  function mountBar(){
    if(document.getElementById('ddfBar')) { paintBar(); return; }
    var bar=document.createElement('div'); bar.id='ddfBar';
    bar.style.cssText='position:sticky;top:0;z-index:900;display:flex;gap:8px;align-items:center;flex-wrap:wrap;'
      +'padding:9px 12px;background:linear-gradient(180deg,#141a2e,#0f1424);color:#fff;font:600 13px system-ui;border-bottom:1px solid #2a3350';
    bar.innerHTML=''
      +'<span id="ddfName" style="font-weight:800"></span>'
      +'<span id="ddfStatus" style="font-size:11px;padding:2px 8px;border-radius:999px;background:#2a3350"></span>'
      +'<span style="flex:1"></span>'
      +'<button id="ddfPull"  class="ddfbtn">↻ Pull</button>'
      +'<button id="ddfSave"  class="ddfbtn ddfprime">☁ Save</button>'
      +'<button id="ddfPub"   class="ddfbtn" style="display:none"></button>';
    var css=document.createElement('style'); css.textContent=
      '.ddfbtn{border:0;border-radius:10px;padding:8px 12px;font:800 12px system-ui;cursor:pointer;background:#2a3350;color:#dfe6ff}'
      +'.ddfbtn.ddfprime{background:linear-gradient(180deg,#2f6feb,#1e50c7);color:#fff}'
      +'.ddfbtn:active{transform:translateY(1px)}';
    document.head.appendChild(css);
    document.body.insertBefore(bar, document.body.firstChild);
    document.getElementById('ddfSave').onclick=save;
    document.getElementById('ddfPull').onclick=function(){ pull(true); };
    document.getElementById('ddfPub').onclick=togglePublish;
    paintBar();
  }
  function paintBar(){
    var n=document.getElementById('ddfName'); if(!n) return;
    n.textContent=(window.DD_FEST.name||slug);
    var st=document.getElementById('ddfStatus');
    st.textContent = window.DD_FEST.owner ? (window.DD_FEST.published?'Published':'Draft — owner') : 'Read-only';
    st.style.background = window.DD_FEST.published ? '#12613f' : (window.DD_FEST.owner?'#5a4a12':'#3a2233');
    var pb=document.getElementById('ddfPub'), sv=document.getElementById('ddfSave');
    if(window.DD_FEST.owner){ pb.style.display=''; pb.textContent=window.DD_FEST.published?'🙈 Unpublish':'👁 Publish'; sv.style.display=''; document.getElementById('ddfPull').style.display=''; }
    else { pb.style.display='none'; sv.style.display='none'; }  // no token → can't write
  }

  // ---- cloud ops ----------------------------------------------------------
  function pull(force){
    if(!C){ toast('Offline — no cloud',false); return; }
    C.rpc('dd_festival_get',{ p_slug:slug, p_token:key||null }).then(function(r){
      var d=r&&r.data; if(!d){ toast('No such festival: '+slug,false); return; }
      window.DD_FEST.owner=!!d.owner; window.DD_FEST.published=!!d.published; window.DD_FEST.name=d.name||slug;
      var doc=d.doc||{};
      var cur=localState();
      var mine = cur && cur.__slug===slug;
      // hydrate when we don't already hold this festival's draft, or on an explicit Pull
      if(doc && doc.items && (force || !mine)){
        doc.__slug=slug;
        localStorage.setItem(LS, JSON.stringify(doc));
        location.reload(); return;
      }
      if(cur && !cur.__slug){ cur.__slug=slug; try{ localStorage.setItem(LS, JSON.stringify(cur)); }catch(e){} }
      mountBar();
    }).catch(function(){ toast('Could not load map',false); });
  }
  function save(){
    if(!C){ toast('Offline',false); return; }
    if(!key){ toast('Read-only — no editor key',false); return; }
    try{ window.fmSave && window.fmSave(); }catch(e){}
    var s=localState()||{}; s.__slug=slug;
    var fp=s.footprint||null;
    C.rpc('dd_festival_save',{
      p_slug:slug, p_token:key, p_doc:s,
      p_name:(s.name||null), p_region:null, p_dates:null,
      p_center:centroid(fp), p_boundary:fp
    }).then(function(r){
      if(r&&r.error){ toast('Save failed: '+(r.error.message||'token?'),false); return; }
      var d=r&&r.data||{}; toast('☁ Saved — '+(d.items!=null?d.items+' placed pins':'ok'), true);
    }).catch(function(){ toast('Save failed',false); });
  }
  function togglePublish(){
    if(!C||!key){ toast('Owner only',false); return; }
    var to=!window.DD_FEST.published;
    C.rpc('dd_festival_publish',{ p_slug:slug, p_token:key, p_published:to }).then(function(r){
      if(r&&r.error){ toast('Failed',false); return; }
      window.DD_FEST.published=to; paintBar(); toast(to?'👁 Published — fans can see it':'Unpublished (draft)', true);
    });
  }

  // ---- Claim my Fair ------------------------------------------------------
  function runClaim(){
    var email=prompt('Claim '+slug+'\n\nEnter your email (we send the owner key here):','');
    if(email===null) return;
    C.rpc('dd_fair_claim',{ p_slug:slug, p_claim_code:claim, p_email:(email||null) }).then(function(r){
      if(r&&r.error){ toast('Claim failed: '+(r.error.message||'code?'),false); return; }
      var tok=r&&r.data&&r.data.owner_token;
      if(tok){ location.replace(location.pathname+'?festival='+encodeURIComponent(slug)+'&key='+encodeURIComponent(tok)); }
    }).catch(function(){ toast('Claim failed',false); });
  }

  // ---- ONE-CLICK CLOUD PUBLISH (no DevTools, ever) ------------------------
  // Local draft → creates a cloud festival, saves the doc, reopens as the owner editor.
  // Already a cloud festival (?festival&key) → just Save.
  window.ddCloudPublish=function(){
    if(!C){ toast('Offline — no cloud',false); return; }
    try{ window.fmSave && window.fmSave(); }catch(e){}
    if(slug && key){ save(); return; }
    var s=localState()||{};
    var nm=(((document.getElementById('fname')||{}).value)||s.name||'').trim();
    if(!nm){ nm=(prompt('Name your festival to publish it:','')||'').trim(); if(!nm) return; }
    var fp=s.footprint||null; toast('☁ Publishing…', true);
    C.rpc('dd_festival_create',{ p_name:nm, p_region:null, p_email:null }).then(function(r){
      if(r&&r.error){ toast('Create failed: '+(r.error.message||''),false); return; }
      var d=(r&&r.data)||{}, sg=d.slug, tok=d.owner_token; if(!sg||!tok){ toast('Create failed',false); return; }
      s.__slug=sg; s.name=nm;
      C.rpc('dd_festival_save',{ p_slug:sg, p_token:tok, p_doc:s, p_name:nm, p_region:null, p_dates:null, p_center:centroid(fp), p_boundary:fp }).then(function(){
        location.href = location.pathname+'?festival='+encodeURIComponent(sg)+'&key='+encodeURIComponent(tok);
      }).catch(function(){ toast('Saved create but doc failed',false); });
    }).catch(function(){ toast('Publish failed',false); });
  };

  // ---- boot ---------------------------------------------------------------
  function boot(){
    if(!slug) return;                      // pure-local maker → do nothing
    if(claim){ runClaim(); return; }
    pull(false);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
