// Service Worker for App Cache Management
// Version: 1.1.0 - Modular Architecture

import {logger} from '../js-common/utils/logging.js';
import {handleAppCacheRequest} from "./utils/app-fetch-handler.js";

const logPrefix = '[SW]';

import {cleanupOldAppCaches, initCache} from './utils/app-cache-manager.js';

self.addEventListener('install', event => {
    logger.debug(logPrefix, 'Installing service worker');
    event.waitUntil((async () => {
        await initCache()
        await self.skipWaiting();
        logger.log(logPrefix, 'Service worker installed');
    })());
});

self.addEventListener('activate', event => {
    logger.debug(logPrefix, 'Activating service worker');
    event.waitUntil((async () => {
        await cleanupOldAppCaches()
        await self.clients.claim();
        logger.log(logPrefix, 'Service worker activated');
    })());
});

// Serve from precache; fall back to network.
self.addEventListener('fetch', event => {
    const { request } = event;
    logger.debug(logPrefix, 'Fetching:', request.url);
    event.respondWith(handleAppCacheRequest(event));
});
