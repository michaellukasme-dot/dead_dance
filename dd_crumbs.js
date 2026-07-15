/* dd_crumbs.js — Cookie & the Coins (client). Feed Cookie a crumb (a real contribution),
   get COINS — the reward. v1 = points-as-discount, no cash peg (see DESIGN_cookie_MASTER.md).
   Every earn POPS a Mario-style coin: it bounces up, flips, "+N" flies, a little ding.
   Server decides the value (dd_crumb_add); the client only asks and celebrates. */
(function (root) {
  function C(){ try{ return root.ddClient && root.ddClient(); }catch(e){ return null; } }
  function me(){ try{ var i=root.ddId&&root.ddId(); return (i&&i.id)||null; }catch(e){ return null; } }
  function myName(){ try{ if(root.DDFeed&&DDFeed.myName){ var n=DDFeed.myName(); if(n&&n!=='A head')return n; } return (root.localStorage&&localStorage.getItem('dd.myname'))||'A head'; }catch(e){ return 'A head'; } }

  // layers: [name, min coins, store discount %]  (discount = the v1 reward — no cash)
  var LAYERS=[['Nibbler',0,0],['Snacker',250,3],['Feaster',1000,5],['Baker',3000,8],["Cookie's Chosen",7500,10]];
  function layer(total){ var L=LAYERS[0]; for(var i=0;i<LAYERS.length;i++){ if(total>=LAYERS[i][1]) L=LAYERS[i]; } var nx=LAYERS[LAYERS.indexOf(L)+1]||null;
    return { name:L[0], min:L[1], discount:L[2], next:nx?{name:nx[0],min:nx[1]}:null }; }

  var LAST=null;
  function total(){ var c=C(),id=me(); if(!c||!id)return Promise.resolve(0);
    return c.rpc('dd_crumb_total',{p_member:id}).then(function(r){ var t=Number((r&&r.data)||0); if(LAST==null)LAST=t; return t; }).catch(function(){return 0;}); }
  function feed(action, ref, opts){ var c=C(),id=me(); opts=opts||{}; if(!c||!id)return Promise.resolve(0);
    return c.rpc('dd_crumb_add',{p_member:id,p_name:myName(),p_action:action,p_ref:ref||null}).then(function(r){
      var t=Number((r&&r.data)||0); if(LAST!=null && t>LAST){ pop(t-LAST, opts.x, opts.y); } LAST=t; return t;
    }).catch(function(){ return 0; }); }
  // add a show → server decides: 40 Cookies if you're FIRST to bring it, 5 if it was already on the board.
  function showKey(band, date, venue){ function n(x){ return String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,''); } return n(band)+'|'+String(date||'')+'|'+n(venue); }
  function showAdd(band, date, venue, opts){ var c=C(),id=me(); opts=opts||{}; var key=showKey(band,date,venue);
    if(!c||!id) return Promise.resolve({});
    return c.rpc('dd_crumb_show_add',{p_member:id,p_name:myName(),p_show_key:key}).then(function(r){
      var d=(r&&r.data)||{}; var t=Number(d.total||0);
      if(LAST!=null && t>LAST){ pop(t-LAST, opts.x, opts.y); } LAST=t;
      if(d.awarded==='new' && typeof root.toast==='function'){ try{ root.toast('🍪 First one in! +'+d.points+' Cookies — the family didn’t have this show. 🌹'); }catch(e){} }
      return d;
    }).catch(function(){ return {}; }); }
  function board(scope){ var c=C(); if(!c)return Promise.resolve([]); return c.rpc('dd_crumb_board',{p_scope:scope||'week'}).then(function(r){ return (r&&r.data)||[]; }).catch(function(){return [];}); }
  function belly(){ var c=C(); if(!c)return Promise.resolve(0); return c.rpc('dd_belly',{}).then(function(r){ return Number((r&&r.data)||0); }).catch(function(){return 0;}); }

  // ---- the Mario coin ----
  function css(){ if(document.getElementById('coincss'))return; var s=document.createElement('style'); s.id='coincss';
    s.textContent=
     '@keyframes ddcoinrise{0%{transform:translateY(6px) scale(.5);opacity:0}18%{opacity:1;transform:translateY(-4px) scale(1)}100%{transform:translateY(-64px) scale(1);opacity:0}}'+
     '@keyframes ddcoinflip{0%,100%{transform:scaleX(1) rotate(0)}50%{transform:scaleX(.22) rotate(8deg)}}'+
     '@keyframes ddcrumbfly{0%{opacity:0;transform:translate(0,0) scale(.5)}22%{opacity:1}100%{opacity:0;transform:translate(var(--tx,0),var(--ty,-18px)) scale(1)}}'+
     '.ddcoin{position:fixed;z-index:10000;width:34px;height:34px;pointer-events:none;animation:ddcoinrise 920ms cubic-bezier(.2,.7,.3,1) forwards}'+
     '.ddcoin svg{width:34px;height:34px;display:block;filter:drop-shadow(0 2px 4px rgba(80,40,10,.35));animation:ddcoinflip 300ms linear infinite}'+
     '.ddcrumb{position:fixed;z-index:10000;width:6px;height:6px;border-radius:2px;background:#8a5a34;pointer-events:none;animation:ddcrumbfly 720ms ease-out forwards}'+
     '.ddcoinamt{position:fixed;z-index:10000;font-weight:900;font-size:16px;color:#B5673E;text-shadow:0 1px 2px rgba(0,0,0,.22);pointer-events:none;animation:ddcoinrise 960ms cubic-bezier(.2,.7,.3,1) forwards}';
    document.head.appendChild(s); }
  function ding(){ try{ var A=root.AudioContext||root.webkitAudioContext; if(!A)return; var ctx=ding._c||(ding._c=new A());
    [[988,0],[1319,0.07]].forEach(function(n){ var o=ctx.createOscillator(),g=ctx.createGain(); o.type='square'; o.frequency.value=n[0];
      o.connect(g); g.connect(ctx.destination); var t=ctx.currentTime+n[1]; g.gain.setValueAtTime(0.05,t); g.gain.exponentialRampToValueAtTime(0.0008,t+0.12); o.start(t); o.stop(t+0.13); }); }catch(e){} }
  var COOKIE='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#C8794F" stroke="#B5673E" stroke-width="1.5"/>'+
    '<circle cx="8" cy="9" r="1.7" fill="#5A2E86"/><circle cx="15.5" cy="8.5" r="1.4" fill="#3A2417"/>'+
    '<circle cx="14" cy="15" r="1.6" fill="#5A2E86"/><circle cx="8" cy="15.5" r="1.2" fill="#3A2417"/><circle cx="12.5" cy="12" r="1.2" fill="#3A2417"/></svg>';
  function crumb(cx, cy){ var s=document.createElement('div'); s.className='ddcrumb'; s.style.left=(cx)+'px'; s.style.top=(cy)+'px';
    s.style.setProperty('--tx',(Math.random()*46-23)+'px'); s.style.setProperty('--ty',(-12-Math.random()*28)+'px');
    document.body.appendChild(s); setTimeout(function(){ try{s.remove();}catch(e){} },720); }
  function pop(n, x, y){ css(); x=(x==null)?(root.innerWidth/2):x; y=(y==null)?(root.innerHeight*0.42):y;
    var k=Math.min(6,Math.max(1,Math.round(n/5)));   // a little shower for bigger rewards
    for(var i=0;i<k;i++){ (function(i){ setTimeout(function(){
      var cx=x-17+(Math.random()*34-17), cy=y;
      var el=document.createElement('div'); el.className='ddcoin'; el.style.left=cx+'px'; el.style.top=cy+'px'; el.innerHTML=COOKIE;
      document.body.appendChild(el); setTimeout(function(){ try{el.remove();}catch(e){} },920);
      for(var j=0;j<4;j++) crumb(cx+14, cy+14);   // 🍪 crumbs scatter off each cookie
    }, i*80); })(i); }
    var amt=document.createElement('div'); amt.className='ddcoinamt'; amt.textContent='+'+n; amt.style.left=(x+16)+'px'; amt.style.top=(y-8)+'px';
    document.body.appendChild(amt); setTimeout(function(){ try{amt.remove();}catch(e){} },960); ding(); }

  root.DDCoins = { feed:feed, showAdd:showAdd, total:total, board:board, belly:belly, layer:layer, pop:pop, LAYERS:LAYERS };
  try{ total(); }catch(e){}   // prime LAST so the first earn pops only the delta, not the whole jar
})(typeof window !== 'undefined' ? window : this);
