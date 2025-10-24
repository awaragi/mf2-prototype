# PWA Design — Simplified Content Caching (v15)

## 1. Overview

### App Shell Cache (Angular PWA)
- Always enabled and handled automatically by `@angular/pwa`.
- The shell (HTML/JS/CSS/runtime assets) is precached per `ngsw.json`.
- Shell updates download in the background and are applied automatically on the next app open. No user prompt.

### Content Cache (Presentations + Assets)
- Always active; there is no on/off switch.
- The Angular client decides what to cache and derives coverage from stored data:
    - **Empty** — no presentations cached.
    - **Partial** — some presentations cached.
    - **Full** — all available presentations cached.
- Per-presentation flags are orthogonal booleans:
    - `cached` — all expected assets present and readable in IndexedDB.
    - `pending` — hydration/refresh is in progress.
    - `stale` — cached but past freshness window (per HTTP expiry); still served offline, queued for refresh online.

### Service Worker (Serve-Only for Content)
- Extends Angular’s SW to add content fetch handling; never writes to IndexedDB.
- Intercepts GET for API roots/attachments; serves from IDB when present, else proxies to network.
- Serves stale cached content when offline.

### Client Orchestration (Angular + Dexie)
- Tracks available content by fetching the complete list of `{id, version}` when online and storing it locally.
- If newer or missing content is detected while online, the update process begins automatically.
- On reopen, resumes any pending updates automatically.
- Uses HTTP headers (`Expires`, `Cache-Control`, `ETag`, `Last-Modified`) to mark assets/presentations stale; stale remains viewable offline.
- If a previously cached presentation is no longer in the latest list, delete it locally (removed or access revoked).

### Modes
- **Full mode:** new items auto-enqueued (`pending=true`) and hydrated.
- **Partial mode:** only user-selected items are desired; new items are visible but not enqueued automatically.

### Forward Compatibility
- Storage model is compatible with future AES-GCM encryption and optional compression.


## 2. Components and Responsibilities

### App (Angular Client)
- Extends Angular PWA capabilities to manage both shell caching and dynamic content caching.
- Maintains coverage (Empty/Partial/Full) and per-presentation flags (`cached`/`pending`/`stale`).
- Startup:
    - Load persisted settings and presentation metadata.
    - Resume any pending hydrations.
- When online:
    - Fetch full list of `{id, version}` for all available presentations.
    - Detect additions, removals, version changes, and expiries.
    - Full mode: auto-enqueue new/changed as pending.
    - Partial mode: only selected presentations are enqueued.
- Hydration with Dexie + IndexedDB:
    - Plan downloads, fetch assets, store, update progress, complete and flip flags.
- User controls:
    - **Cache All Presentations** (Full mode).
    - **Choose Presentations** (subset in Partial mode).
    - **Remove from Device** (delete selected + unreferenced assets).

### Service Worker (Extended Angular PWA)
- Intercepts GET for content; returns cached blob (with stored `Content-Type`) or proxies to network.
- Serve-only; no writes to IndexedDB.
- App shell routing/precaching remains per Angular defaults.

### Storage (IndexedDB via Dexie)
- Persists presentation metadata, assets, settings.
- Single source of truth for hydration progress and flags.
- Schema details in Section 9.


## 3. Cache Coverage Model

### Per-Presentation Flags
- `cached`: all expected assets present.
- `pending`: hydration/refresh in progress.
- `stale`: expired per HTTP headers; still served offline; refresh queued online.

### Coverage States (derived, not stored)
- **Empty** — no presentations with `cached=true`.
- **Partial** — some `cached=true` but not all available.
- **Full** — all available have `cached=true`.

### Computation
- `totalAvailable` = count from latest server list.
- `cachedComplete` = count where `cached=true`.
- Empty: `cachedComplete = 0`
- Partial: `0 < cachedComplete < totalAvailable`
- Full: `cachedComplete = totalAvailable`

### Automatic Adjustments
- Hydration completes → `cached=true`, `pending=false`, `stale=false`.
- Version change detected → `pending=true`; keep `cached=true` until new version completes.
- Expiry reached → `stale=true`; `pending=true`; refresh when online.
- Removal from server list → delete presentation and its unreferenced assets.


## 4. Hydration Orchestration (Client)

### 4.1 Discover
- On startup and when online, fetch complete `{id, version}` list.
- Optionally collect expiry/validation metadata (`Expires`, `Cache-Control`, `ETag`, `Last-Modified`).

### 4.2 Plan (Diff)
- Determine mode:
    - **Full:** all available are desired.
    - **Partial:** only user-selected are desired.
- For each server presentation:
    - **New:**
        - Full: `pending=true`; enqueue hydration.
        - Partial: do not enqueue until selected.
    - **Version changed:** `pending=true` (keep `cached=true` until replacement completes).
    - **Missing from server:** enqueue remove (revoked/removed).
    - **Expired assets:** `stale=true`; `pending=true` for refresh.

### 4.3 Execute (Hydrate/Refresh)
- Build `expectedUrls` from presentation definition.
- For each expected URL:
    - If missing, fetch and store (type/size/etag/expiry/ts).
    - If present but stale, revalidate (`If-None-Match` / `If-Modified-Since`); replace on change.
- On completion:
    - `cached=true`; `pending=false`; `stale=false`; `updatedAt` recorded.

### 4.4 Cleanup
- Remove old/unreferenced assets (respect shared references across presentations).

### 4.5 Progress & Coverage
- Track `cachedCount`/`expectedCount` plus flags (`cached`/`pending`/`stale`).
- Recompute coverage badge (Empty/Partial/Full) continuously.

### 4.6 Resilience & Continuity
- Persist queue/progress; resume on reopen.
- Serve stale when offline (grace period).
- Concurrency limits and retry with backoff.
- Integrity checks (size/ETag) before replacing.

### 4.7 Triggers
- **Automatic:** online, version/expiry changes.
- **User-initiated:** Cache All (switch to Full), Choose Presentations (Partial), Remove from Device.


## 4A. Data Flow Diagram

```
                        ┌────────────────────┐
                        │   Server (API)     │
                        │  {id, version,...} │
                        └─────────┬──────────┘
                                  │
                       (online sync / fetch)
                                  │
                                  ▼
                ┌────────────────────────────────┐
                │        Angular Client           │
                │ (Hydration Orchestration Layer) │
                └────────────────┬────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
  ┌───────────────┐        ┌──────────────┐         ┌──────────────┐
  │  Plan / Diff  │        │ Hydrate /    │         │  Cleanup     │
  │  Compare local│        │ Refresh loop │         │  Orphans etc │
  │  {id,version} │        │ (pending→cached)│      │              │
  └───────────────┘        └──────────────┘         └──────────────┘
          │                        │                        │
          │ writes                 │ writes                 │ deletes
          ▼                        ▼                        ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                    Dexie / IndexedDB                         │
 │--------------------------------------------------------------│
 │  presentations(id, version, cached, pending, stale, expiresAt)│
 │  assets(url, blob, type, etag, expiresAt, ts)                 │
 │  settings(mode, desired[], lastSync)                          │
 │  map(optional reverse refs)                                   │
 └──────────────────────────────────────────────────────────────┘
          ▲                        │
          │ reads                  │ reads
          │                        │
   ┌────────────────────────────────────────────────────────┐
   │     Service Worker (Extended Angular PWA)              │
   │--------------------------------------------------------│
   │ • Intercepts GET for API/attachments                   │
   │ • Reads from IndexedDB assets                          │
   │ • Serves cached or stale assets when offline           │
   │ • Proxies to network if not cached                     │
   │ • Never writes                                         │
   └────────────────────────────────────────────────────────┘
          ▲
          │ (offline fetch)
          │
          ▼
  ┌────────────────────┐
  │  Browser Runtime   │
  │ (User interacting) │
  └────────────────────┘
```

## 4B. Mode Transitions (Full ↔ Partial)

```
           ┌──────────┐
           │  START   │
           └────┬─────┘
                │
                ▼
        ┌───────────────┐
        │ Read settings │
        │  mode = ?     │
        └────┬──────────┘
             │
   ┌─────────┴─────────┐
   │                   │
   ▼                   ▼
┌───────┐          ┌─────────┐
│ FULL  │          │ PARTIAL │
└───┬───┘          └────┬────┘
    │                   │
    │ auto-desire ALL   │ desire = user-selected
    │ new+changed →     │ new (unselected) → do NOT enqueue
    │ pending=true      │ changed (selected) → pending=true
    │                   │
    ▼                   ▼
 (Hydration queue & orchestration as in §4)
    │                   │
    └──────────┬────────┘
               │
   User action / Settings change
               │
     ┌─────────▼─────────┐
     │  SWITCH MODES     │
     └─────────┬─────────┘
               │
   ┌───────────┴─────────────────────────────────────────────┐
   │ FULL → PARTIAL                                          │
   │ - Stop auto-enqueue for newly discovered items.         │
   │ - Keep existing cached items unless user removes them.  │
   │ - Dehydrate only selected ones going forward.           │
   └─────────────────────────────────────────────────────────┘
   ┌─────────────────────────────────────────────────────────┐
   │ PARTIAL → FULL                                          │
   │ - Add all non-selected items to desired set.            │
   │ - Mark missing ones pending=true; begin auto-hydration. │
   │ - Coverage target becomes “all available”.              │
   └─────────────────────────────────────────────────────────┘
```

## 5. Serving Logic (Service Worker)

### Scope & Principles
- Serve-only for content; SW never writes to IDB or revalidates.
- Angular PWA owns shell precache/update via `ngsw.json`.
- Intercepts GET for content (API roots, attachments) only.

### Routing
- App shell assets → Angular defaults.
- Non-GET → proxy to network.
- Content GET → try IDB; else network.

### Decision Tree
- If asset in IDB:
    - Offline → serve cached (even if stale).
    - Online → serve cached; client refreshes in background.
- If asset not in IDB:
    - Online → proxy to network.
    - Offline → synthetic 503; app shows graceful UI.

### Headers for Cached Hits
- Use stored `Content-Type` (and `Content-Length` if tracked).
- Do not synthesize validators (`ETag`, `Last-Modified`) in SW.

### Proxy Behavior
- Forward credentials/CORS as-is; return response verbatim.
- On failures online, surface error; client handles retries.
- Range: no slicing for cached blobs; proxy range to network if not cached.

### Security and Allowlisting
- Intercept only allowlisted origins/paths.
- No cross-origin exposure of IDB.

### Non-Goals
- No background writes, no in-SW freshness checks, no inflight dedupe.


## 6. App Shell Caching

### Ownership & Scope
- `@angular/pwa` fully manages the app shell (HTML/JS/CSS/runtime assets).

### Precaching & Lifecycle
- Shell is precached per `ngsw.json`.
- New shell versions are downloaded in the background and applied automatically on next launch.

### Separation from Content Cache
- Shell updates do not affect IDB data or hydration queues.
- After activation, the client resumes pending work and recomputes coverage.

### Resilience
- Mid-hydration shell updates are safe; progress persists.
- Angular PWA recovers shell assets from prior cache or network if needed.


## 7. Per-Presentation Versioning (Simplified)
- Each presentation carries a server-supplied version string.
- When a presentation’s version changes:
    - Mark all its assets `pending` and update them.
    - Keep existing cached assets until replacement completes (continuity).
    - Delete unreferenced assets after refresh.
- Enables independent, incremental updates without restating orchestration details.


## 9. Dexie Schema (Descriptive)

### Database
- **Name:** `content-cache`
- **Purpose:** Source of truth for presentations, assets, settings.
- **Writer:** Angular client via Dexie. SW is read-only.

### Tables

#### presentations
| Field | Type | Description |
|---|---|---|
| id | string | Presentation identifier |
| version | string | Server-supplied version |
| expectedUrls | array<string> | Expected asset URLs |
| expectedCount | number | Number of expected assets |
| cachedCount | number | Cached assets count |
| cached | boolean | All assets complete |
| pending | boolean | Hydration in progress |
| stale | boolean | Expired but viewable offline |
| updatedAt | epoch ms | Last successful hydration |
| expiresAt | epoch ms (optional) | Derived from headers |

#### assets
| Field | Type | Description |
|---|---|---|
| url | string (PK) | Absolute URL |
| blob | binary | Asset payload |
| type | string | MIME type |
| size | number | Bytes stored |
| etag | string (optional) | For revalidation |
| ts | epoch ms | Stored timestamp |
| expiresAt | epoch ms (optional) | Expiry per header |

#### settings
| Field | Type | Description |
|---|---|---|
| id | string | Always "settings" |
| mode | string | "full" or "partial" |
| desired | array<{id, version}> | User-selected presentations |
| lastSync | epoch ms | Last server sync |
| lastSchemaVersion | string | For DB migrations |

#### map (optional)
| Field | Type | Description |
|---|---|---|
| url | string (PK) | Asset URL |
| pids | array<string> | Referencing presentation IDs |

### ASCII Table Diagram

```
┌────────────────────────────────────────────────────────────┐
│                  DATABASE: content-cache                   │
│------------------------------------------------------------│
│  Manages offline presentation data, assets, and settings.  │
│  Read-only for Service Worker; read/write for Angular app. │
└────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ TABLE: presentations                         │
├──────────────────────────────────────────────┤
│ id (string, PK)                              │
│ version (string)                             │
│ expectedUrls (array<string>)                 │
│ expectedCount (number)                       │
│ cachedCount (number)                         │
│ cached (boolean)                             │
│ pending (boolean)                            │
│ stale (boolean)                              │
│ updatedAt (epoch ms)                         │
│ expiresAt (epoch ms, optional)               │
└──────────────────────────────────────────────┘
                │
                │ 1..* (presentation → assets)
                ▼
┌──────────────────────────────────────────────┐
│ TABLE: assets                                │
├──────────────────────────────────────────────┤
│ url (string, PK)                             │
│ blob (binary)                                │
│ type (string, MIME)                          │
│ size (number, bytes)                         │
│ etag (string, optional)                      │
│ ts (epoch ms)                                │
│ expiresAt (epoch ms, optional)               │
└──────────────────────────────────────────────┘
                ▲
                │ *..* (via optional reverse map)
                ▼
┌──────────────────────────────────────────────┐
│ TABLE: map (optional)                        │
├──────────────────────────────────────────────┤
│ url (string, PK)                             │
│ pids (array<string>) → references presentations.id │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ TABLE: settings (singleton)                  │
├──────────────────────────────────────────────┤
│ id = "settings"                              │
│ mode ("full" | "partial")                    │
│ desired (array<{ id, version }>)             │
│ lastSync (epoch ms)                          │
│ lastSchemaVersion (string)                   │
└──────────────────────────────────────────────┘
```


## 10. Boot Flow

### Overview
Ensures both shell and content caches are synchronized before the app is interactive.

### Startup Sequence
1. **Load App Shell** — available offline; updates apply automatically next open.
2. **Initialize Dexie** — open DB, read settings, determine mode and desired list.
3. **Recover Session** — resume any pending hydrations.
4. **Fetch Availability (online)** — retrieve `{id, version}`, store snapshot, diff with local.
5. **Plan & Queue** — new/changed = pending=true; expired = stale=true/pending=true; missing on server = delete; apply mode rules.
6. **Execute Hydration** — fetch/store assets, update flags, mark complete.
7. **Cleanup & Coverage** — remove unreferenced assets; recompute coverage.
8. **Serve & Operate** — SW serves cached/stale offline, proxies uncached; client monitors expiry.

### Resilience
- Persist state after each write; resume on reopen.
- Stale remains usable offline.
- Mode transitions preserve data and recompute coverage next sync.


## 13. Future Extensions

### 13.1 Encryption at Rest
- AES-GCM wrap before write; SW decrypts on read. App-level key management.

### 13.2 Compression
- Lossless compression (e.g., Brotli/Gzip) before encryption; store encoding and `originalSize`.

### 13.3 Delta Updates
- Server-provided diffs per presentation (`baseVersion → newVersion`); fall back to full download on validation failure.

### 13.4 Background/Periodic Sync
- Idle-until-urgent hydration via Background/Periodic Sync; keeps content fresh automatically.

### 13.5 Predictive Prefetch
- Prefetch likely-next presentations based on usage patterns; especially useful in Partial mode.

### 13.6 Diagnostics and Telemetry
- Optional logging: coverage %, hydrate time, bytes per refresh, eviction rate, quota pressure.
