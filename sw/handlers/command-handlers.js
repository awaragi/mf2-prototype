import {logger} from '../../js-common/utils/logging.js';
import {EVENTS} from '../../js-common/events.js';
import { getEngineEnabled } from '../data-cache-settings.js';

const logPrefix = '[SW-HANDLER]';

/**
 * Get current status for both app and data caching
 * @returns {Promise<Object>} Status object
 */
export async function getCurrentStatus() {
    const engineEnabled = await getEngineEnabled();
    return {
        app: { state: 'active' }, // App caching is always active when SW is running
        data: { 
            state: engineEnabled ? 'active' : 'off',
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
export async function handleActivateDataCaching(broadcastChannel, payload) {
    logger.debug(logPrefix, 'Activate data caching requested');
    try {
        const { enableEngine } = await import('../data-cache-settings.js');
        await enableEngine();
        const status = await getCurrentStatus();
        sendEvent(broadcastChannel, EVENTS.STATUS, status);
    } catch (error) {
        logger.error(logPrefix, 'Failed to activate data caching:', error);
    }
}

/**
 * Handle deactivate data caching command
 * @param {BroadcastChannel} broadcastChannel
 * @param {Object} payload
 */
export async function handleDeactivateDataCaching(broadcastChannel, payload) {
    logger.debug(logPrefix, 'Deactivate data caching requested');
    try {
        const { disableEngine } = await import('../data-cache-settings.js');
        await disableEngine();
        const status = await getCurrentStatus();
        sendEvent(broadcastChannel, EVENTS.STATUS, status);
    } catch (error) {
        logger.error(logPrefix, 'Failed to deactivate data caching:', error);
    }
}

/**
 * Handle cache status request
 * @param {BroadcastChannel} broadcastChannel
 * @param {Object} payload
 */
export async function handleCacheStatus(broadcastChannel, payload) {
    logger.debug(logPrefix, 'Cache status requested');
    try {
        const status = await getCurrentStatus();
        sendEvent(broadcastChannel, EVENTS.STATUS, status);
    } catch (error) {
        logger.error(logPrefix, 'Failed to get cache status:', error);
    }
}

/**
 * Handle cache all data command
 * @param {BroadcastChannel} broadcastChannel
 * @param {Object} payload
 */
export async function handleCacheDataAll(broadcastChannel, payload) {
    logger.debug(logPrefix, 'Cache all data requested');
    try {
        const status = await getCurrentStatus();
        sendEvent(broadcastChannel, EVENTS.STATUS, status);
    } catch (error) {
        logger.error(logPrefix, 'Failed to handle cache all data:', error);
    }
}

/**
 * Handle cache presentation data command
 * @param {BroadcastChannel} broadcastChannel
 * @param {Object} payload
 */
export async function handleCacheDataPresentation(broadcastChannel, payload) {
    logger.debug(logPrefix, 'Cache presentation data requested:', payload.id);
    try {
        const status = await getCurrentStatus();
        sendEvent(broadcastChannel, EVENTS.STATUS, status);
    } catch (error) {
        logger.error(logPrefix, 'Failed to handle cache presentation data:', error);
    }
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
