/* dead_dance — service worker. Bump CACHE on every ship.
   Hardened (Claudine review):
   • install is BEST-EFFORT (one missing asset can't abort the whole install)
   • HTML navigations are NETWORK-FIRST (no more stale index.html), cache as fallback
   • runtime cache is SAME-ORIGIN ONLY — never caches cross-origin archive.org audio (no quota blowout) */
var CACHE = "deaddance-v145-2026-07-05";
var ASSETS = ["./", "./index.html", "./app.html", "./welcome.html", "./studio_calculator.html", "./post_scale.html", "./qr_print.html",
  "./sales_crm.html", "./operator_academy.html", "./hostaband.html", "./managed.html", "./band_vault.html", "./archive.html", "./curator.html", "./record_store.html", "./console_directory.html", "./target_bands.js", "./audio_manifest.js", "./festivals_seed.js",
  "./manifest.webmanifest", "./bands.js", "./market-core.js", "./cassette-reader.js", "./ad-engine.js", "./syf.png", "./lukas_a2hs.js",
  "./crm_seed.js", "./lukas_chat.js", "./lukas_badge.js", "./helptest.js", "./doodles.js", "./doodles/chancellor.svg", "./doodles/sunset.svg",
  "./rosebud.svg", "./rosebud-192.png", "./rosebud-512.png", "./rosebud-32.png",
  "./rose.svg", "./rose-192.png", "./rose-512.png", "./rose-32.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.allSettled(ASSETS.map(function (a) { return c.add(a); })); // best-effort: don't let one 404 break install
    }).then(function () { return self.skipWaiting(); })
  );
});
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
