// PWA Control Script

const SERVICE_WORKER_SCRIPT = '/sw.js';

// PWA state variables
let isOnline = navigator.onLine;
let registration = null;

/**
 * Initialize PWA functionality
 * @returns {Promise<void>}
 */
async function initPWA() {
    console.log('[PWA] Initializing PWA Controller');
    await registerServiceWorker();

}

/**
 * Register service worker
 * @returns {Promise<void>}
 */
async function registerServiceWorker() {
    // Register service worker
    if (! ('serviceWorker' in navigator) ) {
        console.log('[PWA] Service workers not supported');
        return;

    }
    try {
      console.log('[PWA] Registering service worker...');
      registration = await navigator.serviceWorker.register(SERVICE_WORKER_SCRIPT, {scope: '/'});

    console.log('[PWA] SW registered with scope:', registration.scope);

    // Listen for service worker updates
    registration.addEventListener('updatefound', handleRegistrationUpdateFound);

    // Listen for controlling service worker changes
    navigator.serviceWorker.addEventListener('controllerchange', handleServiceWorkerControllerChange);

    // Check for waiting service worker
    if (registration.waiting) {
      console.log('[PWA] Service worker waiting to activate');
    }

    // Check if service worker is controlling the page
    if (navigator.serviceWorker.controller) {
      console.log('[PWA] Page is controlled by service worker');
    } else {
      console.log('[PWA] Page is not controlled by service worker');
    }

  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
  }
}

/**
 * Handle service worker state changes
 * @returns {(function(*): void)|*}
 */
function handleServiceWorkerStateChange(event) {
        if (event.target.state === 'installed') {
            if (navigator.serviceWorker.controller) {
                console.log('[PWA] New version cached and ready');
            } else {
                console.log('[PWA] Service worker installed for the first time');
            }
        }
}

/**
 * Handle when a new service worker version is found
 * @param {Event} event - The update found event
 */
function handleRegistrationUpdateFound(event) {
        console.log('[PWA] New service worker version found');
        registration.installing.addEventListener('statechange', handleServiceWorkerStateChange);
}

/**
 * Handle when a new service worker takes control
 * @param {Event} event - The controller change event
 */
function handleServiceWorkerControllerChange(event) {
    if (navigator.serviceWorker.controller) {
        console.log('[PWA] New service worker took control', navigator.serviceWorker.controller.scriptURL);
    } else {
        console.log('[PWA] Service worker control lost');
    }
}

/**
 * Set up network monitoring
 */
function initNetworkMonitoring() {
  // Initial network status
  console.log('[PWA] Network:', isOnline ? 'online' : 'offline');

  // Listen for network changes
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

/**
 * Handle online event
 */
function handleOnline() {
  isOnline = true;
  console.log('[PWA] Network: online');
  onNetworkChange('online');
}

/**
 * Handle offline event
 */
function handleOffline() {
  isOnline = false;
  console.log('[PWA] Network: offline');
  onNetworkChange('offline');
}

/**
 * Handle network status change
 * @param {string} status - Network status ('online' or 'offline')
 */
function onNetworkChange(status) {
  // Dispatch custom event for other parts of the app to listen to
  const event = new CustomEvent('networkchange', {
    detail: { status, isOnline: status === 'online' }
  });
  window.dispatchEvent(event);
}

/**
 * Check for app cache updates manually
 * @returns {Promise<{
 *  success: boolean,
 *  oldVersion?: string,
 *  newVersion?: string,
 *  versionChanged: boolean,
 *  timestamp?: number,
 *  error?: string
 * }>} App cache update check result
 */
async function checkForAppUpdates() {
  if (!navigator.serviceWorker.controller) {
    console.warn('[PWA] No service worker controller available for app cache check');
    return { 
      success: false, 
      error: 'Service worker not available for app cache check',
      versionChanged: false 
    };
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();

    // Set up timeout to prevent hanging
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: 'Timeout waiting for app cache update check response',
        versionChanged: false
      });
    }, 10000); // 10 second timeout

    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timeout);

      if (event.data.type === 'APP_MANIFEST_CHECK_RESPONSE') {
        console.log('[PWA] App cache update check response:', event.data);

        resolve({
          success: true,
          oldVersion: event.data.oldVersion,
          newVersion: event.data.newVersion,
          versionChanged: event.data.versionChanged,
          timestamp: event.data.timestamp
        });
      } else {
        resolve({
          success: false,
          error: 'Unexpected response type: ' + event.data.type,
          versionChanged: false
        });
      }
    };

    // Send message to service worker
    console.log('[PWA] Checking for app cache updates...');
    navigator.serviceWorker.controller.postMessage(
      { type: 'FORCE_APP_MANIFEST_CHECK' },
      [messageChannel.port2]
    );
  });
}

/**
 * Get current app cache version from service worker
 * @returns {Promise<string|null>}
 */
async function getAppVersion() {
  if (!navigator.serviceWorker.controller) {
    return null;
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data.type === 'APP_VERSION_RESPONSE') {
        resolve(event.data.version);
      }
    };

    navigator.serviceWorker.controller.postMessage(
      { type: 'GET_APP_VERSION' },
      [messageChannel.port2]
    );
  });
}

/**
 * Get current network status
 * @returns {boolean}
 */
function getNetworkStatus() {
  return isOnline;
}

/**
 * Schedule an app cache update check to run as soon as the service worker takes control
 * @returns {Promise<{success: boolean, oldVersion?: string, newVersion?: string, versionChanged: boolean, timestamp?: number, error?: string}>}
 */
async function scheduleCheckForAppUpdate() {
  console.log('[PWA] Scheduling app cache update check...');

  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service workers not supported for app cache updates');
    return { success: false, error: 'Service workers not supported for app cache updates', versionChanged: false };
  }

  // Check for controller up to 10 times with 1 second intervals
  for (let i = 0; i < 10; i++) {
    if (navigator.serviceWorker.controller) {
      console.log('[PWA] Service worker is ready, checking for app cache updates');

      try {
        const updateInformation = await checkForAppUpdates();
        console.log('[PWA] App Cache Update Information', updateInformation);
        return updateInformation;
      } catch (error) {
        console.error('[PWA] Error in scheduled app cache update check:', error);
        return { success: false, error: error.message, versionChanged: false };
      }
    }

    // Wait 1 second before next attempt
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.warn('[PWA] Service worker controller not available for app cache updates after 10 attempts');
  return { success: false, error: 'Service worker controller not available for app cache updates after 10 attempts', versionChanged: false };
}

/**
 * Send message to service worker to update app cache
 * @returns {Promise<{
 *   success: boolean,
 *   error?: string,
 *   updated: boolean,
 *   timestamp?: number
 * }>}
 */
async function updateAppCache() {
    if (!navigator.serviceWorker.controller) {
        console.warn('[PWA] No service worker controller available for app cache update');
        return {
            success: false,
            error: 'Service worker not available for app cache update',
            updated: false
        };
    }

    return new Promise((resolve) => {
        const messageChannel = new MessageChannel();

        // Set up timeout to prevent hanging
        const timeout = setTimeout(() => {
            resolve({
                success: false,
                error: 'Timeout waiting for app cache update response',
                updated: false
            });
        }, 30000); // 30 second timeout

        messageChannel.port1.onmessage = (event) => {
            clearTimeout(timeout);
            if (event.data.type === 'UPDATE_APP_CACHE_RESPONSE') {
                resolve({
                    success: true,
                    updated: event.data.updated,
                    timestamp: event.data.timestamp
                });
            } else {
                resolve({
                    success: false,
                    error: 'Unexpected response type: ' + event.data.type,
                    updated: false
                });
            }
        };

        navigator.serviceWorker.controller.postMessage(
            {type: 'UPDATE_APP_CACHE'},
            [messageChannel.port2]
        );
    });
}

// Initialize PWA when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPWA);
  document.addEventListener('DOMContentLoaded', initNetworkMonitoring);
} else {
  initPWA().then(() => {});
  initNetworkMonitoring();
}

// Export functions for module usage
export {
  checkForAppUpdates,
  getAppVersion,
  getNetworkStatus,
  scheduleCheckForAppUpdate,
  updateAppCache,
};
