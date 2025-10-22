// Service Worker for App Cache Management
// Version: 1.1.0 - Modular Architecture

// Import utilities and handlers
import { loadAppManifest } from './utils/app-manifest-loader.js';
import { cacheAppAssets, cleanupOldAppCaches } from './utils/app-cache-manager.js';
import { handleAppCacheRequest } from './utils/fetch-handler.js';
import { handleVersionMessage } from './handlers/app-version-handler.js';
import { handleCacheMessage } from './handlers/app-cache-handler.js';

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
      case 'GET_APP_VERSION':
      case 'FORCE_APP_MANIFEST_CHECK':
        await handleVersionMessage(event);
        break;

      case 'UPDATE_APP_CACHE':
      case 'CLEAR_APP_MANIFEST_CACHE':
      case 'GET_APP_CACHE_STATUS':
        await handleCacheMessage(event);
        break;

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
