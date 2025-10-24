import {logger} from '../js-common/utils/logging.js';
import {cleanupOldAppCaches, initCache} from './utils/app-cache-manager.js';
import {handleAppCacheRequest} from "./utils/app-fetch-handler.js";

const logPrefix = '[SW]';

/**
 * Broadcast message to all controlled pages
 * @param {Object} message - Message to broadcast
 */
async function broadcastToPages(message) {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
    for (const client of clientsList) {
        client.postMessage(message);
    }
}

self.addEventListener('install', event => {
    logger.debug(logPrefix, 'Installing service worker');
    event.waitUntil((async () => {
        await initCache();
        await self.skipWaiting();
        logger.log(logPrefix, 'Service worker installed');
    })());
});

self.addEventListener('activate', event => {
    logger.debug(logPrefix, 'Activating service worker');
    event.waitUntil((async () => {
        try {
            await cleanupOldAppCaches();
            await self.clients.claim();
            logger.log(logPrefix, 'Service worker activated');
        } catch (error) {
            logger.error(logPrefix, 'Service worker activation failed:', error);
            logger.error(logPrefix, 'Activation error stack:', error.stack);
            throw error;
        }
    })());
});

// Serve from precache; fall back to network.
self.addEventListener('fetch', event => {
    logger.debug(logPrefix, 'Fetching:', event.request.url);
    event.respondWith(handleAppCacheRequest(event));
});
