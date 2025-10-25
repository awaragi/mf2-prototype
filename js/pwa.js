// PWA Control Script
import {logger} from '../js-common/utils/logging.js';
import {initNetworkMonitoring} from "./utils/network-monitor.js";

const SERVICE_WORKER_SCRIPT = '/sw.js';
const logPrefix = '[PWA]';

// PWA state variables
let registration = null;

// UI: network status indicator helper
function updateNetworkIndicators(isOnline) {
    const nodes = document.querySelectorAll('[data-network-indicator]');
    nodes.forEach(node => {
        const icon = isOnline ? 'bi-wifi' : 'bi-wifi-off';
        const label = isOnline ? 'Online' : 'Offline';
        node.innerHTML = `<i class="bi ${icon}"></i>`;
        node.setAttribute('title', label);
        node.setAttribute('aria-label', `Network status: ${label}`);
    });
}

/**
 * Initialize PWA functionality
 * @returns {Promise<void>}
 */
async function initPWA() {
    logger.debug(logPrefix, 'Initializing PWA Controller');
    await registerServiceWorker();

    // Network UI: reflect initial status and subscribe to changes
    updateNetworkIndicators(navigator.onLine);
    window.addEventListener('online', () => updateNetworkIndicators(true));
    window.addEventListener('offline', () => updateNetworkIndicators(false));
    window.addEventListener('networkchange', (e) => {
        try {
            updateNetworkIndicators(!!e.detail?.isOnline);
        } catch (err) {
            // no-op
        }
    });
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
};
