/* dead_dance — SHAKEDOWN SCENE seed (v1).
   Source: shakedownst.com competitive capture (ingested 2026-07-08), facts/directory-data only.
   Loads ./shakedown_scene_seed.csv (single source of truth: type,name,url,notes) and exposes
   window.DD_SCENE_SEED grouped by type, plus DD_SCENE_VENDORS as CRM-ready prospect records.
   These are SEEDED PROSPECTS for the Market-of-Markets vendor console + band directory.
   Nothing auto-sends; a rep drafts and sends. Fires 'dd-scene-seed-ready' when parsed. */
(function(){
  var CSV = "./shakedown_scene_seed.csv";
  window.DD_SCENE_SEED = { headliner:[], tribute:[], jamgrass:[], vendor:[], festival:[], fb_group:[], resource:[], charity:[], _all:[], _ready:false };
  window.DD_SCENE_VENDORS = []; // {n:name, l:url, k:"Vendor (SDS lot)", note:...} — mirrors CRAFT_SEED shape

  function parseCSV(t){
    var rows=[], row=[], cur="", q=false, i, c;
    for(i=0;i<t.length;i++){ c=t[i];
      if(q){ if(c=='"'){ if(t[i+1]=='"'){cur+='"';i++;} else q=false; } else cur+=c; }
      else { if(c=='"') q=true;
        else if(c==','){ row.push(cur); cur=""; }
        else if(c=='\n'){ row.push(cur); rows.push(row); row=[]; cur=""; }
        else if(c=='\r'){}
        else cur+=c; } }
    if(cur.length||row.length){ row.push(cur); rows.push(row); }
    return rows;
  }

  fetch(CSV).then(function(r){ return r.text(); }).then(function(txt){
    var rows=parseCSV(txt), head=rows.shift()||[], S=window.DD_SCENE_SEED;
    rows.forEach(function(r){
      if(!r || !r[0]) return;
      var type=(r[0]||"").trim(), name=(r[1]||"").trim(), url=(r[2]||"").trim(), notes=(r[3]||"").trim();
      if(!type || !name) return;
      var rec={type:type,name:name,url:url,notes:notes};
      (S[type] = S[type]||[]).push(rec);
      S._all.push(rec);
      if(type==="vendor") window.DD_SCENE_VENDORS.push({n:name, l:url, k:"Vendor (SDS lot)", note:notes});
    });
    S._ready=true;
    try{ document.dispatchEvent(new CustomEvent("dd-scene-seed-ready",{detail:{counts:{
      headliners:(S.headliner||[]).length, tributes:(S.tribute||[]).length, vendors:(S.vendor||[]).length,
      festivals:(S.festival||[]).length, resources:(S.resource||[]).length, charities:(S.charity||[]).length,
      total:S._all.length }}})); }catch(e){}
    if(window.console) console.log("[DD_SCENE_SEED] loaded", S._all.length, "records —",
      (S.vendor||[]).length,"vendors,",(S.tribute||[]).length,"tributes,",(S.festival||[]).length,"festivals.");
  }).catch(function(e){ if(window.console) console.warn("[DD_SCENE_SEED] load failed:", e); });
})();
