/* dd_stnav.js — the shared Street-Team tab bar. Include on every street-team page so they
   read as ONE app (same header, tabs across the top, current tab highlighted). No rebuild,
   no iframe — each page keeps its own working body; this only adds the consistent nav. */
(function(){
  try{
    var TABS = [
      { label:'🌹 Academy',      file:'street_academy.html' },
      { label:'🎟️ Adopt a Band', file:'adopt_a_band.html'   },
      { label:'🎚️ Stage Tuning', file:'stage_crew.html'     }
    ];
    var here = (location.pathname.split('/').pop() || 'street_academy.html').toLowerCase();
    function build(){
      if (document.getElementById('stnav')) return;
      var bar = document.createElement('div'); bar.id='stnav';
      bar.style.cssText = 'position:sticky;top:0;z-index:600;display:flex;align-items:center;gap:6px;'
        + 'overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;'
        + 'background:#241535;padding:9px 12px;border-bottom:1px solid #3a2a55;'
        + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
      var html = '<span style="font-weight:900;color:#f0a500;font-size:11px;letter-spacing:.12em;'
        + 'white-space:nowrap;padding-right:4px">STREET&nbsp;TEAM</span>';
      html += TABS.map(function(t){
        var on = here === t.file.toLowerCase();
        return '<a href="'+t.file+'" style="white-space:nowrap;text-decoration:none;font-weight:800;'
          + 'font-size:13px;padding:7px 13px;border-radius:999px;'
          + (on ? 'background:#f0a500;color:#241535' : 'background:#ffffff14;color:#e9e2f7')
          + '">'+t.label+'</a>';
      }).join('');
      bar.innerHTML = html;
      // hide the scrollbar on webkit
      var st=document.createElement('style'); st.textContent='#stnav::-webkit-scrollbar{display:none}';
      document.head.appendChild(st);
      document.body.insertBefore(bar, document.body.firstChild);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
  }catch(e){}
})();
