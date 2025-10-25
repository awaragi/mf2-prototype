// Shared Dexie wrapper for client and Service Worker
// Loads UMD Dexie bundle and exposes a small API for the simplified POC

import '../../assets/third-party/dexie.js';

const Dexie = globalThis.Dexie;

if (!Dexie) {
  throw new Error('Dexie failed to load from assets/third-party/dexie.js');
}

// Initialize database and schema
const db = new Dexie('content-cache');
db.version(1).stores({
  // Primary key url, simple indexes for timestamp
  assets: 'url, ts',
  presentations: 'id, ts'
});

/**
 * Put an asset into the DB
 * @param {Object} rec
 * @param {string} rec.url
 * @param {Blob} rec.blob
 * @param {string} [rec.type]
 * @param {number} [rec.size]
 * @param {string} [rec.etag]
 * @param {number} [rec.expiresAt]
 * @returns {Promise<void>}
 */
export async function putAsset(rec) {
  const { url, blob } = rec || {};
  if (!url || !blob) throw new Error('putAsset requires {url, blob}');
  const type = rec.type || (blob && blob.type) || 'application/octet-stream';
  const size = rec.size ?? (blob && blob.size) ?? undefined;
  const ts = Date.now();
  await db.table('assets').put({
    url,
    blob,
    type,
    size,
    etag: rec.etag,
    expiresAt: rec.expiresAt,
    ts
  });
}

/**
 * Store or update presentation metadata
 * @param {Object} rec
 * @param {string} rec.id
 * @param {string} [rec.version]
 * @param {string} [rec.title]
 * @param {Array<string>} [rec.expectedUrls]
 * @param {number} [rec.expectedCount]
 * @param {number} [rec.cachedCount]
 * @param {boolean} [rec.cached]
 * @param {boolean} [rec.pending]
 * @param {boolean} [rec.stale]
 * @param {number} [rec.updatedAt]
 * @param {number} [rec.expiresAt]
 * @returns {Promise<void>}
 */
export async function putPresentationMeta(rec) {
  const { id } = rec || {};
  if (!id) throw new Error('putPresentationMeta requires {id}');
  const ts = Date.now();
  await db.table('presentations').put({
    id,
    version: rec.version,
    title: rec.title,
    expectedUrls: rec.expectedUrls || [],
    expectedCount: rec.expectedCount || 0,
    cachedCount: rec.cachedCount || 0,
    cached: rec.cached || false,
    pending: rec.pending || false,
    stale: rec.stale || false,
    updatedAt: rec.updatedAt,
    expiresAt: rec.expiresAt,
    ts
  });
}

/**
 * Get presentation metadata by id
 * @param {string} id
 * @returns {Promise<null|{id:string, version?:string, title?:string, ts:number}>}
 */
export async function getPresentationMeta(id) {
  if (!id) return null;
  return db.table('presentations').get(id);
}

/**
 * Get all presentation metadata records
 * @returns {Promise<Array<{id:string, version?:string, title?:string, ts:number}>>}
 */
export async function getAllPresentationMeta() {
  return db.table('presentations').toArray();
}

/**
 * Update presentation flags
 * @param {string} id
 * @param {Object} flags
 * @param {boolean} [flags.cached]
 * @param {boolean} [flags.pending]
 * @param {boolean} [flags.stale]
 * @param {number} [flags.cachedCount]
 * @param {number} [flags.updatedAt]
 * @returns {Promise<void>}
 */
export async function updatePresentationFlags(id, flags) {
  if (!id) throw new Error('updatePresentationFlags requires id');
  const updates = {};
  if (flags.cached !== undefined) updates.cached = flags.cached;
  if (flags.pending !== undefined) updates.pending = flags.pending;
  if (flags.stale !== undefined) updates.stale = flags.stale;
  if (flags.cachedCount !== undefined) updates.cachedCount = flags.cachedCount;
  if (flags.updatedAt !== undefined) updates.updatedAt = flags.updatedAt;

  await db.table('presentations').update(id, updates);
}

/**
 * Get presentations with pending flag set to true
 * @returns {Promise<Array>}
 */
export async function getPendingPresentations() {
  try {
    const allPresentations = await db.table('presentations').toArray();
    return allPresentations.filter(p => p.pending === true);
  } catch (error) {
    console.warn('Error getting pending presentations:', error);
    return [];
  }
}

/**
 * Get count of cached presentations
 * @returns {Promise<number>}
 */
export async function getCachedPresentationCount() {
  try {
    const allPresentations = await db.table('presentations').toArray();
    return allPresentations.filter(p => p.cached === true).length;
  } catch (error) {
    console.warn('Error getting cached presentation count:', error);
    return 0;
  }
}

/**
 * Get comprehensive cache statistics
 * @returns {Promise<{cachedPresentations: number, pendingPresentations: number, totalAssets: number, totalSize: number, formattedSize: string}>}
 */
export async function getCacheStatistics() {
  try {
    const [presentations, assets] = await Promise.all([
      db.table('presentations').toArray(),
      db.table('assets').toArray()
    ]);

    const cachedPresentations = presentations.filter(p => p.cached === true).length;
    const pendingPresentations = presentations.filter(p => p.pending === true).length;
    const totalAssets = assets.length;

    // Calculate total size in bytes
    const totalSize = assets.reduce((sum, asset) => sum + (asset.size || 0), 0);

    // Format size for display
    const formattedSize = formatBytes(totalSize);

    return {
      cachedPresentations,
      pendingPresentations,
      totalAssets,
      totalSize,
      formattedSize
    };
  } catch (error) {
    console.warn('Error getting cache statistics:', error);
    return {
      cachedPresentations: 0,
      pendingPresentations: 0,
      totalAssets: 0,
      totalSize: 0,
      formattedSize: '0 B'
    };
  }
}

/**
 * Format bytes into human readable string
 * @param {number} bytes
 * @param {number} decimals
 * @returns {string}
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get an asset by URL
 * @param {string} url
 * @returns {Promise<null|{url:string, blob:Blob, type:string, size?:number, etag?:string, expiresAt?:number, ts:number}>}
 */
export async function getAsset(url) {
  if (!url) return null;
  return db.table('assets').get(url);
}

/**
 * Clear all cached content (assets + presentation metadata)
 * @returns {Promise<void>}
 */
export async function clearAllAssets() {
  await db.table('assets').clear();
  if (db.tables.find(t => t.name === 'presentations')) {
    await db.table('presentations').clear();
  }
}

export { db };
