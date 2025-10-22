// Cache Message Handler
// Handles cache-related service worker messages

import { loadAppManifest, clearManifestCache, getCachedManifest } from '../utils/app-manifest-loader.js';
import { cacheAppAssets, getAppCacheNames } from '../utils/app-cache-manager.js';
import { sendResponse } from '../utils/client-messenger.js';

/**
 * Handle cache-related messages
 * @param {Event} event - Message event
 * @returns {Promise<void>}
 */
export async function handleCacheMessage(event) {
  const { data } = event;

  try {
    switch (data.type) {
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

          sendResponse(event, response);
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

          sendResponse(event, response);
        } catch (error) {
          console.error('[SW] App cache update failed:', error);
          const response = {
            type: 'UPDATE_APP_CACHE_RESPONSE',
            success: false,
            error: error.message,
            timestamp: Date.now()
          };

          sendResponse(event, response);
        }
        break;
      }

      case 'CLEAR_APP_MANIFEST_CACHE': {
        clearManifestCache();
        console.log('[SW] Manifest cache cleared');
        break;
      }

      case 'GET_APP_CACHE_STATUS': {
        const appCaches = await getAppCacheNames();
        const response = {
          type: 'APP_CACHE_STATUS_RESPONSE',
          appCaches,
          currentVersion: getCachedManifest()?.version || null,
          timestamp: Date.now()
        };

        sendResponse(event, response);
        break;
      }

      default:
        console.warn('[SW] Unknown cache message type:', data.type);
    }
  } catch (error) {
    console.error('[SW] Error handling cache message:', data.type, error);
  }
}
