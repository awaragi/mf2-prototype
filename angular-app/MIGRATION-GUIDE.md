# Migration Guide: Vanilla JS to Angular 20

## Summary

Your presentation viewer application has been successfully converted from vanilla JavaScript to Angular 20. Here's what was done:

## What Was Created

### 1. New Angular Application
- Location: `/home/pierre/Develop/Projects/mf2-prototype/angular-app/`
- Framework: Angular 20 with zoneless change detection
- Architecture: Standalone components (no NgModules)

### 2. Components Created

#### Header Component (`src/app/components/header/`)
- Reusable header with CGI branding
- Input signals for title and back button visibility
- Responsive navigation

#### Presentation List Component (`src/app/components/presentation-list/`)
- Displays all available presentations
- Shows slide count for each presentation
- Links to presentation viewer
- Loading and error states

#### Presentation Viewer Component (`src/app/components/presentation-viewer/`)
- Displays presentation slides
- Keyboard navigation (Arrow keys, Escape)
- Supports HTML and image slide templates
- Navigation buttons with disable states
- Sanitized HTML rendering

### 3. Services

#### Presentation Service (`src/app/services/presentation.ts`)
- Loads presentation data from `/api/slides.json`
- Signal-based reactive state management
- Methods to get presentations and slides by ID
- Loading and error state tracking

### 4. Models

#### Presentation Interface (`src/app/models/presentation.ts`)
```typescript
interface Presentation {
  id: string;
  title: string;
  version: string;
  slides: Slide[];
}
```

#### Slide Interface (`src/app/models/slide.ts`)
```typescript
interface Slide {
  id: string;
  title: string;
  template: 'html' | 'img';
  html?: string;
  src?: string;
  additional?: string;
}
```

### 5. Routes

- `/` - Presentation list (index page)
- `/present/:presentationId/:slideId` - Presentation viewer

## Angular 20 Features Used

### ✅ Signals
Replaced traditional observables with signals for simpler reactive state:

**Before (Vanilla JS):**
```javascript
let presentations = [];
let isDataLoaded = false;
```

**After (Angular with Signals):**
```typescript
private presentations = signal<Presentation[]>([]);
readonly presentationList = this.presentations.asReadonly();
```

### ✅ New Control Flow Syntax
Used `@if`, `@for`, `@else` instead of `*ngIf`, `*ngFor`:

**Template:**
```html
@if (isLoading()) {
  <p>Loading...</p>
} @else if (errorMessage()) {
  <p>{{ errorMessage() }}</p>
} @else {
  @for (presentation of presentations(); track presentation.id) {
    <li>{{ presentation.title }}</li>
  }
}
```

### ✅ Input Signals
Component inputs as signals:

```typescript
export class HeaderComponent {
  title = input<string>('Presentations');
  showBackButton = input<boolean>(false);
}
```

### ✅ Computed Signals
Derived state calculations:

```typescript
currentSlide = computed(() => {
  const pres = this.presentation();
  const index = this.currentSlideIndex();
  return pres?.slides[index];
});
```

### ✅ Effect API
Side effects tied to signal changes:

```typescript
constructor() {
  effect(() => {
    const handleKeydown = (e: KeyboardEvent) => { /* ... */ };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
}
```

### ✅ Zoneless Change Detection
Better performance with `provideZonelessChangeDetection()`

### ✅ Standalone Components
No NgModules - simplified architecture

## What Was Preserved

✅ All original styling (CGI brand colors, layouts)
✅ Bootstrap 5 integration
✅ Bootstrap Icons
✅ Presentation data structure
✅ All assets and attachments
✅ Responsive design
✅ Keyboard navigation functionality

## What Was Removed (As Requested)

❌ PWA features (service worker, offline support)
❌ Network monitoring
❌ IndexedDB/Dexie integration
❌ Offline page
❌ Manifest file

## File Mapping

### Old → New

| Original File | Angular Equivalent |
|--------------|-------------------|
| `index.html` | `presentation-list.component.ts` |
| `present.html` | `presentation-viewer.component.ts` |
| `js/app-index.js` | `presentation-list.component.ts` |
| `js/app-present.js` | `presentation-viewer.component.ts` |
| `styles.css` | `src/styles.css` + component CSS files |
| `api/slides.json` | `public/api/slides.json` |
| `assets/` | `public/assets/` |
| `attachments/` | `public/attachments/` |

## Running the Application

### Development Server
```bash
cd angular-app
npx @angular/cli serve
```
Navigate to `http://localhost:4200/`

### Production Build
```bash
cd angular-app
npx @angular/cli build
```
Output: `dist/angular-app/`

### Serve Production Build
```bash
cd angular-app
npx @angular/cli build
npx http-server dist/angular-app/browser -p 8080
```

## Key Differences from Original

### 1. Routing
- **Before**: Hash-based (`#presentationId/slideId`)
- **After**: Angular Router (`/present/presentationId/slideId`)

### 2. State Management
- **Before**: Global variables
- **After**: Signal-based service

### 3. DOM Manipulation
- **Before**: `document.getElementById()`, `innerHTML`
- **After**: Angular templates, property binding

### 4. Event Handling
- **Before**: `addEventListener()`
- **After**: Angular event binding `(click)="method()"`

### 5. Navigation
- **Before**: `window.location.href`
- **After**: `Router.navigate()`

## Benefits of Angular Version

1. **Type Safety**: Full TypeScript support catches errors at compile time
2. **Better Performance**: Zoneless change detection, optimized rendering
3. **Maintainability**: Clear component structure, separation of concerns
4. **Developer Experience**: Angular DevTools, hot reload, debugging
5. **Scalability**: Easy to add new features, services, components
6. **Testing**: Built-in testing framework (Jasmine/Karma)
7. **Modern Features**: Latest Angular 20 capabilities

## Next Steps

You can now:
1. ✅ Run the development server (already running on port 4200)
2. ✅ Test the application in your browser
3. Add more features (search, filtering, favorites, etc.)
4. Customize styling
5. Add unit tests
6. Deploy to production

## Testing Checklist

- [ ] Presentation list loads correctly
- [ ] Clicking a presentation navigates to viewer
- [ ] Slides display properly (both HTML and image types)
- [ ] Keyboard navigation works (arrows, escape)
- [ ] Navigation buttons work (previous/next)
- [ ] Back button returns to list
- [ ] Responsive design works on mobile
- [ ] All images and assets load correctly

## Notes

- The development server is currently running (PID: 89847)
- Access it at: `http://localhost:4200/`
- All original functionality preserved (except PWA features)
- Code follows Angular 20 best practices
- Uses latest template syntax and signals API

