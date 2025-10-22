// PWA Control Script
import {logger} from '../js-common/utils/logging.js';
import {initNetworkMonitoring} from "./utils/network-monitor.js";
import {COMMANDS, EVENTS, CHANNEL_NAME} from '../js-common/events.js';
import {
    handleStatusEvent,
    handleDataCachingProgressEvent,
    handlePresentationProgressEvent,
    handlePresentationCompleteEvent,
    handleDataCachingCompleteEvent,
    handleContentRefreshEvent,
    handleNukeDataCompleteEvent
} from './handlers/event-handlers.js';

const SERVICE_WORKER_SCRIPT = '/sw.js';
const logPrefix = '[PWA]';

// PWA state variables
let registration = null;
let broadcastChannel = null;

/**
 * Initialize PWA functionality
 * @returns {Promise<void>}
 */
async function initPWA() {
    logger.debug(logPrefix, 'Initializing PWA Controller');
    await registerServiceWorker();
    initBroadcastChannel();
}

/**
 * Register service worker
 * @returns {Promise<void>}
 */
async function registerServiceWorker() {
    // Register service worker
    if (!('serviceWorker' in navigator)) {
        logger.warn(logPrefix, 'Service workers not supported');
        return;
    }

    try {
        registration = await navigator.serviceWorker.register(SERVICE_WORKER_SCRIPT, {type: 'module', scope: '/'});
        logger.log(logPrefix, 'SW registered with scope:', registration.scope);

        handleServiceWorkerControllerChange();

        // Add this after service worker registration
        navigator.serviceWorker.addEventListener('controllerchange', handleServiceWorkerControllerChange);
    } catch (error) {
        logger.error(logPrefix, 'Service worker registration failed:', error);
    }
}

/**
 * Handle when a new service worker takes control
 */
function handleServiceWorkerControllerChange() {
    if (navigator.serviceWorker.controller) {
        logger.log(logPrefix, 'Service worker took control', navigator.serviceWorker.controller.scriptURL);
    } else {
        logger.warn(logPrefix, 'Service worker control lost');
    }
}

/**
 * Initialize BroadcastChannel for PWA messaging
 */
function initBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') {
        logger.warn(logPrefix, 'BroadcastChannel not supported');
        return;
    }

    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.addEventListener('message', handleBroadcastMessage);
    logger.debug(logPrefix, 'BroadcastChannel initialized');
}

// Event handler dictionary
const eventHandlers = {
    [EVENTS.STATUS]: handleStatusEvent,
    [EVENTS.DATA_CACHING_PROGRESS]: handleDataCachingProgressEvent,
    [EVENTS.DATA_CACHING_PRESENTATION_PROGRESS]: handlePresentationProgressEvent,
    [EVENTS.DATA_CACHING_PRESENTATION_COMPLETE]: handlePresentationCompleteEvent,
    [EVENTS.DATA_CACHING_COMPLETE]: handleDataCachingCompleteEvent,
    [EVENTS.CONTENT_REFRESH_RECOMMENDED]: handleContentRefreshEvent,
    [EVENTS.NUKE_DATA_COMPLETE]: handleNukeDataCompleteEvent
};

/**
 * Handle incoming broadcast messages from service worker
 * @param {MessageEvent} event
 */
function handleBroadcastMessage(event) {
    const {type, payload} = event.data;
    logger.debug(logPrefix + ' EVT', type, payload);

    const handler = eventHandlers[type];
    if (handler) {
        handler(payload);
    } else {
        logger.debug(logPrefix, 'Unknown event type:', type);
    }
}

/**
 * Send command to service worker
 * @param {string} command - Command type from COMMANDS
 * @param {Object} payload - Command payload
 */
function sendCommand(command, payload = {}) {
    if (!broadcastChannel) {
        logger.warn(logPrefix, 'BroadcastChannel not available');
        return;
    }

    logger.debug(logPrefix, 'User requested:', command);
    broadcastChannel.postMessage({
        type: command,
        payload: payload
    });
}

/**
 * Request cache status from service worker
 */
function requestCacheStatus() {
    sendCommand(COMMANDS.CACHE_STATUS);
}

/**
 * Toggle data caching
 * @param {boolean} enable
 */
function toggleDataCaching(enable) {
    const command = enable ? COMMANDS.ACTIVATE_DATA_CACHING : COMMANDS.DEACTIVATE_DATA_CACHING;
    sendCommand(command);
}

/**
 * Cache all data (presentations and attachments)
 */
function cacheAllData() {
    sendCommand(COMMANDS.CACHE_DATA_ALL);
}

/**
 * Cache specific presentation data
 * @param {string} presentationId
 */
function cachePresentationData(presentationId) {
    sendCommand(COMMANDS.CACHE_DATA_PRESENTATION, { id: presentationId });
}

/**
 * Clear all data caches
 */
function nukeDataCache() {
    sendCommand(COMMANDS.NUKE_DATA);
}

// Initialize PWA when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPWA);
    document.addEventListener('DOMContentLoaded', initNetworkMonitoring);
} else {
    initPWA().then(() => {});
    initNetworkMonitoring();
}

// Export functions for module usage
export {
    sendCommand,
    requestCacheStatus,
    toggleDataCaching,
    cacheAllData,
    cachePresentationData,
    nukeDataCache
};
