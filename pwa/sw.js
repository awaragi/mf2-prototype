// Service Worker for App Shell Caching
// Version: 1.0.0

const CACHE_PREFIX = 'shell-v';
let CACHE_NAME;
let APP_VERSION;
let SHELL_FILES = [];

// Initialize cache configuration
async function initializeCache() {
  try {
    const response = await fetch('/app-manifest.json');
    const manifest = await response.json();
    APP_VERSION = manifest.appVersion;
    SHELL_FILES = manifest.shellFiles;
    CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
    console.log('[SW] Initialized with version:', APP_VERSION);
  } catch (error) {
    console.error('[SW] Failed to load app manifest:', error);
    // Fallback configuration
    APP_VERSION = '1.0.0';
    CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
    SHELL_FILES = [
      '/',
      '/index.html',
      '/present.html',
      '/styles.css',
      '/js/app-index.js',
      '/js/app-present.js',
      '/js/pwa.js'
    ];
  }
}

// Service Worker Install Event
self.addEventListener('install', async (event) => {
  console.log('[SW] Install event triggered');

  event.waitUntil(
    (async () => {
      await initializeCache();

      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('[SW] Caching shell assets:', SHELL_FILES);
        await cache.addAll(SHELL_FILES);
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
      await initializeCache();

      // Delete old caches
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => 
        name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
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

  // Check if this is a shell file request
  const isShellFile = isShellResource(url.pathname);

  if (isShellFile) {
      console.log('[SW] Serving shell file:', url.pathname);
    event.respondWith(handleShellRequest(event.request));
  }
  // Let other requests (API, attachments) pass through normally
});

// Check if a pathname is a shell resource
function isShellResource(pathname) {
  // Normalize pathname
  if (pathname === '/') {
    pathname = '/index.html';
  }

  return SHELL_FILES.some(shellFile => {
    if (shellFile === '/') {
      return pathname === '/index.html';
    }
    return shellFile === pathname;
  });
}

// Handle shell file requests with cache-first strategy
async function handleShellRequest(request) {
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Normalize root path
  if (pathname === '/') {
    pathname = '/index.html';
  }

  try {
    await initializeCache();
    const cache = await caches.open(CACHE_NAME);

    // Try cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Served shell from cache:', pathname);
      return cachedResponse;
    }

    // If not in cache, fetch and cache
    console.log('[SW] Fetching shell resource:', pathname);
    const response = await fetch(request);

    if (response.ok) {
      const responseClone = response.clone();
      cache.put(request, responseClone);
      console.log('[SW] Cached shell resource:', pathname);
    }

    return response;
  } catch (error) {
    console.error('[SW] Failed to handle shell request:', pathname, error);
    // Return a basic error response
    return new Response('Service Worker Error', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Handle service worker messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION_RESPONSE',
      version: APP_VERSION
    });
  }
});
