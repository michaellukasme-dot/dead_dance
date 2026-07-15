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
  function board(scope){ var c=C(); if(!c)return Promise.resolve([]); return c.rpc('dd_crumb_board',{p_scope:scope||'week'}).then(function(r){ return (r&&r.data)||[]; }).catch(function(){return [];}); }
  function belly(){ var c=C(); if(!c)return Promise.resolve(0); return c.rpc('dd_belly',{}).then(function(r){ return Number((r&&r.data)||0); }).catch(function(){return 0;}); }

  // ---- the Mario coin ----
  function css(){ if(document.getElementById('coincss'))return; var s=document.createElement('style'); s.id='coincss';
    s.textContent=
     '@keyframes ddcoinrise{0%{transform:translateY(6px) scale(.5);opacity:0}18%{opacity:1;transform:translateY(-4px) scale(1)}100%{transform:translateY(-64px) scale(1);opacity:0}}'+
     '@keyframes ddcoinflip{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.16)}}'+
     '.ddcoin{position:fixed;z-index:10000;width:32px;height:32px;pointer-events:none;animation:ddcoinrise 900ms cubic-bezier(.2,.7,.3,1) forwards}'+
     '.ddcoin i{display:flex;width:32px;height:32px;border-radius:50%;align-items:center;justify-content:center;font-style:normal;font-weight:900;font-size:15px;color:#9a6a00;'+
       'background:radial-gradient(circle at 34% 30%,#fff0a6,#f6b800 58%,#cf8f00);box-shadow:inset 0 0 0 2px #b5820a,0 2px 5px rgba(0,0,0,.25);animation:ddcoinflip 300ms linear infinite}'+
     '.ddcoinamt{position:fixed;z-index:10000;font-weight:900;font-size:16px;color:#f0a500;text-shadow:0 1px 2px rgba(0,0,0,.28);pointer-events:none;animation:ddcoinrise 960ms cubic-bezier(.2,.7,.3,1) forwards}';
    document.head.appendChild(s); }
  function ding(){ try{ var A=root.AudioContext||root.webkitAudioContext; if(!A)return; var ctx=ding._c||(ding._c=new A());
    [[988,0],[1319,0.07]].forEach(function(n){ var o=ctx.createOscillator(),g=ctx.createGain(); o.type='square'; o.frequency.value=n[0];
      o.connect(g); g.connect(ctx.destination); var t=ctx.currentTime+n[1]; g.gain.setValueAtTime(0.05,t); g.gain.exponentialRampToValueAtTime(0.0008,t+0.12); o.start(t); o.stop(t+0.13); }); }catch(e){} }
  function pop(n, x, y){ css(); x=(x==null)?(root.innerWidth/2):x; y=(y==null)?(root.innerHeight*0.42):y;
    var k=Math.min(6,Math.max(1,Math.round(n/5)));   // a little shower for bigger rewards
    for(var i=0;i<k;i++){ (function(i){ setTimeout(function(){ var el=document.createElement('div'); el.className='ddcoin';
      el.style.left=(x-16+(Math.random()*34-17))+'px'; el.style.top=y+'px'; el.innerHTML='<i>C</i>'; document.body.appendChild(el);
      setTimeout(function(){ try{el.remove();}catch(e){} },900); }, i*80); })(i); }
    var amt=document.createElement('div'); amt.className='ddcoinamt'; amt.textContent='+'+n; amt.style.left=(x+16)+'px'; amt.style.top=(y-8)+'px';
    document.body.appendChild(amt); setTimeout(function(){ try{amt.remove();}catch(e){} },960); ding(); }

  root.DDCoins = { feed:feed, total:total, board:board, belly:belly, layer:layer, pop:pop, LAYERS:LAYERS };
  try{ total(); }catch(e){}   // prime LAST so the first earn pops only the delta, not the whole jar
})(typeof window !== 'undefined' ? window : this);
