import '../assets/thirdparty/dexie.js';
import { DB_NAME, DB_VERSION, STORES, META_KEYS, DEFAULT_SETTINGS, ASSET_DEFAULTS } from './constants.js';

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
    console.log(`[DB] opened version ${DB_VERSION}`);

    // Initialize default settings if not exists
    const existing = await dbInstance.meta.get(META_KEYS.SETTINGS);
    if (!existing) {
      await dbInstance.meta.put({ key: META_KEYS.SETTINGS, ...DEFAULT_SETTINGS });
      console.log('[DB] initialized default settings');
    }

    return dbInstance;
  } catch (error) {
    console.error('[DB] failed to open:', error);
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
    console.log(`[DB] putAsset → ${url}`);
  } catch (error) {
    console.error(`[DB] putAsset failed for ${url}:`, error);
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
      console.log(`[DB] getAsset → ${url}`);
      return asset;
    } else {
      console.log(`[DB] getAsset → ${url} (not found)`);
      return null;
    }
  } catch (error) {
    console.error(`[DB] getAsset failed for ${url}:`, error);
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
    console.log(`[DB] deleteAsset → ${url}`);
  } catch (error) {
    console.error(`[DB] deleteAsset failed for ${url}:`, error);
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

    console.log(`[DB] creditUrl → ${presentationId} ${url}`);
  } catch (error) {
    console.error(`[DB] creditUrl failed for ${presentationId} ${url}:`, error);
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
    console.error(`[DB] getProgress failed for ${presentationId}:`, error);
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
    console.log(`[DB] setProgress → ${presentationId} (${progress.credited}/${progress.expected})`);
  } catch (error) {
    console.error(`[DB] setProgress failed for ${presentationId}:`, error);
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
    console.log(`[DB] markPresentationComplete → ${presentationId}`);
  } catch (error) {
    console.error(`[DB] markPresentationComplete failed for ${presentationId}:`, error);
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
    console.error('[DB] getSettings failed:', error);
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
    console.log('[DB] setSettings →', Object.keys(settingsObj));
  } catch (error) {
    console.error('[DB] setSettings failed:', error);
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

    console.log('[DB] clearAll → complete');
  } catch (error) {
    console.error('[DB] clearAll failed:', error);
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
    console.error('[DB] getExpiredAssets failed:', error);
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

    console.log(`[DB] deleteAssets → ${urls.length} assets`);
  } catch (error) {
    console.error('[DB] deleteAssets failed:', error);
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
    console.log(`[DB] markPresentationIncomplete → ${presentationId}`);
  } catch (error) {
    console.error(`[DB] markPresentationIncomplete failed for ${presentationId}:`, error);
    throw error;
  }
}
