// Offline POC client: load image assets from slides.json into IndexedDB via Dexie wrapper

import { putAsset, clearAllAssets, putPresentationMeta, getAllPresentationMeta } from '../js-common/db/content-db.js';

const content = '/api/slides.json';

const statusEl = document.getElementById('status');
const btnLoadAll = document.getElementById('btn-load-all');
const btnNuke = document.getElementById('btn-nuke');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

async function updateOnlineStatus() {
  const online = navigator.onLine;
  // When we come online, proactively check for new versions
  if (online) {
    // Don't block UI; run and update status when done
    void checkForPresentationUpdates();
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

async function checkForPresentationUpdates() {
  try {
    const cached = await getAllPresentationMeta();
    if (!cached || cached.length === 0) {
      // Nothing cached yet; nothing to compare
      return;
    }
    const latest = await loadSlidesList();
    const latestMap = new Map(latest.map(p => [p.id, p]));

    const outOfDate = [];
    const missing = [];

    for (const rec of cached) {
      const remote = latestMap.get(rec.id);
      if (!remote) {
        // Presentation no longer present upstream; skip or mark missing
        missing.push(rec);
        continue;
      }
      // Compare version strings; if different, mark out-of-date
      if ((remote.version || '') !== (rec.version || '')) {
        outOfDate.push({ id: rec.id, old: rec.version, latest: remote.version, title: rec.title || remote.title });
      }
    }

    // Also detect new presentations available remotely that aren't cached at all
    const cachedIds = new Set(cached.map(c => c.id));
    const newOnes = latest.filter(p => !cachedIds.has(p.id));

    if (outOfDate.length > 0 || newOnes.length > 0) {
      const parts = [];
      if (outOfDate.length > 0) parts.push(`${outOfDate.length} cached presentation(s) have a new version`);
      if (newOnes.length > 0) parts.push(`${newOnes.length} new presentation(s) available`);
      setStatus(`Update available: ${parts.join(' and ')}. Click "Load All Presentations" to download the latest content.`);
    } else {
      setStatus('All cached presentations are up to date.');
    }
  } catch (e) {
    // Silently ignore network or parse errors to avoid UX noise
    console.warn('Failed to check for presentation updates', e);
  }
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

    await persistPresentationMetadata(data);

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


// Persist presentation metadata in a single place for modularity
async function persistPresentationMetadata(list) {
  try {
    if (!Array.isArray(list) || list.length === 0) return;
    for (const pres of list) {
      if (!pres || !pres.id) continue;
      await putPresentationMeta({ id: pres.id, version: pres.version, title: pres.title });
    }
  } catch (metaErr) {
    console.warn('Failed to store presentation metadata', metaErr);
  }
}
