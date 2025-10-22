// Version Message Handler
// Handles version-related service worker messages

import { loadAppManifest, getCachedManifest } from '../utils/app-manifest-loader.js';
import { broadcastToClients, sendResponse } from '../utils/client-messenger.js';

/**
 * Handle version-related messages
 * @param {Event} event - Message event
 * @returns {Promise<void>}
 */
export async function handleVersionMessage(event) {
  const { data } = event;

  try {
    switch (data.type) {
      case 'GET_APP_VERSION': {
        const manifest = await loadAppManifest();
        const response = {
          type: 'APP_VERSION_RESPONSE',
          version: manifest ? manifest.version : null,
          timestamp: Date.now()
        };

        sendResponse(event, response);
        break;
      }

      case 'FORCE_APP_MANIFEST_CHECK': {
        console.log('[SW] Forcing app manifest check...');
        const oldVersion = getCachedManifest()?.version;
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

        sendResponse(event, response);
        break;
      }

      default:
        console.warn('[SW] Unknown version message type:', data.type);
    }
  } catch (error) {
    console.error('[SW] Error handling version message:', data.type, error);
  }
}
