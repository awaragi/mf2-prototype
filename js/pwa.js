// PWA Control Script
import {logger} from '../js-common/utils/logging.js';
import {initNetworkMonitoring} from "./utils/network-monitor.js";
import {COMMANDS, EVENTS} from '../js-common/events.js';
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

/**
 * Initialize PWA functionality
 * @returns {Promise<void>}
 */
async function initPWA() {
    logger.debug(logPrefix, 'Initializing PWA Controller');
    await registerServiceWorker();
    initServiceWorkerMessaging();
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
 * Initialize Service Worker messaging
 */
function initServiceWorkerMessaging() {
    // Listen for broadcasts from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, payload } = event.data || {};
        logger.debug(logPrefix + ' EVT', type, payload);

        const handler = eventHandlers[type];
        if (handler) {
            handler(payload);
        } else {
            logger.debug(logPrefix, 'Unknown event type:', type);
        }
    });

    logger.debug(logPrefix, 'Service Worker messaging initialized');
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
 * Send fire-and-forget command to service worker
 * @param {string} command - Command type from COMMANDS
 * @param {Object} payload - Command payload
 */
function sendCommand(command, payload = {}) {
    const ctrl = navigator.serviceWorker.controller;
    if (!ctrl) {
        logger.warn(logPrefix, 'Service Worker not controlling page; command skipped:', command);
        return;
    }

    logger.debug(logPrefix, 'User requested:', command);
    ctrl.postMessage({
        type: command,
        payload: payload
    });
}

/**
 * Send command to service worker and wait for response
 * @param {string} command - Command type from COMMANDS
 * @param {Object} payload - Command payload
 * @returns {Promise<any>} Response from service worker
 */
function sendCommandAndWait(command, payload = {}) {
    return new Promise((resolve, reject) => {
        const post = () => {
            const ctrl = navigator.serviceWorker.controller;
            if (!ctrl) {
                reject(new Error('No Service Worker controller'));
                return;
            }

            const mc = new MessageChannel();
            mc.port1.onmessage = (event) => resolve(event.data);
            mc.port1.onmessageerror = reject;

            logger.debug(logPrefix, 'User requested (await):', command);
            ctrl.postMessage({ type: command, payload }, [mc.port2]);
        };

        if (navigator.serviceWorker.controller) {
            post();
        } else {
            navigator.serviceWorker.ready.then(() => {
                if (navigator.serviceWorker.controller) {
                    post();
                } else {
                    reject(new Error('Service Worker not controlling this page yet'));
                }
            });
        }
    });
}

/**
 * Request cache status from service worker
 */
async function requestCacheStatus() {
    try {
        const response = await sendCommandAndWait(COMMANDS.CACHE_STATUS);
        if (response.ok) {
            // Status will be broadcast to all pages via SW message
            logger.debug(logPrefix, 'Cache status retrieved:', response.status);
        } else {
            logger.error(logPrefix, 'Failed to get cache status:', response.error);
        }
    } catch (error) {
        logger.error(logPrefix, 'Cache status request failed:', error);
    }
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
    sendCommandAndWait,
    requestCacheStatus,
    toggleDataCaching,
    cacheAllData,
    cachePresentationData,
    nukeDataCache
};
