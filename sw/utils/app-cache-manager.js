import {APP_CACHE} from '../../app-manifest.js';

const logPrefix = '[SW-CACHE-MANAGER]';

let APP_CACHE_PREFIX = 'app-assets-';
const CACHE_NAME = APP_CACHE_PREFIX + digest(JSON.stringify(APP_CACHE));

/**
 * Generate a hash for a string
 * @param str
 * @returns {string}
 */
export function digest(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16); // Convert to unsigned 32-bit hex
}

/**
 * Initialize the app cache
 * @returns {Promise<void>}
 */
export async function initCache() {
    await caches.open(CACHE_NAME);
    console.log(logPrefix, 'Cache opened:', CACHE_NAME);
    // Build Request objects so you can control cache mode if needed.
    const assets = Object.keys(APP_CACHE);
    await cacheAppAssets(CACHE_NAME, assets);
}

/**
 * caches app assets
 * @param cacheName
 * @param files
 * @param {Object} options - Caching options
 * @returns {Promise<Object>} Caching results
 */
async function cacheAppAssets(cacheName, files, options = {}) {
    const { forceRefresh = false, cleanupOld = false } = options;

    if (!files|| !Array.isArray(files)) {
        throw new Error('Invalid file list or app files not available');
    }

    console.log(logPrefix, 'Opening app cache:', cacheName);

    const cache = await caches.open(cacheName);
    console.log(logPrefix, 'Caching app assets:', files);

    // Cache assets with individual error handling
    const cachePromises = files.map(async (url) => {
        try {
            const fetchOptions = forceRefresh ? { cache: 'no-cache' } : {};
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.status}`);
            }

            await cache.put(url, response);
            console.log(logPrefix, forceRefresh ? 'Updated app cache for:' : 'Added to app cache:', url);

            return { url, success: true };
        } catch (error) {
            console.error(logPrefix, forceRefresh ? 'Failed to update app cache for:' : 'Failed to add to app cache:', url, error.message);
            return { url, success: false, error: error.message };
        }
    });

    const results = await Promise.allSettled(cachePromises);

    // Count successful and failed operations
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    console.log(logPrefix, `App cache operation completed: ${successful} successful, ${failed} failed`);

    let cleanupResult = null;
    if (cleanupOld) {
        cleanupResult = await cleanupOldAppCaches(version);
    }

    return {
        cacheName,
        successful,
        failed,
        total: files.length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
        cleanup: cleanupResult
    };
}

/**
 * Centralized function to clean up old app caches
 * @returns {Promise<Object>} Cleanup results
 */
export async function cleanupOldAppCaches() {
    try {
        const cacheNames = await caches.keys();
        const oldAppCaches = cacheNames.filter(name =>
            name.startsWith(APP_CACHE_PREFIX) && name !== CACHE_NAME
        );

        if (oldAppCaches.length === 0) {
            console.log(logPrefix, 'No old app caches to delete');
            return { deleted: [], failed: [] };
        }

        console.log(logPrefix, 'Deleting old app caches:', oldAppCaches);

        const deletionResults = await Promise.allSettled(
            oldAppCaches.map(async (cacheName) => {
                try {
                    const deleted = await caches.delete(cacheName);
                    console.log(logPrefix, 'Deleted old app cache:', cacheName, deleted ? 'success' : 'failed');
                    return { cacheName, deleted };
                } catch (error) {
                    console.error(logPrefix, 'Failed to delete app cache:', cacheName, error);
                    return { cacheName, deleted: false, error: error.message };
                }
            })
        );

        const deleted = deletionResults
            .filter(result => result.status === 'fulfilled' && result.value.deleted)
            .map(result => result.value.cacheName);

        const failed = deletionResults
            .filter(result => result.status === 'rejected' || !result.value.deleted)
            .map(result => result.value?.cacheName || 'unknown');

        if (failed.length > 0) {
            console.warn(logPrefix, 'Some app caches could not be deleted:', failed);
        }

        console.log(logPrefix, `App cache cleanup completed: ${deleted.length} deleted, ${failed.length} failed`);

        return { deleted, failed };
    } catch (error) {
        console.error(logPrefix, 'App cache cleanup failed:', error);
        return { deleted: [], failed: [], error: error.message };
    }
}
