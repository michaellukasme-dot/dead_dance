/* dead_dance — service worker. Bump CACHE on every ship.
   Hardened (Claudine review):
   • install is BEST-EFFORT (one missing asset can't abort the whole install)
   • HTML navigations are NETWORK-FIRST (no more stale index.html), cache as fallback
   • runtime cache is SAME-ORIGIN ONLY — never caches cross-origin archive.org audio (no quota blowout) */
var CACHE = "deaddance-v249-2026-07-14";
var ASSETS = ["./", "./index.html", "./app.html", "./welcome.html", "./studio_calculator.html", "./post_scale.html", "./qr_print.html",
  "./sales_crm.html", "./operator_academy.html", "./hostaband.html", "./managed.html", "./band_vault.html", "./archive.html", "./curator.html", "./record_store.html", "./record_store_kimock_demo.html", "./your_catalogue.html", "./poster_shop.html", "./tshirt_shop.html", "./karaoke.html", "./deadman.html", "./karaoke_store.html", "./jgb_store.html", "./guitars.html", "./bands.html", "./band_onboard.html", "./venue_console.html", "./console_directory.html", "./act_register.html", "./stagefill.html", "./poster_studio.html", "./card.html", "./welcome_role.html", "./hyperpost_demo.html", "./band_console.html", "./band_manager.html", "./connected_site.html", "./influencer_console.html", "./sales_console.html", "./venue_ops.html", "./venue_pitch.html", "./acts_seed.js", "./target_bands.js", "./audio_manifest.js", "./festivals_seed.js", "./shakedown_scene_seed.js", "./shakedown_scene_seed.csv",
  "./manifest.webmanifest", "./og-card.png", "./bands.js", "./market-core.js", "./cassette-reader.js", "./gd_live.js", "./ad-engine.js", "./syf.png", "./lukas_a2hs.js",
  "./crm_seed.js", "./dd_attrib.js", "./dd_refer.js", "./dd_spread.js", "./spread_maker.html", "./dd_media.js", "./band_media.html", "./dd_theme.css", "./show_card.html", "./band_store.html", "./band_posters.html", "./your_catalogue.html", "./record_store.html", "./dd_showmap.js", "./guitar_facts.js", "./band_facts.js", "./band_seed.js", "./deal_shows.js", "./deal_logo.svg", "./hot_sauce_shows.js", "./hot_sauce_logo.svg", "./qr.js", "./poster_maker.html", "./lukas_chat.js", "./lukas_badge.js", "./helptest.js", "./nowplaying.js", "./dd_back.js", "./dd_friends.js", "./dd_autofill.js", "./dd_join.js", "./dd_feed.js", "./dd_shows.js", "./dd_bands.js", "./dd_art.js", "./dd_pymk.js", "./dd_gigs.js", "./dd_sales.js", "./doodles.js", "./doodles/chancellor.svg", "./doodles/sunset.svg",
  "./dd-mark.svg", "./dd-512.png", "./dd-192.png", "./dd-180.png", "./dd-32.png",
  "./rosebud.svg", "./rosebud-192.png", "./rosebud-512.png", "./rosebud-32.png",
  "./rose.svg", "./rose-192.png", "./rose-512.png", "./rose-32.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.allSettled(ASSETS.map(function (a) { return c.add(a); })); // best-effort: don't let one 404 break install
    }).then(function () { return self.skipWaiting(); })
  );
});
self.addEventListener("message", function (e) { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { if (k !== CACHE) return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var req = e.request, sameOrigin;
  try { sameOrigin = new URL(req.url).origin === self.location.origin; } catch (x) { sameOrigin = false; }
  if (!sameOrigin) return;                       // let cross-origin (archive.org audio, etc.) go straight to network — never cached

  var isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") >= 0;
  if (isHTML) {                                  // network-first for pages → no stale index
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone(); caches.open(CACHE).then(function (c) { try { c.put(req, copy); } catch (z) {} });
        return res;
      }).catch(function () { return caches.match(req).then(function (h) { return h || caches.match("./index.html"); }); })
    );
    return;
  }
  // same-origin assets: cache-first, then network (and cache it)
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone(); caches.open(CACHE).then(function (c) { try { c.put(req, copy); } catch (z) {} });
        return res;
      }).catch(function () { return hit; });
    })
  );
});
