/**
 * MarkVault — Service Worker
 * Strategy: Cache-first for app shell, network-first for CDN libs
 * Enables full offline use after first load.
 */

const CACHE_NAME    = 'markvault-v2';
const SHELL_ASSETS  = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/renderer.js',
  './js/sharing.js',
  './js/ai.js',
  './js/pdfhandler.js',
  './js/app.js',
  './manifest.json',
];

// CDN assets we want cached for offline
const CDN_CACHE     = 'markvault-cdn-v2';
const CDN_ORIGINS   = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
];

// ── Install: pre-cache shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install cache failed:', err))
  );
});

// ── Activate: clean old caches ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache strategies ───────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin API calls (Firebase, AI providers)
  if (request.method !== 'GET') return;
  if (isAPICall(url)) return;

  // CDN assets: stale-while-revalidate
  if (CDN_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(staleWhileRevalidate(request, CDN_CACHE));
    return;
  }

  // App shell: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }
});

function isAPICall(url) {
  return (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('groq.com') ||
    url.hostname.includes('cerebras.ai') ||
    url.hostname.includes('together.xyz') ||
    url.hostname.includes('openrouter.ai') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('datalab.to')
  );
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    return new Response('Offline — cached version unavailable', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(fresh => {
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  }).catch(() => null);
  return cached || fetchPromise;
}

// ── Push: show offline notification ──────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
