/* ============================================================================
   PostMind — service-worker.js  (v1, created June 6 2026)
   STATUS: NEW CODE. This file did not exist before this handoff package.
   It is NOT yet registered in the deployed index.html.

   WHAT IT DOES
   - Caches the app shell (index.html + Google Fonts CSS) for instant repeat
     loads and offline access to the dashboard UI.
   - NEVER caches Anthropic API calls — Claude generations always go to the
     network. If offline, generation fails gracefully (the app already shows
     the error via its toast).
   - Brand profiles and posts live in localStorage, so previously generated
     calendars remain fully readable offline once the shell is cached.

   HOW TO ACTIVATE (one-time, two steps)
   1. Place this file next to index.html at the repo root (same scope).
   2. Add this snippet to index.html, just before the closing </script> tag
      of the main script block:

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('./service-worker.js')
            .catch(function(e){ console.warn('SW registration failed:', e); });
        }

   3. Commit + push to GitHub Pages. First visit installs; second visit is
      served from cache.

   CACHE-BUSTING: bump CACHE_VERSION whenever index.html changes, or stale
   UI will be served. (The activate handler deletes old caches automatically.)
   ========================================================================== */

const CACHE_VERSION = 'postmind-shell-v1';

const SHELL_ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap'
];

// Hosts that must never be cached (live API traffic).
const NETWORK_ONLY_HOSTS = [
  'api.anthropic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1) API calls: network only. Never intercept, never cache.
  if (NETWORK_ONLY_HOSTS.includes(url.hostname)) {
    return; // fall through to default browser fetch
  }

  // 2) Non-GET requests: never cache.
  if (event.request.method !== 'GET') {
    return;
  }

  // 3) Navigation requests: network-first, cache fallback.
  //    Keeps the deployed app fresh while surviving offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 4) Everything else (fonts, static assets): cache-first, network fallback.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        // Cache successful basic/cors responses for next time.
        if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
        }
        return resp;
      });
    })
  );
});
