# PWA Design — Simplified POC (Single File Presentations)

## 1. Overview

### Simplified Architecture
This is a streamlined PWA design for a Proof of Concept that focuses on basic offline functionality:

- **Single File Format**: All presentations are contained in one file with all slides and their content (minus actual images)
- **Full Mode Only**: Cache all presentations or none (no partial selection) - two buttons to load all or delete
- **No Versioning**: Simple one-time loading without change detection
- **Basic Asset Types**: Images (with src) and HTML snippets containing images that we need to parse to get their src
- **IndexedDB Storage**: Simple schema for just the assets
- **Service Worker Intercept**: Basic fetch interception for offline serving

### Core Components
1. **HTML/JS Client**: Manages presentation loading and IndexedDB operations - new page (offline.html with associated js/app-offline.js)
2. **Service Worker**: Intercepts requests and serves cached content
3. **IndexedDB**: Stores presentations and extracted assets (shared between /sw and /js)
4. **Simple UI**: Load all presentations button and offline indicator and nuke all button

## 2. Data Model (Simplified)

### Presentation Structure
Each presentation file contains:
