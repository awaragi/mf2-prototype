// Service Worker for App Cache Management
// Version: 1.1.0 - Modular Architecture

import {handleAppCacheRequest} from "./utils/app-fetch-handler";

const logPrefix = '[SW]';

import {cleanupOldAppCaches, initCache} from './utils/app-cache-manager.js';

self.addEventListener('install', event => {
    console.log(logPrefix, 'Installing service worker');
    event.waitUntil((async () => {
        await initCache()
        await self.skipWaiting();
        console.log(logPrefix, 'Service worker installed');
    })());
});

self.addEventListener('activate', event => {
    console.log(logPrefix, 'Activating service worker');
    event.waitUntil((async () => {
        await cleanupOldAppCaches()
        await self.clients.claim();
        console.log(logPrefix, 'Service worker activated');
    })());
});

// Serve from precache; fall back to network.
self.addEventListener('fetch', event => {
    const { request } = event;
    console.log(logPrefix, 'Fetching:', request.url);
    event.respondWith((async () => {
        // const cached = await caches.match(request, {ignoreSearch: false});
        // if (cached) {
        //     console.log(logPrefix, 'Cache hit for:', request.url);
        // } else {
        //     console.log(logPrefix, 'Cache miss for:', request.url, '- fetching from network');
        // }
        // return cached || fetch(request);
        await handleAppCacheRequest(request);
    })());
});
