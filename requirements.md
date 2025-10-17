# Responsive Presentation Web App (4:3 Slide Deck)

## 1. Overview
Create a **single-page, client-side web application** that displays a presentation composed of multiple slides.  
The slide area must always maintain a **4:3 aspect ratio (1024×768 logical size)** and scale automatically to fit within the browser viewport, beneath a fixed header, without scrollbars unless additional slide content requires them.

The experience should feel similar to a PowerPoint or Keynote viewer, with navigation, autoplay, fullscreen, and optional content below each slide.

---

## 2. Goals
- Provide a clean, minimal, **light-themed** presentation interface.
- Ensure the **main slide content is always fully visible** without scrolling.
- Allow **interactive navigation** via buttons, keyboard, and swipe.
- Support **optional “additional content”** displayed below the slide.
- Implement **fullscreen** modes.
- Be responsive, lightweight, and work across major browsers.

---

## 3. Layout Structure

### 3.1 Header (Sticky Navbar)
- Fixed at the top of the page.
- Contains:
    - Logo area (small colored icon + text).
    - Action buttons:
        - **Fullscreen toggle**
        - **Hamburger menu** for secondary actions.
- Minimal height and padding to maximize viewport space.
- White background with a subtle bottom border.

### 3.2 Slide Stage
- The main “presentation area”.
- Maintains a **4:3 aspect ratio** at all times.
- Centers horizontally and vertically within the viewport under the header.
- Automatically scales up or down to occupy the largest possible size that fits in view.
- No scrollbars when displaying the slide alone.
- Minimal padding around it to maximize content area.

### 3.3 Navigation Controls
- Circular **Previous** and **Next** buttons placed vertically centered at the left and right sides of the slide.
- 25% opacity by default; slightly enlarge and brighten on hover.
- **Auto-hide** after a period of user inactivity (see constants below).
- Reappear on any user interaction (mouse, keyboard, or touch).
- Support swipe left and right gestures.
- Support keyboard shortcuts:
    - Next: `→`, `PageDown`, `Space`
    - Previous: `←`, `PageUp`
    - First: `Home`
    - Last: `End`

### 3.4 Progress Indicator
- Displayed near the bottom center of the slide.
- Shows current slide index and total count.
- Includes a simple horizontal progress bar reflecting overall position.

### 3.5 Additional Content Area
- Appears **below the slide** if the current slide has extra material.
- Scrolls normally with the page.
- Matches the **scaled width** of the visible slide for alignment and aligns with it.
- Adds a small vertical gap to avoid overlap with the slide.
- If no additional content exists, the page must **not scroll** vertically.

---

## 4. Functional Behavior

### 4.1 Slide Rendering
- Each slide is defined in a JS array or data source.
- A slide object includes:
    - `id`: unique string.
    - `title`: optional string 
    - `kind`: `"html"` or `"image"`.
    - `html`: optional HTML markup for textual slides.
    - `src`: optional image URL for image slides.
    - `additional`: optional HTML content to show below the slide.

### 4.2 Navigation
- Navigation can be triggered by:
    - Clicks on previous/next buttons.
    - Keyboard input (as listed above).
    - Swipe gestures (see below).
- **Swipe gestures**:
    - Swipe left → Next slide.
    - Swipe right → Previous slide.
    - Should ignore mostly vertical drags (for scrolling additional content).
    - Must work via touch or pointer events across modern devices.
- Navigating between slides should:
    - Always re-center the stage.
    - **Scroll the page to the top** (in case the previous slide’s content was scrolled down).

### 4.3 Fullscreen Mode
- Clicking the fullscreen button or pressing the `F` key toggles fullscreen.
- Fullscreen applies to the entire presentation page (not just the slide).

### 4.4 Scaling Logic
- The slide’s visible size is determined by:
    - The available width and height of the viewport minus header and paddings.
    - The fixed base ratio (4:3).
- The scaling operation should:
    - Maintain proportional scaling on both axes.
    - Update dynamically when the window is resized or orientation changes.
    - Update after every slide change.
    - No reflow based on screen proportions only scaling

### 4.5 Auto-Hide Navigation
- Navigation buttons disappear after a defined period of inactivity.
- Any interaction (mouse movement, click, keypress, swipe) shows them again.
- The delay duration is configurable (see constants below).

---

## 5. Configuration Constants

| Constant | Description | Default |
|-----------|--------------|----------|
| `INACTIVITY_HIDE_MS` | Time (ms) before navigation buttons auto-hide | `1000` |
| `BASE_W` | Logical base width of slide | `1024` |
| `BASE_H` | Logical base height of slide | `768` |

These values must be declared as configurable constants at the top of the script.

---

## 6. Visual Design

- **Theme**: White / light-gray background with blue accent highlights.
- **Slide background**: White with soft shadow and rounded corners.
- **Typography**:
    - Responsive sizes (e.g., `clamp()` in CSS).
    - Simple sans-serif font (system default).
    - Legible on both mobile and desktop.
- **Buttons**: Bootstrap-styled with light borders and subtle hover feedback.
- **Menu**: Compact dropdown for quick actions (Bootstrap dropdown or equivalent).
- **Progress bar**: Thin, rounded, gradient-filled (blue hues).

---

## 7. Accessibility & Usability
- Use descriptive `aria-label` attributes for all controls.
- Maintain keyboard accessibility for navigation and menus.
- Maintain readable contrast between text and background.
- When changing slides, focus should not jump away from the presentation area.

---

## 8. Performance & Compatibility
- Must run entirely client-side (HTML/CSS/JavaScript only).
- Must use **Bootstrap 5** and **Bootstrap Icons** via CDN.
- No frameworks or build tools.
- Should perform smoothly on modern browsers:
    - Chrome, Edge, Firefox, Safari (desktop).
    - Chrome, Safari (mobile/tablet).
- Scaling and rendering updates should not cause layout jitter or visible lag.

---

## 9. Future Extensibility (Optional)
The design should make it easy to add future features such as:
- Aspect-ratio switching (4:3 ↔ 16:9).
- Content fetching from CMS or remote JSON.
- Slide transitions (fade, slide).
- Notes or speaker mode.
- Print or PDF export.

---

## 10. Deliverables
- **Single file:** `index.html`
    - Includes all HTML, CSS, and JS (no build pipeline).
    - Loads Bootstrap 5 and Bootstrap Icons via CDN.
    - Fully responsive and self-contained.
- Optional: A brief `README.md` with usage instructions.

---

## 11. Acceptance Criteria

### Layout & Scaling
- [ ] Slide maintains 4:3 aspect ratio at all times.
- [ ] No horizontal scrollbars.
- [ ] Full slide visible when no extra content.
- [ ] Additional content width matches slide width.

### Navigation
- [ ] Buttons, keyboard, and swipe all work.
- [ ] Page auto-scrolls to top on slide change.
- [ ] Auto-hide works after 1 second of inactivity.

### Fullscreen
- [ ] Toggling fullscreen works with button or `F` key.

### Usability
- [ ] Controls have accessible labels.
- [ ] Focus and keyboard navigation are intuitive.
- [ ] Layout adjusts cleanly on window resize.

---

## 12. Non-Functional Criteria
- Lightweight, single file (under 200 KB uncompressed).
- Clean, modular code (easy to extend).
- Cross-browser responsive layout.
- Fluid scaling without visible lag.
- No external dependencies beyond Bootstrap and Bootstrap Icons.

---

**End of `requirements.md`**
