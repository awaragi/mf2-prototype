import {logger} from '../../js-common/utils/logging.js';

const logPrefix = '[SW-HANDLER]';

/**
 * Get current status for caching model
 * @returns {Promise<Object>} Status object
 */
export async function getCurrentStatus() {
    return {
        enabled: true,
    };
}
