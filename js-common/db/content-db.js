// Shared Dexie wrapper for client and Service Worker
// Loads UMD Dexie bundle and exposes a small API for the simplified POC

import '../../assets/third-party/dexie.js';

const Dexie = globalThis.Dexie;

if (!Dexie) {
  throw new Error('Dexie failed to load from assets/third-party/dexie.js');
}

// Initialize database and schema
const db = new Dexie('content-cache');
// v1: assets only
// v2: add presentations table for metadata (id, version, title)
db.version(1).stores({
  // Primary key url, simple indexes for timestamp
  assets: 'url, ts'
});
db.version(2).stores({
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
