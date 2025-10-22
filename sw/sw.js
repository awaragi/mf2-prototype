import {logger} from '../js-common/utils/logging.js';
import {cleanupOldAppCaches, initCache} from './utils/app-cache-manager.js';
import {handleAppCacheRequest} from "./utils/app-fetch-handler.js";
import {COMMANDS, CHANNEL_NAME} from '../js-common/events.js';
import {
    handleActivateDataCaching,
    handleDeactivateDataCaching,
    handleCacheStatus,
    handleCacheDataAll,
    handleCacheDataPresentation,
    handleNukeData
} from './handlers/command-handlers.js';

const logPrefix = '[SW]';
let broadcastChannel = null;

// Initialize BroadcastChannel for messaging
function initBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') {
        logger.warn(logPrefix, 'BroadcastChannel not supported');
        return;
    }

    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.addEventListener('message', handleBroadcastMessage);
    logger.debug(logPrefix, 'BroadcastChannel initialized');
}

// Command handler dictionary
const commandHandlers = {
    [COMMANDS.ACTIVATE_DATA_CACHING]: handleActivateDataCaching,
    [COMMANDS.DEACTIVATE_DATA_CACHING]: handleDeactivateDataCaching,
    [COMMANDS.CACHE_STATUS]: handleCacheStatus,
    [COMMANDS.CACHE_DATA_ALL]: handleCacheDataAll,
    [COMMANDS.CACHE_DATA_PRESENTATION]: handleCacheDataPresentation,
    [COMMANDS.NUKE_DATA]: handleNukeData
};

/**
 * Handle incoming broadcast messages from app
 * @param {MessageEvent} event
 */
function handleBroadcastMessage(event) {
    const {type, payload} = event.data;
    logger.debug(logPrefix, 'CMD:', type, payload);

    const handler = commandHandlers[type];
    if (handler) {
        handler(broadcastChannel, payload);
    } else {
        logger.debug(logPrefix, 'Unknown command type:', type);
    }
}

self.addEventListener('install', event => {
    logger.debug(logPrefix, 'Installing service worker');
    event.waitUntil((async () => {
        await initCache();
        initBroadcastChannel();
        await self.skipWaiting();
        logger.log(logPrefix, 'Service worker installed');
    })());
});

self.addEventListener('activate', event => {
    logger.debug(logPrefix, 'Activating service worker');
    event.waitUntil((async () => {
        await cleanupOldAppCaches();
        if (!broadcastChannel) {
            initBroadcastChannel();
        }
        await self.clients.claim();
        logger.log(logPrefix, 'Service worker activated');
    })());
});

// Serve from precache; fall back to network.
self.addEventListener('fetch', event => {
    logger.debug(logPrefix, 'Fetching:', event.request.url);
    event.respondWith(handleAppCacheRequest(event));
});
