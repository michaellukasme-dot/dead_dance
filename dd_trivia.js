/* dd_trivia.js — the Dead Karaoke trivia + global-ranking client.
   Talks to dd_trivia.sql. Show-specific banks, live sessions, normalized scoring,
   and three boards (room · global · season). The normalization lives server-side,
   so a phone here just opens/joins a session, serves questions (no answers), submits
   answers for server grading, and reads the boards. Realtime lights the boards up live. */
(function (root) {
  function C(){ try { return root.ddClient && root.ddClient(); } catch(e){ return null; } }
  function me(){ try { var i = root.ddId && root.ddId(); return (i && i.id) || null; } catch(e){ return null; } }

  function openSession(venue, showKey, tier, tournament){
    var c=C(); if(!c) return Promise.resolve(null);
    return c.rpc('dd_session_open',{p_venue:venue||null,p_show_key:showKey||null,p_tier:tier||'most',p_tournament:tournament||null})
      .then(function(r){ return (r&&r.data)||null; }).catch(function(){ return null; });
  }
  function join(code, name, level){
    var c=C(); if(!c) return Promise.resolve(null);
    return c.rpc('dd_join',{p_code:code,p_member:me(),p_name:name||'Anonymous Head',p_level:level||'deadhead'})
      .then(function(r){ return (r&&r.data)||null; }).catch(function(){ return null; });
  }
  function questions(sessionId){
    var c=C(); if(!c) return Promise.resolve([]);
    return c.rpc('dd_trivia_questions',{p_session:sessionId})
      .then(function(r){ return (r&&r.data)||[]; }).catch(function(){ return []; });
  }
  function answer(sessionId, playerId, qId, choiceIdx, ms){
    var c=C(); if(!c) return Promise.resolve(null);
    return c.rpc('dd_answer',{p_session:sessionId,p_player:playerId,p_q:qId,p_choice:choiceIdx,p_ms:ms|0})
      .then(function(r){ return (r&&r.data)||null; }).catch(function(){ return null; });
  }
  function scoreAdd(sessionId, playerId, kind, raw){
    var c=C(); if(!c) return Promise.resolve(0);
    return c.rpc('dd_score_add',{p_session:sessionId,p_player:playerId,p_kind:kind||'game',p_raw:raw|0})
      .then(function(r){ return (r&&r.data)||0; }).catch(function(){ return 0; });
  }
  function roomBoard(sessionId){
    var c=C(); if(!c) return Promise.resolve([]);
    return c.rpc('dd_room_board',{p_session:sessionId}).then(function(r){ return (r&&r.data)||[]; }).catch(function(){ return []; });
  }
  function globalBoard(tournament){
    var c=C(); if(!c) return Promise.resolve([]);
    return c.rpc('dd_global_board',{p_tournament:tournament||'nightly'}).then(function(r){ return (r&&r.data)||[]; }).catch(function(){ return []; });
  }
  function seasonBoard(since){
    var c=C(); if(!c) return Promise.resolve([]);
    return c.rpc('dd_season_board',{p_since:since||null}).then(function(r){ return (r&&r.data)||[]; }).catch(function(){ return []; });
  }
  var chan=null;
  function subscribe(onChange){
    var c=C(); if(!c||chan) return;
    try {
      chan=c.channel('dd_trivia_live')
        .on('postgres_changes',{event:'*',schema:'public',table:'dd_score'}, function(){ try{onChange&&onChange();}catch(e){} })
        .subscribe();
    } catch(e){}
  }

  root.DDTrivia = { openSession:openSession, join:join, questions:questions, answer:answer,
    scoreAdd:scoreAdd, roomBoard:roomBoard, globalBoard:globalBoard, seasonBoard:seasonBoard, subscribe:subscribe };
})(typeof window !== 'undefined' ? window : this);
