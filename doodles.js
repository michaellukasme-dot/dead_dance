/* dead_dance — rotating headline "doodle" hero.
   Each doodle is a vector scene in ./doodles/. The hero shows today's date-matched
   doodle if one is tagged (when:"MM-DD"), otherwise it rotates the everyday set.

   >>> HEADLINE: set your own line per doodle in the `headline` field below. <<<
   It overlays the top of the art in a script font. Leave "" for none.
   Use ONLY words you have the right to publish (your own lines, or licensed text).
   To honor a date, set when:"MM-DD" (e.g. "08-09") and that scene shows that day. */
var DD_DOODLES = [
  /* Greyhound Rock sunset — the family dancing the sun down. THE hero. */
  { id:"sunset", file:"doodles/sunset.svg",
    headline:"",                              /* <-- set your headline here */
    caption:"sunset over Greyhound Rock",
    when:null }
  /* "chancellor" (doodles/chancellor.svg) is PARKED — kept on disk, out of the hero
     rotation by request. To bring it back (or honor a date), re-add it here with a
     when:"MM-DD" tag or as another everyday entry. */
];

function ddHeroEsc(t){ return String(t==null?"":t).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }

function ddHeroCss(){
  if(document.getElementById("dd-hero-css"))return;
  var s=document.createElement("style"); s.id="dd-hero-css";
  s.textContent=
    ".dd-hero{position:relative;width:100%;border-radius:14px;overflow:hidden;margin:0 0 12px;background:#0e0a1a;min-height:110px;box-shadow:0 6px 18px rgba(0,0,0,.18)}"+
    ".dd-hero svg{display:block;width:100%;height:auto}"+
    ".dd-hero .dd-head{position:absolute;top:0;left:0;right:0;text-align:center;padding:9px 14px 24px;"+
      "font-family:'Snell Roundhand','Brush Script MT','Segoe Script',cursive;font-size:24px;line-height:1.15;"+
      "color:#ffe9c7;text-shadow:0 2px 10px rgba(0,0,0,.65);background:linear-gradient(rgba(14,10,26,.72),transparent);pointer-events:none}"+
    ".dd-hero .dd-cap{position:absolute;bottom:7px;right:12px;font-family:Georgia,serif;font-size:11px;color:#ecdfc6;opacity:.85;text-shadow:0 1px 4px rgba(0,0,0,.7);pointer-events:none}";
  document.head.appendChild(s);
}

function ddHeroPick(){
  var t=new Date();
  var mmdd=("0"+(t.getMonth()+1)).slice(-2)+"-"+("0"+t.getDate()).slice(-2);
  for(var i=0;i<DD_DOODLES.length;i++){ if(DD_DOODLES[i].when===mmdd) return DD_DOODLES[i]; }
  var ever=DD_DOODLES.filter(function(d){ return !d.when; }); if(!ever.length) ever=DD_DOODLES;
  var doy=Math.floor((t-new Date(t.getFullYear(),0,0))/864e5);
  return ever[doy%ever.length];
}

function ddHeroMount(){
  var host=document.getElementById("ddHero"); if(!host)return;
  ddHeroCss();
  var d=ddHeroPick(); host.setAttribute("data-doodle",d.id);
  if(typeof fetch!=="function"){ host.style.display="none"; return; }
  var paint=function(svg){
    host.style.display="";
    host.innerHTML=svg+
      (d.headline?'<div class="dd-head">'+ddHeroEsc(d.headline)+'</div>':"")+
      (d.caption?'<div class="dd-cap">'+ddHeroEsc(d.caption)+'</div>':"");
  };
  try{
    fetch(d.file).then(function(r){ return r.text(); })
      .then(function(svg){ if(svg&&svg.indexOf("<svg")>=0) paint(svg); else host.style.display="none"; })
      .catch(function(){ host.style.display="none"; });
  }catch(e){ host.style.display="none"; }
}
