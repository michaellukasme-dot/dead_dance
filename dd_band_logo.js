/* dd_band_logo.js — every band gets "a logo" until it claims its own.
   .cover(name, explicit) → image for the ticket cover / hero (uses the band's real SVG if we have one,
     the passed logo if given, else a generated wordmark).
   .icon(name, explicit)  → a PNG data-URI (canvas) safe as an iOS home-screen / manifest icon.
   Neutral StageFill register (ink → teal), no rose. When a band uploads its own art, that overrides. */
(function (root) {
  "use strict";
  var HOUSE = { deal:'deal_logo.svg', kgb:'kgb_logo.svg', cnc:'cnc_logo.svg', rift:'rift_logo.svg',
                hotsauce:'hot_sauce_logo.svg', shakedown:'shakedown_citi_logo.svg', shakedownciti:'shakedown_citi_logo.svg' };
  function norm(n){ return String(n||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
  function house(n){ return HOUSE[norm(n)] || null; }
  function initials(n){
    var w = String(n||'').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '★';
    if (w.length === 1) return w[0].slice(0,2).toUpperCase();
    return (w[0][0] + w[1][0]).toUpperCase();
  }
  function rr(x,X,Y,W,H,r){ x.beginPath(); x.moveTo(X+r,Y); x.arcTo(X+W,Y,X+W,Y+H,r); x.arcTo(X+W,Y+H,X,Y+H,r); x.arcTo(X,Y+H,X,Y,r); x.arcTo(X,Y,X+W,Y,r); x.closePath(); }
  function gen(name){
    try{
      var s=512, c=document.createElement('canvas'); c.width=s; c.height=s; var x=c.getContext('2d');
      var g=x.createLinearGradient(0,0,s,s); g.addColorStop(0,'#153042'); g.addColorStop(1,'#0b7f7c');
      x.fillStyle=g; rr(x,0,0,s,s,96); x.fill();
      x.fillStyle='#ffffff'; x.textAlign='center'; x.textBaseline='middle';
      x.font='900 224px -apple-system,"Segoe UI",Roboto,Arial,sans-serif';
      x.fillText(initials(name), s/2, s/2-14);
      x.font='700 40px -apple-system,"Segoe UI",Roboto,Arial,sans-serif';
      x.fillStyle='rgba(255,255,255,.86)';
      var nm=String(name||'').toUpperCase(); if(nm.length>18) nm=nm.slice(0,17)+'…';
      x.fillText(nm, s/2, s-72);
      return c.toDataURL('image/png');
    }catch(e){ return ''; }
  }
  var api = {
    norm:norm, house:house, initials:initials, gen:gen,
    cover:function(name, explicit){ return explicit || house(name) || gen(name); },
    icon:function(name, explicit){ if(explicit && /\.(png|jpe?g)(\?|$)/i.test(explicit)) return explicit; return gen(name); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DDBandLogo = api;
})(typeof window !== 'undefined' ? window : this);
