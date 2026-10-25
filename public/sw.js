// Service worker for NeliTv Progressive Web App & Offline Playback Support
const CACHE_NAME = 'nelitv-pwa-v3';
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

  // Bypass live video stream chunks & real-time payment webhooks
  if (
    url.pathname.startsWith('/api/harakapay') ||
    url.hostname.includes('azamtvltd') ||
    url.hostname.includes('amagi.tv') ||
    url.hostname.includes('base44.app') ||
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
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>NeliTv Offline</title></head><body style="background:#070A0F;color:#fff;text-align:center;padding:50px;font-family:sans-serif;"><h2>NeliTv Iko Nje ya Mtandao</h2><p>Tafadhali washa intaneti yako kutazama mechi na vipindi moja kwa moja.</p></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }

  // Static assets: Stale-While-Revalidate caching strategy
  if (
    event.request.destination === 'style' ||
    event.request.destination === 'script' ||
    event.request.destination === 'image' ||
    event.request.destination === 'font'
  ) {
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
