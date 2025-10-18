# Responsive Presentation Web App (4:3 Slide Deck)

## 1. Overview
Create a **single-page, client-side web application** that displays a presentation composed of multiple slides.  
The slide area must always maintain a **4:3 aspect ratio (1024×768 logical size)** and scale automatically to fit within the browser viewport, beneath a fixed header, without scrollbars unless additional slide content requires them.

The experience should feel similar to a PowerPoint or Keynote viewer, with navigation, fullscreen, and optional content below each slide.

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
        - **Grid icon** for slide overview navigation
        - **Hamburger menu** with dropdown containing:
            - **Fullscreen toggle**
            - **Bookmarks** (placeholder for future functionality)
            - **About** (placeholder for future functionality)
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

### 3.4 Slide Overview Navigation
- **Hidden by default** - only appears when grid icon in header is clicked.
- **Positioning**: Floating bar at the bottom of the page, positioned at the bottom edge of the slide area.
- **Behavior**: When page has additional content and user scrolls down, the bar moves up with the page to stay at the bottom of the slide.
- **Layout**: 
    - Horizontal bar spanning 3/4 of the available width, centered.
    - Height approximately twice the header height.
    - Horizontal scrollbar if slides exceed available width.
- **Slide Thumbnails**:
    - Each slide represented as a 4:3 aspect ratio box.
    - Content: Slide title (if available) centered above slide number.
    - If no title exists, display only the slide number.
    - Current slide highlighted using CGI brand colors.
- **Animation**: Slides up from bottom with smooth animation when appearing.
- **Interaction**: 
    - Click on any slide thumbnail to jump to that slide.
    - Toggle visibility by clicking the grid icon in header.
    - Remains visible until grid icon is clicked again.

### 3.5 Additional Content Area
- Appears **below the slide** if the current slide has extra material.
- Scrolls normally with the page.
- Matches the **scaled width** of the visible slide for alignment and aligns with it.
- Adds a small vertical gap to avoid overlap with the slide.
- If no additional content exists, the page must **not scroll** vertically.

---

## 4. Functional Behavior

### 4.1 Slide Rendering
- **Data source**: Slides are defined in a JS array loaded from `slides.js` as a default export
- **Initial slide selection**: 
    - Check URL hash (`#slide-id`) to determine starting slide
    - Default to first slide (index 0) if no hash or invalid hash provided
    - Update URL hash when navigating between slides
- **Progressive loading strategy**:
    - Load and render the current slide immediately on page load
    - Display slide placeholder animation only while the initial current slide is loading
    - After current slide loads, progressively preload all other slides in the background
    - Once a slide is loaded, navigating to it becomes instant (no loading required)
- **Loading states**:
    - **Placeholder animation**: CSS-based spinner centered in slide area
    - **Image loading placeholders**: Show spinner for images still loading (rare due to preloading)
    - **Background loading progress**: Log preloading progress to console only
    - **No error handling**: No fallback required if slides.js fails to load
    - **No timeouts**: No timeout specifications required at this stage
- **Future extensibility**: The slides.js loading will later be replaced by API calls
- **Slide object structure**:
    - `id`: unique string (used in URL hash)
    - `title`: optional string 
    - `template`: `"html"` | `"img"`
    - `html`: optional HTML markup for textual slides
    - `src`: optional image URL for image slides
    - `additional`: optional HTML content to show below the slide
- **Sample data structure** (5-6 slides with varied content):
    - Slide 1: Simple HTML content only
    - Slide 2: HTML content with additional content below
    - Slide 3: HTML content with additional content below
    - Slide 4: Image slide only
    - Slide 5: Image slide with additional content below
    - Slide 6: Simple HTML content only

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
- Navigating between slides should
    - **Scroll the page to the top** (in case the previous slide’s content was scrolled down).

### 4.3 URL Management and Browser Navigation
- **URL hash updates**: Update the URL hash (`#slide-id`) whenever slide changes via any navigation method
- **Browser navigation**: Support browser back/forward buttons to navigate between slides
- **No page reloads**: All navigation must stay within the page using hash-based routing
- **Invalid URL handling**: If URL contains invalid slide ID, default to first slide (index 0) and update hash accordingly
- **Page title updates**: Update document title to reflect current slide:
    - Format: `"Slide Title - Presentation"` (if slide has title)
    - Format: `"Slide X - Presentation"` (if no title, where X is slide number)
    - Default: `"Presentation"` (during loading)

### 4.4 Slide Overview Navigation
- Clicking the grid icon in the header toggles the slide overview bar.
- **Show behavior**: Bar slides up from the bottom with smooth animation.
- **Hide behavior**: Bar slides down and disappears when grid icon is clicked again.
- **Slide selection**: Clicking any slide thumbnail navigates to that slide and keeps the overview visible.
- **Positioning logic**: 
    - When no additional content: Stays fixed at bottom of slide area.
    - When additional content exists: Moves with scroll to remain at slide bottom edge.

### 4.5 Hamburger Menu
- Clicking the hamburger icon toggles a dropdown menu.
- **Menu items**:
    - **Fullscreen**: Toggles fullscreen mode for the entire presentation
    - **Bookmarks**: Placeholder item (no functionality required at this stage)
    - **About**: Placeholder item (no functionality required at this stage)
- Menu closes when clicking outside or selecting an item.

### 4.5 Fullscreen Mode
- Clicking the fullscreen option in the hamburger menu or pressing the `F` key toggles fullscreen.
- Fullscreen applies to the entire presentation page (not just the slide).

### 4.6 Scaling Logic
- The slide’s visible size is determined by:
    - The available width and height of the viewport minus header and paddings.
    - The fixed base ratio (4:3).
- The scaling operation should:
    - Maintain proportional scaling on both axes.
    - Update dynamically when the window is resized or orientation changes.
    - Verify scaling remains correct after slide change.
    - No reflow based on screen proportions only scaling

### 4.6 Auto-Hide Navigation
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

These values must be declared as configurable constants for easy update. 

---

## 6. Visual Design

### 6.1 Brand Colors
Always use the CGI brand color specifications below:

**Red**
- RGB: R227 G25 B55
- HEX: #E31937
- CMYK: C0 M100 Y81 K4
- PANTONE: 186C

**Purple**
- RGB: R82 G54 B171
- HEX: #5236AB
- CMYK: C80 M81 Y0 K0
- PANTONE: 2103C

**White**
- RGB: R255 G255 B255
- HEX: #ffffff
- CMYK: C0 M0 Y0 K0

**Black**
- RGB: R0 G0 B0
- HEX: #000000
- CMYK: C0 M0 Y0 K100

gradients are acceptable when applicable

### 6.2 Design Guidelines
- **Theme**: White / light-gray background with CGI brand color accents (red and purple).
- **Slide background**: White with soft shadow and rounded corners.
- **Typography**:
    - Responsive sizes (e.g., `clamp()` in CSS).
    - Simple sans-serif font (system default).
    - Legible on both mobile and desktop.
- **Buttons**: Bootstrap-styled with light borders and subtle hover feedback using brand colors.
- **Menu**: Compact dropdown for quick actions (Bootstrap dropdown or equivalent).

---

## 7. Accessibility & Usability
- Not required at this stage. 

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
- Content fetching from CMS or remote JSON

---

## 10. Deliverables
- **multiple files:** with root file being `index.html`
    - seperate HTML, CSS, and JS (no build pipeline)
    - `slides.js` with sample slide data as default export
    - Loads Bootstrap 5 and Bootstrap Icons via CDN
    - Fully responsive 
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
- [ ] Layout adjusts cleanly on window resize.

---

## 12. Non-Functional Criteria
- Lightweight
- Clean, modular code (easy to extend).
- Cross-browser responsive layout.
- Fluid scaling without visible lag.
- No external dependencies beyond Bootstrap and Bootstrap Icons and swipe libraries

---

**End of `requirements.md`**
