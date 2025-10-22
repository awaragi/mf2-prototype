// App Manifest Management Utility
// Handles loading and caching of app manifest

const APP_MANIFEST_URL = '/app-manifest.json';

// Cache manifest in memory to avoid repeated fetches
let cachedManifest = null;
let manifestFetchTime = 0;
const MANIFEST_CACHE_TTL = 60000; // 1 minute

/**
 * Load app manifest configuration with caching
 * @param {boolean} forceRefresh - Force refresh from network
 * @returns {Promise<Object|null>} The manifest object or null if not available
 */
export async function loadAppManifest(forceRefresh = false) {
  const now = Date.now();

  // Use cached version if available and not expired
  if (!forceRefresh && cachedManifest && (now - manifestFetchTime) < MANIFEST_CACHE_TTL) {
      console.log('[SW] Using memory cached manifest version:', cachedManifest.version);
    return cachedManifest;
  }

  try {
    console.log('[SW] Loading app manifest...');
    // Add timestamp to ensure cache busting
    const cacheBustUrl = `${APP_MANIFEST_URL}?t=${Date.now()}`;
    const response = await fetch(cacheBustUrl, {
        cache: 'no-cache', // Always get fresh manifest for version checks
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const manifest = await response.json();

    // Validate manifest structure
    if (!manifest.version || !Array.isArray(manifest.files)) {
      throw new Error('Invalid app cache manifest structure');
    }

    // Cache the manifest
    cachedManifest = manifest;
    manifestFetchTime = now;

    console.log('[SW] Loaded app cache manifest, version:', manifest.version);
    return manifest;
  } catch (error) {
    console.log('[SW] App manifest not available:', error.message);
    // Keep using cached version if available, even if expired
    if (cachedManifest) {
      console.log('[SW] Using cached manifest version:', cachedManifest.version);
      return cachedManifest;
    }
    return null;
  }
}

/**
 * Clear manifest cache
 */
export function clearManifestCache() {
  cachedManifest = null;
  manifestFetchTime = 0;
}

/**
 * Get cached manifest without network request
 * @returns {Object|null} The cached manifest or null
 */
export function getCachedManifest() {
  return cachedManifest;
}
