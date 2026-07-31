/* Harness for dd_groups.js — run: node dd_groups.test.js
 * Covers: palette resolve + neutral fallback, sub-tint override + unknown-fest
 * fallback, overlap (one ticket → two wallets) + uniqueFans dedupe, idempotent
 * claim, uptake clamp, new-festival claim, setHome, and telemetry (guarded +
 * NO PII). Exit code 0 = all green. */
'use strict';
var G = require('./dd_groups.js');
var pass=0, fail=0, fails=[];
function ok(name, cond){ if(cond){pass++;} else {fail++; fails.push(name);} }
function eq(name, a, b){ ok(name+' ('+JSON.stringify(a)+'==='+JSON.stringify(b)+')', a===b); }

G._reset();

// 1. palette + neutral fallback
eq('deaddance accent', G.paletteFor('deaddance').accent, '#7a3cc0');
eq('unknown community → neutral rail', G.paletteFor('__nope__').accent, '#2f6feb');

// 2. sub-tint override
var mf = G.resolveTheme('festivaldance','musikfest');
eq('MusikFest sub-tint accent (ArtsQuest blue)', mf.accent, '#1b5fa8');
eq('MusikFest sub-tint bar', mf.bar, '#12345f');
eq('sub-tint keeps community ink', mf.ink, '#173a24');

// 3. unknown festival → base unchanged, no crash
var base = G.resolveTheme('festivaldance','__no_such_fest__');
eq('unknown fest falls back to community accent', base.accent, '#2f8f4e');

// 4. OVERLAP: one ticket, two wallets
G.addTicket({ id:'t1', holder:'mike', event:'DSO @ MusikFest', communities:['deaddance','festivaldance'] });
eq('ticket surfaces in DeadDance wallet', G.walletFor('deaddance').length, 1);
eq('SAME ticket surfaces in FestivalDance wallet', G.walletFor('festivaldance').length, 1);
eq('global unique fans (deduped across wallets)', G.uniqueFans(), 1);

// 5. uniqueFans dedupes by holder within a community
G.addTicket({ id:'t2', holder:'mike', event:'Shakedown @ MusikFest', communities:['festivaldance'] });
eq('FestivalDance has 2 tickets', G.walletFor('festivaldance').length, 2);
eq('…but 1 unique fan', G.uniqueFans('festivaldance'), 1);

// 6. no duplicate ticket by id
G.addTicket({ id:'t1', holder:'mike', communities:['deaddance'] });
eq('re-adding t1 does not duplicate', G.walletFor('deaddance').length, 1);

// 7. uptake: MusikFest seeded claimed → 1 of 800
var u0 = G.uptakeStats();
eq('seed claimed = 1 (MusikFest)', u0.claimed, 1);
eq('remaining = 799', u0.remaining, 799);
eq('goal = 800', u0.goal, 800);

// 8. claim is idempotent
var r1 = G.claimFestival('baconfest','Easton BID');
eq('bacon claim ok', r1.ok, true);
eq('claimed now 2', r1.uptake.claimed, 2);
var r2 = G.claimFestival('baconfest','someone else');
eq('re-claim flagged already', r2.already, true);
eq('claimed still 2 (no double count)', G.uptakeStats().claimed, 2);

// 9. claiming a brand-new festival off the 800 list registers + counts it
var r3 = G.claimFestival('kutztownfolk','Kutztown Folk Festival');
eq('new festival claim ok', r3.ok, true);
eq('claimed now 3', G.uptakeStats().claimed, 3);
ok('new festival is in registry', !!G.festival('kutztownfolk'));

// 10. setHome joins membership + returns home
eq('setHome returns id', G.setHome('festivaldance'), 'festivaldance');
ok('home membership joined', G.memberships().indexOf('festivaldance')>=0);

// 11. telemetry: guarded + NO PII
var captured=[];
global.ddEvent = function(name, payload){ captured.push({name:name, payload:payload}); };
G.addTicket({ id:'t9', holder:'secret.person@example.com', communities:['deaddance'] });
G.claimFestival('musikfest','ArtsQuest'); // idempotent (already), should not emit claim, but exercise path
G.claimFestival('newfest2','Private Claimant LLC');
var PII = ['holder','email','name','claimant','phone'];
var leaked = captured.some(function(e){ return Object.keys(e.payload||{}).some(function(k){ return PII.indexOf(k)>=0; }); });
ok('telemetry emitted at least one event', captured.length>0);
ok('NO PII in any telemetry payload', !leaked);
delete global.ddEvent;

// 11b. festivals() returns copies — mutating them can't corrupt the registry
var snap = G.festivals(); snap[0].tint.accent='#000000'; snap[0].claimed=false;
eq('registry tint protected from caller mutation', G.resolveTheme('festivaldance','musikfest').accent, '#1b5fa8');

// 12. emit is a silent no-op with no sink (must not throw)
var threw=false; try{ G.claimFestival('nofest_nosink','x'); }catch(e){ threw=true; }
ok('emit no-op without sink (no throw)', !threw);

console.log('\n dd_groups harness: '+pass+' passed, '+fail+' failed');
if(fail){ console.log(' FAILURES:\n  - '+fails.join('\n  - ')); process.exit(1); }
console.log(' ✅ all green');
