import {logger} from '../../js-common/utils/logging.js';
import {EVENTS} from '../../js-common/events.js';
import {disableEngine, enableEngine, getEngineEnabled} from '../data-cache-settings.js';
import { startEngine, stopEngine } from '../data-cache-engine.js';

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

// Global reference to broadcast function (set by SW)
let broadcastToPages = null;

/**
 * Set the broadcast function for sending events to pages
 * @param {Function} broadcastFn - Function to broadcast messages to all pages
 */
export function setBroadcastFunction(broadcastFn) {
    broadcastToPages = broadcastFn;
}

/**
 * Send event to all pages
 * @param {string} eventType - Event type from EVENTS
 * @param {Object} payload - Event payload
 */
async function sendEvent(eventType, payload = {}) {
    if (broadcastToPages) {
        await broadcastToPages({
            type: eventType,
            payload: payload
        });
    }
}

/**
 * Handle activate data caching command
 * @param {Object} payload
 */
export async function handleActivateDataCaching(payload) {
    logger.debug(logPrefix, 'Activate data caching requested');
    try {
        await enableEngine();
        // Start the data cache engine immediately when manually activated
        await startEngine(false);
        const status = await getCurrentStatus();
        await sendEvent(EVENTS.STATUS, status);
    } catch (error) {
        logger.error(logPrefix, 'Failed to activate data caching:', error);
    }
}

/**
 * Handle deactivate data caching command
 * @param {Object} payload
 */
export async function handleDeactivateDataCaching(payload) {
    logger.debug(logPrefix, 'Deactivate data caching requested');
    try {
        await disableEngine();
        // Stop the data cache engine immediately when manually deactivated
        await stopEngine();
        const status = await getCurrentStatus();
        await sendEvent(EVENTS.STATUS, status);
    } catch (error) {
        logger.error(logPrefix, 'Failed to deactivate data caching:', error);
    }
}

/**
 * Handle cache all data command
 * @param {Object} payload
 */
export async function handleCacheDataAll(payload) {
    logger.debug(logPrefix, 'Cache all data requested');
    try {
        const status = await getCurrentStatus();
        await sendEvent(EVENTS.STATUS, status);
    } catch (error) {
        logger.error(logPrefix, 'Failed to handle cache all data:', error);
    }
}

/**
 * Handle cache presentation data command
 * @param {Object} payload
 */
export async function handleCacheDataPresentation(payload) {
    logger.debug(logPrefix, 'Cache presentation data requested:', payload.id);
    try {
        const status = await getCurrentStatus();
        await sendEvent(EVENTS.STATUS, status);
    } catch (error) {
        logger.error(logPrefix, 'Failed to handle cache presentation data:', error);
    }
}

/**
 * Handle nuke data command
 * @param {Object} payload
 */
export async function handleNukeData(payload) {
    logger.debug(logPrefix, 'Nuke data requested');
    await sendEvent(EVENTS.NUKE_DATA_COMPLETE, {message: 'Data nuke not implemented yet'});
}
