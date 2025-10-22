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
