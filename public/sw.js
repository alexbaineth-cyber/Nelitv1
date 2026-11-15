// Service worker for NeliTv Progressive Web App & Offline Playback Support
const CACHE_NAME = 'nelitv-pwa-v4';
const OFFLINE_URL = '/';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.png',
  '/app-logo.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache notice:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Respond to client ping checks for Service Worker status
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PING_SW_STATUS') {
    event.ports?.[0]?.postMessage({
      type: 'PONG_SW_STATUS',
      cacheName: CACHE_NAME,
      status: 'active',
      timestamp: Date.now()
    });
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // CRITICAL: Never cache Vite dev modules, pre-bundled deps (?v=), or source TypeScript files
  // Caching them causes mismatched ?v= hashes and duplicate React instances ("Invalid hook call").
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t')
  ) {
    return;
  }

  // Bypass live video stream chunks & external streams
  if (
    url.pathname.endsWith('.mpd') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.m4s') ||
    url.pathname.endsWith('.mp4')
  ) {
    return;
  }

  // Navigation requests: Network-first, fallback to cached index.html / app shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(OFFLINE_URL);
        return cached || (await cache.match('/index.html')) || new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>NeliTv Offline</title></head><body style="background:#070A0F;color:#fff;text-align:center;padding:50px;font-family:sans-serif;"><h2>NeliTv Iko Nje ya Mtandao</h2><p>Tafadhali washa intaneti yako kutazama NeliTv.</p></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }

  // Only cache built production /assets/* and static public icons/images
  const isBuiltAsset = url.pathname.startsWith('/assets/');
  const isStaticMedia =
    event.request.destination === 'image' ||
    event.request.destination === 'font';

  if (isBuiltAsset || isStaticMedia) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
