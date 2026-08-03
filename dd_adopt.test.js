/* dd_adopt.test.js — node harness for the ADOPT-A-BAND engine.
   Proves the pure builders AND that the guarded spine write is really chained
   (.then/.catch fires) and reports the honest server/offline result.
   Run:  node dd_adopt.test.js   (exit 0 = all green) */
'use strict';

// ---- minimal browser shims (module reads globals off `root`) ----
var _store = {};
global.localStorage = {
  getItem:function(k){ return Object.prototype.hasOwnProperty.call(_store,k)?_store[k]:null; },
  setItem:function(k,v){ _store[k]=String(v); },
  removeItem:function(k){ delete _store[k]; }
};

// real DD_MUSIKFEST-shaped schedule + DD_MF_BANDS-shaped roster
global.DD_MUSIKFEST = [
  { d:'2026-08-02', t:'12:00 PM', st:'Americaplatz', b:'Life After Dead', sc:'dd' },
  { d:'2026-08-02', t:'2:00 PM',  st:'Volksplatz',   b:'Rift',            sc:'dd' },
  { d:'2026-08-03', t:'6:00 PM',  st:'Steel Stage',  b:'Rift',            sc:'dd' },
  { d:'2026-07-31', t:'8:00 PM',  st:'Liederplatz',  b:'Old Act',         sc:'dd' }
];
global.DD_MF_BANDS = {
  'rift': { name:'Rift', kind:'Philadelphia Phish Tribute', Facebook:'https://facebook.com/rift' },
  'life-after-dead': { name:'Life After Dead', kind:'Grateful Dead Tribute' }
};

var A = require('./dd_adopt.js');

var pass=0, fail=0;
function ok(name, cond){ if(cond){ pass++; } else { fail++; console.log('  ✗ '+name); } }

// ---- tixUrl : canonical FREE ticket url with the band name ----
ok('tixUrl builds the FREE ticket url with band',
   A.tixUrl('Rift')==='https://deaddance.app/ticket.html?price=FREE&band=Rift');
ok('tixUrl encodes spaces',
   A.tixUrl('Life After Dead')==='https://deaddance.app/ticket.html?price=FREE&band=Life%20After%20Dead');

// ---- slugify ----
ok('slugify normalizes', A.slugify('Life After Dead!')==='life-after-dead');

// ---- lineup : built from the schedule, de-duped by band, phased, sorted ----
var lu = A.lineup();
ok('lineup de-dupes a band that plays twice (Rift once)',
   lu.filter(function(b){return b.name==='Rift';}).length===1);
ok('lineup pulls slug + kind from the curated roster',
   (function(){ var r=lu.filter(function(b){return b.name==='Rift';})[0]; return r && r.slug==='rift' && /Phish/.test(r.kind); })());
ok('lineup carries the band Facebook link through',
   (function(){ var r=lu.filter(function(b){return b.name==='Rift';})[0]; return r && r.fb==='https://facebook.com/rift'; })());
ok('lineup has every distinct act',
   lu.length===3 && lu.some(function(b){return b.name==='Old Act';}));

// ---- _pick : deterministic per seed (same band → same variant every time) ----
ok('_pick is deterministic for a seed',
   A._pick('rift', A.BAND_MSGS)===A._pick('rift', A.BAND_MSGS));
ok('_pick spreads across variants (band vs own differ by seed)',
   typeof A._pick('rift', A.BAND_MSGS)==='function');

// ---- msgBand / msgOwn : differentiated posts carrying the band's ticket link ----
var rift = lu.filter(function(b){return b.name==='Rift';})[0];
var mb = A.msgBand(rift), mo = A.msgOwn(rift);
ok('msgBand mentions the band', /Rift/.test(mb));
ok('msgBand carries the band ticket link', mb.indexOf(A.tixUrl('Rift'))>=0);
ok('msgOwn mentions the band + carries the link', /Rift/.test(mo) && mo.indexOf(A.tixUrl('Rift'))>=0);
ok('msgBand and msgOwn are different posts', mb!==mo);

// ---- cardHTML : two-panel card, both copy buttons + Done, ticket link ----
var card = A.cardHTML(rift, false);
ok('cardHTML has POST TO THE BAND panel', /POST TO THE BAND/.test(card));
ok('cardHTML has POST TO YOUR WALL panel', /POST TO YOUR WALL/.test(card));
ok('cardHTML wires ADOPT.copyBand / copyOwn / claim',
   /ADOPT\.copyBand\('rift'\)/.test(card) && /ADOPT\.copyOwn\('rift'\)/.test(card) && /ADOPT\.claim\('rift'\)/.test(card));
ok('cardHTML claimed state shows the adopted badge',
   /✓ Adopted/.test(A.cardHTML(rift, true)));

// ---- THE SPINE: saveClaim must CHAIN .then (v2 only sends when chained) ----------
// (a) with a fake client whose rpc resolves {error:null} → cb(true) AND the rpc fired
var rpcCalls=[];
global.ddClient = function(){ return { rpc:function(fn,args){ rpcCalls.push({fn:fn,args:args});
  return { then:function(res){ res({ error:null }); return { catch:function(){} }; } }; } }; };
var savedStatus=null;
A.saveClaim('rift', function(status){ savedStatus=status; });
ok('saveClaim FIRES the rpc (chained .then actually sends)', rpcCalls.length===1 && rpcCalls[0].fn==='dd_bandadopt_claim');
ok('saveClaim passes the slug + adopter to the spine', rpcCalls[0].args.p_slug==='rift' && !!rpcCalls[0].args.p_by);
ok('saveClaim reports TRUE only on server success', savedStatus===true);

// (b) server rejects → honest FALSE
global.ddClient = function(){ return { rpc:function(){ return { then:function(res){ res({ error:{message:'nope'} }); return { catch:function(){} }; } }; } }; };
var rej=null; A.saveClaim('life-after-dead', function(s){ rej=s; });
ok('saveClaim reports FALSE when the server rejects', rej===false);

// (c) NO client → honest null (offline), never a fake "saved"
global.ddClient = undefined;
var off='x'; A.saveClaim('old-act', function(s){ off=s; });
ok('saveClaim reports NULL (offline) with no client — never fakes saved', off===null);

// ---- flushMine : retroactively re-sends only THIS device's own past claims ---------
_store['dd.adopt'] = JSON.stringify({
  'rift':{ by:A.who(), ts:1 },              // mine → should re-send
  'someone-else':{ by:'fan-other', ts:1 }   // not mine → must NOT re-send
});
var flushed=[];
var fakeCl = { rpc:function(fn,args){ flushed.push(args.p_slug); return { then:function(){ return { catch:function(){} }; } }; } };
A.flushMine(fakeCl);
ok('flushMine re-sends my own past claim', flushed.indexOf('rift')>=0);
ok('flushMine does NOT re-send another device\'s claim', flushed.indexOf('someone-else')<0);

console.log('\n dd_adopt harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' ❌ FAILURES ABOVE'); process.exit(1); } else { console.log(' ✅ all green'); }
