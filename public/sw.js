// Service worker for Your Max TV PWA
const CACHE_NAME = 'yourmaxtv-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let media streams and API requests pass directly to network
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('azamtvltd') ||
    url.pathname.endsWith('.mpd') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.mp4')
  ) {
    return;
  }
});
