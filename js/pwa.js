// PWA Control Script
// Handles service worker registration and PWA lifecycle

class PWAController {
  constructor() {
    this.isOnline = navigator.onLine;
    this.registration = null;
    this.init();
  }

  async init() {
    console.log('[PWA] Initializing PWA Controller');

    // Set up network monitoring
    this.setupNetworkMonitoring();

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await this.registerServiceWorker();
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
      }
    } else {
      console.log('[PWA] Service workers not supported');
    }
  }

  async registerServiceWorker() {
    try {
      console.log('[PWA] Registering service worker...');

      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[PWA] SW registered with scope:', this.registration.scope);

      // Listen for service worker updates
      this.registration.addEventListener('updatefound', () => {
        console.log('[PWA] New service worker version found');
        const newWorker = this.registration.installing;

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
      if (this.registration.waiting) {
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

  setupNetworkMonitoring() {
    // Initial network status
    console.log('[PWA] Network:', this.isOnline ? 'online' : 'offline');

    // Listen for network changes
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[PWA] Network: online');
      this.onNetworkChange('online');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[PWA] Network: offline');
      this.onNetworkChange('offline');
    });
  }

  onNetworkChange(status) {
    // Dispatch custom event for other parts of the app to listen to
    const event = new CustomEvent('networkchange', {
      detail: { status, isOnline: status === 'online' }
    });
    window.dispatchEvent(event);
  }

  // Method to check for service worker updates manually
  async checkForUpdates() {
    if (!this.registration) {
      console.log('[PWA] No service worker registration found');
      return;
    }

    try {
      console.log('[PWA] Checking for updates...');
      const registration = await this.registration.update();
      console.log('[PWA] Update check completed');
      return registration;
    } catch (error) {
      console.error('[PWA] Update check failed:', error);
    }
  }

  // Method to get current app version from service worker
  async getVersion() {
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
}

// Initialize PWA Controller when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pwaController = new PWAController();
  });
} else {
  window.pwaController = new PWAController();
}

// Export for module usage
export default PWAController;
