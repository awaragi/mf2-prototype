// PWA functionality for index page - cache status and toggle controls

import { toggleDataCaching, requestCacheStatus } from './pwa.js';
import { EVENTS } from '../js-common/events.js';
import {logger} from "../js-common/utils/logging";

const logPrefix = '[INDEX-PWA]';

// DOM elements
let cacheStatusElement = null;
let cacheToggleButton = null;

// Current cache state (updated from service worker)
let currentCacheState = {
    enabled: false,
    state: 'off'
};

/**
 * Initialize PWA controls for index page
 */
function initIndexPWA() {
    logger.log(logPrefix, 'Initializing index PWA controls');

    // Get DOM elements
    cacheStatusElement = document.getElementById('cache-status');
    cacheToggleButton = document.getElementById('cache-toggle');

    if (!cacheStatusElement || !cacheToggleButton) {
        logger.warn(logPrefix, 'Cache control elements not found');
        return;
    }

    // Set up event listeners
    cacheToggleButton.addEventListener('click', handleCacheToggle);

    // Initialize service worker messaging for receiving status updates
    initServiceWorkerMessaging();

    // Update UI with current state (will be updated when service worker responds)
    updateCacheStatus(currentCacheState);

    // Always request current cache status from service worker
    setTimeout(async () => {
        logger.log(logPrefix, 'Requesting current cache status from service worker');
        try {
            currentCacheState = await requestCacheStatus();
            updateCacheStatus(currentCacheState);
        } catch (error) {
            logger.warn(logPrefix, 'Failed to get initial cache status:', error.message);
            // Set a fallback status if service worker isn't ready
            updateCacheStatus({ enabled: false, state: 'off' });
        }
    }, 500); // Increased delay to allow PWA initialization
}

/**
 * Initialize Service Worker messaging for receiving PWA events
 */
function initServiceWorkerMessaging() {
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, payload } = event.data || {};

        if (type === EVENTS.STATUS) {
            updateCacheStatus(payload);
        }
    });

    logger.log(logPrefix, 'Service Worker messaging initialized for status updates');
}

/**
 * Handle cache toggle button click
 */
function handleCacheToggle() {
    logger.log(logPrefix, 'Cache toggle clicked, current state:', currentCacheState);

    // Disable button during toggle
    cacheToggleButton.disabled = true;

    // Toggle caching state
    const newEnabled = !currentCacheState.enabled;

    // Send toggle command to service worker
    toggleDataCaching(newEnabled);

    // Update UI immediately for responsiveness
    updateToggleButton(newEnabled ? 'enabling' : 'disabling');

    // Wait for service worker to respond with actual status update
    // The UI will be updated when the service worker broadcasts the new status
}

/**
 * Update cache status display
 */
function updateCacheStatus(status) {
    logger.debug(logPrefix, 'Updating cache status:', status);

    // Handle service worker payload format { app, data }
    if (status.data) {
        // Service worker payload format
        const isActive = status.data.state === 'active';
        const progress = status.data.progress ? status.data.progress.overall : 0;

        let state = 'off';
        if (isActive) {
            if (progress >= 100) {
                state = 'full';
            } else if (progress > 0) {
                state = 'partial';
            } else {
                state = 'partial'; // Active but no progress yet means starting/partial
            }
        }

        currentCacheState = {
            enabled: isActive,
            state: state
        };
    } else if (status.enabled !== undefined) {
        // Direct state format (for backward compatibility)
        currentCacheState = {
            enabled: status.enabled,
            state: status.state || 'off'
        };
    }

    // Update status badge
    if (cacheStatusElement) {
        const { enabled, state } = currentCacheState;
        let badgeClass = 'bg-secondary';
        let statusText = 'Cache: Unknown';

        if (enabled) {
            switch (state) {
                case 'full':
                    badgeClass = 'bg-success';
                    statusText = 'Cache: Ready';
                    break;
                case 'partial':
                    badgeClass = 'bg-warning';
                    statusText = 'Cache: Updating';
                    break;
                default:
                    badgeClass = 'bg-info';
                    statusText = 'Cache: Starting';
                    break;
            }
        } else {
            badgeClass = 'bg-secondary';
            statusText = 'Cache: Disabled';
        }

        cacheStatusElement.className = `badge ${badgeClass}`;
        cacheStatusElement.textContent = statusText;
    }

    // Update toggle button
    updateToggleButton();
}

/**
 * Update toggle button state
 */
function updateToggleButton(transitionState = null) {
    if (!cacheToggleButton) return;

    const { enabled, state } = currentCacheState;

    // Handle transition states
    if (transitionState) {
        cacheToggleButton.disabled = true;
        cacheToggleButton.innerHTML = transitionState === 'enabling' 
            ? '<i class="bi bi-hourglass-split"></i> Enabling...'
            : '<i class="bi bi-hourglass-split"></i> Disabling...';
        return;
    }

    // Update based on current state
    cacheToggleButton.disabled = false;

    if (enabled) {
        cacheToggleButton.className = 'btn btn-outline-danger btn-sm';
        cacheToggleButton.innerHTML = '<i class="bi bi-cloud-slash"></i> Disable Offline';
    } else {
        cacheToggleButton.className = 'btn btn-outline-primary btn-sm';
        cacheToggleButton.innerHTML = '<i class="bi bi-cloud-download"></i> Enable Offline';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIndexPWA);
} else {
    initIndexPWA();
}
