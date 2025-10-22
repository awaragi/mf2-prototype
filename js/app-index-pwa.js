// PWA functionality for index page - cache status and toggle controls

import { toggleDataCaching, requestCacheStatus } from './pwa.js';
import { EVENTS, CHANNEL_NAME } from '../js-common/events.js';

const logPrefix = '[INDEX-PWA]';

// DOM elements
let cacheStatusElement = null;
let cacheToggleButton = null;
let broadcastChannel = null;

// Cache state persistence key
const CACHE_STATE_KEY = 'pwa-cache-state';

// Default cache state
const DEFAULT_CACHE_STATE = {
    enabled: false,
    state: 'off'
};

/**
 * Get current cache state from localStorage
 */
function getCurrentCacheState() {
    try {
        const stored = localStorage.getItem(CACHE_STATE_KEY);
        return stored ? JSON.parse(stored) : DEFAULT_CACHE_STATE;
    } catch (error) {
        console.warn(logPrefix, 'Error reading cache state from localStorage:', error);
        return DEFAULT_CACHE_STATE;
    }
}

/**
 * Save cache state to localStorage
 */
function saveCacheState(state) {
    try {
        localStorage.setItem(CACHE_STATE_KEY, JSON.stringify(state));
        console.log(logPrefix, 'Cache state saved to localStorage:', state);
    } catch (error) {
        console.warn(logPrefix, 'Error saving cache state to localStorage:', error);
    }
}

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

    // Load cache state from localStorage
    const currentState = getCurrentCacheState();
    console.log(logPrefix, 'Loaded cache state from localStorage:', currentState);

    // Set up event listeners
    cacheToggleButton.addEventListener('click', handleCacheToggle);

    // Initialize broadcast channel for receiving status updates
    initBroadcastChannel();

    // Update UI with loaded state
    updateCacheStatus(currentState);

    // Notify service worker of current state and request it to act accordingly
    setTimeout(() => {
        if (currentState.enabled) {
            console.log(logPrefix, 'Notifying service worker to activate caching based on stored state');
            toggleDataCaching(true);
        } else {
            console.log(logPrefix, 'Requesting current cache status from service worker');
            requestCacheStatus();
        }
    }, 100); // Small delay to ensure PWA is initialized
}

/**
 * Initialize BroadcastChannel for receiving PWA events
 */
function initBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') {
        console.warn(logPrefix, 'BroadcastChannel not supported');
        return;
    }

    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.addEventListener('message', handlePWAEvent);
    console.log(logPrefix, 'BroadcastChannel initialized for status updates');
}

/**
 * Handle PWA events from service worker
 */
function handlePWAEvent(event) {
    const { type, payload } = event.data;

    if (type === EVENTS.STATUS) {
        updateCacheStatus(payload);
    }
}

/**
 * Handle cache toggle button click
 */
function handleCacheToggle() {
    const currentState = getCurrentCacheState();
    console.log(logPrefix, 'Cache toggle clicked, current state:', currentState);

    // Disable button during toggle
    cacheToggleButton.disabled = true;

    // Toggle caching state
    const newEnabled = !currentState.enabled;

    // Update localStorage state immediately
    const newState = {
        enabled: newEnabled,
        state: newEnabled ? 'partial' : 'off'
    };
    saveCacheState(newState);

    // Send toggle command to service worker
    toggleDataCaching(newEnabled);

    // Update UI immediately for responsiveness
    updateToggleButton(newEnabled ? 'enabling' : 'disabling');

    // Simulate completion after a short delay (temporary until real SW responds)
    setTimeout(() => {
        const finalState = {
            enabled: newEnabled,
            state: newEnabled ? 'full' : 'off'
        };
        saveCacheState(finalState);
        updateCacheStatus(finalState);
    }, 1000);
}

/**
 * Update cache status display
 */
function updateCacheStatus(status) {
    console.debug(logPrefix, 'Updating cache status:', status);

        let newState;

        // Handle both direct state updates and service worker payload format
        if (status.dataCaching) {
            // Service worker payload format
            newState = {
                enabled: status.dataCaching.enabled || false,
                state: status.dataCaching.state || 'off'
            };
        } else if (status.enabled !== undefined) {
            // Direct state format
            newState = {
                enabled: status.enabled,
                state: status.state || 'off'
            };
        } else {
            // Use current localStorage state
            newState = getCurrentCacheState();
        }

        // Save updated state to localStorage
        saveCacheState(newState);

        // Update status badge
        if (cacheStatusElement) {
            const { enabled, state } = newState;
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

    const { enabled, state } = getCurrentCacheState();

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
