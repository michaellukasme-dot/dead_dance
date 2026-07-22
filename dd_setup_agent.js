/* dd_setup_agent.js — "Claude · DeadDance install agent" (window.DDSetup)
   A guided, streaming, Claude-voiced setup wizard (Claude mark top-left), modeled on the
   Google Workspace guided-setup window. Claude is the BRAINS behind the posts flow — it walks
   a user/band/store through:
     1) HyperPost DRUC (the recurring auto-post consent)   2) Band setup + comms
     3) Store setup   4) Invite Facebook friends   5) Collect original human content
   Every step is wired to the REAL action if present (DDCheckin DRUC, the composer, invites,
   band/store onboarding); otherwise it degrades gracefully. Self-contained, no deps. */
(function (root) {
  'use strict';
  var MARK = 'claude-mark.svg';
  var panel = null, chat = null, foot = null, bar = null, _busy = false, _stepN = 0, _total = 6;

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function has(fn){ try{ return typeof root[fn]==='function'; }catch(e){ return false; } }
  function call(fn){ try{ if(has(fn)){ root[fn].apply(null, [].slice.call(arguments,1)); return true; } }catch(e){} return false; }

  function css(){ if(document.getElementById('ddset-css')) return; var s=document.createElement('style'); s.id='ddset-css';
    s.textContent=''
    +'#ddsetOv{position:fixed;inset:0;z-index:2147483200;background:rgba(20,12,30,.5);display:none;align-items:flex-end;justify-content:center}'
    +'#ddsetOv.on{display:flex}'
    +'#ddsetWin{background:#fff;width:min(440px,96vw);max-height:88vh;border-radius:20px 20px 0 0;box-shadow:0 -14px 50px #0007;display:flex;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}'
    +'@media(min-width:640px){#ddsetOv{align-items:center}#ddsetWin{border-radius:20px}}'
    +'#ddsetHd{display:flex;align-items:center;gap:10px;padding:13px 14px;background:linear-gradient(90deg,#2a1b3d,#3a1f57);color:#fff}'
    +'#ddsetHd .m{width:30px;height:30px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;flex:none}'
    +'#ddsetHd .m img{width:22px;height:22px;display:block}'
    +'#ddsetHd .t{font-weight:800;font-size:15px;flex:1;line-height:1.15}#ddsetHd .t small{display:block;font-weight:600;font-size:11px;opacity:.8}'
    +'#ddsetHd .x{border:0;background:#ffffff22;color:#fff;width:30px;height:30px;border-radius:9px;font-size:17px;cursor:pointer;flex:none}'
    +'#ddsetBar{height:3px;background:#ece7f2}#ddsetBar>i{display:block;height:3px;background:linear-gradient(90deg,#7a3cc0,#b8002e);width:0;transition:width .4s ease}'
    +'#ddsetChat{flex:1;overflow-y:auto;padding:16px 14px;background:#faf8fc;-webkit-overflow-scrolling:touch}'
    +'.ddset-turn{display:flex;gap:9px;margin-bottom:14px;align-items:flex-start}'
    +'.ddset-turn .av{width:26px;height:26px;border-radius:7px;background:#fff;border:1px solid #ece7f2;flex:none;display:flex;align-items:center;justify-content:center}'
    +'.ddset-turn .av img{width:18px;height:18px}'
    +'.ddset-bub{background:#fff;border:1px solid #efeaf4;border-radius:4px 14px 14px 14px;padding:11px 13px;font-size:14px;line-height:1.5;color:#1a1320;max-width:88%;box-shadow:0 1px 3px #2a1b3d0f}'
    +'.ddset-bub b{font-weight:800}'
    +'#ddsetFoot{border-top:1px solid #efeaf4;padding:11px 12px calc(12px + env(safe-area-inset-bottom,0px));background:#fff;display:flex;flex-direction:column;gap:8px}'
    +'.ddset-choices{display:flex;flex-direction:column;gap:8px}'
    +'.ddset-ch{border:1px solid #e2dcec;background:#faf7ff;color:#3a1f57;font-weight:800;font-size:14px;border-radius:12px;padding:12px 13px;cursor:pointer;text-align:left;font-family:inherit}'
    +'.ddset-ch:active{transform:scale(.98)}'
    +'.ddset-ch.go{background:linear-gradient(135deg,#7a3cc0,#b8002e);color:#fff;border-color:transparent}'
    +'.ddset-ch.ghost{background:#fff;color:#7a7285;font-weight:700}'
    +'.ddset-note{font-size:11px;color:#9a93a8;text-align:center}';
    document.head.appendChild(s); }

  function build(){ if(panel) return; css();
    var ov=document.createElement('div'); ov.id='ddsetOv';
    ov.innerHTML=''
    +'<div id="ddsetWin" role="dialog" aria-label="Claude DeadDance setup">'
    + '<div id="ddsetHd"><div class="m"><img src="'+MARK+'" alt="Claude" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'✳\',style:\'color:#5a2e86;font-weight:900\'}))"></div>'
    +   '<div class="t">Set up with Claude<small>DeadDance install agent</small></div>'
    +   '<button class="x" aria-label="Close" onclick="DDSetup.close()">×</button></div>'
    + '<div id="ddsetBar"><i></i></div>'
    + '<div id="ddsetChat"></div>'
    + '<div id="ddsetFoot"></div>'
    +'</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) close(); });
    panel=ov; chat=ov.querySelector('#ddsetChat'); foot=ov.querySelector('#ddsetFoot'); bar=ov.querySelector('#ddsetBar>i');
  }

  function progress(n){ _stepN = (n==null)? _stepN : n; if(bar) bar.style.width = Math.min(100, Math.round(100*_stepN/_total)) + '%'; }

  // stream a Claude turn (typewriter), then callback
  function say(lines, cb){ if(_busy) return; _busy=true; lines=(typeof lines==='string')?[lines]:lines;
    var turn=document.createElement('div'); turn.className='ddset-turn';
    turn.innerHTML='<div class="av"><img src="'+MARK+'" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'✳\'}))"></div><div class="ddset-bub"></div>';
    chat.appendChild(turn); var bub=turn.querySelector('.ddset-bub'); chat.scrollTop=chat.scrollHeight;
    var li=0;
    function nextLine(){ if(li>=lines.length){ _busy=false; if(cb)cb(); return; }
      var full=lines[li], i=0, span=document.createElement('div'); if(li>0)span.style.marginTop='7px'; bub.appendChild(span);
      (function type(){ if(i<=full.length){ span.innerHTML=full.slice(0,i); i++; chat.scrollTop=chat.scrollHeight; setTimeout(type, 12); } else { li++; setTimeout(nextLine, 160); } })();
    }
    nextLine();
  }

  // render choice buttons in the footer
  function choices(list, note){ foot.innerHTML='';
    var wrap=document.createElement('div'); wrap.className='ddset-choices';
    (list||[]).forEach(function(c){ var b=document.createElement('button'); b.className='ddset-ch'+(c.style?(' '+c.style):'');
      b.textContent=c.label; b.onclick=function(){ if(_busy)return; foot.innerHTML=''; try{ if(c.run)c.run(); }catch(e){} if(c.go) go(c.go); };
      wrap.appendChild(b); });
    foot.appendChild(wrap);
    if(note){ var n=document.createElement('div'); n.className='ddset-note'; n.textContent=note; foot.appendChild(n); }
    chat.scrollTop=chat.scrollHeight;
  }

  function done(msg, nextChoices){ say(msg, function(){ choices(nextChoices || [{label:'Back to setup menu', go:'home', style:'go'},{label:'Close', run:close, style:'ghost'}]); }); }

  // ---- the real action hooks (feature-detected; graceful fallback) ----
  function actDruc(){
    if(root.DDCheckin && DDCheckin.drucScreen){ DDCheckin.drucScreen(function(){ progress(2); done(['✅ Auto-posting is <b>on</b> — from now on your check-ins and posts fan out to the networks you picked, credited to you.','Off anytime in your profile. Next: let’s make your first post so there’s something to send. 🌹'], [{label:'✍️ Write my first post', go:'content', style:'go'},{label:'Back to menu', go:'home', style:'ghost'}]); }); }
    else { done(['Auto-posting turns on in the check-in / composer once you tap “Auto-post my check-ins.” I’ll surface it there.','It’s the one recurring consent — like a subscription, on only when you say so.']); }
  }
  function actContent(){ progress(5); close();
    if(call('openCompose')) return; if(call('hyperConsole','dead.dance')) return; if(call('openCreate')) return;
    if(root.DDHyper && DDHyper.go){ DDHyper.go(''); return; }
    if(root.toast) toast('Open the composer to write your post 🌹');
  }
  function actInvite(){ progress(4); close();
    if(call('inviteVia','fb')) return; if(call('inviteFamily')) return; if(call('openFriendsMgr')) return;
    if(root.toast) toast('Open Friends → Invite to bring your Facebook friends 🌹');
  }
  function actBand(){ progress(3); close();
    if(call('ddSheet','band_onboard.html','🌹 Band Install')) return;
    try{ location.href='band_onboard.html?src=selfclaim'; }catch(e){}
  }
  function actStore(){ progress(3); close();
    if(call('openAppSheet','shakedown')) return; if(call('openReader','market')) return; if(call('ddSheet','tshirt_shop.html','🛍️ Your Store')) return;
    try{ location.href='band_store.html'; }catch(e){}
  }
  // Print partner: HyperPost the bundle offer to the Musikfest acts (credited to the partner), + the DD Musikfest group.
  function actPrinterSend(){ progress(6);
    var txt='🖨️ Playing Musikfest? Get your band merch printed local + fast — Jay’s Customz, 50 Broad St, Bethlehem. DeadDance bands pick a bundle: The Dozen (12 tees) $200 · The Merch Table (36) $540 · The Tour Kit (72) $1,150 — plugs into your free DeadDance store. Claim yours 🌹 deaddance.app';
    try{ if(root.DDFeed && DDFeed.groupPost) DDFeed.groupPost('musikfest', txt); else if(root.DDFeed && DDFeed.post) DDFeed.post(txt); }catch(e){}
    try{ if(root.DDHyper && DDHyper.post) DDHyper.post(txt); }catch(e){}          // fan out to the partner's networks
    done(['✅ Sent — your bundle offer is HyperPosting to the Musikfest acts, credited to you.','Each act lands on their DeadDance page and can order your bundles from their store curtain. 🌹'],
      [{label:'Back to setup menu', go:'home', style:'go'},{label:'Close', run:close, style:'ghost'}]);
  }

  // ---- the flows (Claude is the brains sequencing the posts flow) ----
  var FLOWS = {
    home: function(){ progress(0); say(['👋 Hey — I’m <b>Claude</b>, the brains behind DeadDance.','I’ll get your <b>posts flow</b> set up in a few taps. What do you want to do first?'], function(){
      choices([
        {label:'📡 Turn on HyperPost (auto-post)', go:'druc', style:'go'},
        {label:'✍️ Write original human content', go:'content'},
        {label:'👥 Invite my Facebook friends', go:'invite'},
        {label:'🎸 Set up my band + its comms', go:'band'},
        {label:'🛍️ Set up my store', go:'store'},
        {label:'🖨️ I’m a print / merch partner', go:'printer'},
        {label:'Not now', run:close, style:'ghost'}
      ]); }); },

    printer: function(){ progress(1); say([
        '🖨️ You’re a <b>print partner</b> — I’ll set you up in three taps: your bundles, your pricing, and a broadcast to the Musikfest acts.',
        'Here are your <b>LESS / MORE / MOST</b> bundles (edit the prices anytime):',
        '• <b>The Dozen</b> — 12 tees · 1 side · ≤4 colors · 4-day — <b>$200</b>',
        '• <b>The Merch Table</b> — 36 tees · front+back + a poster — <b>$540</b>',
        '• <b>The Tour Kit</b> — 72 tees · full color · +100 stickers — <b>$1,150</b>',
        'Look good?'
      ], function(){ choices([
        {label:'Yes — draft my broadcast to the acts', go:'printerCampaign', style:'go'},
        {label:'Set my own prices first', run:actStore},
        {label:'Back', go:'home', style:'ghost'}
      ]); }); },
    printerCampaign: function(){ progress(4); say([
        '📣 Here’s the note I’ll send the <b>~600 Musikfest acts</b>, credited to you:',
        '“Playing Musikfest? Get your merch printed <b>local + fast</b> — Jay’s Customz, 50 Broad St. DeadDance bands pick a bundle: The Dozen $200 · The Merch Table $540 · The Tour Kit $1,150 — and it plugs into your free DeadDance store. 🌹”',
        'It HyperPosts to each act’s DeadDance page (and emails anyone opted in — never scraped). Send it?'
      ], function(){ choices([
        {label:'🚀 HyperPost it to the acts', run:actPrinterSend, style:'go'},
        {label:'Tweak the wording', run:actContent},
        {label:'Back', go:'home', style:'ghost'}
      ]); }); },

    druc: function(){ progress(1); say([
        '📡 <b>HyperPost</b> is the differentiator: you write once, it radiates to every network — credited to you, in your voice.',
        'To let me send on your behalf on an ongoing basis, I need one <b>recurring consent</b> — think of it like a subscription: affirmative, scoped to the networks <i>you</i> pick, and off in one tap anytime.',
        'Ready to turn it on?'
      ], function(){ choices([
        {label:'Turn on auto-posting', run:actDruc, style:'go'},
        {label:'What exactly gets posted?', go:'drucInfo'},
        {label:'Not now', go:'home', style:'ghost'}
      ]); }); },
    drucInfo: function(){ say([
        '<b>What</b> — each check-in or post you make. <b>Where</b> — only the networks you tick (Facebook, Instagram, X, TikTok, Email). <b>How often</b> — each new one. <b>How long</b> — until you switch it off.',
        'Every post is still your words; a human always starts it. No bots, ever. 🌹'
      ], function(){ choices([{label:'Got it — turn it on', run:actDruc, style:'go'},{label:'Back', go:'home', style:'ghost'}]); }); },

    content: function(){ progress(5); say([
        '✍️ The feed’s always hungry — <b>original human content</b> is the whole engine. Let’s drop your first one.',
        'Write a line — a show you caught, a tape, a photo. I’ll help shape it, then it posts to the family (and out to your networks if HyperPost is on).'
      ], function(){ choices([{label:'Open the composer', run:actContent, style:'go'},{label:'Back to menu', go:'home', style:'ghost'}]); }); },

    invite: function(){ progress(4); say([
        '👥 DeadDance grows head-by-head. Bring your <b>Facebook friends</b> — every friend grows the family and your reach.',
        'I’ll open the invite tool — pick email, text, or your FB friends; you choose who, it never touches Facebook’s API.'
      ], function(){ choices([{label:'Open the invite tool', run:actInvite, style:'go'},{label:'Back to menu', go:'home', style:'ghost'}]); }); },

    band: function(){ progress(3); say([
        '🎸 If you’re a band (or rep one), claim your page — then I run <b>all your comms</b>: new shows and setlists auto-HyperPosted, poster videos, ticket sales, fan blasts — each on your say-so.',
        'Let’s claim your band first.'
      ], function(){ choices([{label:'Claim my band', run:actBand, style:'go'},{label:'Back to menu', go:'home', style:'ghost'}]); }); },

    store: function(){ progress(3); say([
        '🛍️ Your <b>store</b> — merch, posters, made-to-order — sells on the web (no App Store 30% toll), and I market it: walk-by placements, HyperPost drops, your own list.',
        'Let’s set up your shop.'
      ], function(){ choices([{label:'Set up my store', run:actStore, style:'go'},{label:'Back to menu', go:'home', style:'ghost'}]); }); }
  };

  function go(id){ var f=FLOWS[id]; if(f){ try{ f(); }catch(e){} } }
  function open(flow){ build(); panel.classList.add('on'); document.body.style.overflow='hidden'; chat.innerHTML=''; foot.innerHTML=''; go(flow||'home'); }
  function close(){ if(panel){ panel.classList.remove('on'); } document.body.style.overflow=''; }

  root.DDSetup = { open: open, close: close, go: go, FLOWS: FLOWS };
})(typeof window !== 'undefined' ? window : this);
