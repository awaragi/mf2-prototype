# Execution Plan: Responsive Presentation Web App (4:3 Slide Deck)

**Goal:** Implement the app in small, testable stages. After each stage, you can open `present.html` in a browser and validate the listed checks.  
**Stack:** Vanilla HTML/CSS/JS, Bootstrap 5 + Bootstrap Icons (via CDN). No build tools.

---

## Stage 0 — Project Scaffold

**Create files**
```
/ (root)
  ├─ present.html
  ├─ styles.css
  ├─ app-present.js
  ├─ slides.js
  └─ assets/
      └─ cgi-logo.png   (download from https://www.cgi.com/en/cgi-downloads)
```

**Present skeleton**
- Minimal HTML5 doc.
- Load Bootstrap 5 CSS/JS and Bootstrap Icons via CDN.
- Link `styles.css`, `app-present.js`, and `slides.js` (defer).
- Add root containers:
    - `<header id="app-header">...</header>`
    - `<main id="app-main">...</main>`

**Test**
- Open `present.html`. No console errors. Page shows empty header+main.

---

## Stage 1 — Header (Sticky Navbar)

**Implement**
- Sticky header with:
    - Left: CGI logo image (fits header height with padding) + `<span id="current-title">` (empty initially).
    - Right: buttons:
        - Grid icon button (bi bi-grid) → `#btn-grid`
        - Hamburger (bi bi-list) → `#btn-menu` opens dropdown:
            - Fullscreen toggle → `#menu-fullscreen`
            - Bookmarks (placeholder)
            - About (placeholder)
- Clicking logo goes to root path: clears hash (`location.hash = ''`).

- Visuals: white bg, subtle bottom border, minimal height.

**Test**
- Header remains at top on scroll.
- Logo clickable → removes hash.
- Dropdown opens/closes; items clickable (no-op except fullscreen later).

---

## Stage 2 — Slide Stage Container (Aspect Ratio Shell)

**Implement**
- In `<main>`, add:
    - `<section id="stage-wrap">` (flex center; fills viewport minus header).
    - Inside: `<div id="stage">` the 4:3 logical slide surface (base 1024×768) with white bg, soft shadow, rounded corners.
    - Add spinner placeholder: `<div id="stage-loading" aria-hidden="true"></div>` (CSS spinner).
- CSS:
    - `#stage` maintains 4:3 via `aspect-ratio: 4 / 3;` and `transform: scale(...)` *or* size math—choose one approach, but ensure no overflow.
    - `#stage-wrap` centers the scaled stage.
- JS:
    - Constants:
      ```js
      const INACTIVITY_HIDE_MS = 1000;
      const BASE_W = 1024;
      const BASE_H = 768;
      ```
    - Compute available size (viewport minus header) and scale stage to max that fits 4:3 without scrollbars. Recompute on `resize`/`orientationchange`.

**Test**
- Resize window; stage remains centered, 4:3, no horizontal scrollbar.

---

## Stage 3 — Sample Slide Data (slides.js)

**Implement**
- Default export an array of 6 slides:
    - 1: HTML only
    - 2: HTML + `additional`
    - 3: HTML + `additional`
    - 4: Image-only (`template: "img"`)
    - 5: Image + `additional`
    - 6: HTML only
- Structure:
  ```js
  export default [
    { id: "intro", title: "Welcome", template: "html", html: "<h1>...</h1><p>...</p>" },
    { id: "agenda", title: "Agenda", template: "html", html: "...", additional: "<p>...</p>" },
    { id: "details", title: "Details", template: "html", html: "...", additional: "<ul>...</ul>" },
    { id: "image-1", title: "Diagram", template: "img", src: "https://..." },
    { id: "gallery", title: "Photo", template: "img", src: "https://...", additional: "<p>Caption...</p>" },
    { id: "outro", title: "Thanks", template: "html", html: "<h2>...</h2>" }
  ];
  ```

**Test**
- `slides.js` loads with no errors (temporarily log the array in `app-present.js`).

---

## Stage 4 — Slide Rendering (Initial Load)

**Implement**
- In `app-present.js`, import slides:
  ```js
  import slides from './slides.js';
  ```
- Determine initial slide from `location.hash` (`#slide-id`), else index 0.
- While first slide is “loading”, show centered spinner (`#stage-loading` visible). After render, hide spinner.
- Render:
    - If `template:"html"`: inject sanitized HTML into `#stage` logical surface.
    - If `"img"`: create `<img>`; show per-image spinner until `load`.
- Update document title:
    - `"Presentation - Title"` or `"Presentation - Slide X"`.
- Update header `#current-title`.

**Test**
- Load first slide quickly; spinner visible only during first render.
- Titles update correctly.

---

## Stage 5 — Progressive Preload (Background)

**Implement**
- After initial render, begin preloading the *rest*:
    - For HTML slides, no extra work.
    - For image slides, create `Image()` and cache by `id`.
- Log progress to console only: `"Preloaded N / total"`.

**Test**
- Open DevTools → Console logs show progressive counts.
- Navigating to preloaded image slide is instant (no visible spinner).

---

## Stage 6 — Navigation Controls (Prev/Next + Keyboard)

**Implement**
- Floating circular buttons:
    - Left: `#btn-prev` (bi bi-chevron-left)
    - Right: `#btn-next` (bi bi-chevron-right)
- Position: fixed at viewport edges, vertically centered, high z-index; 25% opacity default; hover: slightly larger/brighter.
- Handlers:
    - Click prev/next → change slide.
    - Keyboard:
        - Next: `ArrowRight`, `PageDown`, `Space`
        - Prev: `ArrowLeft`, `PageUp`
        - First: `Home`
        - Last: `End`
- On slide change, scroll page to top.

**Test**
- Buttons navigate correctly; keyboard shortcuts work.
- Page scrolls to top on each change.

---

## Stage 7 — URL Hash Routing (Back/Forward)

**Implement**
- On each slide change, set `location.hash = '#{id}'`.
- Listen to `hashchange` → render corresponding slide (if invalid, go to first and fix hash).
- No page reloads; history back/forward navigates slides.

**Test**
- Navigate a few slides, hit Back/Forward; slides update; hash matches.
- Invalid hash on refresh defaults to first slide and updates hash.

---

## Stage 8 — Additional Content Area

**Implement**
- Below `#stage`, add `<section id="additional">` (hidden when no `additional`).
- When slide has `additional`, show container with the **same effective width** as the scaled stage.
    - Compute width from current stage scale and BASE_W.
    - Add small vertical gap.
- When slide has no `additional`, page should not scroll vertically.

**Test**
- Slides with `additional` show aligned content and allow vertical scroll.
- Slides without `additional` → no vertical scrollbar.

---

## Stage 9 — Slide Overview Bar (Grid)

**Implement**
- Hidden by default. Clicking `#btn-grid` toggles a bottom floating bar (`#overview`).
- Layout:
    - Width = 75% of available, centered.
    - Height ≈ 2× header height.
    - Horizontal scroll if thumbnails overflow.
- Thumbnails:
    - 4:3 boxes with slide number and optional title.
    - Current slide highlighted using CGI colors.
- Behavior:
    - Appears with slide-up animation; remains visible until toggled off.
    - Click thumb → navigate to that slide (overview remains visible).
    - Positioning:
        - If page has additional content and user scrolls, the bar moves up with page to stay aligned with bottom edge of the slide area.
        - If no additional content, stays at bottom of slide area.

**Test**
- Toggle grid; smooth animation in/out.
- Thumbs scroll horizontally when needed.
- Clicking a thumbnail navigates correctly and highlights active slide.

---

## Stage 10 — Hamburger Menu + Fullscreen

**Implement**
- Dropdown item **Fullscreen** toggles document fullscreen via Fullscreen API; also bind key `F`.
- Close menu on outside click or selection.
- Bookmarks/About remain placeholders (no-op).

**Test**
- `F` key and menu item both enter/exit fullscreen.
- Menu opens/closes correctly.

---

## Stage 11 — Swipe Gestures (Touch & Pointer)

**Implement**
- Custom swipe recognizer using Pointer Events:
    - Track `pointerdown`, `pointermove`, `pointerup/cancel`.
    - Ignore mostly vertical drags (set angle/threshold).
    - Swipe left → next; swipe right → previous.
    - Support touch devices and pointer-capable devices.
- Prevent conflict with vertical scroll on `#additional`.

**Test**
- On touch device or emulator:
    - Horizontal swipe changes slides.
    - Vertical scroll on additional content is unaffected.

---

## Stage 12 — Auto-Hide Navigation

**Implement**
- Hide `#btn-prev` / `#btn-next` after `INACTIVITY_HIDE_MS` of no user input.
- Show on any interaction: mousemove, click, keydown, pointer events, touch.
- Don’t hide while menus/overview are open.

**Test**
- After 1s idle, buttons fade out.
- Any interaction shows them again.

---

## Stage 13 — Visual Polish & Branding

**Implement**
- Colors (CGI):
    - Red `#E31937`, Purple `#5236AB`, White `#ffffff`, Black `#000000`.
- Theme:
    - Light background; brand accents in header border, active thumbnail highlight, focus/hover states.
- Typography:
    - System sans-serif; use `clamp()` for responsive heading/body sizes inside slides.
- Buttons:
    - Subtle borders; hover feedback using brand colors.
- Stage aesthetics:
    - White slide surface, soft shadow, rounded corners.

**Test**
- Check contrast and readability.
- Active states visibly use CGI colors.

---

## Stage 14 — Robustness: Resizing & Orientation

**Implement**
- Debounced resize/orientation recalculation of stage scale.
- Re-verify additional content width sync after scale changes.
- Ensure no layout jitter (avoid forced sync layout thrash).

**Test**
- Rapidly resize window; scale stays stable, no jitter.
- Rotate mobile emulator; slide fills correctly.

---

## Stage 15 — Cross-Browser Smoke Tests

**Do**
- Desktop: Chrome, Edge, Firefox, Safari.
- Mobile: Chrome (Android), Safari (iOS).
- Validate:
    - Aspect ratio and scaling.
    - Keyboard shortcuts (desktop).
    - Swipe (mobile).
    - Fullscreen (where supported).
    - Hash routing.

**Test**
- Note any browser-specific quirks; apply minimal conditionals if required.

---

## Stage 16 — Final Acceptance Checklist

**Layout & Scaling**
- [ ] Slide maintains 4:3 aspect ratio at all times.
- [ ] No horizontal scrollbars.
- [ ] Full slide visible when no extra content.
- [ ] Additional content width matches slide width.

**Navigation**
- [ ] Buttons, keyboard, and swipe all work.
- [ ] Page auto-scrolls to top on slide change.
- [ ] Auto-hide works after 1 second of inactivity.

**Fullscreen**
- [ ] Toggling fullscreen works with button or `F` key.

**Usability**
- [ ] Layout adjusts cleanly on window resize.

**Non-Functional**
- [ ] Lightweight, modular code; no external deps beyond Bootstrap & Icons.

---

## Implementation Notes (for the Agent)

### Scaling Logic (reference)
- Compute available area: `availW = viewportW`, `availH = viewportH - headerHeight - margins`.
- Desired stage size at base ratio:
    - `scale = Math.min(availW / BASE_W, availH / BASE_H)`.
    - Apply via CSS transform on an inner `#stage-inner` (1024×768 logical) to avoid reflow. Alternatively, set width/height directly using computed pixels—choose the approach that yields least jitter.
- Keep a single source of truth for current scale to sync the additional content width:
    - `const pxStageWidth = BASE_W * scale; additional.style.width = pxStageWidth + 'px';`

### Routing
- Normalize IDs in a `Map` for O(1) lookup; on invalid hash, set to first slide and correct hash.

### Preload Cache
- Keep `{ images: Map<id, HTMLImageElement> }`.

### Accessibility (defer)
- Not required now; ensure buttons have `aria-label` and keyboard focusable.

---

## Manual Test Script (Quick Pass)

1. Load app → Spinner then slide 1. Title set in header and `document.title`.
2. Resize window → Slide stays 4:3, centered; no horiz scroll.
3. Click Next → Slide increments; page scrolls to top; hash updates.
4. Press `Home`/`End` → Jumps to first/last.
5. Toggle Grid → Overview slides up; click a thumb → navigates; overview stays visible.
6. Toggle Menu → Click Fullscreen → Enter/exit; press `F` works.
7. Wait 1s → Prev/Next auto-hide; move mouse → reappear.
8. On slide with `additional` → content aligns to slide width; vertical scroll OK.
9. Touch device/emulator → Swipe left/right navigates; vertical scroll unaffected.
10. Back/Forward buttons navigate slides without reloads.

---

## Deliverables

- `present.html` — root file with header, stage, overview, and dropdown markup.
- `styles.css` — theme, layout, buttons, overview animations, spinner.
- `app-present.js` — all logic (scaling, render, nav, routing, preload, swipe, fullscreen, auto-hide).
- `slides.js` — sample slides (6 items, per schema).
- `assets/cgi-logo.png` — logo.

> After **each stage**, commit, open `present.html`, and run the listed **Test** items before continuing.