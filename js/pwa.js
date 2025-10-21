// PWA Control Script
// Handles service worker registration and PWA lifecycle

// PWA state variables
let isOnline = navigator.onLine;
let registration = null;

// Initialize PWA functionality
async function initPWA() {
  console.log('[PWA] Initializing PWA Controller');

  // Set up network monitoring
  setupNetworkMonitoring();

  // Register service worker
  if ('serviceWorker' in navigator) {
    try {
      await registerServiceWorker();
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  } else {
    console.log('[PWA] Service workers not supported');
  }
}

// Register service worker
async function registerServiceWorker() {
  try {
    console.log('[PWA] Registering service worker...');

    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('[PWA] SW registered with scope:', registration.scope);

    // Listen for service worker updates
    registration.addEventListener('updatefound', () => {
      console.log('[PWA] New service worker version found');
      const newWorker = registration.installing;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            console.log('[PWA] New version cached and ready');
            // Could notify user of update here
          } else {
            console.log('[PWA] Service worker installed for the first time');
          }
        }
      });
    });

    // Listen for controlling service worker changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] New service worker took control');
    });

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

// Set up network monitoring
function setupNetworkMonitoring() {
  // Initial network status
  console.log('[PWA] Network:', isOnline ? 'online' : 'offline');

  // Listen for network changes
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

// Handle online event
function handleOnline() {
  isOnline = true;
  console.log('[PWA] Network: online');
  onNetworkChange('online');
}

// Handle offline event
function handleOffline() {
  isOnline = false;
  console.log('[PWA] Network: offline');
  onNetworkChange('offline');
}

// Handle network status change
function onNetworkChange(status) {
  // Dispatch custom event for other parts of the app to listen to
  const event = new CustomEvent('networkchange', {
    detail: { status, isOnline: status === 'online' }
  });
  window.dispatchEvent(event);
}

// Check for service worker updates manually
async function checkForUpdates() {
  if (!registration) {
    console.log('[PWA] No service worker registration found');
    return;
  }

  try {
    console.log('[PWA] Checking for updates...');
    const updatedRegistration = await registration.update();
    console.log('[PWA] Update check completed');
    return updatedRegistration;
  } catch (error) {
    console.error('[PWA] Update check failed:', error);
  }
}

// Get current app version from service worker
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

// Get current network status
function getNetworkStatus() {
  return isOnline;
}

// Get service worker registration
function getRegistration() {
  return registration;
}

// Initialize PWA when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPWA);
} else {
  initPWA();
}

// Export functions for module usage
export {
  initPWA,
  registerServiceWorker,
  setupNetworkMonitoring,
  checkForUpdates,
  getVersion,
  getNetworkStatus,
  getRegistration,
  onNetworkChange
};
