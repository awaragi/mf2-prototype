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
        console.log('[PWA] New service worker took control');
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
 * Check for service worker updates manually
 * @returns {Promise<{
 *  success: boolean,
 *  oldVersion?: string,
 *  newVersion?: string,
 *  versionChanged: boolean,
 *  timestamp?: number,
 *  error?: string
 * }>} Update check result
 */
async function checkForUpdates() {
  if (!navigator.serviceWorker.controller) {
    console.warn('[PWA] No service worker controller available');
    return { 
      success: false, 
      error: 'Service worker not available',
      versionChanged: false 
    };
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();

    // Set up timeout to prevent hanging
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: 'Timeout waiting for update check response',
        versionChanged: false
      });
    }, 10000); // 10 second timeout

    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timeout);

      if (event.data.type === 'MANIFEST_CHECK_RESPONSE') {
        console.log('[PWA] Update check response:', event.data);

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
    console.log('[PWA] Checking for updates...');
    navigator.serviceWorker.controller.postMessage(
      { type: 'FORCE_MANIFEST_CHECK' },
      [messageChannel.port2]
    );
  });
}

/**
 * Get current app version from service worker
 * @returns {Promise<string|null>}
 */
async function getVersion() {
  if (!navigator.serviceWorker.controller) {
    return null;
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data.type === 'VERSION_RESPONSE') {
        resolve(event.data.version);
      }
    };

    navigator.serviceWorker.controller.postMessage(
      { type: 'GET_VERSION' },
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
  checkForUpdates,
  getVersion,
  getNetworkStatus,
};
