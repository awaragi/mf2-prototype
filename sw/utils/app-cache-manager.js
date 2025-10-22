// Cache Management Utility
// Handles app cache operations

const APP_CACHE_PREFIX = 'app-cache-v';

/**
 * Centralized function to clean up old app caches
 * @param {string} currentVersion - Current app version to keep
 * @param {Object} options - Options for logging
 * @returns {Promise<Object>} Cleanup results
 */
export async function cleanupOldAppCaches(currentVersion, options = {}) {
  const { logPrefix = '[SW]' } = options;

  try {
    const currentCacheName = `${APP_CACHE_PREFIX}${currentVersion}`;
    const cacheNames = await caches.keys();
    const oldAppCaches = cacheNames.filter(name =>
      name.startsWith(APP_CACHE_PREFIX) && name !== currentCacheName
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

/**
 * Centralized function to cache app assets
 * @param {Object} manifest - App manifest with files to cache
 * @param {Object} options - Caching options
 * @returns {Promise<Object>} Caching results
 */
export async function cacheAppAssets(manifest, options = {}) {
  const { forceRefresh = false, logPrefix = '[SW]', cleanupOld = false } = options;

  if (!manifest || !Array.isArray(manifest.files)) {
    throw new Error('Invalid manifest or app files not available');
  }

  const cacheName = `${APP_CACHE_PREFIX}${manifest.version}`;
  console.log(logPrefix, 'Opening app cache:', cacheName);

  const cache = await caches.open(cacheName);
  console.log(logPrefix, 'Caching app assets:', manifest.files);

  // Cache assets with individual error handling
  const cachePromises = manifest.files.map(async (url) => {
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
    cleanupResult = await cleanupOldAppCaches(manifest.version, { logPrefix });
  }

  return {
    cacheName,
    successful,
    failed,
    total: manifest.files.length,
    results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
    cleanup: cleanupResult
  };
}

/**
 * Get app cache name for a given version
 * @param {string} version - App version
 * @returns {string} Cache name
 */
export function getAppCacheName(version) {
    return version ? `${APP_CACHE_PREFIX}${version}` : '';
}

/**
 * Get all app cache names
 * @returns {Promise<string[]>} Array of app cache names
 */
export async function getAppCacheNames() {
  const cacheNames = await caches.keys();
  return cacheNames.filter(name => name.startsWith(APP_CACHE_PREFIX));
}
