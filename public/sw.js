// Service worker for NeliTv Progressive Web App
const CACHE_NAME = 'nelitv-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
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

self.addEventListener('fetch', (event) => {
  // Let live media streams, websockets, and API requests bypass cache
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('azamtvltd') ||
    url.hostname.includes('amagi.tv') ||
    url.hostname.includes('base44.app') ||
    url.pathname.endsWith('.mpd') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.mp4')
  ) {
    return;
  }
});
