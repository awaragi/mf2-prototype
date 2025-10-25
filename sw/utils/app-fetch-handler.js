import {logger} from "../../js-common/utils/logging.js";
import {getAsset} from "../../js-common/db/content-db.js";

const logPrefix = '[SW-FETCH]';

/**
 * Handle requests with content-from-IDB first (allowlisted),
 * then app cache, then network.
 * @returns {Promise<Response>} The response
 * @param event
 */
export async function handleAppCacheRequest(event) {
    const startTime = performance.now();

    let {request, pathname} = extractRequest(event);

    // Check for network-first header
    const networkFirst = request.headers.get('X-Network-First') === '1';
    if (networkFirst) {
        try {
            logger.debug(logPrefix, 'Network-first fetch requested, trying network first');
            const response = await fetch(request);
            if (response.ok) {
                const duration = Math.round(performance.now() - startTime);
                logger.debug(logPrefix, 'Network fetch success:', pathname, `(${duration}ms)`);
                return response;
            } else {
                throw new Error('Network-first fetch failed');
            }
        } catch (error) {
            logger.debug(logPrefix, 'Network-first fetch failed, falling back to normal flow');
        }

    }
    try {
        // 1) Content cache via IndexedDB (attachments and other allowed paths)
        if (shouldServeFromIDB(pathname, request)) {
            let asset = await getAsset(pathname.startsWith('/') ? pathname.slice(1) : pathname);
            // Also try absolute pathname (without slicing) and full URL as keys if first miss
            const hit = asset || await getAsset(pathname) || await getAsset(new URL(request.url).pathname);
            if (hit && hit.blob) {
                const headers = new Headers({
                    'Content-Type': hit.type || 'application/octet-stream',
                    'Content-Length': hit.size != null ? String(hit.size) : undefined,
                    'X-Served-From': 'idb'
                });
                // Remove undefined headers
                for (const [k,v] of [...headers.entries()]) { if (v === undefined) headers.delete(k); }
                const duration = Math.round(performance.now() - startTime);
                logger.debug(logPrefix, 'IDB content hit:', pathname, `(${duration}ms)`);
                return new Response(hit.blob, { status: 200, headers });
            }
        }

        // 2) Try to find in app cache (precache) next
        let cachedResponse;

        // check all caches for original request
        cachedResponse = await caches.match(request);

        // If not found, try matching without query parameters
        if (!cachedResponse) {
            cachedResponse = await caches.match(new Request(pathname));
        }

        if (cachedResponse) {
            const duration = Math.round(performance.now() - startTime);
            logger.debug(logPrefix, 'App cache hit:', pathname, `(${duration}ms)`);
            return cachedResponse;
        }

        // 3) If not in app cache, fetch from network
        logger.log(logPrefix, 'Cache miss, fetching network:', pathname);
        const response = await fetch(request);
        const duration = Math.round(performance.now() - startTime);

        if (response.ok) {
            logger.debug(logPrefix, 'Network fetch success:', pathname, `(${duration}ms)`);
        } else {
            logger.debug(logPrefix, 'Network fetch failed:', pathname, response.status, `(${duration}ms)`);
        }

        return response;

    } catch (fetchError) {
        const duration = Math.round(performance.now() - startTime);
        logger.error(logPrefix, 'Request failed:', pathname, fetchError.message, `(${duration}ms)`);

        // Try to serve any cached version as fallback
        try {
            const fallbackResponse = await caches.match(request);
            if (fallbackResponse) {
                logger.log(logPrefix, 'Served stale app cache as fallback:', pathname);
                return fallbackResponse;
            }
        } catch (fallbackError) {
            logger.error(logPrefix, 'Fallback app cache lookup failed:', fallbackError.message);
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

/**
 * Decide if a request should be served from IDB content cache.
 * Very small allowlist for the POC: /attachments/*
 * @param {string} pathname
 * @param {Request} request
 * @returns {boolean}
 */
function shouldServeFromIDB(pathname, request) {
    if (request.method !== 'GET') return false;
    // Only same-origin attachments for now
    return ['/attachments/', '/api/'].some(prefix => pathname.startsWith(prefix));
}

/**
 * Extract request details from the event
 * @param event
 */
function extractRequest(event) {
    const request = event.request;
    const url = new URL(request.url);
    let pathname = url.pathname;

    pathname = pathname.trim();

    // App-shell for navigations (SPA)
    if (request.mode === 'navigate') {
        pathname = '/index.html';
    }

    // Normalize paths (but keep attachments paths untouched)
    if (pathname.endsWith('/') && !pathname.startsWith('/attachments/')) {
        pathname = pathname + 'index.html';
    }

    return {request, pathname};
}

