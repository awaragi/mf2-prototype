import {logger} from "../../js-common/utils/logging.js";

const logPrefix = '[NETWORK-MONITOR]';
let online = false;

/**
 * Set up network monitoring
 */
export function initNetworkMonitoring() {
    // Initial network status
    online = navigator.onLine;
    logger.log(logPrefix, 'Network:', online ? 'online' : 'offline');

    // Listen for network changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

}
/**
 * Handle online event
 */
function handleOnline() {
    online = true;
    logger.log(logPrefix, 'Network: online');
    onNetworkChange('online');
}

/**
 * Handle offline event
 */
function handleOffline() {
    online = false;
    logger.log(logPrefix, 'Network: offline');
    onNetworkChange('offline');
}

/**
 * Handle network status change
 * @param {string} status - Network status ('online' or 'offline')
 */
function onNetworkChange(status) {
    // Dispatch custom event for other parts of the app to listen to
    const event = new CustomEvent('networkchange', {
        detail: { status, isOnline: status === 'online' }
    });
    window.dispatchEvent(event);
}

