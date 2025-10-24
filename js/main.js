// Main Initialization - Setup and event listeners

function init() {
    // Initialize DOM element references
    canvas = document.getElementById('canvas');
    canvasContainer = document.getElementById('canvas-container');
    svgCanvas = document.getElementById('svg-canvas');
    backgroundGrid = document.getElementById('background-grid');
    zoomLevel = document.getElementById('zoom-level');
    colorPicker = document.getElementById('color-picker');
    colorWheelPicker = document.getElementById('color-wheel-picker');
    colorWheelCanvas = document.getElementById('color-wheel-canvas');
    colorPreviewBox = document.getElementById('color-preview-box');
    colorHexInput = document.getElementById('color-hex-input');
    dialoguePanel = document.getElementById('dialogue-panel');
    dialogueContent = document.getElementById('dialogue-content');
    variablePanel = document.getElementById('variable-panel');
    variableList = document.getElementById('variable-list');

    setupEventListeners();
    initColorPicker();
    initColorWheel();
    updateTransform();
    updateBreadcrumbs();

    // Auto-create START node in root if it doesn't exist
    ensureRootStartNode();
}

function setupEventListeners() {
    canvasContainer.addEventListener('mousedown', handleCanvasPanStart);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    canvasContainer.addEventListener('wheel', handleZoom, { passive: false });
    canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('click', (e) => {
        // Don't close color picker if color wheel is open or if clicking on custom color button
        const isColorWheelOpen = colorWheelPicker.classList.contains('active');
        const clickedCustomBtn = e.target.classList.contains('custom-color-btn');

        if (!colorPicker.contains(e.target) && !e.target.classList.contains('color-btn') && !isColorWheelOpen) {
            colorPicker.classList.remove('active');
        }

        if (!colorWheelPicker.contains(e.target) && !clickedCustomBtn) {
            colorWheelPicker.classList.remove('active');
        }
    });

    // Space key for advancing execution
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && isPlaying) {
            e.preventDefault();
            advanceExecution();
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}