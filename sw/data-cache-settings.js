import { getSettings, setSettings } from './cache-db.js';
import { logger } from '../js-common/utils/logging.js';

const logPrefix = '[DATA-SETTINGS]';

/**
 * Get current engine enabled state (data caching state)
 * @returns {Promise<boolean>} True if engine is enabled, false otherwise
 */
export async function getEngineEnabled() {
    try {
        const settings = await getSettings();
        return settings.engineEnabled || false;
    } catch (error) {
        logger.error(logPrefix, 'Failed to get engine enabled state:', error);
        return false;
    }
}

/**
 * Set engine enabled state (data caching state)
 * @param {boolean} enabled - True to enable engine, false to disable
 * @returns {Promise<void>}
 */
export async function setEngineEnabled(enabled) {
    try {
        await setSettings({ engineEnabled: enabled });
        logger.info(logPrefix, `Engine enabled state set to: ${enabled}`);
    } catch (error) {
        logger.error(logPrefix, 'Failed to set engine enabled state:', error);
        throw error;
    }
}

/**
 * Enable data caching engine
 * @returns {Promise<void>}
 */
export async function enableEngine() {
    await setEngineEnabled(true);
}

/**
 * Disable data caching engine
 * @returns {Promise<void>}
 */
export async function disableEngine() {
    await setEngineEnabled(false);
}
