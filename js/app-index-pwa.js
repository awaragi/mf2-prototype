// PWA functionality for index page - cache status and toggle controls

import { toggleDataCaching, requestCacheStatus } from './pwa.js';
import { EVENTS } from '../js-common/events.js';

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
    console.log(logPrefix, 'Initializing index PWA controls');

    // Get DOM elements
    cacheStatusElement = document.getElementById('cache-status');
    cacheToggleButton = document.getElementById('cache-toggle');

    if (!cacheStatusElement || !cacheToggleButton) {
        console.warn(logPrefix, 'Cache control elements not found');
        return;
    }

    // Set up event listeners
    cacheToggleButton.addEventListener('click', handleCacheToggle);

    // Initialize service worker messaging for receiving status updates
    initServiceWorkerMessaging();

    // Update UI with current state (will be updated when service worker responds)
    updateCacheStatus(currentCacheState);

    // Always request current cache status from service worker
    setTimeout(() => {
        console.log(logPrefix, 'Requesting current cache status from service worker');
        requestCacheStatus();
    }, 100); // Small delay to ensure PWA is initialized
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

    console.log(logPrefix, 'Service Worker messaging initialized for status updates');
}

/**
 * Handle cache toggle button click
 */
function handleCacheToggle() {
    console.log(logPrefix, 'Cache toggle clicked, current state:', currentCacheState);

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
    console.debug(logPrefix, 'Updating cache status:', status);

    // Handle both direct state updates and service worker payload format
    if (status.dataCaching) {
        // Service worker payload format
        currentCacheState = {
            enabled: status.dataCaching.enabled || false,
            state: status.dataCaching.state || 'off'
        };
    } else if (status.enabled !== undefined) {
        // Direct state format
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
