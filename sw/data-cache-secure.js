import { openDB, putAsset as dbPutAsset, getAsset as dbGetAsset, deleteAsset as dbDeleteAsset, creditUrl, getProgress, setProgress, markPresentationComplete } from './cache-db.js';
import { encrypt, decrypt, createBlobFromDecrypted, initCrypto } from './crypto.js';
import { KEY_VERSION, DEFAULT_TTL_SECONDS, MAX_ASSET_SIZE } from './constants.js';
import {logger} from "../js-common/utils/logging";

const logPrefix = '[DATA-CACHE]';

let dbReady = false;
let cryptoReady = false;
let initPromise = null; // Track ongoing initialization

/**
 * Initialize the secure data cache (internal, auto-called)
 */
async function initSecureCache() {
  try {
    await openDB();
    dbReady = true;
    logger.debug(logPrefix, 'Database ready');

    await initCrypto();
    cryptoReady = true;
    logger.debug(logPrefix, 'Crypto ready');

    return true;
  } catch (error) {
    logger.error(logPrefix, 'Initialization failed:', error);
    throw error;
  }
}

/**
 * Ensure secure cache is initialized (auto-initialization helper)
 */
async function ensureInitialized() {
  if (dbReady && cryptoReady) {
    return true;
  }

  // Prevent multiple concurrent initializations
  if (!initPromise) {
    initPromise = initSecureCache();
  }

  try {
    await initPromise;
    return true;
  } catch (error) {
    initPromise = null; // Reset on failure to allow retry
    throw error;
  }
}

/**
 * Manual initialization (optional - for explicit control)
 */
export async function init() {
  return await ensureInitialized();
}

/**
 * Parse HTTP cache headers to determine expiration time
 */
function parseExpiration(headers) {
  try {
    // Check Cache-Control header first
    const cacheControl = headers.get('cache-control');
    if (cacheControl) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1]);
        return Date.now() + (maxAge * 1000);
      }
    }

    // Fallback to Expires header
    const expires = headers.get('expires');
    if (expires) {
      const expiresDate = new Date(expires);
      if (!isNaN(expiresDate.getTime())) {
        return expiresDate.getTime();
      }
    }

    // Default TTL
    return Date.now() + (DEFAULT_TTL_SECONDS * 1000);
  } catch (error) {
      logger.warn(logPrefix, 'Could not parse expiration, using default TTL');
      return Date.now() + (DEFAULT_TTL_SECONDS * 1000);
  }
}

/**
 * Cache an asset with encryption and TTL handling
 * @param {string} url - Asset URL
 * @param {Response} response - Fetch response
 * @param {Array<string>} presentationIds - IDs of presentations that reference this asset
 * @returns {Promise<boolean>} Success status
 */
export async function cacheAsset(url, response, presentationIds = []) {
  try {
    await ensureInitialized();
  } catch (error) {
    logger.error(logPrefix, 'Failed to initialize cache for cacheAsset');
    return false;
  }

  try {
    const data = await response.arrayBuffer();

    // Check asset size limit
    if (data.byteLength > MAX_ASSET_SIZE) {
        logger.warn(logPrefix, `Asset too large: ${url} (${data.byteLength} bytes)`);
        return false;
    }

    const type = response.headers.get('content-type') || 'application/octet-stream';
    const expiresAt = parseExpiration(response.headers);

    // Encrypt the asset data
    const encryptedData = await encrypt(data, KEY_VERSION, type);

    // Store encrypted data with metadata
    const assetRecord = {
      url,
      data: encryptedData, // This contains {iv, ct, type, keyVersion}
      type,
      timestamp: Date.now(),
      expiresAt,
      keyVersion: KEY_VERSION
    };

    await dbPutAsset(url, assetRecord.data, type, assetRecord.timestamp, assetRecord.expiresAt, assetRecord.keyVersion);

    // Credit this asset to all referencing presentations
    for (const presentationId of presentationIds) {
      await creditUrl(presentationId, url);
    }

      logger.debug(logPrefix, `Cached asset: ${url} (${data.byteLength} bytes, expires: ${new Date(expiresAt).toISOString()})`);
      return true;
  } catch (error) {
      logger.error(logPrefix, `Failed to cache asset ${url}:`, error);
      return false;
  }
}

/**
 * Retrieve and decrypt a cached asset
 * @param {string} url - Asset URL
 * @returns {Promise<Blob|null>} Decrypted asset as Blob, or null if not found/expired
 */
export async function retrieveAsset(url) {
  try {
    await ensureInitialized();
  } catch (error) {
    logger.error(logPrefix, 'Failed to initialize cache for retrieveAsset');
    return null;
  }

  try {
    const assetRecord = await dbGetAsset(url);
    if (!assetRecord) {
        logger.debug(logPrefix, `Asset not found: ${url}`);
        return null;
    }

    // Check if asset is expired
    if (assetRecord.expiresAt && assetRecord.expiresAt < Date.now()) {
        logger.debug(logPrefix, `Asset expired: ${url}`);
        // Don't delete here - let TTL sweep handle cleanup
      return null;
    }

    // Decrypt the asset data
    const decryptedData = await decrypt(assetRecord.data);
    if (!decryptedData) {
        logger.error(logPrefix, `Failed to decrypt asset: ${url}`);
        // Asset may be corrupted, mark for deletion
      await dbDeleteAsset(url);
      return null;
    }

    // Create blob with original type
    const blob = createBlobFromDecrypted(decryptedData, assetRecord.type);
      logger.debug(logPrefix, `Retrieved asset: ${url} (${blob.size} bytes)`);

      return blob;
  } catch (error) {
      logger.error(logPrefix, `Failed to retrieve asset ${url}:`, error);
      return null;
  }
}

/**
 * Check if an asset exists and is fresh
 * @param {string} url - Asset URL
 * @returns {Promise<boolean>} True if asset exists and is not expired
 */
export async function isAssetFresh(url) {
  try {
    await ensureInitialized();
  } catch (error) {
    logger.error(logPrefix, 'Failed to initialize cache for isAssetFresh');
    return false;
  }

  try {
    const assetRecord = await dbGetAsset(url);
    if (!assetRecord) return false;

    return !assetRecord.expiresAt || assetRecord.expiresAt > Date.now();
  } catch (error) {
      logger.error(logPrefix, `Failed to check asset freshness ${url}:`, error);
      return false;
  }
}

/**
 * Remove expired assets and update presentation progress
 * @returns {Promise<number>} Number of assets cleaned up
 */
export async function cleanupExpiredAssets() {
  try {
    await ensureInitialized();
  } catch (error) {
    logger.error(logPrefix, 'Failed to initialize cache for cleanupExpiredAssets');
    return 0;
  }

  try {
    const now = Date.now();
    const expiredUrls = await getExpiredAssets(now);

    if (expiredUrls.length === 0) {
        logger.debug(logPrefix, 'No expired assets to clean up');
        return 0;
    }

    // Delete expired assets
    for (const url of expiredUrls) {
      await dbDeleteAsset(url);
    }

    // Update presentation progress - this would need to be implemented
    // based on how we track which presentations are affected

      logger.debug(logPrefix, `Cleaned up ${expiredUrls.length} expired assets`);
      return expiredUrls.length;
  } catch (error) {
      logger.error(logPrefix, 'Failed to cleanup expired assets:', error);
      return 0;
  }
}

/**
 * Get basic cache statistics
 * @returns {Promise<Object>} Cache stats
 */
export async function getCacheStats() {
  try {
    await ensureInitialized();
  } catch (error) {
    logger.error(logPrefix, 'Failed to initialize cache for getCacheStats');
    return { assetCount: 0, totalSize: 0 };
  }

  try {
    // This would need to be implemented based on cache-db.js capabilities
    // For now, return basic structure
    return {
      assetCount: 0,
      totalSize: 0,
      expiredCount: 0,
      keyVersion: KEY_VERSION
    };
  } catch (error) {
      logger.error(logPrefix, 'Failed to get cache stats:', error);
      return { assetCount: 0, totalSize: 0 };
  }
}

// Re-export progress tracking functions
export { creditUrl, getProgress, setProgress, markPresentationComplete };

// Helper function to get expired assets (would need to be implemented in cache-db.js)
async function getExpiredAssets(now) {
  // This is a placeholder - the actual implementation would need
  // to query the assets store for records where expiresAt < now
  return [];
}
