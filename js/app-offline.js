// Offline POC client: load image assets from slides.json into IndexedDB via Dexie wrapper

import { putAsset, clearAllAssets } from '../js-common/db/content-db.js';

const content = '/api/slides.json';

const statusEl = document.getElementById('status');
const netEl = document.getElementById('net-indicator');
const btnLoadAll = document.getElementById('btn-load-all');
const btnNuke = document.getElementById('btn-nuke');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function updateOnlineStatus() {
  const online = navigator.onLine;
  if (netEl) {
    netEl.className = 'badge ' + (online ? 'text-bg-success' : 'text-bg-secondary');
    netEl.textContent = online ? 'Online' : 'Offline';
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

async function loadSlidesList() {
    const res = await fetch(content, {cache: 'no-cache', headers: {'X-Network-First': '1'}});
    if (!res.ok) {
      throw new Error(`Failed to fetch ${content}: ${res.status}`);
  }
  return res.json();
}

function extractImageUrls(slidesData) {
  const urls = new Set();
  for (const pres of slidesData || []) {
    for (const slide of pres.slides || []) {
      if (slide.template === 'img' && slide.src) {
        urls.add(slide.src);
      }
      // Parse HTML fields for <img src="...">
      for (const field of ['html', 'additional']) {
        const html = slide[field];
        if (typeof html === 'string' && html.includes('<img')) {
          // naive regex for src attributes
          const regex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
          let m;
          while ((m = regex.exec(html)) !== null) {
            urls.add(m[1]);
          }
        }
      }
    }
  }
  return [...urls];
}

function normalizeKey(url) {
    return url.startsWith('/') ? url.slice(1) : url;
}

async function fetchAndStore(url) {
  // Normalize to absolute path key used by SW lookups
  const key = normalizeKey(url);
  setStatus(`Fetching ${url} ...`);
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  const blob = await res.blob();
  const type = res.headers.get('Content-Type') || blob.type || 'application/octet-stream';
  const etag = res.headers.get('ETag') || undefined;
  const size = blob.size;
  await putAsset({ url: key, blob, type, etag, size });
}

async function handleLoadAll() {
  try {
    btnLoadAll.disabled = true;
    const data = await loadSlidesList();
    const urls = extractImageUrls(data);
    urls.push(normalizeKey(content));
    if (urls.length === 0) {
      setStatus(`No image URLs found in ${content}.`);
      return;
    }
    setStatus(`Found ${urls.length} assets. Downloading...`);
    let ok = 0, fail = 0;
    for (const u of urls) {
      try {
        await fetchAndStore(u);
        ok++;
        setStatus(`Cached ${ok}/${urls.length} ...`);
      } catch (e) {
        console.error('Failed to cache', u, e);
        fail++;
      }
    }
    setStatus(`Done. Cached: ${ok}, Failed: ${fail}.`);
  } catch (e) {
    console.error(e);
    setStatus('Error: ' + e.message);
  } finally {
    btnLoadAll.disabled = false;
  }
}

async function handleNuke() {
  try {
    btnNuke.disabled = true;
    await clearAllAssets();
    setStatus('All cached content deleted.');
  } catch (e) {
    console.error(e);
    setStatus('Error: ' + e.message);
  } finally {
    btnNuke.disabled = false;
  }
}

function init() {
  updateOnlineStatus();
  if (btnLoadAll) btnLoadAll.addEventListener('click', () => void handleLoadAll());
  if (btnNuke) btnNuke.addEventListener('click', () => void handleNuke());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
