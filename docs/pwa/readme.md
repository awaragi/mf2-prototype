navigator.serviceWorker.controller?.postMessage({ type: 'FORCE_MANIFEST_CHECK' });
navigator.serviceWorker.controller?.postMessage({ type: 'UPDATE_CACHE' });
