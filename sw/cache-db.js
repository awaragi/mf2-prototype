import '../assets/thirdparty/dexie.js';
import { DB_NAME, DB_VERSION, STORES, META_KEYS, DEFAULT_SETTINGS, ASSET_DEFAULTS } from './constants.js';
import {logger} from '../js-common/utils/logging.js';

const logPrefix = '[DB]';

const { Dexie } = self;

class CacheDB extends Dexie {
  constructor() {
    super(DB_NAME);

    // Define schema
    this.version(DB_VERSION).stores({
      [STORES.META]: '&key', // key-value store for settings
      [STORES.PROGRESS]: '&presentationId, expected, credited, complete', // progress tracking
      [STORES.ASSETS]: '&url, type, timestamp, expiresAt, keyVersion', // encrypted assets
      [STORES.ASSETS_INDEX]: '&[presentationId+url], presentationId, url' // presentation-asset mapping
    });

    // Define table references
    this.meta = this.table(STORES.META);
    this.progress = this.table(STORES.PROGRESS);
    this.assets = this.table(STORES.ASSETS);
    this.assetsIndex = this.table(STORES.ASSETS_INDEX);
  }
}

let dbInstance = null;

/**
 * Open database connection
 * @returns {Promise<CacheDB>}
 */
export async function openDB() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = new CacheDB();
    await dbInstance.open();
      logger.info(logPrefix, `opened version ${DB_VERSION}`);

      // Initialize default settings if not exists
    const existing = await dbInstance.meta.get(META_KEYS.SETTINGS);
    if (!existing) {
      await dbInstance.meta.put({ key: META_KEYS.SETTINGS, ...DEFAULT_SETTINGS });
        logger.info(logPrefix, 'initialized default settings');
    }

    return dbInstance;
  } catch (error) {
      logger.error(logPrefix, 'failed to open:', error);
      throw error;
  }
}

/**
 * Store encrypted asset
 * @param {string} url - Asset URL
 * @param {Object|Blob|ArrayBuffer} data - Asset data (encrypted object or raw data)
 * @param {string} type - MIME type
 * @param {number} expiresAt - Expiration timestamp
 * @param {number} keyVersion - Encryption key version
 * @returns {Promise<void>}
 */
export async function putAsset(url, data, type = ASSET_DEFAULTS.DEFAULT_TYPE, expiresAt = ASSET_DEFAULTS.TTL_INFINITY, keyVersion = 1) {
  try {
    const db = await openDB();
    const timestamp = Date.now();

    const asset = {
      url,
      data, // This will be encrypted object {iv, ct} or raw data
      type,
      timestamp,
      expiresAt,
      keyVersion
    };

    await db.assets.put(asset);
      logger.info(logPrefix, `putAsset → ${url}`);
  } catch (error) {
      logger.error(logPrefix, `putAsset failed for ${url}:`, error);
      throw error;
  }
}

/**
 * Retrieve asset
 * @param {string} url - Asset URL
 * @returns {Promise<Object|null>} Asset data or null if not found
 */
export async function getAsset(url) {
  try {
    const db = await openDB();
    const asset = await db.assets.get(url);

    if (asset) {
        logger.info(logPrefix, `getAsset → ${url}`);
        return asset;
    } else {
        logger.info(logPrefix, `getAsset → ${url} (not found)`);
        return null;
    }
  } catch (error) {
      logger.error(logPrefix, `getAsset failed for ${url}:`, error);
      return null;
  }
}

/**
 * Delete asset
 * @param {string} url - Asset URL
 * @returns {Promise<void>}
 */
export async function deleteAsset(url) {
  try {
    const db = await openDB();
    await db.transaction('rw', [db.assets, db.assetsIndex], async () => {
      await db.assets.delete(url);
      await db.assetsIndex.where('url').equals(url).delete();
    });
      logger.info(logPrefix, `deleteAsset → ${url}`);
  } catch (error) {
      logger.error(logPrefix, `deleteAsset failed for ${url}:`, error);
      throw error;
  }
}

/**
 * Credit URL to presentation (mark as cached)
 * @param {string} presentationId - Presentation ID
 * @param {string} url - Asset URL
 * @returns {Promise<void>}
 */
export async function creditUrl(presentationId, url) {
  try {
    const db = await openDB();

    await db.transaction('rw', [db.assetsIndex, db.progress], async () => {
      // Add to assets index
      const indexKey = `${presentationId}+${url}`;
      await db.assetsIndex.put({
        'presentationId+url': indexKey,
        presentationId,
        url
      });

      // Update progress
      const progress = await db.progress.get(presentationId);
      if (progress) {
        const newCredited = progress.credited + 1;
        await db.progress.update(presentationId, { credited: newCredited });

        // Check if complete
        if (newCredited >= progress.expected) {
          await db.progress.update(presentationId, { complete: true });
        }
      }
    });

      logger.info(logPrefix, `creditUrl → ${presentationId} ${url}`);
  } catch (error) {
      logger.error(logPrefix, `creditUrl failed for ${presentationId} ${url}:`, error);
      throw error;
  }
}

/**
 * Get presentation progress
 * @param {string} presentationId - Presentation ID
 * @returns {Promise<Object|null>} Progress object or null
 */
export async function getProgress(presentationId) {
  try {
    const db = await openDB();
    const progress = await db.progress.get(presentationId);
    return progress || null;
  } catch (error) {
      logger.error(logPrefix, `getProgress failed for ${presentationId}:`, error);
      return null;
  }
}

/**
 * Set presentation progress
 * @param {string} presentationId - Presentation ID
 * @param {Object} progressObj - Progress object {expected, credited, complete}
 * @returns {Promise<void>}
 */
export async function setProgress(presentationId, progressObj) {
  try {
    const db = await openDB();
    const progress = {
      presentationId,
      expected: progressObj.expected || 0,
      credited: progressObj.credited || 0,
      complete: progressObj.complete || false
    };

    await db.progress.put(progress);
      logger.info(logPrefix, `setProgress → ${presentationId} (${progress.credited}/${progress.expected})`);
  } catch (error) {
      logger.error(logPrefix, `setProgress failed for ${presentationId}:`, error);
      throw error;
  }
}

/**
 * Mark presentation as complete
 * @param {string} presentationId - Presentation ID
 * @returns {Promise<void>}
 */
export async function markPresentationComplete(presentationId) {
  try {
    const db = await openDB();
    await db.progress.update(presentationId, { complete: true });
      logger.info(logPrefix, `markPresentationComplete → ${presentationId}`);
  } catch (error) {
      logger.error(logPrefix, `markPresentationComplete failed for ${presentationId}:`, error);
      throw error;
  }
}

/**
 * Get settings
 * @returns {Promise<Object>} Settings object
 */
export async function getSettings() {
  try {
    const db = await openDB();
    const settings = await db.meta.get(META_KEYS.SETTINGS);
    return settings ? { ...settings } : { ...DEFAULT_SETTINGS };
  } catch (error) {
      logger.error(logPrefix, 'getSettings failed:', error);
      return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Update settings
 * @param {Object} settingsObj - Settings to update
 * @returns {Promise<void>}
 */
export async function setSettings(settingsObj) {
  try {
    const db = await openDB();
    const current = await getSettings();
    const updated = { key: META_KEYS.SETTINGS, ...current, ...settingsObj };

    await db.meta.put(updated);
      logger.info(logPrefix, 'setSettings →', Object.keys(settingsObj));
  } catch (error) {
      logger.error(logPrefix, 'setSettings failed:', error);
      throw error;
  }
}

/**
 * Clear all data
 * @returns {Promise<void>}
 */
export async function clearAll() {
  try {
    const db = await openDB();
    await db.transaction('rw', [db.meta, db.progress, db.assets, db.assetsIndex], async () => {
      await db.meta.clear();
      await db.progress.clear();
      await db.assets.clear();
      await db.assetsIndex.clear();

      // Reinitialize default settings
      await db.meta.put({ key: META_KEYS.SETTINGS, ...DEFAULT_SETTINGS });
    });

      logger.info(logPrefix, 'clearAll → complete');
  } catch (error) {
      logger.error(logPrefix, 'clearAll failed:', error);
      throw error;
  }
}

/**
 * Get expired assets
 * @param {number} now - Current timestamp
 * @returns {Promise<Array>} Array of expired asset URLs
 */
export async function getExpiredAssets(now = Date.now()) {
  try {
    const db = await openDB();
    const expired = await db.assets
      .where('expiresAt')
      .below(now)
      .toArray();

    return expired.map(asset => asset.url);
  } catch (error) {
      logger.error(logPrefix, 'getExpiredAssets failed:', error);
      return [];
  }
}

/**
 * Delete multiple assets
 * @param {Array<string>} urls - Array of asset URLs to delete
 * @returns {Promise<void>}
 */
export async function deleteAssets(urls) {
  if (!urls || urls.length === 0) return;

  try {
    const db = await openDB();
    await db.transaction('rw', [db.assets, db.assetsIndex], async () => {
      await db.assets.where('url').anyOf(urls).delete();
      await db.assetsIndex.where('url').anyOf(urls).delete();
    });

      logger.info(logPrefix, `deleteAssets → ${urls.length} assets`);
  } catch (error) {
      logger.error(logPrefix, 'deleteAssets failed:', error);
      throw error;
  }
}

/**
 * Mark presentation as incomplete (for TTL cleanup)
 * @param {string} presentationId - Presentation ID
 * @returns {Promise<void>}
 */
export async function markPresentationIncomplete(presentationId) {
  try {
    const db = await openDB();
    await db.progress.update(presentationId, { complete: false });
      logger.info(logPrefix, `markPresentationIncomplete → ${presentationId}`);
  } catch (error) {
      logger.error(logPrefix, `markPresentationIncomplete failed for ${presentationId}:`, error);
      throw error;
  }
}
