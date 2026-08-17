/* dd_cluster.js — lightweight marker clustering for StageFill maps (frameworkless, local Leaflet, no CDN).
   Density stays legible at every scale: nearby pins collapse into ONE bubble showing the count in that
   cluster; click a bubble (or zoom in) and it splits back into individual pins. Works with our own
   category/type filters — only the currently-visible points are clustered.

   Usage:
     var C = new DDCluster(map, { radius:56, colorFor:function(pts){...}, onExpand:'flyToBounds' });
     C.set(points);   // points: [{ lat, lng, marker:<L.marker, not yet on map> }]
     C.refresh();     // re-cluster (after a filter change), C.set() also re-clusters
*/
(function (root) {
  "use strict";
  var CSS = ''
    + '.ddcl{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font:900 13px/1 -apple-system,system-ui,sans-serif;color:#fff;'
    + 'background:rgba(15,22,32,.92);box-shadow:0 0 0 6px rgba(15,22,32,.18),0 2px 8px rgba(20,26,34,.4);cursor:pointer;border:2px solid #fff}'
    + '.ddcl.sm{width:34px;height:34px;font-size:12px}.ddcl.lg{width:48px;height:48px;font-size:15px;box-shadow:0 0 0 8px rgba(15,22,32,.16),0 2px 9px rgba(20,26,34,.45)}'
    + '.ddcl:hover{background:#0b7f7c}';
  function injectCSS(){ if(document.getElementById('ddcluster-css')) return; var s=document.createElement('style'); s.id='ddcluster-css'; s.textContent=CSS; (document.head||document.body).appendChild(s); }

  function DDCluster(map, opts){
    opts = opts || {}; injectCSS();
    var R = opts.radius || 56;
    var pts = [];
    var group = L.layerGroup().addTo(map);
    var self = this;

    function clusterHtml(n){
      var cls = n >= 50 ? ' lg' : (n < 10 ? ' sm' : '');
      return '<div class="ddcl'+cls+'">'+n+'</div>';
    }
    function redraw(){
      if(!pts.length){ group.clearLayers(); return; }
      var proj = pts.map(function(p){ return map.latLngToLayerPoint(L.latLng(p.lat, p.lng)); });
      var used = new Array(pts.length); for(var k=0;k<pts.length;k++) used[k]=false;
      group.clearLayers();
      for(var i=0;i<pts.length;i++){
        if(used[i]) continue;
        var members=[i]; used[i]=true;
        for(var j=i+1;j<pts.length;j++){
          if(used[j]) continue;
          if(proj[i].distanceTo(proj[j]) <= R){ members.push(j); used[j]=true; }
        }
        if(members.length === 1){
          group.addLayer(pts[i].marker);
        } else {
          var la=0, lo=0; members.forEach(function(m){ la+=pts[m].lat; lo+=pts[m].lng; });
          var center=[la/members.length, lo/members.length];
          var cl = L.marker(center, { icon: L.divIcon({ className:'', html: clusterHtml(members.length), iconSize:[40,40], iconAnchor:[20,20] }), zIndexOffset:400, keyboard:false });
          (function(mem){
            var bounds = L.latLngBounds(mem.map(function(m){ return [pts[m].lat, pts[m].lng]; }));
            cl.on('click', function(){
              if(bounds.getNorthEast().equals(bounds.getSouthWest())){ map.flyTo(bounds.getCenter(), Math.min(map.getZoom()+3, map.getMaxZoom()||20), {duration:.5}); }
              else { map.flyToBounds(bounds.pad(0.35), { maxZoom: Math.min((map.getZoom()||10)+4, map.getMaxZoom()||20), duration:.5 }); }
            });
            cl.bindTooltip(mem.length+' here — click to zoom', {direction:'top', offset:[0,-16]});
          })(members);
          group.addLayer(cl);
        }
      }
    }
    // expose a pure function for testing/verification (no Leaflet needed)
    self.set = function(points){ pts = points || []; redraw(); return self; };
    self.refresh = redraw;
    self.clear = function(){ pts=[]; group.clearLayers(); };
    map.on('zoomend', redraw); map.on('moveend', redraw);
  }

  // ── pure clustering core (for headless verification) ────────────────────────
  // pts: [{x,y}] pixel coords; returns array of clusters (each = array of indices).
  DDCluster.clusterPx = function(pxs, R){
    var used=new Array(pxs.length), out=[]; for(var k=0;k<pxs.length;k++) used[k]=false;
    for(var i=0;i<pxs.length;i++){
      if(used[i]) continue; var m=[i]; used[i]=true;
      for(var j=i+1;j<pxs.length;j++){ if(used[j]) continue;
        var dx=pxs[i].x-pxs[j].x, dy=pxs[i].y-pxs[j].y;
        if(Math.sqrt(dx*dx+dy*dy)<=R){ m.push(j); used[j]=true; } }
      out.push(m);
    }
    return out;
  };

  root.DDCluster = DDCluster;
})(typeof window!=='undefined' ? window : globalThis);
