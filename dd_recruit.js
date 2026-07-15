/* dd_recruit.js — the Recruiting Game client ("Bring 'Em Home"). See DESIGN_recruiting_game.md.
   You share your ?ref= QR; a newcomer is attributed to you at first touch; when they STICK
   (earn their own Coins), the server credits YOU — activation-gated, one-level, capped, no cash.
   Auto: capture attribution on load, then check in so a member's earning credits their recruiter. */
(function (root) {
  function C(){ try{ return root.ddClient && root.ddClient(); }catch(e){ return null; } }
  function me(){ try{ var i=root.ddId&&root.ddId(); return (i&&i.id)||null; }catch(e){ return null; } }
  function myName(){ try{ if(root.DDFeed&&DDFeed.myName){ var n=DDFeed.myName(); if(n&&n!=='A head')return n; } return (root.localStorage&&localStorage.getItem('dd.myname'))||''; }catch(e){ return ''; } }
  function region(){ try{ return (root.localStorage&&(localStorage.getItem('dd.chapterName')||localStorage.getItem('dd.chapter')))||null; }catch(e){ return null; } }
  function link(){ return 'https://deaddance.app/?ref=' + encodeURIComponent(me()||''); }

  // new member arriving via ?ref= → lock attribution once (server blocks self-ref + re-attribution)
  function capture(){ try{
    var ref=new (root.URLSearchParams||URLSearchParams)(location.search).get('ref'); if(!ref) return;
    if(ref===me()) return;
    if(root.localStorage && localStorage.getItem('dd.recruitedBy')) return;
    var c=C(); if(!c) return;
    c.rpc('dd_recruit_record',{p_recruiter:ref,p_recruit:me(),p_recruiter_name:'',p_region:region()}).then(function(r){
      var v=(r&&r.data); if(v==='recorded'||v==='locked'){ try{ localStorage.setItem('dd.recruitedBy',ref); }catch(e){} }
    }).catch(function(){});
  }catch(e){} }
  // my own earning should activate my recruiter (server verifies I'm real + caps)
  function checkin(){ var c=C(),id=me(); if(!c||!id) return; try{ if(!localStorage.getItem('dd.recruitedBy')) return; }catch(e){ return; }
    c.rpc('dd_recruit_checkin',{p_recruit:id}).catch(function(){}); }
  function setname(){ var c=C(),id=me(),n=myName(); if(!c||!id||!n) return; c.rpc('dd_recruit_setname',{p_recruiter:id,p_name:n}).catch(function(){}); }
  function board(scope, reg){ var c=C(); if(!c)return Promise.resolve([]); return c.rpc('dd_recruit_board',{p_scope:scope||'all',p_region:reg||null}).then(function(r){ return (r&&r.data)||[]; }).catch(function(){return [];}); }
  function mine(){ var c=C(),id=me(); if(!c||!id)return Promise.resolve([]); return c.rpc('dd_recruit_mine',{p_recruiter:id}).then(function(r){ return (r&&r.data)||[]; }).catch(function(){return [];}); }
  function homecoming(reg){ var c=C(); if(!c)return Promise.resolve(0); return c.rpc('dd_homecoming',{p_region:reg||null}).then(function(r){ return Number((r&&r.data)||0); }).catch(function(){return 0;}); }

  root.DDRecruit = { capture:capture, checkin:checkin, setname:setname, board:board, mine:mine, homecoming:homecoming, link:link, region:region };
  try{ capture(); setTimeout(checkin, 3000); }catch(e){}   // attribute on arrival; credit the recruiter once the member's real
})(typeof window !== 'undefined' ? window : this);
