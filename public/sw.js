// FlowTailor PWA Service Worker
// Ultra-fast offline & minimal data usage via Stale-While-Revalidate (SWR)

const SW_VERSION = 'v3.0.0';
const STATIC_CACHE = `flowtailor-static-${SW_VERSION}`;
const RUNTIME_CACHE = `flowtailor-runtime-${SW_VERSION}`;
const MAX_RUNTIME_ITEMS = 60; // Conserve device storage and mobile bandwidth

// Core App Shell resources to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/icon-192.png',
  '/icon-512.png'
];

// Helper: Trim cache to limit stored entries (LRU cleanup)
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      // Evict oldest items first
      await cache.delete(keys[0]);
      await trimCache(cacheName, maxItems);
    }
  } catch (err) {
    // Fail silently
  }
}

// 1. Install Event: Cache essential app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      try {
        await cache.addAll(PRECACHE_ASSETS);
      } catch (err) {
        console.warn('SW Precache warning (transient resources):', err);
      }
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean up outdated cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) {
            console.log('[SW] Removendo cache obsoleto:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Helper: Determine if request is a static asset suitable for SWR
function isStaticAsset(url, request) {
  const pathname = url.pathname.toLowerCase();
  const destination = request.destination;

  // By Request Destination
  if (['style', 'script', 'font', 'image', 'manifest'].includes(destination)) {
    return true;
  }

  // By File Extensions
  return /\.(js|mjs|css|png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|eot|json)$/i.test(pathname);
}

// 3. Fetch Event: Implement SWR & Network Strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bypass API routes, WebSockets & Browser extensions
  if (
    url.pathname.startsWith('/api/') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // A. Navigation / Document Requests (HTML Pages & SPA Routes)
  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline Fallback: Serve cached index.html for smooth Single-Page App navigation
          const cachedDoc = await caches.match(request);
          if (cachedDoc) return cachedDoc;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // B. Static Assets: STALE-WHILE-REVALIDATE (Instant Cache + Background Update)
  if (isStaticAsset(url, request)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request) || await caches.match(request);

        // Background revalidation fetch (does not block instant UI delivery)
        const fetchPromise = fetch(request)
          .then(async (networkResponse) => {
            if (
              networkResponse &&
              (networkResponse.status === 200 || networkResponse.type === 'opaque')
            ) {
              // Store latest version in cache for subsequent visits
              await cache.put(request, networkResponse.clone());
              // Enforce lightweight cache memory limit
              trimCache(RUNTIME_CACHE, MAX_RUNTIME_ITEMS);
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failure: cached response will continue serving
            return null;
          });

        // Return cached version immediately if present; otherwise wait for network
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // C. Fallback for other standard requests: Cache with Network Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(request).then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
      );
    })
  );
});

// 4. Message Event: Remote commands (e.g. skipWaiting or cache reset)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => caches.delete(key)));
      })
    );
  }
});

