// Database configuration constants
export const DB_NAME = 'PWACacheDB';
export const DB_VERSION = 1;

// Store names
export const STORES = {
  META: 'meta',
  PROGRESS: 'progress', 
  ASSETS: 'assets',
  ASSETS_INDEX: 'assetsIndex'
};

// Meta store keys
export const META_KEYS = {
  SETTINGS: 'settings'
};
// Crypto constants for AES-GCM-256 encryption
export const KEY_VERSION = 1;
export const CRYPTO_ALGORITHM = 'AES-GCM';
export const KEY_LENGTH = 256; // bits
export const IV_LENGTH = 12; // bytes for GCM
export const TAG_LENGTH = 128; // bits for GCM authentication tag

// Cache and TTL constants
export const DEFAULT_TTL_SECONDS = 86400; // 24 hours default
export const MAX_ASSET_SIZE = 50 * 1024 * 1024; // 50MB limit per asset

// Engine constants (for future stages)
export const ENGINE_MAX_CONCURRENCY = 4;
// Default settings
export const DEFAULT_SETTINGS = {
  engineEnabled: false,
  targetContentVersion: null,
  lastCompleteContentVersion: null,
  telemetryEnabled: false,
  engineConcurrency: 4
};

// Asset storage constants
export const ASSET_DEFAULTS = {
  TTL_INFINITY: Number.MAX_SAFE_INTEGER,
  DEFAULT_TYPE: 'application/octet-stream'
};
