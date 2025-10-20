// Presentation App Logic
// Application logic will be added in subsequent stages

// Import slides data
import slidesData from './slides.js';

// Configuration constants
const INACTIVITY_HIDE_MS = 1000;
const BASE_W = 1024;
const BASE_H = 768;

// Stage scaling variables
let currentScale = 1;
let stageElement;
let stageWrapElement;
let currentPresentationIndex = 0;
let currentSlideIndex = 0;

// Get presentations array
const presentations = slidesData.presentations;
// Get current presentation slides
let slides = presentations[currentPresentationIndex].slides;

// Preload cache for images
const imageCache = new Map();
let preloadProgress = 0;

// Overview state
let isOverviewVisible = false;

// Auto-hide navigation state
let autoHideTimer = null;
let areNavigationButtonsVisible = true;
let isMenuOpen = false;

// Swipe gesture state
let swipeState = {
    isTracking: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Presentation app initialized');
    initializeHeader();
    initializeStage();
    initializeNavigation();
    initializeNavigationButtons();
    initializeOverview();
    initializeSwipeGestures();
    initializeAutoHideNavigation();
    loadSlideFromHash();
    initializeAboutModal();
    // Start preloading after initial render
    setTimeout(() => startProgressivePreload(), 500);
});

// Header functionality
function initializeHeader() {
    // Logo click handler - clears hash and goes to root
    const logoArea = document.getElementById('logo-area');
    if (logoArea) {
        logoArea.addEventListener('click', function(e) {
            e.preventDefault();
            location.hash = '';
            console.log('Logo clicked - hash cleared');
        });
    }

    // Menu item handlers
    const fullscreenBtn = document.getElementById('btn-fullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', function() {
            toggleFullscreen();
        });
    }

    // Track menu state and close dropdown on outside click
    document.addEventListener('click', function(e) {
        const dropdown = document.querySelector('#btn-menu').closest('.dropdown');
        const dropdownMenu = dropdown.querySelector('.dropdown-menu');

        if (!dropdown.contains(e.target) && dropdownMenu.classList.contains('show')) {
            // Close dropdown
            const dropdownToggle = bootstrap.Dropdown.getInstance(document.getElementById('btn-menu'));
            if (dropdownToggle) {
                dropdownToggle.hide();
            }
        }
    });

    // Track menu open/close events
    const menuButton = document.getElementById('btn-menu');
    if (menuButton) {
        menuButton.addEventListener('shown.bs.dropdown', function() {
            isMenuOpen = true;
            console.log('Menu opened - pausing auto-hide');
        });

        menuButton.addEventListener('hidden.bs.dropdown', function() {
            isMenuOpen = false;
            console.log('Menu closed - resuming auto-hide');
            resetAutoHideTimer();
        });
    }

    // Grid button handler
    const gridBtn = document.getElementById('btn-grid');
    if (gridBtn) {
        gridBtn.addEventListener('click', function() {
            toggleOverview();
        });
    }

    // About button handler
    const aboutBtn = document.getElementById('btn-about');
    if (aboutBtn) {
        aboutBtn.addEventListener('click', function() {
            showAboutModal();
        });
    }
}

// Overview functionality
function initializeOverview() {
    generateOverviewThumbnails();
    updateOverviewPosition();

    // Add scroll listener for positioning when additional content is present
    window.addEventListener('scroll', debounce(updateOverviewPosition, 100));

    console.log('Overview initialized');
}

function toggleOverview() {
    const overviewElement = document.getElementById('overview');
    if (!overviewElement) return;

    isOverviewVisible = !isOverviewVisible;

    if (isOverviewVisible) {
        overviewElement.classList.add('visible');
        updateActiveOverviewThumbnail();
        updateOverviewPosition();
        console.log('Overview shown - pausing auto-hide');
    } else {
        overviewElement.classList.remove('visible');
        console.log('Overview hidden - resuming auto-hide');
        resetAutoHideTimer();
    }
}

function generateOverviewThumbnails() {
    const thumbnailsContainer = document.getElementById('overview-thumbnails');
    if (!thumbnailsContainer) return;

    // Clear existing thumbnails
    thumbnailsContainer.innerHTML = '';

    slides.forEach((slide, index) => {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'overview-thumbnail';
        thumbnail.dataset.slideIndex = index;

        // Add click handler
        thumbnail.addEventListener('click', function() {
            navigateToSlide(index);
            // Keep overview visible after navigation
        });

        if (slide.template === 'img' && slide.src) {
            // Image slide - show image with overlay
            const img = document.createElement('img');
            img.className = 'thumbnail-image';
            img.src = slide.src;
            img.alt = slide.title;

            const overlay = document.createElement('div');
            overlay.className = 'thumbnail-overlay';
            overlay.innerHTML = `
                <div class="thumbnail-number">${index + 1}</div>
                <div class="thumbnail-title">${slide.title}</div>
            `;

            thumbnail.appendChild(img);
            thumbnail.appendChild(overlay);
        } else {
            // HTML slide - show number and title
            thumbnail.innerHTML = `
                <div class="thumbnail-number">${index + 1}</div>
                <div class="thumbnail-title">${slide.title}</div>
            `;
        }

        thumbnailsContainer.appendChild(thumbnail);
    });

    console.log(`Generated ${slides.length} overview thumbnails for presentation: ${presentations[currentPresentationIndex].title}`);
}

function updateActiveOverviewThumbnail() {
    const thumbnails = document.querySelectorAll('.overview-thumbnail');

    thumbnails.forEach((thumbnail, index) => {
        if (index === currentSlideIndex) {
            thumbnail.classList.add('active');
        } else {
            thumbnail.classList.remove('active');
        }
    });
}

function updateOverviewPosition() {
    const overviewElement = document.getElementById('overview');
    const additionalSection = document.getElementById('additional');

    if (!overviewElement) return;

    // Check if additional content is visible and if user has scrolled
    const hasAdditionalContent = additionalSection && additionalSection.classList.contains('visible');

    if (hasAdditionalContent) {
        const stageWrap = document.getElementById('stage-wrap');
        const stageRect = stageWrap ? stageWrap.getBoundingClientRect() : null;
        const scrollY = window.scrollY;

        if (stageRect && scrollY > 0) {
            // User has scrolled down - position overview to align with bottom of stage area
            const stageBottom = stageRect.bottom + scrollY;
            const viewportHeight = window.innerHeight;

            // Calculate if we need to move the overview up
            const overviewHeight = overviewElement.offsetHeight;
            const targetPosition = Math.max(0, stageBottom - viewportHeight);

            overviewElement.style.transform = `translateY(-${Math.min(scrollY, targetPosition)}px)`;
        } else {
            // Reset to default position
            overviewElement.style.transform = 'translateY(0)';
        }
    } else {
        // No additional content, keep at bottom
        overviewElement.style.transform = 'translateY(0)';
    }
}

// Stage initialization and scaling
function initializeStage() {
    stageElement = document.getElementById('stage');
    stageWrapElement = document.getElementById('stage-wrap');

    if (!stageElement || !stageWrapElement) {
        console.error('Stage elements not found');
        return;
    }

    // Initial scaling
    calculateStageScale();

    // Add robust resize listeners with specialized debounce to prevent jitter
    window.addEventListener('resize', debounceResize(calculateStageScale, 150));
    window.addEventListener('orientationchange', function() {
        // Longer delay to allow orientation change to fully complete on mobile devices
        setTimeout(() => {
            calculateStageScale();
            // Force a second calculation after a brief delay to handle any remaining layout settling
            setTimeout(calculateStageScale, 50);
        }, 200);
    });

    console.log('Stage initialized with scaling');
}

function calculateStageScale() {
    if (!stageElement || !stageWrapElement) return;

    // Use requestAnimationFrame to avoid forced synchronous layout
    requestAnimationFrame(() => {
        // Get header height - use cached value if possible to avoid layout thrashing
        const header = document.getElementById('app-header');
        const headerHeight = header ? header.offsetHeight : 60;

        // Calculate available space
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Account for padding and header
        const padding = 32; // 1rem * 2 for padding on both sides
        const availableWidth = viewportWidth - padding;
        const availableHeight = viewportHeight - headerHeight - padding;

        // Calculate scale based on 4:3 ratio
        const scaleByWidth = availableWidth / BASE_W;
        const scaleByHeight = availableHeight / BASE_H;

        // Use the smaller scale to ensure it fits
        const newScale = Math.min(scaleByWidth, scaleByHeight);

        // Only update if scale has changed significantly to prevent unnecessary updates
        if (Math.abs(newScale - currentScale) < 0.001) {
            return;
        }

        // Apply scaling
        currentScale = newScale;

        // Set the stage size
        const stageWidth = BASE_W * currentScale;
        const stageHeight = BASE_H * currentScale;

        // Batch DOM updates to prevent layout thrashing
        stageElement.style.width = `${stageWidth}px`;
        stageElement.style.height = `${stageHeight}px`;
        stageElement.style.maxWidth = `${stageWidth}px`;

        // Reapply content scaling if content exists
        const contentContainer = stageElement.querySelector('.slide-content');
        if (contentContainer) {
            applyContentScaling(contentContainer);
        }

        // Update additional content width to match scaled stage (debounced)
        requestAnimationFrame(() => {
            updateAdditionalContentWidth();
        });

        // Update overview positioning after scale changes (debounced)
        if (isOverviewVisible) {
            requestAnimationFrame(() => {
                setTimeout(() => updateOverviewPosition(), 50);
            });
        }

        console.log(`Stage scaled to ${stageWidth}x${stageHeight} (scale: ${currentScale.toFixed(3)})`);
    });
}

function renderAdditionalContent(slide) {
    const additionalSection = document.getElementById('additional');
    const additionalContent = document.getElementById('additional-content');

    if (!additionalSection || !additionalContent) return;

    if (slide.additional) {
        // Show additional content
        additionalContent.innerHTML = slide.additional;
        additionalSection.classList.add('visible');

        // Set width to match scaled stage
        updateAdditionalContentWidth();
    } else {
        // Hide additional content
        additionalSection.classList.remove('visible');
        additionalContent.innerHTML = '';
    }
}

function updateAdditionalContentWidth() {
    const additionalContent = document.getElementById('additional-content');
    if (!additionalContent) return;

    // Calculate the effective width of the scaled stage
    const stageWidth = BASE_W * currentScale;

    // Only update if the width has actually changed to prevent unnecessary reflows
    const currentWidth = parseFloat(additionalContent.style.width) || 0;
    const newWidth = Math.round(stageWidth);

    if (Math.abs(currentWidth - newWidth) > 1) {
        additionalContent.style.width = `${newWidth}px`;
        console.log(`Additional content width updated to ${newWidth}px`);
    }
}

// Progressive preload functionality
function startProgressivePreload() {
    console.log('Starting progressive preload...');
    preloadProgress = 0;

    const imageSlides = slides.filter(slide => slide.template === 'img');
    const totalImages = imageSlides.length;

    if (totalImages === 0) {
        console.log('No images to preload for current presentation');
        return;
    }

    // Preload images one by one to avoid overwhelming the browser
    let loadedCount = 0;

    imageSlides.forEach((slide, index) => {
        setTimeout(() => {
            preloadImage(slide).then(() => {
                loadedCount++;
                preloadProgress = loadedCount;
                console.log(`Preloaded ${loadedCount} / ${totalImages} for presentation: ${presentations[currentPresentationIndex].title}`);
            }).catch((error) => {
                console.warn(`Failed to preload image for slide ${slide.id}:`, error);
                loadedCount++;
                preloadProgress = loadedCount;
            });
        }, index * 200); // Stagger the requests
    });
}

function preloadImage(slide) {
    return new Promise((resolve, reject) => {
        if (imageCache.has(slide.id)) {
            resolve(imageCache.get(slide.id));
            return;
        }

        const img = new Image();
        img.onload = () => {
            imageCache.set(slide.id, img);
            resolve(img);
        };
        img.onerror = reject;
        img.src = slide.src;
    });
}

// Navigation and slide management
function initializeNavigation() {
    // Listen for hash changes
    window.addEventListener('hashchange', loadSlideFromHash);

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        switch(e.key) {
            case 'ArrowLeft':
            case 'PageUp':
                e.preventDefault();
                navigateSlide(-1);
                break;
            case 'ArrowRight':
            case 'PageDown':
            case ' ':
                e.preventDefault();
                navigateSlide(1);
                break;
            case 'Home':
                e.preventDefault();
                navigateToSlide(0);
                break;
            case 'End':
                e.preventDefault();
                navigateToSlide(slides.length - 1);
                break;
            case 'g':
            case 'G':
                e.preventDefault();
                toggleOverview();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                toggleFullscreen();
                break;
        }
    });
}

function initializeNavigationButtons() {
    // Previous button
    const prevBtn = document.getElementById('btn-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            navigateSlide(-1);
        });
    }

    // Next button
    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            navigateSlide(1);
        });
    }

    console.log('Navigation buttons initialized');
}

function loadSlideFromHash() {
    const hash = window.location.hash.slice(1);
    let presentationIndex = 0;
    let slideIndex = 0;
    let isValidHash = false;

    if (hash && hash.includes('/')) {
        const [presentationId, slideId] = hash.split('/', 2);

        // Find presentation by ID
        const foundPresentationIndex = presentations.findIndex(p => p.id === presentationId);
        if (foundPresentationIndex !== -1) {
            // Find slide within this presentation
            const foundSlideIndex = presentations[foundPresentationIndex].slides.findIndex(slide => slide.id === slideId);
            if (foundSlideIndex !== -1) {
                // Valid hash found
                presentationIndex = foundPresentationIndex;
                slideIndex = foundSlideIndex;
                isValidHash = true;
            }
        }
    } else if (hash) {
        // Treat hash without / as presentation ID
        const foundPresentationIndex = presentations.findIndex(p => p.id === hash);
        if (foundPresentationIndex !== -1) {
            presentationIndex = foundPresentationIndex;
            slideIndex = 0;
            isValidHash = true;
        }
    }

    // If hash is invalid, missing, or doesn't contain separator, redirect to first presentation/slide
    if (!isValidHash) {
        if (hash) {
            console.warn(`Invalid hash format: ${hash}, redirecting to first presentation and slide`);
        }
        presentationIndex = 0;
        slideIndex = 0;

        // Redirect to correct hash
        const presentation = presentations[0];
        const slide = presentation.slides[0];
        location.hash = `${presentation.id}/${slide.id}`;
        return; // Let the hashchange event handle the rest
    }

    // Update current presentation if it changed
    if (presentationIndex !== currentPresentationIndex) {
        currentPresentationIndex = presentationIndex;
        slides = presentations[currentPresentationIndex].slides;

        // Regenerate overview thumbnails for new presentation
        generateOverviewThumbnails();

        // Restart preloading for new presentation
        setTimeout(() => startProgressivePreload(), 500);
    }

    // Navigate to the slide
    navigateToSlide(slideIndex);
}

function navigateSlide(direction) {
    const newIndex = currentSlideIndex + direction;
    if (newIndex >= 0 && newIndex < slides.length) {
        navigateToSlide(newIndex);
    }
}

function navigateToSlide(index) {
    if (index < 0 || index >= slides.length) return;

    currentSlideIndex = index;
    const presentation = presentations[currentPresentationIndex];
    const slide = slides[index];

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update URL hash - use location.hash for proper browser history
    location.hash = `${presentation.id}/${slide.id}`;

    // Update header title
    updateHeaderTitle(slide.title);

    // Update document title
    document.title = `${presentation.title} - ${slide.title}`;

    // Render slide content
    renderSlide(slide);

    // Update overview thumbnail highlighting
    if (isOverviewVisible) {
        updateActiveOverviewThumbnail();
    }

    // Update navigation button visibility
    updateNavigationButtonVisibility();
}

function updateHeaderTitle(title) {
    const titleElement = document.getElementById('current-title');
    if (titleElement) {
        titleElement.textContent = title;
    }
}

function renderSlide(slide) {
    if (!stageElement) return;

    // Show loading
    showLoading(true);

    // Clear existing content
    stageElement.innerHTML = '';

    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'slide-content';
    contentContainer.style.width = `${BASE_W}px`;
    contentContainer.style.height = `${BASE_H}px`;
    contentContainer.style.position = 'absolute';
    contentContainer.style.top = '0';
    contentContainer.style.left = '0';
    contentContainer.style.overflow = 'hidden';

    // Render based on template type
    if (slide.template === 'html') {
        renderHtmlSlide(contentContainer, slide);
    } else if (slide.template === 'img') {
        renderImageSlide(contentContainer, slide);
    }

    stageElement.appendChild(contentContainer);

    // Apply scaling transform
    applyContentScaling(contentContainer);

    // Handle additional content in separate section
    renderAdditionalContent(slide);

    // Hide loading after a short delay
    setTimeout(() => {
        showLoading(false);
        // Ensure navigation buttons are properly updated after render
        updateNavigationButtonVisibility();
    }, 300);
}

function renderHtmlSlide(container, slide) {
    const content = document.createElement('div');
    content.className = 'html-slide';
    content.style.padding = '40px';
    content.style.height = '100%';
    content.style.boxSizing = 'border-box';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.justifyContent = 'center';
    content.style.overflow = 'auto';

    content.innerHTML = slide.html;

    container.appendChild(content);
}

function renderImageSlide(container, slide) {
    const img = document.createElement('img');

    // Use cached image if available, otherwise load normally
    if (imageCache.has(slide.id)) {
        const cachedImg = imageCache.get(slide.id);
        img.src = cachedImg.src;
        console.log(`Using cached image for slide ${slide.id}`);
    } else {
        img.src = slide.src;
    }

    img.alt = slide.title;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    img.style.margin = '0 auto';

    const content = document.createElement('div');
    content.className = 'image-slide';
    content.style.height = '100%';
    content.style.display = 'flex';
    content.style.alignItems = 'center';
    content.style.justifyContent = 'center';
    content.style.padding = '20px';
    content.style.boxSizing = 'border-box';

    content.appendChild(img);
    container.appendChild(content);
}

function applyContentScaling(contentContainer) {
    contentContainer.style.transform = `scale(${currentScale})`;
    contentContainer.style.transformOrigin = 'top left';
}

function showLoading(show) {
    const loadingElement = document.getElementById('stage-loading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'flex' : 'none';
        loadingElement.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
}

// Fullscreen functionality
function toggleFullscreen() {
    if (!document.fullscreenEnabled) {
        console.warn('Fullscreen API not supported');
        return;
    }

    if (document.fullscreenElement) {
        // Exit fullscreen
        document.exitFullscreen().then(() => {
            console.log('Exited fullscreen mode');
        }).catch((error) => {
            console.error('Error exiting fullscreen:', error);
        });
    } else {
        // Enter fullscreen
        document.documentElement.requestFullscreen().then(() => {
            console.log('Entered fullscreen mode');
        }).catch((error) => {
            console.error('Error entering fullscreen:', error);
        });
    }

    // Close the dropdown menu after selection
    const dropdownToggle = bootstrap.Dropdown.getInstance(document.getElementById('btn-menu'));
    if (dropdownToggle) {
        dropdownToggle.hide();
    }
}

// About modal functionality
function initializeAboutModal() {
    const modal = document.getElementById('about-modal');
    const closeBtn = document.getElementById('about-modal-close');

    if (!modal || !closeBtn) {
        console.error('About modal elements not found');
        return;
    }

    // Close button handler
    closeBtn.addEventListener('click', function() {
        closeAboutModal();
    });

    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeAboutModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.open) {
            closeAboutModal();
        }
    });

    console.log('About modal initialized');
}

function showAboutModal() {
    const modal = document.getElementById('about-modal');
    if (modal) {
        modal.showModal();
        console.log('About modal opened');

        // Close the dropdown menu
        const dropdownToggle = bootstrap.Dropdown.getInstance(document.getElementById('btn-menu'));
        if (dropdownToggle) {
            dropdownToggle.hide();
        }
    }
}

function closeAboutModal() {
    const modal = document.getElementById('about-modal');
    if (modal && modal.open) {
        modal.close();
        console.log('About modal closed');
    }
}

// Swipe gesture initialization
function initializeSwipeGestures() {
    const stageOverlay = document.getElementById('stage-overlay');
    if (!stageOverlay) {
        console.error('Stage overlay not found for swipe gestures');
        return;
    }

    // Add pointer event listeners
    stageOverlay.addEventListener('pointerdown', handlePointerDown, { passive: false });
    stageOverlay.addEventListener('pointermove', handlePointerMove, { passive: false });
    stageOverlay.addEventListener('pointerup', handlePointerEnd, { passive: false });
    stageOverlay.addEventListener('pointercancel', handlePointerEnd, { passive: false });

    // Prevent context menu and text selection
    stageOverlay.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    // Prevent drag operations
    stageOverlay.addEventListener('dragstart', function(e) {
        e.preventDefault();
    });

    console.log('Swipe gestures initialized');
}

function handlePointerDown(e) {
    // Only handle primary pointer (first finger/main pointer)
    if (!e.isPrimary) {
        console.log('Ignoring non-primary pointer');
        return;
    }

    swipeState.isTracking = true;
    swipeState.startX = e.clientX;
    swipeState.startY = e.clientY;
    swipeState.currentX = e.clientX;
    swipeState.currentY = e.clientY;
    swipeState.startTime = Date.now();

    // Capture the pointer
    e.target.setPointerCapture(e.pointerId);
}

function handlePointerMove(e) {
    if (!swipeState.isTracking || !e.isPrimary) return;

    swipeState.currentX = e.clientX;
    swipeState.currentY = e.clientY;

    // Calculate distances
    const deltaX = swipeState.currentX - swipeState.startX;
    const deltaY = swipeState.currentY - swipeState.startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // If this is primarily a vertical gesture, don't prevent default
    // This allows vertical scrolling on additional content to work properly
    if (absDeltaY > absDeltaX && absDeltaY > 20) {
        return;
    }

    // If this is primarily horizontal, prevent default to avoid any browser gestures
    if (absDeltaX > absDeltaY && absDeltaX > 10) {
        e.preventDefault();
    }
}

function handlePointerEnd(e) {
    if (!swipeState.isTracking || !e.isPrimary) return;

    const deltaX = swipeState.currentX - swipeState.startX;
    const deltaY = swipeState.currentY - swipeState.startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const deltaTime = Date.now() - swipeState.startTime;

    // Reset tracking state
    swipeState.isTracking = false;

    // Swipe detection parameters
    const minSwipeDistance = 50; // Minimum distance for a swipe
    const maxSwipeTime = 1000; // Maximum time for a swipe (ms)
    const minSwipeVelocity = 0.1; // Minimum velocity (pixels per ms)

    // Calculate velocity
    const velocity = absDeltaX / deltaTime;

    // Check if this qualifies as a horizontal swipe
    if (absDeltaX >= minSwipeDistance &&
        absDeltaX > absDeltaY * 1.5 && // Horizontal bias
        deltaTime <= maxSwipeTime &&
        velocity >= minSwipeVelocity) {

        // Determine swipe direction and navigate
        if (deltaX > 0) {
            // Swipe right -> previous slide
            console.log('Swipe right detected - going to previous slide');
            navigateSlide(-1);
        } else {
            // Swipe left -> next slide  
            console.log('Swipe left detected - going to next slide');
            navigateSlide(1);
        }
    } else {
        // nothing to do
    }

    // Release pointer capture
    if (e.target.hasPointerCapture(e.pointerId)) {
        e.target.releasePointerCapture(e.pointerId);
    }
}

// Auto-hide navigation functionality
function initializeAutoHideNavigation() {
    // Initialize with buttons visible
    showNavigationButtons();

    // Add activity listeners
    const activityEvents = ['mousemove', 'mousedown', 'click', 'keydown', 'pointerdown', 'touchstart'];

    activityEvents.forEach(eventType => {
        document.addEventListener(eventType, handleUserActivity, { passive: true });
    });

    // Start the initial timer
    resetAutoHideTimer();

    console.log('Auto-hide navigation initialized');
}

function handleUserActivity() {
    // Show buttons if they were hidden
    if (!areNavigationButtonsVisible) {
        showNavigationButtons();
    }

    // Reset the auto-hide timer
    resetAutoHideTimer();
}

function resetAutoHideTimer() {
    // Clear existing timer
    if (autoHideTimer) {
        clearTimeout(autoHideTimer);
        autoHideTimer = null;
    }

    // Don't start timer if menu or overview are open
    if (isMenuOpen || isOverviewVisible) {
        return;
    }

    // Start new timer
    autoHideTimer = setTimeout(() => {
        hideNavigationButtons();
    }, INACTIVITY_HIDE_MS);
}

function showNavigationButtons() {
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');

    if (prevBtn && nextBtn) {
        prevBtn.classList.remove('auto-hidden');
        nextBtn.classList.remove('auto-hidden');
        areNavigationButtonsVisible = true;

        // Update visibility based on current slide position
        updateNavigationButtonVisibility();
    }
}

function updateNavigationButtonVisibility() {
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');

    if (!prevBtn || !nextBtn) return;

    // Hide previous button on first slide
    if (currentSlideIndex === 0) {
        prevBtn.classList.add('nav-hidden');
    } else {
        prevBtn.classList.remove('nav-hidden');
    }

    // Hide next button on last slide
    if (currentSlideIndex === slides.length - 1) {
        nextBtn.classList.add('nav-hidden');
    } else {
        nextBtn.classList.remove('nav-hidden');
    }
}

function hideNavigationButtons() {
    // Don't hide if menu or overview are open
    if (isMenuOpen || isOverviewVisible) {
        return;
    }

    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');

    if (prevBtn && nextBtn) {
        prevBtn.classList.add('auto-hidden');
        nextBtn.classList.add('auto-hidden');
        areNavigationButtonsVisible = false;
        console.log('Navigation buttons auto-hidden after inactivity');
    }
}

// Enhanced debounce utility function with immediate option
function debounce(func, wait, immediate = false) {
    let timeout;
    let callCount = 0;

    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) {
                callCount++;
                func.apply(this, args);

                // Reset call count after a period of inactivity
                setTimeout(() => {
                    callCount = 0;
                }, wait * 2);
            }
        };

        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) {
            callCount++;
            func.apply(this, args);
        }
    };
}

// Specialized debounce for rapid resize events that prevents excessive calls
function debounceResize(func, wait) {
    let timeout;
    let rafId;
    let lastCallTime = 0;

    return function executedFunction(...args) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime;

        // Cancel any pending animation frame
        if (rafId) {
            cancelAnimationFrame(rafId);
        }

        clearTimeout(timeout);

        // If it's been a while since the last call, execute immediately
        if (timeSinceLastCall > wait * 2) {
            lastCallTime = now;
            rafId = requestAnimationFrame(() => {
                func.apply(this, args);
            });
        } else {
            // Otherwise, debounce normally
            timeout = setTimeout(() => {
                lastCallTime = Date.now();
                rafId = requestAnimationFrame(() => {
                    func.apply(this, args);
                });
            }, wait);
        }
    };
}
