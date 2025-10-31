# Angular Presentation Viewer

This is an Angular 20 conversion of the presentation viewer application.

## Features

- **Modern Angular 20**: Uses the latest Angular features including:
  - Signals for reactive state management
  - New control flow syntax (@if, @for, @else)
  - Standalone components
  - Zoneless change detection
  - Input signals

- **Presentation List**: Browse available presentations
- **Presentation Viewer**: View slides with keyboard navigation
- **Responsive Design**: Works on desktop and mobile devices

## Project Structure

```
angular-app/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── header/              # Reusable header component
│   │   │   ├── presentation-list/   # Lists all presentations
│   │   │   └── presentation-viewer/ # Displays presentation slides
│   │   ├── models/
│   │   │   ├── presentation.ts      # Presentation interface
│   │   │   └── slide.ts             # Slide interface
│   │   ├── services/
│   │   │   └── presentation.ts      # Presentation data service with signals
│   │   ├── app.routes.ts            # Application routes
│   │   └── app.ts                   # Root component
│   ├── styles.css                   # Global styles
│   └── index.html                   # Main HTML file
└── public/
    ├── api/
    │   └── slides.json              # Presentation data
    ├── assets/                       # Images and third-party libraries
    └── attachments/                  # Presentation attachments
```

## Development

### Prerequisites
- Node.js 18+ 
- npm

### Installation
```bash
npm install
```

### Development Server
Run the development server:
```bash
npx @angular/cli serve
```

Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

### Build
Build the project for production:
```bash
npx @angular/cli build
```

The build artifacts will be stored in the `dist/` directory.

## Usage

### Keyboard Navigation
- **Arrow Left**: Previous slide
- **Arrow Right**: Next slide  
- **Escape**: Return to presentation list

### Routes
- `/` - Presentation list
- `/present/:presentationId/:slideId` - View a specific slide

## Angular 20 Features Used

### Signals
The application uses Angular signals for reactive state management:

```typescript
// In PresentationService
private presentations = signal<Presentation[]>([]);
readonly presentationList = this.presentations.asReadonly();
```

### New Control Flow Syntax
Templates use the new @if, @for syntax:

```html
@if (isLoading()) {
  <p>Loading...</p>
} @else {
  @for (presentation of presentations(); track presentation.id) {
    <li>{{ presentation.title }}</li>
  }
}
```

### Input Signals
Components use input signals for properties:

```typescript
title = input<string>('Presentations');
showBackButton = input<boolean>(false);
```

### Computed Signals
Derived state uses computed signals:

```typescript
currentSlide = computed(() => {
  const pres = this.presentation();
  const index = this.currentSlideIndex();
  return pres?.slides[index];
});
```

## Notes

- PWA features have been removed as requested
- The original Bootstrap styling is preserved
- Uses standalone components (no NgModules)
- Zoneless change detection for better performance

