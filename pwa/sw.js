// Service Worker for App Cache Management
// Version: 1.1.0

const APP_CACHE_PREFIX = 'app-cache-v';
const APP_MANIFEST_URL = '/app-manifest.json';

// Cache manifest in memory to avoid repeated fetches
let cachedManifest = null;
let manifestFetchTime = 0;
const MANIFEST_CACHE_TTL = 60000; // 1 minute

// Load app manifest configuration with caching
async function loadAppManifest(forceRefresh = false) {
  const now = Date.now();

  // Use cached version if available and not expired
  if (!forceRefresh && cachedManifest && (now - manifestFetchTime) < MANIFEST_CACHE_TTL) {
      console.log('[SW] Using memory cached manifest version:', cachedManifest.version);
    return cachedManifest;
  }

  try {
    console.log('[SW] Loading app manifest...');
    // Add timestamp to ensure cache busting
    const cacheBustUrl = `${APP_MANIFEST_URL}?t=${Date.now()}`;
    const response = await fetch(cacheBustUrl, {
        cache: 'no-cache', // Always get fresh manifest for version checks
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const manifest = await response.json();

    // Validate manifest structure
    if (!manifest.version || !Array.isArray(manifest.files)) {
      throw new Error('Invalid app cache manifest structure');
    }

    // Cache the manifest
    cachedManifest = manifest;
    manifestFetchTime = now;

    console.log('[SW] Loaded app cache manifest, version:', manifest.version);
    return manifest;
  } catch (error) {
    console.log('[SW] App manifest not available:', error.message);
    // Keep using cached version if available, even if expired
    if (cachedManifest) {
      console.log('[SW] Using cached manifest version:', cachedManifest.version);
      return cachedManifest;
    }
    return null;
  }
}

// Clear manifest cache
function clearManifestCache() {
  cachedManifest = null;
  manifestFetchTime = 0;
}

// Broadcast message to all clients
async function broadcastToClients(message) {
  try {
    const clients = await self.clients.matchAll();
    console.log('[SW] Broadcasting to', clients.length, 'clients:', message.type);

    clients.forEach(client => {
      try {
        client.postMessage(message);
      } catch (error) {
        console.error('[SW] Failed to send message to client:', error);
      }
    });
  } catch (error) {
    console.error('[SW] Failed to broadcast message:', error);
  }
}

// Centralized function to clean up old app caches
async function cleanupOldAppCaches(currentVersion, options = {}) {
  const { logPrefix = '[SW]' } = options;

  try {
    const currentCacheName = `${APP_CACHE_PREFIX}${currentVersion}`;
    const cacheNames = await caches.keys();
    const oldAppCaches = cacheNames.filter(name =>
      name.startsWith(APP_CACHE_PREFIX) && name !== currentCacheName
    );

    if (oldAppCaches.length === 0) {
      console.log(logPrefix, 'No old app caches to delete');
      return { deleted: [], failed: [] };
    }

    console.log(logPrefix, 'Deleting old app caches:', oldAppCaches);

    const deletionResults = await Promise.allSettled(
      oldAppCaches.map(async (cacheName) => {
        try {
          const deleted = await caches.delete(cacheName);
          console.log(logPrefix, 'Deleted old app cache:', cacheName, deleted ? 'success' : 'failed');
          return { cacheName, deleted };
        } catch (error) {
          console.error(logPrefix, 'Failed to delete app cache:', cacheName, error);
          return { cacheName, deleted: false, error: error.message };
        }
      })
    );

    const deleted = deletionResults
      .filter(result => result.status === 'fulfilled' && result.value.deleted)
      .map(result => result.value.cacheName);

    const failed = deletionResults
      .filter(result => result.status === 'rejected' || !result.value.deleted)
      .map(result => result.value?.cacheName || 'unknown');

    if (failed.length > 0) {
      console.warn(logPrefix, 'Some app caches could not be deleted:', failed);
    }

    console.log(logPrefix, `App cache cleanup completed: ${deleted.length} deleted, ${failed.length} failed`);

    return { deleted, failed };
  } catch (error) {
    console.error(logPrefix, 'App cache cleanup failed:', error);
    return { deleted: [], failed: [], error: error.message };
  }
}

// Centralized function to cache app assets
async function cacheAppAssets(manifest, options = {}) {
  const { forceRefresh = false, logPrefix = '[SW]', cleanupOld = false } = options;

  if (!manifest || !Array.isArray(manifest.files)) {
    throw new Error('Invalid manifest or app files not available');
  }

  const cacheName = `${APP_CACHE_PREFIX}${manifest.version}`;
  console.log(logPrefix, 'Opening app cache:', cacheName);

  const cache = await caches.open(cacheName);
  console.log(logPrefix, 'Caching app assets:', manifest.files);

  // Cache assets with individual error handling
  const cachePromises = manifest.files.map(async (url) => {
    try {
      const fetchOptions = forceRefresh ? { cache: 'no-cache' } : {};
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }

      await cache.put(url, response);
      console.log(logPrefix, forceRefresh ? 'Updated app cache for:' : 'Added to app cache:', url);

      return { url, success: true };
    } catch (error) {
      console.error(logPrefix, forceRefresh ? 'Failed to update app cache for:' : 'Failed to add to app cache:', url, error.message);
      return { url, success: false, error: error.message };
    }
  });

  const results = await Promise.allSettled(cachePromises);

  // Count successful and failed operations
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

  console.log(logPrefix, `App cache operation completed: ${successful} successful, ${failed} failed`);

  let cleanupResult = null;
  if (cleanupOld) {
    cleanupResult = await cleanupOldAppCaches(manifest.version, { logPrefix });
  }

  return {
    cacheName,
    successful,
    failed,
    total: manifest.files.length,
    results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
    cleanup: cleanupResult
  };
}

// Service Worker Install Event
self.addEventListener('install', async (event) => {
  console.log('[SW] Install event triggered');

  event.waitUntil(
    (async () => {
      const startTime = performance.now();

      try {
        const manifest = await loadAppManifest(true); // Force refresh on install

        if (!manifest) {
          console.log('[SW] Skipping caching - offline mode');
          return;
        }

        // Use centralized caching function
        const cacheResult = await cacheAppAssets(manifest, {
          forceRefresh: false,
          logPrefix: '[SW]'
        });

        const duration = Math.round(performance.now() - startTime);
        console.log('[SW] App cache install completed in', duration, 'ms -', 
                   `${cacheResult.successful}/${cacheResult.total} assets cached`);

        // Skip waiting to activate immediately
        self.skipWaiting();

      } catch (error) {
        console.error('[SW] Install failed:', error);
        // Don't skip waiting if install failed
        throw error;
      }
    })()
  );
});

// Service Worker Activate Event
self.addEventListener('activate', async (event) => {
  console.log('[SW] Activate event triggered');

  event.waitUntil(
    (async () => {
      const startTime = performance.now();

      try {
        const manifest = await loadAppManifest();

        if (!manifest) {
          console.log('[SW] Skipping app cache cleanup - offline mode');
        } else {
          // Use centralized cleanup function
          await cleanupOldAppCaches(manifest.version, { logPrefix: '[SW]' });
        }

        const duration = Math.round(performance.now() - startTime);
        console.log('[SW] App cache activation complete in', duration, 'ms');

        // Take control of all clients immediately
        await self.clients.claim();
        console.log('[SW] Claimed all clients');

      } catch (error) {
        console.error('[SW] Activation failed:', error);
        // Still try to claim clients even if other operations failed
        await self.clients.claim();
        throw error;
      }
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

  // Handle all requests with app cache-first strategy (let cache determine availability)
  event.respondWith(handleAppCacheRequest(event.request));
});

// Handle requests with app cache-first strategy
async function handleAppCacheRequest(request) {
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Normalize root path
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const startTime = performance.now();

  try {
    // Try to find in cache first (more efficient approach)
    let cachedResponse;

    // First try current app cache if we have manifest
    if (cachedManifest) {
      const cacheName = `${APP_CACHE_PREFIX}${cachedManifest.version}`;
      const cache = await caches.open(cacheName);
      cachedResponse = await cache.match(request);

        // If not found, try without query parameters
        if (!cachedResponse) {
            cachedResponse = await cache.match(new Request(pathname));
        }
    }

      // If not found, check all caches
    if (!cachedResponse) {
        cachedResponse = await caches.match(request);

        // If not found, try matching without query parameters
        if (!cachedResponse) {
            cachedResponse = await caches.match(new Request(pathname));
        }
    }

      if (cachedResponse) {
      const duration = Math.round(performance.now() - startTime);
      console.log('[SW] App cache hit:', pathname, `(${duration}ms)`);
      return cachedResponse;
    }

    // If not in app cache, fetch from network
    console.log('[SW] App cache miss, fetching:', pathname);
    const response = await fetch(request);

    const duration = Math.round(performance.now() - startTime);

    if (response.ok) {
      console.log('[SW] Network fetch success:', pathname, `(${duration}ms)`);
    } else {
      console.warn('[SW] Network fetch failed:', pathname, response.status, `(${duration}ms)`);
    }

    return response;

  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error('[SW] Request failed:', pathname, error.message, `(${duration}ms)`);

    // Try to serve any cached version as fallback
    try {
      const fallbackResponse = await caches.match(request);
      if (fallbackResponse) {
        console.log('[SW] Served stale app cache as fallback:', pathname);
        return fallbackResponse;
      }
    } catch (fallbackError) {
      console.error('[SW] Fallback app cache lookup failed:', fallbackError.message);
    }

    // Return a user-friendly error response
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
        <head><title>Resource Unavailable</title></head>
        <body>
          <h1>Resource Unavailable</h1>
          <p>The requested resource "${pathname}" could not be loaded.</p>
          <p>Please check your internet connection and try again.</p>
        </body>
      </html>
    `, {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  }
}

// Handle service worker messages
self.addEventListener('message', async (event) => {
  const { data } = event;

  if (!data || !data.type) {
    console.warn('[SW] Invalid message received:', data);
    return;
  }

  console.log('[SW] Message received:', data.type);

  try {
    switch (data.type) {
        case 'GET_APP_VERSION': {
          const manifest = await loadAppManifest();
          const response = {
            type: 'APP_VERSION_RESPONSE',
          version: manifest ? manifest.version : null,
          timestamp: Date.now()
        };

        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(response);
        } else {
          // Fallback for clients.postMessage
          event.source?.postMessage(response);
        }
        break;
      }

      case 'FORCE_APP_MANIFEST_CHECK': {
        console.log('[SW] Forcing app manifest check...');
        const oldVersion = cachedManifest?.version;
        const manifest = await loadAppManifest(true); // Force refresh

        const response = {
          type: 'APP_MANIFEST_CHECK_RESPONSE',
          oldVersion,
          newVersion: manifest ? manifest.version : null,
          versionChanged: manifest && oldVersion !== manifest.version,
          timestamp: Date.now()
        };

        // Notify about version change
        if (response.versionChanged) {
          console.log('[SW] App version changed from', oldVersion, 'to', response.newVersion);
          await broadcastToClients({
            type: 'APP_VERSION_CHANGED',
            oldVersion,
            newVersion: response.newVersion,
            timestamp: Date.now()
          });
        }

        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(response);
        } else {
          event.source?.postMessage(response);
        }
        break;
      }

      case 'UPDATE_APP_CACHE': {
        console.log('[SW] Forcing cache update...');
        const manifest = await loadAppManifest(true); // Force refresh

        if (!manifest) {
          const response = {
            type: 'UPDATE_APP_CACHE_RESPONSE',
            success: false,
            error: 'App manifest not available',
            timestamp: Date.now()
          };

          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage(response);
          } else {
            event.source?.postMessage(response);
          }
          break;
        }

        try {
          // Use centralized caching function with force refresh and cleanup
          const cacheResult = await cacheAppAssets(manifest, {
            forceRefresh: true,
            logPrefix: '[SW]',
            cleanupOld: true
          });

          const response = {
            type: 'UPDATE_APP_CACHE_RESPONSE',
            success: true,
            version: manifest.version,
            cacheName: cacheResult.cacheName,
            successful: cacheResult.successful,
            failed: cacheResult.failed,
            total: cacheResult.total,
            cleanup: cacheResult.cleanup,
            timestamp: Date.now()
          };

          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage(response);
          } else {
            event.source?.postMessage(response);
          }
        } catch (error) {
          console.error('[SW] App cache update failed:', error);
          const response = {
            type: 'UPDATE_APP_CACHE_RESPONSE',
            success: false,
            error: error.message,
            timestamp: Date.now()
          };

          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage(response);
          } else {
            event.source?.postMessage(response);
          }
        }
        break;
      }

      case 'CLEAR_APP_MANIFEST_CACHE': {
        clearManifestCache();
        console.log('[SW] Manifest cache cleared');
        break;
      }

        case 'GET_APP_CACHE_STATUS': {
          const cacheNames = await caches.keys();
          const appCaches = cacheNames.filter(name => name.startsWith(APP_CACHE_PREFIX));
          const response = {
            type: 'APP_CACHE_STATUS_RESPONSE',
          appCaches,
          currentVersion: cachedManifest?.version || null,
          timestamp: Date.now()
        };

        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(response);
        } else {
          event.source?.postMessage(response);
        }
        break;
      }

      default:
        console.warn('[SW] Unknown message type:', data.type);
    }
  } catch (error) {
    console.error('[SW] Error handling message:', data.type, error);
  }
});

// Add error event handler for unhandled service worker errors
self.addEventListener('error', (event) => {
  console.error('[SW] Unhandled error:', event.error);
});

// Add unhandledrejection handler for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
  // Prevent the default handling (which would log to console anyway)
  event.preventDefault();
});
