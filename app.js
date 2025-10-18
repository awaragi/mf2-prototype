// Presentation App Logic
// Application logic will be added in subsequent stages

// Import slides data
import slides from './slides.js';

// Configuration constants
const INACTIVITY_HIDE_MS = 1000;
const BASE_W = 1024;
const BASE_H = 768;

// Stage scaling variables
let currentScale = 1;
let stageElement;
let stageWrapElement;
let currentSlideIndex = 0;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Presentation app initialized');
    initializeHeader();
    initializeStage();
    initializeNavigation();
    loadSlideFromHash();
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

    // Menu item handlers (placeholder functionality)
    const fullscreenBtn = document.getElementById('menu-fullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', function() {
            console.log('Fullscreen clicked (functionality will be added later)');
        });
    }

    // Grid button handler (placeholder)
    const gridBtn = document.getElementById('btn-grid');
    if (gridBtn) {
        gridBtn.addEventListener('click', function() {
            console.log('Grid button clicked (functionality will be added later)');
        });
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

    // Add resize listeners
    window.addEventListener('resize', debounce(calculateStageScale, 100));
    window.addEventListener('orientationchange', function() {
        // Small delay to allow orientation change to complete
        setTimeout(calculateStageScale, 100);
    });

    console.log('Stage initialized with scaling');
}

function calculateStageScale() {
    if (!stageElement || !stageWrapElement) return;

    // Get header height
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
    const scale = Math.min(scaleByWidth, scaleByHeight); // Allow scaling beyond 1:1
    // Apply scaling
    currentScale = scale;

    // Set the stage size
    const stageWidth = BASE_W * scale;
    const stageHeight = BASE_H * scale;

    stageElement.style.width = `${stageWidth}px`;
    stageElement.style.height = `${stageHeight}px`;
    stageElement.style.maxWidth = `${stageWidth}px`;

    // Reapply content scaling if content exists
    const contentContainer = stageElement.querySelector('.slide-content');
    if (contentContainer) {
        applyContentScaling(contentContainer);
    }

    console.log(`Stage scaled to ${stageWidth}x${stageHeight} (scale: ${scale.toFixed(3)})`);
}

// Navigation and slide management
function initializeNavigation() {
    // Listen for hash changes
    window.addEventListener('hashchange', loadSlideFromHash);

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        switch(e.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                navigateSlide(-1);
                break;
            case 'ArrowRight':
            case 'ArrowDown':
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
        }
    });
}

function loadSlideFromHash() {
    const hash = window.location.hash.slice(1);
    let slideIndex = 0;

    if (hash) {
        const foundIndex = slides.findIndex(slide => slide.id === hash);
        if (foundIndex !== -1) {
            slideIndex = foundIndex;
        }
    }

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
    const slide = slides[index];

    // Update URL hash
    window.history.replaceState(null, null, `#${slide.id}`);

    // Update header title
    updateHeaderTitle(slide.title);

    // Render slide content
    renderSlide(slide);
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

    // Hide loading after a short delay
    setTimeout(() => showLoading(false), 300);
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

    // Add additional content if present
    if (slide.additional) {
        const additionalDiv = document.createElement('div');
        additionalDiv.className = 'additional-content';
        additionalDiv.style.marginTop = '2rem';
        additionalDiv.style.fontSize = '0.9em';
        additionalDiv.innerHTML = slide.additional;
        content.appendChild(additionalDiv);
    }

    container.appendChild(content);
}

function renderImageSlide(container, slide) {
    const img = document.createElement('img');
    img.src = slide.src;
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

    // Add additional content if present
    if (slide.additional) {
        const additionalDiv = document.createElement('div');
        additionalDiv.className = 'additional-content';
        additionalDiv.style.position = 'absolute';
        additionalDiv.style.bottom = '20px';
        additionalDiv.style.left = '20px';
        additionalDiv.style.right = '20px';
        additionalDiv.style.background = 'rgba(255, 255, 255, 0.9)';
        additionalDiv.style.padding = '15px';
        additionalDiv.style.borderRadius = '8px';
        additionalDiv.innerHTML = slide.additional;
        content.appendChild(additionalDiv);
        content.style.position = 'relative';
    }

    container.appendChild(content);
}

function applyContentScaling(contentContainer) {
    const scale = currentScale;
    contentContainer.style.transform = `scale(${scale})`;
    contentContainer.style.transformOrigin = 'top left';
}

function showLoading(show) {
    const loadingElement = document.getElementById('stage-loading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'flex' : 'none';
        loadingElement.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
}

// Debounce utility function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
