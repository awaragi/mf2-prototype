// Service Worker for App Shell Caching
// Version: 1.0.0

const CACHE_PREFIX = 'shell-v';

// Load app manifest configuration
async function loadAppManifest() {
  try {
    console.log('[SW] Loading app manifest...');
    const response = await fetch('/app-manifest.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const manifest = await response.json();
    console.log('[SW] Loaded app manifest, version:', manifest.appVersion);
    return manifest;
  } catch (error) {
    console.log('[SW] App manifest not available (offline mode):', error.message);
    return null;
  }
}

// Service Worker Install Event
self.addEventListener('install', async (event) => {
  console.log('[SW] Install event triggered');

  event.waitUntil(
    (async () => {
      const manifest = await loadAppManifest();

      if (!manifest) {
        console.log('[SW] Skipping caching - offline mode');
        return;
      }

      try {
        const cacheName = `${CACHE_PREFIX}${manifest.appVersion}`;
        const cache = await caches.open(cacheName);
        console.log('[SW] Caching shell assets:', manifest.shellFiles);
        await cache.addAll(manifest.shellFiles);
        console.log('[SW] Cached shell assets successfully');
      } catch (error) {
        console.error('[SW] Failed to cache shell assets:', error);
      }
    })()
  );
});

// Service Worker Activate Event
self.addEventListener('activate', async (event) => {
  console.log('[SW] Activate event triggered');

  event.waitUntil(
    (async () => {
      const manifest = await loadAppManifest();

      if (!manifest) {
        console.log('[SW] Skipping cache cleanup - offline mode');
        // Still take control of clients
        return self.clients.claim();
      }

      // Delete old caches
      const currentCacheName = `${CACHE_PREFIX}${manifest.appVersion}`;
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => 
        name.startsWith(CACHE_PREFIX) && name !== currentCacheName
      );

      if (oldCaches.length > 0) {
        console.log('[SW] Deleting old caches:', oldCaches);
        await Promise.all(
          oldCaches.map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }

      console.log('[SW] Activation complete');

      // Take control of all clients immediately
      return self.clients.claim();
    })()
  );
});

// Service Worker Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests for same origin
  if (event.request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // Handle all requests with cache-first strategy (let cache determine availability)
  event.respondWith(handleShellRequest(event.request));
});

// Handle requests with cache-first strategy
async function handleShellRequest(request) {
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Normalize root path
  if (pathname === '/') {
    pathname = '/index.html';
  }

  try {
    // Try to find in any available cache first
    let cachedResponse;

    // Try to load manifest to determine if we're in online mode
    const manifest = await loadAppManifest();

    if (manifest) {
      // Online mode: use specific cache
      const cacheName = `${CACHE_PREFIX}${manifest.appVersion}`;
      const cache = await caches.open(cacheName);
      cachedResponse = await cache.match(request);
    } else {
      // Offline mode: check all caches for this resource
      cachedResponse = await caches.match(request);
    }

    if (cachedResponse) {
      console.log('[SW] Served from cache:', pathname);
      return cachedResponse;
    }

    // If not in cache, fetch from network
    console.log('[SW] Fetching resource:', pathname);
    const response = await fetch(request);

    if (response.ok) {
      console.log('[SW] Fetched resource from network:', pathname);
    }

    return response;
  } catch (error) {
    console.error('[SW] Failed to handle request:', pathname, error);
    // Return a basic error response
    return new Response('Resource not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Handle service worker messages
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    const manifest = await loadAppManifest();
    event.ports[0].postMessage({
      type: 'VERSION_RESPONSE',
      version: manifest ? manifest.appVersion : null
    });
  }
});
