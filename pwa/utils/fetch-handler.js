// Fetch Request Handler Utility
// Handles service worker fetch events

import {getCachedManifest} from './app-manifest-loader.js';
import {getAppCacheName} from './app-cache-manager.js';

/**
 * Handle requests with app cache-first strategy
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} The response
 */
export async function handleAppCacheRequest(request) {
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Normalize root path
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const startTime = performance.now();

  try {
    // Try to find in cache first (more efficient approach)
    let cachedResponse;

    // First try current app cache if we have manifest
    if (getAppCacheName(getCachedManifest().version)) {
      const cache = await caches.open(cacheName);
      cachedResponse = await cache.match(request);

        // If not found, try without query parameters
        if (!cachedResponse) {
            cachedResponse = await cache.match(new Request(pathname));
        }
    }

      // If not found, check all caches
    if (!cachedResponse) {
        cachedResponse = await caches.match(request);

        // If not found, try matching without query parameters
        if (!cachedResponse) {
            cachedResponse = await caches.match(new Request(pathname));
        }
    }

      if (cachedResponse) {
      const duration = Math.round(performance.now() - startTime);
      console.log('[SW] App cache hit:', pathname, `(${duration}ms)`);
      return cachedResponse;
    }

    // If not in app cache, fetch from network
    console.log('[SW] App cache miss, fetching:', pathname);
    const response = await fetch(request);

    const duration = Math.round(performance.now() - startTime);

    if (response.ok) {
      console.log('[SW] Network fetch success:', pathname, `(${duration}ms)`);
    } else {
      console.warn('[SW] Network fetch failed:', pathname, response.status, `(${duration}ms)`);
    }

    return response;

  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error('[SW] Request failed:', pathname, error.message, `(${duration}ms)`);

    // Try to serve any cached version as fallback
    try {
      const fallbackResponse = await caches.match(request);
      if (fallbackResponse) {
        console.log('[SW] Served stale app cache as fallback:', pathname);
        return fallbackResponse;
      }
    } catch (fallbackError) {
      console.error('[SW] Fallback app cache lookup failed:', fallbackError.message);
    }

    // Return a user-friendly error response
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
        <head><title>Resource Unavailable</title></head>
        <body>
          <h1>Resource Unavailable</h1>
          <p>The requested resource "${pathname}" could not be loaded.</p>
          <p>Please check your internet connection and try again.</p>
        </body>
      </html>
    `, {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  }
}
