
# PWA Design — Encrypted Offline Caching, Presentation‑First, Proxy‑While‑Caching
**Version:** v12 (detailed) — supersedes earlier v11.x drafts  
**Authoring context:** Consolidates all decisions from the conversation:
- Caching is **entirely in the Service Worker (SW)** — the app never orchestrates content caching.
- Strict **Serve vs Engine** split inside the SW.
- **Proxy‑while‑caching** UX (no blocking on downloads).
- **Presentation‑first**, **atomic** completion, **resumable**, **shared‑asset reuse**.
- **Version snapshot & end‑of‑session verify** (using `/content-version.json`).
- **App shell caching** elaborated via `/app-manifest.json`.
- **Staleness** driven by HTTP expiration headers (Cache‑Control/Expires).
- **States:** Off → Partial → Full, with auto‑resume and online stale purge.

---

## 1) Goals & Non‑Goals

### Goals
- PWA that loads `presentation[]` (with all slides & assets) and works offline once fully cached.
- **Encrypted‑at‑rest** content for all cached assets (images/JSON/etc.).
- **Binary presentation cache**: a presentation is “Cached” only when *all* its required assets are present; app is “Full” when *all presentations* are cached.
- **Proxy‑while‑caching**: users get live data immediately; caching runs in background.
- **Version control**: snapshot contentVersion before caching; verify after; if changed → notify only.
- **Resumability**: Crash/close restarts caching where it left off.
- **No chunking** complexity required.

### Non‑Goals
- No per‑user secrets management beyond hardcoded key (meets the stated “non‑malicious leaks” model).
- No background periodic checks beyond “on open if online” (explicitly simplified).
- No byte‑content diffing; identity is by URL + TTL freshness.

---

## 2) System Overview

```
+-----------------+           +----------------------+
|     Web App     |           |   API (same origin)  |
| index.html      |           |  /                   |
| styles.css      |  fetch    |  /attachments/...    |
| js/app.js    <----------------  /content-version.json
| manifest.webmanifest           |                    |
+---------^-------+           +-----------^----------+
          |                               |
          |                               |
          |            control+events     |
          |         +---------------------v--------+
          |         |       Service Worker         |
          |         |  sw.js                       |
          |         |   ├─ sw-serve.js   (Serve)   |
          |         |   └─ sw-engine.js  (Engine)  |
          |         |  cache-db.js / crypto.js     |
          |         +------------------------------+
          |                       |
          |                       | encrypted blobs
          |                       v
          |                 IndexedDB (content)
          |
          |  plaintext shell
          v
   Cache Storage (shell)
```

---

## 3) Files & Endpoints

### App bundle
```
/index.html
/styles.css
/js/app.js
/js/events.js                # message/event names & tiny helpers (optional)
/pwa/manifest.webmanifest    # installable PWA manifest
/pwa/sw.js                   # composes serve + engine + shell
/pwa/sw-serve.js             # Serve module (independent of engine inflight)
/pwa/sw-engine.js            # Engine module (presentation-first, resumable)
/pwa/cache-db.js             # IndexedDB adapters (meta/progress/assets)
/pwa/crypto.js               # AES-GCM helpers; versioned key
/pwa/constants.js            # API_BASE, CHANNEL_NAME, etc.
/app-manifest.json           # { appVersion, shell:[...] } for shell precache
```

### API endpoints
- `GET ${API_BASE}/` → **presentation[]** with all slides and attachments
- `GET ${API_BASE}/attachments/...` → binary assets
- `GET ${API_BASE}/content-version.json` → `{ "contentVersion": "YYYYMMDD-<hash>" }`

> All content (JSON or binary) fetched from `${API_BASE}` is eligible for encrypted storage.

---

## 4) Security Posture

- **Content encryption**: AES‑GCM‑256 with random 96‑bit IV; ciphertext only in IndexedDB.
- **Key**: Hardcoded, versioned 32‑byte key in `/pwa/crypto.js` (acceptable per threat model).
- **App shell**: Cached plaintext in Cache Storage (public resources).
- **CSP**: No inline script; `connect-src` limited to API origin; `img-src 'self' blob:`; `object-src 'none'`.
- **HTTPS** is mandatory; SW scope is `/`.

---

## 5) Caching States & Semantics

- **Off** (default): No encrypted content reads/writes. Serve is proxy‑only; offline API/assets fail.
- **Partial**: Caching enabled; at least one presentation incomplete. Engine runs in background. Serve keeps proxying; if asset available it *can* be served offline.
- **Full**: Every presentation complete. Online Serve still proxies by default; offline Serve returns decrypted assets.

**Transitions**
- Off → Partial: User taps **Activate Offline** (Engine starts).
- Partial → Full: Engine completes all presentations.
- Partial/Full → Off: User **Disables Offline** (encrypted store wiped).

---

## 6) App Shell Caching (Elaborated)

1) **Install**: SW fetches `/app-manifest.json`, precaches each `shell[]` entry into `shell-<appVersion>` cache.
2) **Activate**: Deletes old `shell-*` caches ≠ current `appVersion`; `clients.claim()` to control the page.
3) **Open (online)**: Re‑fetch `/app-manifest.json`; if `appVersion` differs from active shell cache key:
   - Place new shell under a waiting SW per the standard lifecycle.
   - Emit **`APP_UPDATE_AVAILABLE`** so the UI can **Reload**.
4) **Offline**: Shell loads from Cache Storage, regardless of content caching state.

---

## 7) Versioning of Content (Snapshot → Session → Verify)

- On **app open**, **if online** and caching is enabled:
  1) **Snapshot** `targetContentVersion` by fetching `${API_BASE}/content-version.json` and storing it in IDB meta.
  2) Fetch `${API_BASE}/` to get `presentation[]`. Engine derives **Expected URL Sets** internally.
  3) Start a **caching session** strictly bound to `targetContentVersion`.
- **End‑of‑session verify**:
  - When Engine believes Full is achieved, fetch `content-version.json` again:
    - If **same**: mark `lastCompleteContentVersion = targetContentVersion` and keep **Full**.
    - If **different**: emit **`CONTENT_REFRESH_RECOMMENDED`** (no auto recache).

> If content version changes **after** Full, follow **normal flow**: alert user via `CONTENT_REFRESH_RECOMMENDED` and only recache if they opt in.

---

## 8) Staleness / TTL (from Response Headers)

- On each network fetch used for caching, parse TTL:
  - Prefer `Cache-Control: max-age=N` → `expiresAt = now + N`.
  - Else parse `Expires: <http-date>`.
  - Else `expiresAt = null` (treated as not automatically expiring; still replaced by new version sessions).
- On **open** (online) with caching enabled:
  - Sweep `assets`:
    - If `now > expiresAt`: mark as **stale** → **delete** the asset.
    - For each deleted asset, **downgrade** affected presentations to incomplete (Partial).
  - After sweep, Engine **auto‑resumes** to regain Full.

> During normal online browsing, if Serve detects a local asset is stale (expired), it will **not** serve from cache; it proxies instead. The background sweep/engine handles deletion and refill.

---

## 9) Strict Separation: Serve vs Engine

### Serve (`sw-serve.js`)
- Handles **all fetch events** for API base & `/attachments/...`.
- Decision logic:
  1) If **asset exists** in encrypted store (and not stale): **decrypt & return**.
  2) Else: **proxy** network response directly to page.
- If network fails and asset exists: **serve decrypted fallback**.
- **Never** uses or signals Engine’s in‑flight requests; **no crediting** in Serve path.

### Engine (`sw-engine.js`)
- Runs **independently** of Serve.
- Starts on: activation (if enabled), open (online snapshot), resume after crash/close, post‑stale sweep, or user trigger.
- **Presentation‑first loop** (resumable):
  - For each `pid`:
    - For each `u` in `expectedUrls[pid]`:
      - If `assetsIndex` has `u` and not stale → **credit** `pid` immediately; continue.
      - Else fetch (Engine’s *own* inflight dedupe applies **inside Engine only**), **encrypt**, **store**, **credit**.
    - When `creditedCount(pid) === expectedCount(pid)`: flip `complete=true` atomically; emit `PRESENTATION_COMPLETE { id }`.
  - When all `pid` complete: run **version verify** (see §7).

> **Engine ignores Serve in‑flight requests**; **Serve ignores Engine in‑flight**. This reduces race conditions and couples cache state only to what’s *committed* to IDB.

---

## 10) Reuse of Existing Assets

### Resume after crash/close
- On SW startup, Engine loads:
  - `cachingEnabled`, `targetContentVersion`,
  - `progress` per presentation,
  - `assetsIndex` (URL presence), and TTL metadata to know which are still fresh.
- Engine rebuilds expected sets (from latest root if online; else from cached root if present).
- For each presentation:
  - **Credit immediately** for URLs already present & fresh.
  - Skip network for those; fetch only missing URLs.
  - Continue to presentation completion, then to global Full.

### Refresh after content version update (user‑accepted)
- Snapshot the **new** `targetContentVersion`.
- Build new expected sets.
- For each URL in new sets:
  - If the **same URL** is **already present** and **fresh**, **reuse** (credit only; no re‑download).
  - Else fetch → encrypt → store → credit.

> Reuse is based on **URL identity and freshness** (not bytes). This is consistent with API‑controlled cache busting (e.g., versioned URLs).

---

## 11) Data Model (IndexedDB)

### Stores
- **meta**
  - `settings`: `{ cachingEnabled: boolean, targetContentVersion: string|null, lastCompleteContentVersion: string|null }`
  - `schemaVersion`, `keyVersion`
- **progress** (per presentation)
  - `{ id, expectedUrls: string[], expectedCount: number, creditedCount: number, complete: boolean, sessionVersion: string }`
- **assets** (encrypted blobs)
  - `{ url: string, iv: number[12], ct: Uint8Array, type: string, ts: number, expiresAt: number|null }`
- **assetsIndex** (optional helper for presence checks)
  - `{ url: string }`

### Atomicity guarantees
- Each asset write + presentation credit are applied in one transaction or consistent steps (write → index → credit). If any step fails, partial changes are rolled back or retried.
- `complete=true` flips only once per presentation and is durable.

---

## 12) SW <-> App Protocol (Minimal)

### Commands (App → SW)
- `ACTIVATE_CACHING`  
  Sets `cachingEnabled=true`. If online: snapshot version, build expected sets (Engine), start background caching → state becomes **Partial**.
- `DEACTIVATE_CACHING`  
  Sets `cachingEnabled=false`, wipes encrypted `assets` + `assetsIndex` → state **Off**.
- `PREFETCH_ALL` / `PREFETCH_PRESENTATION { id }`  
  Optional manual triggers (Engine runs in background).
- `CACHE_STATUS`  
  Returns `{ state:'off'|'partial'|'full', version, totals:{ credited, expected }, perPresentation:[{ id, credited, expected, complete }] }`.
- `NUKE`  
  Hard reset (wipe encrypted content + optionally old shell caches). SW responds; app reloads.

### Events (SW → App) — via BroadcastChannel + postMessage
- `STATUS { state, version, totals, perPresentation }`
- `PRESENTATION_PROGRESS { id, credited, expected }`
- `PRESENTATION_COMPLETE { id }`
- `APP_UPDATE_AVAILABLE`
- `CONTENT_REFRESH_RECOMMENDED`

> Communications are **lean**; the app toggles and visualizes only.

---

## 13) Request Handling Matrix (Serve)

| State   | Online behavior                                   | Offline behavior                         |
|---------|----------------------------------------------------|------------------------------------------|
| **Off** | **Proxy** network; do not read/write encrypted DB  | 503 for API/assets; shell still works    |
| **Partial** | **Proxy** network (Engine caches separately)  | Serve decrypted if available; else 503   |
| **Full** | **Proxy** by default; can still serve cache if desired | Serve decrypted (fully offline)     |

> Serve uses encrypted cache **only** when an asset is available and fresh (or when offline).

---

## 14) Lifecycle & Control Flows

### A) App Open (Online, Caching Enabled)
1. Shell loads from Cache Storage; app registers SW.
2. SW rechecks `/app-manifest.json` for app updates → maybe `APP_UPDATE_AVAILABLE`.
3. SW fetches `/content-version.json` → snapshots `targetContentVersion`.
4. SW fetches root `/` → Engine builds expected sets.
5. Engine runs presentation‑first loop until all complete.
6. Engine rechecks `/content-version.json`:
   - Same → mark Full; store `lastCompleteContentVersion`.
   - Different → emit `CONTENT_REFRESH_RECOMMENDED` (no auto recache).

### B) App Open (Offline, Caching Enabled)
- Shell loads; Serve can return decrypted assets already stored.
- Engine waits (no version snapshot possible). State remains Partial/Full depending on DB.

### C) Online Stale Sweep (on Open)
- For each asset where `now > expiresAt` → delete asset.
- Downgrade any presentation referencing it to incomplete.
- Emit `STATUS`; Engine auto‑resumes to return to Full.

### D) Crash/Close Resume
- On SW start, load meta/progress/index.
- If incomplete → Engine continues where it left off.

---

## 15) Error Handling & Recovery

- **Network failure** (online path fails): Serve proxies by default; if proxy fails but asset exists, Serve decrypts and returns cached version as fallback.
- **Decryption error** (e.g., wrong keyVersion): Delete corrupt item; Engine re‑fetches next time online.
- **DB errors**: Retry with exponential backoff; surface a soft error in `STATUS` if persistent.
- **Version mismatch at end**: Only alert; don’t auto recache (as specified).

---

## 16) Testing Plan (QA)

- **First‑run online** → Activate → Partial → Full → switch to airplane mode → all slides render offline.
- **Resume**: Kill tab mid‑prefetch; reopen → Engine continues and reaches Full.
- **Shared assets**: two presentations reference same image → fetched once; both credited to completion.
- **Serve/Engine isolation**: During prefetch, user navigation is instant (proxy path); no races.
- **TTL from headers**: Set short max‑age for a known asset; on next open online → asset purged, presentation downgraded, Engine refills it.
- **Version end‑verify**: Change `content-version.json` after cache completes → banner appears; accepting refresh reuses identical URLs.
- **App update**: Change `/app-manifest.json` `appVersion` and shell list → banner appears; reload swaps shells.

---

## 17) Config Constants

- `API_BASE: string`
- `CHANNEL_NAME = 'pwa-events'`
- `APP_SHELL_CACHE_PREFIX = 'shell-'`
- `KEY_VERSION: number` (selects active AES key in `/pwa/crypto.js`)

---

## 18) Open Questions (none outstanding)
All points clarified:
- Staleness from **response headers** only.
- After Full, if version updates later → **notify only**, no auto recache.
- Serve ignores Engine inflight; Engine ignores Serve inflight.
- During caching, **Serve always proxies** unless asset is already available.

---

## 19) Glossary
- **Credit**: Count a URL toward a presentation’s completion when its encrypted asset is confirmed present & fresh.
- **Complete (presentation)**: `creditedCount === expectedCount` for the current sessionVersion.
- **Full (app)**: All presentations complete for current `targetContentVersion` and end‑verify passed.
- **Proxy‑while‑caching**: Serve returns network responses immediately; Engine caches in background.
