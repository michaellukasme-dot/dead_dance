/* ============================================================================
 * dd_datamodule.js — the DATA MODULE ("Whopper") brain: tiers, pricing, gating,
 * and guarded lead capture (Stripe/checkout parked on the EIN — so for now we
 * capture INTENT and invoice when checkout opens).
 *
 * The ladder (Bloomberg/Placer.ai model, sized for live events — see research):
 *   LESS  — the post-event PDF report. FREE. The hook / lead-gen.
 *   MORE  — the live, filterable dashboard for ONE event. Subscription.
 *   MOST  — full raw data feed / API / export. Enterprise, custom.
 *   CITY  — comprehensive annual: EVERY festival AND farmers market a city runs,
 *           year-round foot traffic, under one umbrella. (GEDP = Bacon Fest +
 *           Easton Farmers Market on one subscription.) Vendor sales stay on the
 *           vendors' own Square — we sell the MAP + the DATA, not the transaction.
 *
 * Pure + deterministic + guarded (no backend = no-op). Dual browser/node export.
 * Prices are RESEARCH-BASED RECOMMENDATIONS — owner approves before any public price.
 * ==========================================================================*/
;(function (root) {
  'use strict';
  function money(n){ return '$'+Math.round(+n||0).toLocaleString('en-US'); }

  // ---- the tiers (recommended pricing; illustrative, owner-approved before public) ----
  var TIERS = {
    less: { key:'less', label:'LESS — The Report', price:0, unit:'free',
      tagline:'The post-event PDF. Yours free.',
      includes:['Headline attendance & peak day','Top stages by draw','A taste of the dwell data','Every link points here'] },
    more: { key:'more', label:'MORE — Live Dashboard', price:3500, unit:'per event  ·  or $6,000/yr recurring', yr:6000,
      tagline:'Slice it yourself — filter by day, stage, hour, weather.',
      includes:['Interactive dashboard (1 event)','Stage-by-stage dwell heatmap','Hour-by-hour foot traffic','Repeat-visit & fan-origin','CSV export (capped)'] },
    most: { key:'most', label:'MOST — Full Feed / API', price:18000, unit:'from  ·  /yr, custom',
      tagline:'The raw firehose, into your own tools.',
      includes:['Full data feed / API','Unlimited export','Year-over-year history','Integrations (BI / CRM)','Everything in MORE'] },
    city: { key:'city', label:'CITY — The District Umbrella', price:24000, unit:'/yr flat  ·  comprehensive',
      tagline:'Every festival AND every farmers market you run — one subscription.',
      includes:['ALL festivals + ALL farmers markets','Year-round foot-traffic data','Festival Maker for every footprint','The dashboard on all of it','Vendor sales stay on their own Square — we sell the map + data'] }
  };
  var ORDER = ['less','more','most','city'];

  // the locked teasers shown (blurred) in the free report → the visceral upsell
  var LOCKED = [
    { id:'dwell',  title:'Stage-by-stage dwell heatmap', hint:'where the crowd actually stayed' },
    { id:'hourly', title:'Hour-by-hour foot traffic',    hint:'when each stage peaked' },
    { id:'origin', title:'Fan origin & repeat visits',   hint:'who came back, and from where' },
    { id:'attrib', title:'Ad & ticket attribution',      hint:'what each dollar of promo returned' }
  ];

  function tier(k){ return TIERS[String(k||'').toLowerCase()] || null; }
  function tiers(){ return ORDER.map(function(k){ return TIERS[k]; }); }
  function locked(){ return LOCKED.slice(); }
  function priceLabel(k){ var t=tier(k); if(!t) return ''; return t.price===0 ? 'Free' : (money(t.price)+' '+t.unit); }

  // recommend a tier from the buyer's scope
  function quote(scope){ scope=scope||{};
    if(scope.city || scope.multiFootprint) return { tier:'city', price:TIERS.city.price, why:'A city/district running multiple festivals and markets — one umbrella price.' };
    if(scope.api || scope.feed || scope.raw) return { tier:'most', price:TIERS.most.price, why:'They want the raw feed/API into their own systems.' };
    if(scope.dashboard || scope.events>=1)   return { tier:'more', price:(scope.recurring?TIERS.more.yr:TIERS.more.price), price_basis:(scope.recurring?'yr':'event'), why:'A single event that wants to slice its own data.' };
    return { tier:'less', price:0, why:'Start with the free report; upsell from the locked panels.' };
  }

  // ---- guarded lead capture (Stripe parked → capture INTENT, invoice later) ----
  function C(){ try{ return root.ddClient && root.ddClient(); }catch(e){ return null; } }
  function emit(evt,p){ try{ if(root.DDTele&&root.DDTele.event) root.DDTele.event('datamodule.'+evt,p||{}); }catch(e){} }
  function requestUnlock(opts){ opts=opts||{}; var t=tier(opts.tier); if(!t) return { ok:false, err:'unknown tier' };
    var c=C(); var lead={ tier:t.key, festival:opts.festival||null, email:opts.email||null, note:opts.note||null };
    var sent=false; if(c&&c.rpc){ try{ c.rpc('sf_data_lead_capture',{ p_tier:lead.tier, p_festival:lead.festival, p_email:lead.email, p_note:lead.note }); sent=true; }catch(e){} }
    emit('unlock', { tier:t.key, sent:sent });
    return { ok:true, tier:t.key, captured:sent, price:t.price,
             message: t.price===0 ? 'You already have this — it’s the free report.'
                    : 'Got it. Checkout opens shortly (EIN pending) — we’ll send your invoice for '+priceLabel(t.key)+'. 🌹' };
  }

  var api = { TIERS:TIERS, ORDER:ORDER, tier:tier, tiers:tiers, locked:locked, priceLabel:priceLabel, quote:quote, requestUnlock:requestUnlock, money:money };
  root.DDDataModule = api;
  if (typeof module!=='undefined' && module.exports) module.exports = api;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
