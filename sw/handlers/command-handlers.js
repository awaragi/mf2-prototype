import {logger} from '../../js-common/utils/logging.js';
import {EVENTS} from '../../js-common/events.js';

const logPrefix = '[SW-HANDLER]';

/**
 * Get current status for both app and data caching
 * @returns {Object} Status object
 */
export function getCurrentStatus() {
    return {
        app: { state: 'active' }, // App caching is always active when SW is running
        data: { 
            state: 'off', // Engine will be implemented in later stages
            progress: {
                overall: 0,
                presentations: {}
            }
        }
    };
}

/**
 * Send event to app via BroadcastChannel
 * @param {BroadcastChannel} broadcastChannel
 * @param {string} eventType - Event type from EVENTS
 * @param {Object} payload - Event payload
 */
function sendEvent(broadcastChannel, eventType, payload = {}) {
    if (!broadcastChannel) {
        return;
    }

    broadcastChannel.postMessage({
        type: eventType,
        payload: payload
    });
}

/**
 * Handle activate data caching command
 * @param {BroadcastChannel} broadcastChannel
 * @param {Object} payload
 */
export function handleActivateDataCaching(broadcastChannel, payload) {
    logger.debug(logPrefix, 'Activate data caching requested');
    // Engine will be implemented in later stages
    sendEvent(broadcastChannel, EVENTS.STATUS, getCurrentStatus());
}

/**
 * Handle deactivate data caching command
 * @param {BroadcastChannel} broadcastChannel
 * @param {Object} payload
 */
export function handleDeactivateDataCaching(broadcastChannel, payload) {
    logger.debug(logPrefix, 'Deactivate data caching requested');
    sendEvent(broadcastChannel, EVENTS.STATUS, getCurrentStatus());
}

/**
 * Handle cache status request
 * @param {BroadcastChannel} broadcastChannel
 * @param {Object} payload
 */
export function handleCacheStatus(broadcastChannel, payload) {
    logger.debug(logPrefix, 'Cache status requested');
    sendEvent(broadcastChannel, EVENTS.STATUS, getCurrentStatus());
}

/**
 * Handle cache all data command
 * @param {BroadcastChannel} broadcastChannel
 * @param {Object} payload
 */
export function handleCacheDataAll(broadcastChannel, payload) {
    logger.debug(logPrefix, 'Cache all data requested');
    sendEvent(broadcastChannel, EVENTS.STATUS, getCurrentStatus());
}

/**
 * Handle cache presentation data command
 * @param {BroadcastChannel} broadcastChannel
 * @param {Object} payload
 */
export function handleCacheDataPresentation(broadcastChannel, payload) {
    logger.debug(logPrefix, 'Cache presentation data requested:', payload.id);
    sendEvent(broadcastChannel, EVENTS.STATUS, getCurrentStatus());
}

/**
 * Handle nuke data command
 * @param {BroadcastChannel} broadcastChannel
 * @param {Object} payload
 */
export function handleNukeData(broadcastChannel, payload) {
    logger.debug(logPrefix, 'Nuke data requested');
    sendEvent(broadcastChannel, EVENTS.NUKE_DATA_COMPLETE, {message: 'Data nuke not implemented yet'});
}
