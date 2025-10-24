// Index page functionality - loads and displays presentations list

// Load presentation data via AJAX
async function loadPresentations() {
    try {
        const response = await fetch('/api/slides.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const slidesData = await response.json();
        console.log('[INDEX] Slides loaded successfully', slidesData);
        return slidesData;
    } catch (error) {
        console.error('[INDEX] Error loading presentations:', error);
        return null;
    }
}

function createPresentationHTML(presentations) {
    return presentations.map(presentation => {
        const firstSlideId = presentation.slides[0]?.id || '';
        const presentationUrl = `present.html#${presentation.id}/${firstSlideId}`;

        return `
            <li>
                <a href="${presentationUrl}">
                    ${presentation.title}
                </a>
                <div class="presentation-meta">
                    ${presentation.slides.length} slide${presentation.slides.length !== 1 ? 's' : ''}
                </div>
            </li>
        `;
    }).join('');
}

async function generatePresentationsList() {
    const listElement = document.getElementById('presentations-list');
    const presentations = await loadPresentations();

    if (!presentations) {
        listElement.innerHTML = '<li style="color: red;">Error loading presentations. Please check if slides.json exists.</li>';
        return;
    }

    // Replace placeholder with actual content
    listElement.innerHTML = createPresentationHTML(presentations);

    console.log(`[INDEX] Loaded ${presentations.length} presentations`);
}

// Online/offline indicator functionality
function updateOnlineStatus() {
    const online = navigator.onLine;
    const netEl = document.getElementById('net-indicator');
    if (netEl) {
        netEl.className = 'badge ' + (online ? 'text-bg-success' : 'text-bg-secondary');
        netEl.textContent = online ? 'Online' : 'Offline';
    }
}

// Button to open offline.html page
function initOfflineButton() {
    const btnOffline = document.getElementById('btn-offline');
    if (btnOffline) {
        btnOffline.addEventListener('click', () => {
            window.location.href = 'offline.html';
        });
    }
}

function initNavigation() {
    updateOnlineStatus();
    initOfflineButton();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    generatePresentationsList();
    initNavigation();
});
