// Offline POC client: load image assets from slides.json into IndexedDB via Dexie wrapper

import { putAsset, clearAllAssets, putPresentationMeta, getAllPresentationMeta, updatePresentationFlags, getPendingPresentations, getCachedPresentationCount, getAsset } from '../js-common/db/content-db.js';

const content = '/api/slides.json';
const DELAY = 1000;

const statusEl = document.getElementById('status');
const btnLoadAll = document.getElementById('btn-load-all');
const btnNuke = document.getElementById('btn-nuke');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

/**
 * Add artificial delay to make progress visible
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
async function artificialDelay(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create or update progress bar HTML
 * @param {string} id - Element ID for the progress bar
 * @param {number} current - Current progress value
 * @param {number} total - Total progress value
 * @param {string} label - Label for the progress bar
 * @returns {string} - HTML for progress bar
 */
function createProgressBarHTML(id, current, total, label) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  return `
    <div class="progress-container" style="margin: 5px 0;">
      <div style="font-size: 12px; margin-bottom: 2px;">${label}</div>
      <div style="background: #e0e0e0; border-radius: 4px; height: 8px; overflow: hidden;">
        <div id="${id}" style="background: #4caf50; height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
      </div>
      <div style="font-size: 11px; color: #666; margin-top: 2px;">${current}/${total} (${percentage}%)</div>
    </div>
  `;
}

/**
 * Update status with progress bars
 * @param {string} message - Main status message
 * @param {Object} assetProgress - Asset progress {current, total, presentation}
 * @param {Object} presentationProgress - Presentation progress {current, total}
 */
function setStatusWithProgress(message, assetProgress = null, presentationProgress = null) {
  if (!statusEl) return;

  let html = `<div>${message}</div>`;

  if (presentationProgress && presentationProgress.total > 0) {
    html += createProgressBarHTML(
      'presentation-progress',
      presentationProgress.current,
      presentationProgress.total,
      'Overall Presentations'
    );
  }

  if (assetProgress && assetProgress.total > 0) {
    html += createProgressBarHTML(
      'asset-progress',
      assetProgress.current,
      assetProgress.total,
      `Assets for "${assetProgress.presentation}"`
    );
  }

  statusEl.innerHTML = html;
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

function normalizeKey(url) {
    return url.startsWith('/') ? url.slice(1) : url;
}

async function fetchAndStore(url) {
  // Normalize to absolute path key used by SW lookups
  const key = normalizeKey(url);

  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);

  const blob = await res.blob();

  // Add artificial delay to simulate slower network/processing
  await artificialDelay(DELAY);

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

    const totalPresentations = data.length;
    let completedPresentations = 0;

    // Process each presentation individually with progress tracking
    for (let i = 0; i < data.length; i++) {
      const pres = data[i];

      setStatusWithProgress(
        `Processing presentations...`,
        null,
        { current: completedPresentations, total: totalPresentations }
      );

      await hydratePresentationAssets(pres, {
        presentationIndex: i + 1,
        totalPresentations,
        onProgress: (assetProgress) => {
          setStatusWithProgress(
            `Processing presentations...`,
            assetProgress,
            { current: completedPresentations, total: totalPresentations }
          );
        }
      });

      completedPresentations++;

      setStatusWithProgress(
        `Processing presentations...`,
        null,
        { current: completedPresentations, total: totalPresentations }
      );

      // Small delay between presentations
      await artificialDelay(200);
    }

    // Cache the main content file
    setStatusWithProgress('Caching main content file...', null, { current: totalPresentations, total: totalPresentations });
    await fetchAndStore(content);
    await artificialDelay(DELAY);

    try {
      const cachedCount = await getCachedPresentationCount();
      setStatus(`✓ Done! ${cachedCount} presentation(s) fully cached.`);
    } catch (error) {
      console.warn('Error getting cached count:', error);
      setStatus(`✓ Done! ${totalPresentations} presentation(s) processed.`);
    }
  } catch (e) {
    console.error(e);
    setStatus('Error: ' + e.message);
  } finally {
    btnLoadAll.disabled = false;
  }
}

/**
 * Hydrate assets for a single presentation
 * @param {Object} pres - Presentation object
 * @param {Object} options - Progress tracking options
 * @param {Function} [options.onProgress] - Progress callback
 * @returns {Promise<void>}
 */
async function hydratePresentationAssets(pres, options = {}) {
  if (!pres || !pres.id) return;

  const expectedUrls = extractImageUrlsFromPresentation(pres);
  if (expectedUrls.length === 0) {
    // No assets to download, mark as cached
    await updatePresentationFlags(pres.id, { 
      cached: true, 
      pending: false,
      cachedCount: 0,
      updatedAt: Date.now()
    });
    return;
  }

  const presentationTitle = pres.title || pres.id;
  let cachedCount = 0;

  // Initial progress callback
  if (options.onProgress) {
    options.onProgress({
      current: 0,
      total: expectedUrls.length,
      presentation: presentationTitle
    });
  }

  for (let i = 0; i < expectedUrls.length; i++) {
    const url = expectedUrls[i];

    try {
      // Add artificial delay before each asset download
      if (i > 0) {
        await artificialDelay(400); // Slightly longer delay between assets
      }

      await fetchAndStore(url);
      cachedCount++;

      // Update progress
      if (options.onProgress) {
        options.onProgress({
          current: cachedCount,
          total: expectedUrls.length,
          presentation: presentationTitle
        });
      }

    } catch (e) {
      console.error('Failed to cache asset', url, e);
      // Still update progress even on failure
      if (options.onProgress) {
        options.onProgress({
          current: cachedCount,
          total: expectedUrls.length,
          presentation: presentationTitle
        });
      }
    }
  }

  const cached = cachedCount === expectedUrls.length;
  await updatePresentationFlags(pres.id, { 
    cachedCount, 
    cached,
    pending: false,
    updatedAt: Date.now()
  });

  // Small delay after completing presentation
  await artificialDelay(200);
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
  // Resume any pending hydrations from previous session
  void resumePendingHydrations();
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
      const expectedUrls = extractImageUrlsFromPresentation(pres);
      await putPresentationMeta({ 
        id: pres.id, 
        version: pres.version, 
        title: pres.title,
        expectedUrls,
        expectedCount: expectedUrls.length,
        pending: true  // Mark as pending since we'll download assets next
      });
    }
  } catch (metaErr) {
    console.warn('Failed to store presentation metadata', metaErr);
  }
}

/**
 * Extract image URLs from a single presentation
 * @param {Object} pres - Presentation object
 * @returns {Array<string>} - Array of image URLs
 */
function extractImageUrlsFromPresentation(pres) {
  const urls = new Set();
  for (const slide of pres.slides || []) {
    if (slide.template === 'img' && slide.src) {
      urls.add(normalizeKey(slide.src));
    }
    // Parse HTML fields for <img src="...">
    for (const field of ['html', 'additional']) {
      const html = slide[field];
      if (typeof html === 'string' && html.includes('<img')) {
        // naive regex for src attributes
        const regex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
        let m;
        while ((m = regex.exec(html)) !== null) {
          urls.add(normalizeKey(m[1]));
        }
      }
    }
  }
  return [...urls];
}

/**
 * Update cached count for a presentation based on available assets
 * @param {string} presentationId
 * @param {Array<string>} expectedUrls
 * @returns {Promise<void>}
 */
async function updatePresentationCachedCount(presentationId, expectedUrls) {
  let cachedCount = 0;
  for (const url of expectedUrls) {
    const asset = await getAsset(url);
    if (asset && asset.blob) {
      cachedCount++;
    }
  }

  const cached = cachedCount === expectedUrls.length;
  await updatePresentationFlags(presentationId, { 
    cachedCount, 
    cached,
    pending: !cached,
    updatedAt: cached ? Date.now() : undefined
  });
}

/**
 * Resume any pending hydrations on startup
 * @returns {Promise<void>}
 */
async function resumePendingHydrations() {
  try {
    const pendingPresentations = await getPendingPresentations();
    if (pendingPresentations.length > 0) {
      console.log(`Resuming ${pendingPresentations.length} pending hydrations...`);
    }
    for (const pres of pendingPresentations) {
      if (pres.expectedUrls && pres.expectedUrls.length > 0) {
        await updatePresentationCachedCount(pres.id, pres.expectedUrls);
      }
    }
  } catch (error) {
    console.warn('Failed to resume pending hydrations', error);
    // Don't let this error break the app initialization
  }
}
