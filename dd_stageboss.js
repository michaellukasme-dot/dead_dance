/* ============================================================================
 * dd_stageboss.js — the AUTONOMOUS FESTIVAL STAGE-MANAGER AGENT.
 *
 * The industrialized sibling of sf_calendar_coach.js (the single-venue calendar
 * manager). Where the coach fills ONE room's week, StageBoss fills a WHOLE
 * FESTIVAL — many stages, many days, many slots — from a bookable act pool,
 * WITHIN AN ACTS BUDGET, maximizing expected draw, then prices its own service
 * per stage-day managed. The organizer confirms; nothing books without a yes.
 *
 *   plan(spec, pool, opts) — the whole festival proforma (per-stage lineup,
 *                            P&L, StageFill fee, and a plain-English "why" per act).
 *
 * Design goals (commercial-grade):
 *   • Budget is a HARD cap — the plan never overspends the acts budget.
 *   • Deterministic + explainable — same inputs → same plan, every act carries a reason.
 *   • No double-booking — one act can't be in two overlapping slots.
 *   • Local-draw aware — hometown/region acts get a real, bounded bonus.
 *   • Guarded + local-first (no backend = no-op). Instrumented (ids/counts, NO PII).
 *   • Confirm-gated — plan is a DRAFT; confirm() is the only thing that "books".
 *   • Dual browser/node export; pure core is unit-testable.
 * ==========================================================================*/
;(function (root) {
  'use strict';

  // ---- knobs (defensible rules of thumb, NOT a forecast) --------------------
  var SIZE_DRAW   = { Band:60, DJ:55, Quartet:45, Trio:40, Duo:35, Solo:30 };
  var ENERGY_MULT = { High:1.15, Mid:1.0, Chill:0.9 };
  var GENRE_POP   = { // broad-appeal genres pull a bigger general-festival crowd
    'Rock':1.15,'Pop':1.15,'Country':1.15,'Cover / Top 40':1.15,
    'Hip-Hop':1.1,'R&B / Soul':1.1,'Latin':1.1,'Reggae':1.1,'Electronic / DJ':1.1,'Grateful Dead':1.1,
    'Folk / Americana':1.0,'Blues':1.0,'Jazz':1.0,
    'Classical':0.85,'Piano / Standards':0.85
  };
  var PART_ENERGY = { afternoon:'Chill', mid:'Mid', evening:'High', night:'High' };  // what each slot wants
  var DEFAULTS = { perStageDay:150, gateSharePct:0, cover:15, barPerHead:11, housePerStageDay:350, fillFloor:0.35, fillSpan:0.40, maxPerAct:1 };

  function clamp(x,a,b){ return x<a?a:(x>b?b:x); }
  function num(x,d){ x=Number(x); return isFinite(x)?x:(d||0); }
  function money(n){ return Math.round(num(n)); }

  // ---- draw index (expected pull, ~0..100) ----------------------------------
  function drawIndex(act, region){
    if(!act) return 0;
    var base = SIZE_DRAW[act.size] != null ? SIZE_DRAW[act.size] : 38;
    var em   = ENERGY_MULT[act.energy] != null ? ENERGY_MULT[act.energy] : 1.0;
    var gp   = GENRE_POP[act.genre] != null ? GENRE_POP[act.genre] : 1.0;
    var d = base * em * gp;
    if(region){                                   // hometown draw — real but bounded
      if(act.state && region.state && String(act.state).toUpperCase()===String(region.state).toUpperCase()) d += 8;
      if(act.city  && region.city  && String(act.city ).toLowerCase()===String(region.city ).toLowerCase()) d += 6;
    }
    return Math.round(clamp(d, 0, 100));
  }

  // ---- fit of an act to a stage+slot (0..1) ---------------------------------
  function fitScore(act, stage, slot){
    if(!act||!stage) return 0;
    var f = 0.15;                                  // baseline: any act can play any stage
    // genre ↔ stage lean
    var lean = (stage.lean||[]).map(function(g){return String(g).toLowerCase();});
    if(lean.length){ f += (lean.indexOf(String(act.genre||'').toLowerCase())>=0) ? 0.40 : 0.0; }
    else f += 0.15;                                // no lean = the stage takes all comers
    // energy ↔ slot part
    var want = PART_ENERGY[(slot&&slot.part)||'evening'] || 'High';
    if(act.energy===want) f += 0.25; else if(act.energy==='Mid') f += 0.12;
    // size ↔ capacity
    var cap = num(stage.cap, 300), big = (act.size==='Band'||act.size==='DJ');
    if(cap>=800) f += big?0.20:0.05; else if(cap<=200) f += big?0.05:0.18; else f += 0.12;
    // vibe ↔ fit tag
    var vibe = String(stage.vibe||'any').toLowerCase();
    if(vibe==='upscale' && act.fit==='Upscale') f += 0.15;
    else if((vibe==='rowdy'||vibe==='any') && act.energy==='High') f += 0.10;
    else f += 0.05;
    return clamp(f, 0, 1);
  }

  function expFill(draw, opts){ opts=opts||{}; var fl=num(opts.fillFloor,DEFAULTS.fillFloor), sp=num(opts.fillSpan,DEFAULTS.fillSpan);
    return clamp(fl + (num(draw)/100)*sp, 0.05, 0.98); }

  function whyLine(act, stage, slot, region){
    var bits=[];
    if(act.energy) bits.push(act.energy+'-energy');
    if(act.genre)  bits.push(act.genre);
    var localState = act.state && region && region.state && String(act.state).toUpperCase()===String(region.state).toUpperCase();
    if(localState) bits.push('local ('+act.state+')');
    var part = (slot&&slot.part)||'evening';
    return bits.join(', ') + ' — fits ' + (stage.name||'the stage') + ' ' + part;
  }

  // ---- default slot generation (3 parts/day) --------------------------------
  function defaultSlots(days, per){
    var parts = per===2 ? [['15:00','Afternoon','mid'],['19:30','Night','night']]
              : per===4 ? [['12:00','Midday','afternoon'],['15:00','Afternoon','mid'],['18:00','Evening','evening'],['21:00','Headliner','night']]
              :           [['13:00','Afternoon','afternoon'],['16:30','Evening','mid'],['20:00','Night','night']];
    var out=[]; (days||[]).forEach(function(d){ parts.forEach(function(p){ out.push({day:d,start:p[0],label:p[1],part:p[2]}); }); });
    return out;
  }

  // ---- normalize a stage → {id,name,cap,lean,vibe,slots[]} -------------------
  function normStage(s, festDays){
    var days = (s.days&&s.days.length)?s.days:(festDays||[]);
    var slots = (s.slots&&s.slots.length) ? s.slots.slice() : defaultSlots(days, s.slotsPerDay||3);
    return { id:String(s.id||s.name||'stage'), name:s.name||s.id||'Stage', cap:num(s.cap,300),
             cover:(s.cover!=null? num(s.cover): null),   // per-stage ticket price; null = use festival default; 0 = FREE stage
             lean:s.lean||[], vibe:s.vibe||'any', days:days, slots:slots };
  }

  // ---- THE PLAN: fill every stage×slot to max draw within the acts budget ----
  function plan(spec, pool, opts){
    spec=spec||{}; opts=Object.assign({}, DEFAULTS, opts||{});
    var region = spec.region||{};
    var budget = num(spec.budget, 0);                         // total acts budget — a HARD cap
    var festDays = spec.days||[];
    var stages = (spec.stages||[]).map(function(s){ return normStage(s, festDays); });

    // pre-score the pool once (draw is stage-independent)
    var acts = (pool||[]).filter(function(a){ return a && a.name && isFinite(Number(a.fee)); })
      .map(function(a){ return { act:a, draw:drawIndex(a, region), fee:num(a.fee,0) }; });

    // candidate triples (stage,slot,act) ranked by value = draw × fit
    var cands=[];
    stages.forEach(function(st, si){
      st.slots.forEach(function(sl, li){
        acts.forEach(function(pa){
          var fit = fitScore(pa.act, st, sl);
          var value = pa.draw * fit;
          cands.push({ si:si, li:li, act:pa.act, fee:pa.fee, draw:pa.draw, fit:fit, value:value,
                       vpf: pa.fee>0 ? value/pa.fee : value });   // value-per-fee (knapsack heuristic)
        });
      });
    });
    // greedy: best value-per-dollar first (efficient spend), tie-break on raw value
    cands.sort(function(a,b){ return (b.vpf-a.vpf) || (b.value-a.value); });

    // assignment state
    var slotFilled = stages.map(function(st){ return st.slots.map(function(){ return null; }); });
    var actUsedAt = {};                          // actName -> [{day,start}] to block same-time overlaps
    var actCount  = {};                          // actName -> times booked across the festival (variety cap)
    var maxPerAct = Math.max(1, num(opts.maxPerAct, DEFAULTS.maxPerAct));
    var spend = 0;

    function overlaps(name, day, start){
      var arr = actUsedAt[name]; if(!arr) return false;
      for(var i=0;i<arr.length;i++){ if(arr[i].day===day && arr[i].start===start) return true; }  // same slot time same day
      return false;
    }

    cands.forEach(function(c){
      if(slotFilled[c.si][c.li]) return;                       // slot already taken
      if((actCount[c.act.name]||0) >= maxPerAct) return;       // VARIETY — one act can't hog the festival
      var st=stages[c.si], sl=st.slots[c.li];
      if(overlaps(c.act.name, sl.day, sl.start)) return;       // act already playing at this time elsewhere
      if(spend + c.fee > budget) return;                       // HARD budget cap
      slotFilled[c.si][c.li] = c;
      (actUsedAt[c.act.name]=actUsedAt[c.act.name]||[]).push({day:sl.day,start:sl.start});
      actCount[c.act.name] = (actCount[c.act.name]||0) + 1;
      spend += c.fee;
    });

    // build per-stage proformas + P&L
    var perStageDay = num(opts.perStageDay, DEFAULTS.perStageDay);
    var cover = num(spec.cover!=null?spec.cover:opts.cover, DEFAULTS.cover);
    var totGate=0, totBar=0, totActCost=0, totHouse=0, totAtt=0, slotsFilled=0, slotsTotal=0, stageDays=0;

    var stagesOut = stages.map(function(st, si){
      var dayset={}; var actCost=0, gate=0, bar=0, att=0, filled=0;
      var stCover = st.cover!=null ? st.cover : cover;   // per-stage ticket price (a FEE stage inside a FREE festival, e.g. Wind Creek)
      var slotsOut = st.slots.map(function(sl, li){
        slotsTotal++; var c = slotFilled[si][li]; dayset[sl.day]=1;
        if(!c){ return { day:sl.day, start:sl.start, label:sl.label, part:sl.part, act:null }; }
        filled++; slotsFilled++;
        var a=c.act, f=expFill(c.draw, opts), slotAtt=Math.round(st.cap*f);
        var g=slotAtt*stCover, b=slotAtt*num(opts.barPerHead,DEFAULTS.barPerHead);
        actCost+=c.fee; gate+=g; bar+=b; att+=slotAtt;
        return { day:sl.day, start:sl.start, label:sl.label, part:sl.part,
                 act:{ name:a.name, genre:a.genre, size:a.size, energy:a.energy, city:a.city, state:a.state },
                 fee:c.fee, draw:c.draw, fit:Math.round(c.fit*100)/100, expAtt:slotAtt,
                 why: whyLine(a, st, sl, region) };
      });
      var ndays=Object.keys(dayset).length; stageDays+=ndays;
      var house=num(opts.housePerStageDay,DEFAULTS.housePerStageDay)*ndays;
      totGate+=gate; totBar+=bar; totActCost+=actCost; totHouse+=house; totAtt+=att;
      return { id:st.id, name:st.name, cap:st.cap, days:ndays, slotsFilled:filled, slotsTotal:st.slots.length,
               cover:stCover, ticketed:(stCover>0),
               actCost:money(actCost), expAtt:att, gate:money(gate), bar:money(bar),
               net:money(gate+bar-actCost-house), slots:slotsOut };
    });

    // StageFill pricing — the $$/stage-day managed model, transparent
    var mgmtFee = perStageDay * stageDays;
    var gateShare = Math.round(totGate * (num(opts.gateSharePct,DEFAULTS.gateSharePct)/100));
    var sfFee = mgmtFee + gateShare;
    var houseNet = totGate + totBar - totActCost - totHouse;          // before StageFill fee

    var result = {
      festival: spec.name||'Festival',
      budget: money(budget), actSpend: money(spend), budgetLeft: money(budget - spend),
      slotsFilled: slotsFilled, slotsTotal: slotsTotal,
      expAttendance: Math.round(totAtt),
      stages: stagesOut,
      pnl: { gate:money(totGate), bar:money(totBar), actCost:money(totActCost), house:money(totHouse), netToHouse:money(houseNet) },
      price: { model:'$'+perStageDay+'/stage-day' + (opts.gateSharePct? ' + '+opts.gateSharePct+'% gate':''),
               stageDays:stageDays, perStageDay:perStageDay, mgmtFee:money(mgmtFee), gateShare:money(gateShare), total:money(sfFee) },
      netAfterStageFill: money(houseNet - sfFee),
      generatedAt: Date.now()
    };
    emit('plan', { stages:stagesOut.length, filled:slotsFilled, budget:money(budget), spend:money(spend) });
    return result;
  }

  // ---- confirm a plan (the ONLY thing that "books") — guarded, idempotent ----
  function confirm(planResult, orgId){
    if(!planResult) return { ok:false, err:'no plan' };
    var id = 'fest:'+(planResult.festival||'x')+'|'+(planResult.generatedAt||Date.now());
    guardSpine('sf_stageboss_confirm', { p_plan_id:id, p_org:orgId||null,
      p_stages:(planResult.stages||[]).length, p_spend:planResult.actSpend, p_fee:(planResult.price||{}).total });
    emit('confirm', { stages:(planResult.stages||[]).length, spend:planResult.actSpend });
    return { ok:true, plan_id:id, booked:(planResult.slotsFilled||0) };
  }

  // ---- instrumentation (guarded; NO PII — ids & counts only) ----------------
  function emit(evt, payload){ payload=payload||{};
    try{ if(root.DDTele && typeof root.DDTele.event==='function'){ root.DDTele.event('stageboss.'+evt, payload); return; }
         if(typeof root.ddEvent==='function'){ root.ddEvent('stageboss.'+evt, payload); } }catch(e){} }
  function guardSpine(rpc, args){
    try{ if(typeof root.ddClient==='function'){ var c=root.ddClient(); if(c&&c.rpc){ c.rpc(rpc,args); return true; } } }catch(e){}
    return false;   // no backend → local-first no-op
  }

  var api = {
    plan: plan, confirm: confirm,
    drawIndex: drawIndex, fitScore: fitScore, expFill: expFill,
    _defaults: DEFAULTS
  };
  root.ddStageBoss = api;
  if (typeof module!=='undefined' && module.exports) module.exports = api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
