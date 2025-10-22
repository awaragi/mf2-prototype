import {logger} from "../../js-common/utils/logging.js";

const logPrefix = '[SW-FETCH]';

/**
 * Handle requests with app cache-first strategy
 * @returns {Promise<Response>} The response
 * @param event
 */
export async function handleAppCacheRequest(event) {
    let {request, pathname} = extractRequest(event);

    const startTime = performance.now();
    try {
        // Try to find in cache first (more efficient approach)
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

        // If not in app cache, fetch from network
        logger.log(logPrefix, 'App cache miss, fetching:', pathname);
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

    // Normalize paths
    if (pathname.endsWith('/')) {
        pathname = pathname + 'index.html';
    }

    return {request, pathname};
}

