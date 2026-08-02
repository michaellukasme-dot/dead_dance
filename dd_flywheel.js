/* dd_flywheel.js — the Band→Fan growth flywheel brain. Works for EVERY event: a single-band bar show
   or a whole festival. A FREE ticket makes the holder a FAN (ticket-holder) of that specific band;
   band + its ticket-holders = ONE group. "Fans = Ticket Holders; Band = Grouped Users."
   Client ledger (localStorage); spine sync guarded (no-ops until a table exists). Never throws.
   Exposes window.DDFlywheel. */
(function (root) {
  "use strict";
  var LS = "dd.flywheel";
  var BASE = "https://deaddance.app/";   // absolute → tickets open the same from map, email, or QR
  function slug(n) { try { if (root.DDBandGroups && root.DDBandGroups.slug) return root.DDBandGroups.slug(n); } catch (e) {}
    return String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function load() { try { return JSON.parse(root.localStorage.getItem(LS) || "{}") || {}; } catch (e) { return {}; } }
  function save(o) { try { root.localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }
  function bandsMap() { var s = load(); return s.bands || {}; }
  function isPaidStage(stage) { var s = String(stage || ""); var n = s.toLowerCase().replace(/\s+/g,' ').trim();
    try { var L = (typeof window !== 'undefined' && window.DD_PAID_STAGES) || [];   // per-festival ticketed stages (e.g. Allentown Fair's Grandstand), set by the host on switch
      for (var i=0;i<L.length;i++){ if (String(L[i]).toLowerCase().replace(/\s+/g,' ').trim() === n) return true; } } catch(e){}
    return /(wind\s*creek|steel\s*stage)/i.test(s); }   // MusikFest's paid Steel Stage (feed labels it "Steel Stage"); everything else free

  // ---- ticket links for a show (line up 1:1 with the email merge fields) ----
  function q(o) { return Object.keys(o).map(function (k) { return k + "=" + encodeURIComponent(o[k] == null ? "" : o[k]); }).join("&"); }
  function fanTicket(show) { show = show || {}; return BASE + "ticket.html?" + q({ band: show.band || "", venue: show.stage || show.venue || "", date: show.date || "", price: (isPaidStage(show.stage || show.venue) ? "" : "FREE") }); }
  function bandTicket(show) { show = show || {}; return BASE + "ticket.html?" + q({ role: "band", band: show.band || "", venue: show.stage || show.venue || "", date: show.date || "", price: "FREE" }); }
  function links(show) { return { fan: fanTicket(show), band: bandTicket(show), paid: isPaidStage(show && (show.stage || show.venue)) }; }

  // ---- grab a FREE ticket → become that band's ticket-holder/fan + join its group ----
  function grab(band, show) {
    if (!band) return { error: "no band" };                                   // guard: no junk state from an empty name
    show = show || {}; show.band = show.band || band;
    if (isPaidStage(show.stage || show.venue)) return { paid: true, buy: fanTicket(show) };   // the paid stage stays paid → caller routes to Buy
    var s = load(); s.bands = s.bands || {}; var k = slug(band);
    var b = s.bands[k] || { held: true, name: band, at: Date.now(), shows: [] };
    b.held = true; b.name = band; b.shows = b.shows || (b.show ? [b.show] : []);   // keep EVERY show of this band (don't overwrite a prior date)
    var sh = { stage: show.stage || show.venue || "", date: show.date || "", time: show.time || "" };
    if (!b.shows.some(function (x) { return (x.date || "") === (sh.date || "") && (x.stage || "") === (sh.stage || ""); })) b.shows.push(sh);
    s.bands[k] = b; save(s);
    // mirror onto the standard ticket ledger so DDTickets / the profile QR "wallet" sees it
    try { var mk = "dd.mytix", arr = JSON.parse(root.localStorage.getItem(mk) || "[]");
      if (!arr.some(function (t) { return slug(t.band) === k && (t.date || "") === (show.date || ""); }))
        arr.push({ ref: "t" + Date.now(), band: band, venue: (show.stage || show.venue || ""), date: (show.date || ""), iso: (show.date || ""), price: "FREE", at: Date.now(), flywheel: true });
      root.localStorage.setItem(mk, JSON.stringify(arr));
    } catch (e) {}
    try { if (root.DDBandGroups && root.DDBandGroups.setTuned) root.DDBandGroups.setTuned(band, true); } catch (e) {}   // land in the band's DeadDance group
    syncSpine(k, band, s.bands[k].show);
    return { held: true, band: band, slug: k, group: group(band) };
  }
  function release(band) { var s = load(); s.bands = s.bands || {}; delete s.bands[slug(band)]; save(s); }
  function isHeld(band) { var b = bandsMap()[slug(band)]; return !!(b && b.held); }
  function held() { var m = bandsMap(), out = [];
    Object.keys(m).forEach(function (k) { var r = m[k]; if (!r.held) return; var shows = r.shows || (r.show ? [r.show] : [{}]);
      shows.forEach(function (sh) { out.push({ slug: k, name: r.name, show: sh, at: r.at }); }); });
    return out; }

  // ---- GROUP = band + its ticket-holders. A held ticket = +1 real member on top of any seed count. ----
  function group(band) { var mine = isHeld(band) ? 1 : 0, seed = 0, disp = band, ic = "🌹";
    try { if (root.DDBandGroups && root.DDBandGroups.get) { var g = root.DDBandGroups.get(band); if (g) { seed = g.members || 0; disp = g.disp || band; ic = g.ic || ic; } } } catch (e) {}
    return { slug: slug(band), name: band, disp: disp, ic: ic, youIn: !!mine, fans: seed + mine, members: seed + mine }; }
  function groups() { var out = [];
    try { if (root.DDBandGroups && root.DDBandGroups.list) root.DDBandGroups.list().forEach(function (g) { var gg = group(g.name); gg.rose = g.rose; out.push(gg); }); } catch (e) {}
    held().forEach(function (h) { if (!out.some(function (o) { return o.slug === h.slug; })) out.push(group(h.name)); });   // long-tail acts too
    return out; }

  // stable anonymous fan id (device-local) so the spine can de-dup + count fans per band
  function fanId() { try { var id = root.localStorage.getItem("dd.fanid"); if (!id) { id = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); root.localStorage.setItem("dd.fanid", id); } return id; } catch (e) { return "anon"; } }
  // guarded spine sync — persists the fan server-side via dd_fan_join; no-op until Supabase + the table exist
  // TRUTHFUL WRITE: chain .then/.catch so the fan-join actually SENDS (supabase-js v2 only fires on then/catch).
  // This is the flywheel's server persistence — without the chain, ticketholder→fan conversions never accumulated.
  // Background/best-effort: the local wallet already holds the ticket, so a failed sync is swallowed, never faked.
  function syncSpine(k, band, show) { try { var cl = (root.ddClient && root.ddClient()); if (cl && cl.rpc) cl.rpc("dd_fan_join", { p_band: k, p_name: band, p_show: (show || {}), p_fan: fanId() }).then(function(){}).catch(function(){}); } catch (e) {} }

  root.DDFlywheel = { grab: grab, release: release, isHeld: isHeld, held: held, group: group, groups: groups,
    links: links, fanTicket: fanTicket, bandTicket: bandTicket, isPaidStage: isPaidStage, slug: slug };
})(typeof window !== "undefined" ? window : this);
