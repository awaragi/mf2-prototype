// Presentation App Logic
// Application logic will be added in subsequent stages

// Configuration constants
const INACTIVITY_HIDE_MS = 1000;
const BASE_W = 1024;
const BASE_H = 768;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Presentation app initialized');
    initializeHeader();
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
