import {logger} from '../js-common/utils/logging.js';
import {cleanupOldAppCaches, initCache} from './utils/app-cache-manager.js';
import {handleAppCacheRequest} from "./utils/app-fetch-handler.js";
import {COMMANDS} from '../js-common/events.js';
import {
    handleActivateDataCaching,
    handleDeactivateDataCaching,
    getCurrentStatus,
    handleCacheDataAll,
    handleCacheDataPresentation,
    handleNukeData,
    setBroadcastFunction
} from './handlers/command-handlers.js';
import { initializeEngine, setMessageCallback } from './data-cache-engine.js';

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

// Handle incoming messages from pages
self.addEventListener('message', async (event) => {
    const port = event.ports?.[0] || null;
    const { type, payload } = event.data || {};

    logger.debug(logPrefix, 'CMD:', type, payload);

    try {
        switch (type) {
            case COMMANDS.CACHE_STATUS:
                const status = await getCurrentStatus();
                port?.postMessage({ ok: true, status });
                await broadcastToPages({ type: 'STATUS', payload: status });
                break;

            case COMMANDS.ACTIVATE_DATA_CACHING:
                await handleActivateDataCaching(payload);
                break;

            case COMMANDS.DEACTIVATE_DATA_CACHING:
                await handleDeactivateDataCaching(payload);
                break;

            case COMMANDS.CACHE_DATA_ALL:
                await handleCacheDataAll(payload);
                break;

            case COMMANDS.CACHE_DATA_PRESENTATION:
                await handleCacheDataPresentation(payload);
                break;

            case COMMANDS.NUKE_DATA:
                await handleNukeData(payload);
                break;

            default:
                logger.debug(logPrefix, 'Unknown command type:', type);
                port?.postMessage({ ok: false, error: 'Unknown command' });
                break;
        }
    } catch (error) {
        logger.error(logPrefix, 'Command handler error:', error);
        port?.postMessage({ ok: false, error: String(error) });
    }
});

self.addEventListener('install', event => {
    logger.debug(logPrefix, 'Installing service worker');
    event.waitUntil((async () => {
        await initCache();
        // Set up data cache engine to broadcast messages to pages
        setMessageCallback(broadcastToPages);
        // Set broadcast function in command handlers
        setBroadcastFunction(broadcastToPages);
        await self.skipWaiting();
        logger.log(logPrefix, 'Service worker installed');
    })());
});

self.addEventListener('activate', event => {
    logger.debug(logPrefix, 'Activating service worker');
    event.waitUntil((async () => {
        await cleanupOldAppCaches();
        await self.clients.claim();

        // Initialize data cache engine if enabled
        await initializeEngine();

        logger.log(logPrefix, 'Service worker activated');
    })());
});

// Serve from precache; fall back to network.
self.addEventListener('fetch', event => {
    logger.debug(logPrefix, 'Fetching:', event.request.url);
    event.respondWith(handleAppCacheRequest(event));
});
