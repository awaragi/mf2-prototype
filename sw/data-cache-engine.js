// Data Cache Engine - Background prefetch with presentation-first progress tracking
import { putAsset, getAsset, getProgress, setProgress, creditUrl, markPresentationComplete, getSettings, setSettings } from './cache-db.js';
import { logger } from '../js-common/utils/logging.js';

// Configuration constants
const ENGINE_MAX_CONCURRENCY = 1;
const PROGRESS_BATCH_SIZE = 1; // Emit progress events every N assets
const logPrefix = '[ENGINE]';

// Module-level state
let engineState = 'off'; // off, partial, full
let isRunning = false;
let activeFetches = new Set(); // URLs currently being fetched
let inflightFetches = new Set(); // Process-level deduplication
let progressBatch = new Map(); // presentationId -> pending progress updates
let batchCounter = 0;

// Asset tracking
let presentations = [];
let globalAssetMap = new Map(); // url -> Set<presentationId>
let expectedCounts = new Map(); // presentationId -> number
let creditedCounts = new Map(); // presentationId -> number

// Message callback function
let messageCallback = null;

export function setMessageCallback(callback) {
  messageCallback = callback;
}

function postMessage(message) {
  if (messageCallback) {
    messageCallback(message);
  }
}

/**
 * Initialize engine - load settings and start if enabled
 * Should be called on service worker startup
 */
export async function initializeEngine() {
  logger.info(logPrefix, 'Initializing engine');

  try {
    const settings = await getSettings();
    if (settings.engineEnabled) {
      logger.info(logPrefix, 'Engine enabled in settings, starting engine');
      await startEngine(true); // Resume mode
    } else {
      logger.info(logPrefix, 'Engine disabled in settings');
      engineState = 'off';
      emitStatus();
    }
  } catch (error) {
    logger.error(logPrefix, 'Engine initialization failed:', error);
    engineState = 'off';
    emitStatus();
  }
}

export async function startEngine(resume = false) {
  logger.info(logPrefix, `start (resume=${resume})`);

  try {
    const settings = await getSettings();
    if (!settings.engineEnabled) {
      logger.info(logPrefix, 'Engine disabled in settings');
      engineState = 'off';
      emitStatus();
      return;
    }

    isRunning = true;
    await buildAssetMap();
    await loadProgress();
    await updateState();
    emitStatus();

    if (engineState !== 'full') {
      await runPrefetch();
    }
  } catch (error) {
    logger.error(logPrefix, 'Start failed:', error);
    isRunning = false;
  }
}

export async function stopEngine() {
  logger.info(logPrefix, 'Stopping engine');
  isRunning = false;
  activeFetches.clear();
  inflightFetches.clear();
  engineState = 'off';
  emitStatus();
}

async function buildAssetMap() {
  logger.info(logPrefix, 'Building asset map from slides.json');

  try {
    const response = await fetch('/api/slides.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch slides.json: ${response.status}`);
    }

    presentations = await response.json();
    globalAssetMap.clear();
    expectedCounts.clear();

    for (const presentation of presentations) {
      const assetUrls = extractAssetUrls(presentation);
      expectedCounts.set(presentation.id, assetUrls.length);

      logger.info(logPrefix, `expected for ${presentation.id}: ${assetUrls.length}`);

      // Build global deduped map
      for (const url of assetUrls) {
        if (!globalAssetMap.has(url)) {
          globalAssetMap.set(url, new Set());
        }
        globalAssetMap.get(url).add(presentation.id);
      }
    }

    logger.info(logPrefix, `Total unique assets: ${globalAssetMap.size}`);
  } catch (error) {
    logger.error(logPrefix, 'Failed to build asset map:', error);
    throw error;
  }
}

function extractAssetUrls(presentation) {
  const urls = [];

  // Extract from slides
  if (presentation.slides) {
    for (const slide of presentation.slides) {
      if (slide.background) urls.push(slide.background);
      if (slide.content) {
        // Extract image references from content
        const imgMatches = slide.content.match(/src=["']([^"']+)["']/g);
        if (imgMatches) {
          for (const match of imgMatches) {
            const url = match.match(/src=["']([^"']+)["']/)[1];
            if (url.startsWith('/')) urls.push(url);
          }
        }
      }
    }
  }

  // Extract from attachments
  if (presentation.attachments) {
    for (const attachment of presentation.attachments) {
      if (attachment.url) urls.push(attachment.url);
    }
  }

  return [...new Set(urls)]; // Dedupe within presentation
}

async function loadProgress() {
  creditedCounts.clear();

  for (const presentation of presentations) {
    const progress = await getProgress(presentation.id);
    const credited = progress ? progress.credited : 0;
    creditedCounts.set(presentation.id, credited);
  }
}

async function updateState() {
  let completePresentations = 0;

  for (const presentation of presentations) {
    const expected = expectedCounts.get(presentation.id) || 0;
    const credited = creditedCounts.get(presentation.id) || 0;

    if (expected > 0 && credited >= expected) {
      completePresentations++;
    }
  }

  const oldState = engineState;

  if (completePresentations === 0) {
    engineState = 'off';
  } else if (completePresentations === presentations.length) {
    engineState = 'full';
  } else {
    engineState = 'partial';
  }

  if (oldState !== engineState) {
    logger.info(logPrefix, `state=${engineState}`);
  }
}

async function runPrefetch() {
  if (!isRunning) return;

  logger.info(logPrefix, 'Starting prefetch operation');

  const urlsToFetch = [];
  for (const [url, presentationIds] of globalAssetMap) {
    // Check if we already have this asset cached
    const cached = await getAsset(url);
    if (!cached && !inflightFetches.has(url)) {
      urlsToFetch.push(url);
    }
  }

  logger.info(logPrefix, `URLs to fetch: ${urlsToFetch.length}`);

  // Process with concurrency limit
  const chunks = [];
  for (let i = 0; i < urlsToFetch.length; i += ENGINE_MAX_CONCURRENCY) {
    chunks.push(urlsToFetch.slice(i, i + ENGINE_MAX_CONCURRENCY));
  }

  for (const chunk of chunks) {
    if (!isRunning) break;

    const fetchPromises = chunk.map(url => fetchAndStoreAsset(url));
    await Promise.allSettled(fetchPromises);
  }

  await updateState();
  emitStatus();
  flushProgressBatch(); // Emit any remaining progress updates
}

async function fetchAndStoreAsset(url) {
  if (inflightFetches.has(url)) {
    return; // Already being fetched
  }

  inflightFetches.add(url);
  activeFetches.add(url);

  try {
    logger.info(logPrefix, `fetch start: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Encrypt and store
    await putAsset(url, arrayBuffer, contentType);
    logger.info(logPrefix, `fetch ok: ${url}`);

    // Credit to all referencing presentations
    const presentationIds = globalAssetMap.get(url) || new Set();
    for (const presentationId of presentationIds) {
      await creditUrl(presentationId, url);

      const credited = (creditedCounts.get(presentationId) || 0) + 1;
      const expected = expectedCounts.get(presentationId) || 0;

      creditedCounts.set(presentationId, credited);
      logger.info(logPrefix, `credit: ${presentationId} ${url} (${credited}/${expected})`);

      // Add to batch for progress emission
      progressBatch.set(presentationId, { credited, expected });
      batchCounter++;

      // Check if presentation is complete
      if (credited >= expected) {
        await markPresentationComplete(presentationId);
        logger.info(logPrefix, `complete: ${presentationId}`);
        emitPresentationComplete(presentationId);
      }
    }

    // Emit progress batch if threshold reached
    if (batchCounter >= PROGRESS_BATCH_SIZE) {
      flushProgressBatch();
    }

  } catch (error) {
    logger.error(logPrefix, `fetch failed: ${url}`, error);
  } finally {
    inflightFetches.delete(url);
    activeFetches.delete(url);
  }
}

function flushProgressBatch() {
  if (progressBatch.size === 0) return;

  for (const [presentationId, progress] of progressBatch) {
    emitPresentationProgress(presentationId, progress.credited, progress.expected);
  }

  progressBatch.clear();
  batchCounter = 0;
}

function emitStatus() {
  const status = {
    state: engineState,
    isRunning: isRunning,
    progress: {
      presentations: presentations.length,
      completed: Array.from(creditedCounts.entries()).filter(([id, credited]) => {
        const expected = expectedCounts.get(id) || 0;
        return expected > 0 && credited >= expected;
      }).length
    },
    activeFetches: activeFetches.size
  };

  postMessage({ type: 'STATUS', payload: status });
}

function emitPresentationProgress(presentationId, credited, expected) {
  postMessage({
    type: 'PRESENTATION_PROGRESS',
    payload: { presentationId, credited, expected }
  });
}

function emitPresentationComplete(presentationId) {
  postMessage({
    type: 'PRESENTATION_COMPLETE',
    payload: { presentationId }
  });
}

export async function getEngineStatus() {
  await updateState();
  emitStatus();
  return {
    state: engineState,
    isRunning: isRunning
  };
}
