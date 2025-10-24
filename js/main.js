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

    setupEventListeners();
    initColorPicker();
    initColorWheel();
    updateTransform();
}

function setupEventListeners() {
    canvasContainer.addEventListener('mousedown', handleCanvasPanStart);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    canvasContainer.addEventListener('wheel', handleZoom, { passive: false });
    canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('click', (e) => {
        if (!colorPicker.contains(e.target) && !e.target.classList.contains('color-btn')) {
            colorPicker.classList.remove('active');
        }
        if (!colorWheelPicker.contains(e.target) && !e.target.classList.contains('custom-color-btn')) {
            colorWheelPicker.classList.remove('active');
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}