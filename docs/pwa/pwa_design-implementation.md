# 🧭 Complete Implementation Plan — Stages 0 → 14 (Skip 15–16)

This document specifies **what the AI agent must implement** and **how you will validate** each stage using console logs and functional checks.  
It preserves strict isolation between **Service Worker modules** (`/pwa/*`) and **app code** (`/js/*`), forbids inline scripts, and assumes your current project structure:
- `/api/slides.json` (simulates `/presentations` and returns array of presentations)
- `/js/app-present.js` (main app logic)
- `styles.css` (main styles)
- `index.html` (list of presentations)
- `present.html` (renders slides & attachments)

> Stage 12 security enforcement is **optional for localhost** during development; enforce fully before production.

---

## 🧩 Stage 0 — Repo Scaffold & Local Infrastructure

### 🎯 Purpose
Establish a working mock environment mirroring production data flows with zero PWA logic.

### 📋 Implementation Directives (Agent)
- Keep existing structure:
  ```text
  /index.html
  /present.html
  /styles.css
  /js/app-index.js     ← handles presentation list
  /js/app-present.js   ← handles slide presentation
  /js-common/utils/logging.js  ← shared logging utility
  /api/slides.json     ← mock presentations list
  /attachments/...     ← mock images and binaries
  /assets/             ← static assets (logos, icons, bootstrap)
  ```
- Ensure `present.html?d=<id>` loads the correct presentation from `/api/slides.json` and displays attachments.
- No Service Worker yet. No caching.

### 🧪 Validation (Reviewer)
- Load `index.html` → list loads from `/api/slides.json`.
- Open a presentation → images and attachments render from `/attachments/*`.
- Lighthouse: basic PWA installability may be incomplete (expected).

---

## 🧩 Stage 1 — App Shell Caching & Lifecycle (No Inline JS)

### 🎯 Purpose
Make the app installable and resilient offline for the **shell only** (HTML/CSS/JS). Keep **all JS external** (no inline code).

### 📋 Implementation Directives (Agent)
- Create:
  - `/sw/sw.js` (shell installer/activator/fetch for shell assets only)
  - `/sw/manifest.webmanifest` (install metadata)
  - `/app-manifest.js` (exports `APP_CACHE` object with hash-based cache keys)
  - `/js/pwa.js` (centralized app-side PWA manager: registration + status logs)
  - `/sw/utils/app-cache-manager.js` (cache management utilities)
  - `/sw/utils/app-fetch-handler.js` (app cache-first fetch strategy)
- `/sw/sw.js` must:
  - **install**: call `initCache()`, `skipWaiting()`, log `[SW] Installing service worker` and `[SW] Service worker installed`.
  - **activate**: call `cleanupOldAppCaches()`, `clients.claim()`, log `[SW] Activating service worker` and `[SW] Service worker activated`.
  - **fetch**: delegate to `handleAppCacheRequest(event)` which implements cache-first strategy with fallback; log `[SW] Fetching:` for each request.
- `/js/pwa.js` must register the SW on `DOMContentLoaded` and log:
  - `[PWA] SW registered with scope: …`
  - Handle `controllerchange` events and log controller status
  - Include helper functions like `getAppVersion()`
- Cache naming uses hash-based approach: `app-assets-<hash>` where hash is generated from `APP_CACHE` object
- **No inline JS** in HTML. Keep `<script type="module" src="/js/app-present.js" defer></script>` and `<script type="module" src="/js/pwa.js" defer></script>` only.

### 🧪 Validation (Reviewer)
1. First load: Console shows `[SW] Installing service worker`, `[SW] Service worker installed`, `[SW] Service worker activated`, `[PWA] SW registered with scope:`.
2. Reload: Shell assets served from cache (`Application → Cache Storage → app-assets-<hash>`).
3. Offline: Pages load (shell only); content endpoints fail (expected).  
4. Change `APP_CACHE` content: New hash generated, old cache cleaned up on activate.

---

## 🧩 Stage 2 — Messaging Protocol & State Management

### 🎯 Purpose
Enable structured **app ↔ SW** communication to request status and toggle caching.

### 📋 Implementation Directives (Agent)
- Add `/js/events.js` with constants for **Commands** and **Events**:
  - Commands (app→SW): `ACTIVATE_CACHING`, `DEACTIVATE_CACHING`, `CACHE_STATUS`
  - Events (SW→app): `STATUS`, `APP_UPDATE_AVAILABLE`, `LOG`
- `/js/pwa.js`:
  - Open `BroadcastChannel('pwa-events')` and wire send/receive helpers.
  - Send commands on UI toggle (or dev-only button) and log `[PWA] User requested: <CMD>`.
  - Log **all** incoming events: `[PWA EVT] <TYPE> …`.
  - **Clean up existing `getAppVersion()` MessageChannel code** - replace with BroadcastChannel approach.
- `/sw/sw.js`:
  - Add central `message` listener: log `[SW] CMD: <type>`; respond with `STATUS {state:"off"}` until Engine exists.
  - **Keep existing install/activate/fetch handlers** but add messaging capability.
- **Preserve existing cache management utilities** (`/sw/utils/`) but prepare them for Engine integration in later stages.

### 🧪 Validation (Reviewer)
- Toggling “Enable Offline” logs `[PWA] User requested: ACTIVATE_CACHING` then `[SW] CMD: ACTIVATE_CACHING` then `STATUS` echo.
- `CACHE_STATUS` yields `STATUS` from SW.
- No DB operations occur yet. Isolation intact.

---

## 🧩 Stage 3 — IndexedDB Schema & Persistence Layer

### 🎯 Purpose
Create durable stores to support caching; still plaintext assets at this stage.

### 📋 Implementation Directives (Agent)
- `/sw/cache-db.js` must create stores:
  - `meta` (key: `"settings"` → `{engineEnabled, targetContentVersion, lastCompleteContentVersion, telemetryEnabled, engineConcurrency}` …)
  - `progress` (key: `presentationId` → `{expected, credited, complete}`)
  - `assets` (key: `url` → `{url, blob|{iv,ct}, type, timestamp, expiresAt, keyVersion}`)
  - `assetsIndex` (key: compound `presentationId+url`)
- Expose async APIs (all Promise-based) with logs:
  - `openDB()` → `[DB] opened version 1`
  - `putAsset(url, data, type)` → `[DB] putAsset → url`
  - `getAsset(url)` → `[DB] getAsset → url`
  - `deleteAsset(url)` → `[DB] deleteAsset → url`
  - `creditUrl(pId,url)` → `[DB] creditUrl → pId url`
  - `getProgress(pId)`, `setProgress(pId, obj)`, `markPresentationComplete(pId)`
  - `setSettings(obj)`, `getSettings()`
  - `clearAll()`

### 🧪 Validation (Reviewer)
- Activation shows `[DB] opened …`.
- Manual test writes/reads succeed and persist across reloads.
- `clearAll` empties stores.

---

## 🧩 Stage 4 — Crypto Layer (AES-GCM-256, Encrypted-at-Rest)

### 🎯 Purpose
Ensure all cached assets are **encrypted** before storing in IndexedDB.

### 📋 Implementation Directives (Agent)
- `/sw/crypto.js`:
  - Use **AES-GCM-256** with random 12-byte IV per asset.
  - Implement `encrypt(plainBytes, keyVersion)` and `decrypt({iv, ct, type, keyVersion})`.
  - Logs: `[CRYPTO] WebCrypto OK`, `[CRYPTO] Encrypt → <bytes>`, `[CRYPTO] Decrypt → <type>`.
- `/sw/constants.js`: export `KEY_VERSION=1` and any crypto constants.
- Update `cache-db.js`:
  - `putAsset` must store **ciphertext** `{iv, ct, type, keyVersion}`.
  - `getAsset` must **decrypt** before returning a Blob/ArrayBuffer.
- Error handling:
  - On decrypt failure, log `[CRYPTO-ERROR] …` and return `null`.

### 🧪 Validation (Reviewer)
- Inspect IDB: assets are ciphertext (no raw image data).
- Roundtrip decrypt returns identical data (type preserved).
- Corrupt an entry → decrypt error logged; item unreadable.

---

## 🧩 Stage 5 — Serve Module: Proxy-While-Caching & Offline Fallback

### 🎯 Purpose
Serve module responds to fetches for API & attachments without writing DB; prefers cache if available/fresh, else proxy network, else fallback.

### 📋 Implementation Directives (Agent)
- Create `/sw/sw-serve.js`:
  - Intercept **GET** for `/api/*` and `/attachments/*`.
  - Decision order:
    1. Cache exists & fresh → decrypt & return (`[SERVE] Cache hit: <url>`).
    2. Otherwise (online) → network proxy (`[SERVE] Proxy network: <url>`).
    3. If network fails but cache exists → offline fallback (`[SERVE] Offline fallback: <url>`).
    4. Else 503 (`[SERVE] Unavailable: <url>`).
  - Never write or credit DB here.
- `/pwa/sw.js` imports Serve and routes fetch events accordingly (shell handled by Stage 1).

### 🧪 Validation (Reviewer)
- Online browsing → see proxy logs for API calls.
- After assets exist (later stages), offline → cache hits/fallbacks render content.
- Confirm no `[DB] putAsset` calls from Serve.

---

## 🧩 Stage 6 — Engine Module: Background Prefetch (Presentation-First)

### 🎯 Purpose
Add Engine that, when enabled, prefetches assets by presentation, encrypts, stores, and **credits** them.

### 📋 Implementation Directives (Agent)
- Add `/sw/sw-engine.js`:
  - **Start/Resume** on `ACTIVATE_CACHING` or if `settings.engineEnabled=true`.
  - Fetch `/api/slides.json`; build expected URL sets **per presentation** (dedupe globally).
  - Concurrency cap: **4**.
  - For each fetched asset:
    - Encrypt → `putAsset` → on commit, run `creditUrl` for every referencing presentation.
    - Update per-presentation progress; emit `PRESENTATION_PROGRESS`.
  - When presentation credited == expected → emit `PRESENTATION_COMPLETE`.
  - State machine: `off` → `partial` → `full` (emit `STATUS` on changes).
- Logs:
  - `[ENGINE] start (resume=<true|false>)`
  - `[ENGINE] expected for <id>: <n>`
  - `[ENGINE] fetch ok: <url>`
  - `[ENGINE] credit: <id> <url> (<credited>/<expected>)`
  - `[ENGINE] complete: <id>`
  - `[ENGINE] state=<off|partial|full>`

### 🧪 Validation (Reviewer)
- Enable Offline → see expected/build logs + progress increments.
- Shared URLs fetched once, credited to multiple presentations.
- Reload → resumes without duplication.
- Offline → cached slides render via Serve.

---

## 🧩 Stage 7 — Version Snapshot & End-of-Session Verify (Notify Only)

### 🎯 Purpose
Prevent silent redownloads; bind caching session to `/api/content-version.json` and **notify** when content changed.

### 📋 Implementation Directives (Agent)
- On Engine **start (online)**: snapshot `targetContentVersion`.
- On Engine **complete**:
  - Re-fetch content version.
  - If **match** → set `lastCompleteContentVersion` to current.
  - If **mismatch** → emit `CONTENT_REFRESH_RECOMMENDED {previousVersion, currentVersion, reason:"mismatch_end_verify"}`. Do **not** auto-recache.
- On **open (online)**:
  - If `state==="full"` and `currentVersion !== lastCompleteContentVersion` → notify with `reason:"mismatch_on_open"`.
- Logs: snapshot/verify/mismatch.

### 🧪 Validation (Reviewer)
- Match path shows `end-verify: match` and updates `lastCompleteContentVersion`.
- Mismatch triggers notification only; no downloads begin.
- Offline verify deferred; triggers on next online open.

---

## 🧩 Stage 8 — TTL & Staleness Purge

### 🎯 Purpose
Honor HTTP cache TTLs; delete expired assets, downgrade presentations, and auto-resume Engine to refresh them.

### 📋 Implementation Directives (Agent)
- `putAsset()` parses headers and sets `expiresAt` from `Cache-Control: max-age=N` or `Expires`. Default: `Infinity`.
- Add DB helpers: `getExpiredAssets(now)`, `deleteAssets(urls)`, `markPresentationIncomplete(id)`.
- On SW activate or online open:
  - Run TTL sweep: delete expired, downgrade affected presentations, emit `STATUS`, **auto-resume** Engine.
- Serve must ignore stale items (`[SERVE] Ignored stale cache: <url>`).

### 🧪 Validation (Reviewer)
- With `max-age=5` assets: wait >5s and reload online → see TTL sweep logs; state → `partial`; Engine refills to `full`.

---

## 🧩 Stage 9 — Serve/Engine Isolation & Inflight Rules

### 🎯 Purpose
Eliminate cross-talk and races between Serve (fetch handler) and Engine (downloader).

### 📋 Implementation Directives (Agent)
- Engine: maintain `inflightFetches: Set<url>` (process-level only).
  - Skip duplicate downloads of same URL.
- **Credit atomicity:** credit only **after** encryption+store commit succeeds.
- Serve: never checks inflight sets; it decides solely on cache vs network.
- Logs: commit-before-credit, inflight dedupe, clear decision lines per fetch.

### 🧪 Validation (Reviewer)
- While Engine runs, Serve proxies normally.
- Same URL appearing twice → only one download; multiple credits.
- No credit until commit logs appear.

---

## 🧩 Stage 10 — Error Handling & Recovery

### 🎯 Purpose
Resilience under failure: retries, corruption cleanup, non-fatal DB/crypto errors.

### 📋 Implementation Directives (Agent)
- **Network retries:** up to 3 attempts, back-off 1s/2s/4s; log attempt numbers and back-off.
- **Decryption errors:** on `getAsset`/Serve decrypt failure → delete record, mark for re-fetch; log with `[ENGINE-ERROR]` or `[SERVE-ERROR]`.
- **DB failures:** wrap ops, retry once after 250ms, then emit `STATUS.debug.dbError=true`.
- **STATUS.debug** aggregates `{networkRetries, dbError, corrupt}`.
- Serve: on decrypt fail and online → network fallback; offline → 503 with text message.

### 🧪 Validation (Reviewer)
- Disable network mid-run → observe retries and graceful continuation.
- Corrupt a record → deletion + re-download next run.
- DB failure simulated → error surfaced but system continues.
- Serve decrypt error → fallback path visible.
- System returns to `full` eventually.

---

## 🧩 Stage 11 — SW↔App Protocol Polish & Optional Commands

### 🎯 Purpose
Finalize a stable command/event contract and add optional commands.

### 📋 Implementation Directives (Agent)
- **Envelope** for **every** message: `{ type: string, payload: object }`.
- **Commands**: `ACTIVATE_CACHING`, `DEACTIVATE_CACHING`, `CACHE_STATUS`, `PREFETCH_ALL`, `PREFETCH_PRESENTATION {id}`, `NUKE`, `RESET_DEBUG` (optional).
- **Events**: `STATUS`, `PRESENTATION_PROGRESS`, `PRESENTATION_COMPLETE`, `APP_UPDATE_AVAILABLE`, `CONTENT_REFRESH_RECOMMENDED`, `NUKE_COMPLETE`, `LOG`, `METRICS` (Stage 13).
- `/pwa/sw.js` central router: `[SW] CMD: ...` and `[SW] EVT: ...` logs.
- Implement **NUKE**: clear IDB + caches + settings; send `NUKE_COMPLETE`; log `[SECURITY] full wipe complete`.
- All module logs should prefer emitting `LOG` events as well as local console logs.

### 🧪 Validation (Reviewer)
- Send each command → observe correct events and effects.
- `NUKE` fully wipes; subsequent `CACHE_STATUS` shows clean state.
- Unknown commands are logged but ignored.

---

## 🧩 Stage 12 — Security Posture & CSP Hardening (**Optional for Localhost Dev**)

### 🎯 Purpose
Production hardening: CSP, HTTPS enforcement, origin checks, key rotation. Localhost may temporarily relax enforcement.

### 📋 Implementation Directives (Agent)
- **CSP header** (or meta during dev):  
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; manifest-src 'self';`
- **HTTPS-only SW registration** (allow `localhost` as secure).
- **Same-origin enforcement** for all SW fetches.
- **Key rotation**: bump `KEY_VERSION` and start a new session; old assets invalid until refreshed.
- **NUKE** clears everything; log `[SECURITY] full wipe complete`.
- Logs: `[PWA] HTTPS check → OK`, `[PWA-ERROR] Refused to register SW on insecure origin`, `[SW] integrity check: all modules loaded locally`.

### 🧪 Validation (Reviewer)
- HTTPS path: registers successfully; HTTP path: registration refused (except localhost).
- CSP shows **no violations**.
- Rotating key triggers recache on next session.
- All imports are local; no remote scripts.

---

## 🧩 Stage 13 — Metrics & Observability (Non-PII)

### 🎯 Purpose
Visibility into cache effectiveness and stability **without** user data.

### 📋 Implementation Directives (Agent)
- Collect in SW (Engine + Serve):
  - **Cache efficiency**: `cacheHits`, `networkHits`, `offlineFallbacks`
  - **Prefetch**: `assetsFetched`, `bytesDownloaded`, `avgFetchTimeMs`
  - **Stability**: `errorsNetwork`, `errorsDecrypt`, `errorsDB`
  - **Lifecycle**: `engineRuns`, `ttlSweeps`, `verifies`
- Emit `METRICS` events every 60s or on state change to full:  
  `{ type: 'METRICS', payload: { timestamp, category, data } }`
- Add `telemetryEnabled` flag in `meta.settings` (default false).

### 🧪 Validation (Reviewer)
- Browse online/offline → metrics reflect cache vs network vs fallback.
- Force errors → counters climb.
- `METRICS` events appear periodically and on important transitions.
- `NUKE` or `RESET_DEBUG` resets counters.

---

## 🧩 Stage 14 — Performance Hardening

### 🎯 Purpose
Ensure smooth runtime under load: bounded concurrency, back-pressure, streaming, and low memory footprint.

### 📋 Implementation Directives (Agent)
- **Concurrency control**: `ENGINE_MAX_CONCURRENCY = 4` (configurable via settings).  
  Log `[ENGINE] queue: <pending>, <active>` during operation.
- **Adaptive throttling/back-pressure**:
  - Pause Engine when: offline, tab hidden, or sustained long tasks > 250 ms.
  - Resume when conditions recover.
  - Logs: `[ENGINE] paused (reason: <…>)`, `[ENGINE] resumed (reason: <…>)`.
- **Streaming encrypt→write**:
  - Process large assets in chunks (~256 KB): stream → encrypt → write to IDB to avoid large heap spikes.
  - Log completion time and size.
- **DB batching**:
  - Commit groups of up to 20 assets per transaction; ensure atomic commits.
  - Log `[DB] batch commit: <n> assets (<bytes> total)`.
- **Memory hygiene**:
  - Release buffers after write (`null` references), optional `self.gc?.()` if available.
  - Emit memory metrics (`memoryUsageMB`) in `METRICS` events; target < 200 MB typical.

### 🧪 Validation (Reviewer)
- With ≥100 assets, observe concurrency cap in logs.
- Backgrounding tab pauses Engine; returning resumes with no duplication.
- Network throttled to Slow 3G: no crashes; progress continues slowly.
- Performance panel shows flat/controlled heap; no “Long task” warnings.
- `METRICS` include `avgEncryptTimeMs`, `memoryUsageMB`, `queueDepth`.
- End-to-end run still reaches `state=full` reliably.

---

## ✅ Notes & Guardrails Carried Across All Stages

- **Strict Isolation**: `/pwa/*` (SW/Engine/Serve/DB/Crypto) vs `/js/*` (UI/app-side). Communicate only via messages. No shared imports across contexts.
- **No Inline Scripts**: All logic is in external files. Prepares for strict CSP in production.
- **Console-First Validation**: Every module must log clear, prefixed messages for each action and decision path.
- **Same-Origin Policy**: All fetches are same-origin. No third-party network calls.
- **User Agency**: Version mismatch (Stage 7) notifies only; no silent re-downloads.
- **Localhost Exception**: Stage 12 enforcement may be disabled during local dev; must be enforced before production.

---

**End of Plan**  
This file is the authoritative implementation & validation spec for Stages **0–14**.  
Use it as the checklist for the AI agent’s work and your review process.
