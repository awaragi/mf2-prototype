// Presentation App Logic
// Application logic will be added in subsequent stages

// Configuration constants
const INACTIVITY_HIDE_MS = 1000;
const BASE_W = 1024;
const BASE_H = 768;

// Stage scaling variables
let currentScale = 1;
let stageElement;
let stageWrapElement;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Presentation app initialized');
    initializeHeader();
    initializeStage();
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
    const scale = Math.min(scaleByWidth, scaleByHeight, 1); // Don't scale up beyond 1:1

    // Apply scaling
    currentScale = scale;

    // Set the stage size
    const stageWidth = BASE_W * scale;
    const stageHeight = BASE_H * scale;

    stageElement.style.width = `${stageWidth}px`;
    stageElement.style.height = `${stageHeight}px`;
    stageElement.style.maxWidth = `${stageWidth}px`;

    console.log(`Stage scaled to ${stageWidth}x${stageHeight} (scale: ${scale.toFixed(3)})`);
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
