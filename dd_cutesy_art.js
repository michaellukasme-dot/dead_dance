/* ============================================================================
 * dd_cutesy_art.js — the illustrated ("cutesy") MAP GENERATOR (window.DDCutesyArt).
 *
 * Renders a container's OWN geo footprint (boundary + inner containers) as hand-illustrated art on a
 * canvas keyed to the exact bounding box, so a Leaflet imageOverlay(bounds = bbox) AUTO-SNAPS — real
 * markers land right on the illustration. No designer, no corner-dragging.
 *
 * ONE ENGINE, THREE FACES (theme):
 *   'festival' — parkland: green fields, cream grounds, tan pavilion roofs, scattered trees.
 *   'market'   — farmers market: warm cream, produce greens, striped stall awnings.
 *   'corridor' — a street: soft asphalt, a road down the long axis, storefront blocks.
 *
 * feats: { title, boundary:[[lat,lng]...], containers:[{corners:[[lat,lng]...], name, covered}] }
 * bbox : [[swLat,swLng],[neLat,neLng]]  → render() returns a PNG dataURL (or null). Node-safe (needs a canvas).
 * ==========================================================================*/
(function (root) {
  'use strict';
  var THEMES = {
    festival: { sky1:'#d3ebbd', sky2:'#bfe0a6', ground:'#fbf3df', edge:'#8a5a2a', tent:'#e6c79a', open:'#dfe9c6', tentEdge:'#9a6b34', dot:['#a6cf86','#93c26f'], label:'#5a3c18' },
    market:   { sky1:'#f3e7c9', sky2:'#ecd9a8', ground:'#fff6e6', edge:'#9a5a2a', tent:'#e07a5a', open:'#f2c14e', tentEdge:'#b0432b', dot:['#8fbf5a','#e07a5a'], label:'#6b3a12' },
    corridor: { sky1:'#dfe3e8', sky2:'#cfd5dd', ground:'#eef1f4', edge:'#5b6472', tent:'#c9b79c', open:'#d8dee6', tentEdge:'#7a5a3a', dot:['#8fae7a','#9aa7b3'], label:'#39414d' }
  };
  function render(bbox, feats, theme) { try {
    var T = THEMES[theme] || THEMES.festival; feats = feats || {};
    if (!(bbox && bbox[0] && bbox[1])) return null;
    var sw = bbox[0], ne = bbox[1], latSpan = ne[0]-sw[0], lngSpan = ne[1]-sw[1];
    if (!(latSpan > 0 && lngSpan > 0)) return null;
    var midLat = (sw[0]+ne[0])/2, lngM = lngSpan*111320*Math.cos(midLat*Math.PI/180), latM = latSpan*110540;
    var W = 1100, H = Math.max(520, Math.min(1600, Math.round(W*(latM/Math.max(1,lngM)))));
    var doc = root.document || (typeof document !== 'undefined' ? document : null); if (!doc) return null;
    var cv = doc.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d'); if (!x) return null;
    function px(lat,lng){ return [ (lng-sw[1])/lngSpan*W, (ne[0]-lat)/latSpan*H ]; }
    function poly(pts){ x.beginPath(); pts.forEach(function(p,i){ var q=px(p[0],p[1]); if(i===0)x.moveTo(q[0],q[1]); else x.lineTo(q[0],q[1]); }); x.closePath(); }
    // ground wash
    var g = x.createLinearGradient(0,0,0,H); g.addColorStop(0,T.sky1); g.addColorStop(1,T.sky2); x.fillStyle=g; x.fillRect(0,0,W,H);
    // scatter (trees / produce / street trees)
    x.globalAlpha=.5; var n=Math.round(W*H/9000); for(var i=0;i<n;i++){ x.fillStyle=(Math.random()<.5?T.dot[0]:T.dot[1]); x.beginPath(); x.arc(Math.random()*W,Math.random()*H,3+Math.random()*4,0,7); x.fill(); } x.globalAlpha=1;
    // corridor: a soft road down the long axis with a dashed centerline
    if (theme === 'corridor') { x.strokeStyle='#c2c8d0'; x.lineWidth=Math.max(10,W*0.03); x.lineCap='round'; x.beginPath(); x.moveTo(W*0.5,H*0.05); x.lineTo(W*0.5,H*0.95); x.stroke(); x.setLineDash([14,16]); x.strokeStyle='#ffffffcc'; x.lineWidth=3; x.stroke(); x.setLineDash([]); }
    // grounds
    var bd = feats.boundary || []; if (bd.length >= 3) { poly(bd); x.fillStyle=T.ground; x.fill(); x.lineWidth=6; x.strokeStyle=T.edge; x.setLineDash([14,10]); x.stroke(); x.setLineDash([]); }
    // inner containers (pavilions / stalls / storefronts)
    (feats.containers || []).forEach(function(c){ var pts=c.corners||[]; if(pts.length<3) return; poly(pts);
      x.fillStyle = c.covered ? T.tent : T.open; x.fill(); x.lineWidth=3; x.strokeStyle=T.tentEdge; x.stroke();
      // market: paint a striped awning across covered stalls
      if (theme === 'market' && c.covered) { var mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9; pts.forEach(function(p){ var q=px(p[0],p[1]); mnx=Math.min(mnx,q[0]); mny=Math.min(mny,q[1]); mxx=Math.max(mxx,q[0]); mxy=Math.max(mxy,q[1]); });
        x.save(); poly(pts); x.clip(); var stripe=Math.max(10,(mxx-mnx)/7); for(var s=mnx;s<mxx;s+=stripe*2){ x.fillStyle='#ffffff88'; x.fillRect(s,mny,stripe,mxy-mny); } x.restore(); }
      var cx=0,cy=0; pts.forEach(function(p){ var q=px(p[0],p[1]); cx+=q[0]; cy+=q[1]; }); cx/=pts.length; cy/=pts.length;
      x.fillStyle=T.label; x.font='700 15px -apple-system,sans-serif'; x.textAlign='center'; x.fillText((c.covered?'⛺ ':'')+(c.name||''), cx, cy); });
    // title ribbon
    if (feats.title) { x.font='800 26px -apple-system,sans-serif'; var m=x.measureText(feats.title).width, pw=Math.min(W-30,m+50), ph=46, pxx=(W-pw)/2, pyy=16;
      x.beginPath(); if(x.roundRect) x.roundRect(pxx,pyy,pw,ph,23); else x.rect(pxx,pyy,pw,ph); x.fillStyle='rgba(74,30,92,.92)'; x.fill();
      x.fillStyle='#fff'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(feats.title, W/2, pyy+ph/2); x.textBaseline='alphabetic'; }
    return cv.toDataURL('image/png');
  } catch (e) { return null; } }
  root.DDCutesyArt = { render: render, themes: Object.keys(THEMES) };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DDCutesyArt;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
