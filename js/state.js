// Global State Variables

// Data
let nodes = [];
let comments = [];
let connections = [];
let nodeIdCounter = 1;
let commentIdCounter = 1;
let connectionIdCounter = 1;

// View state
let zoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Interaction state
let isConnecting = false;
let connectionStart = null;
let tempLine = null;
let dragState = null;
let resizeState = null;
let colorPickerTarget = null;
let customColorPickerTarget = null;
let selectedCustomColor = '#000000';

// Selection state
let selectedNodes = [];
let selectedComments = [];
let isSelecting = false;
let selectionStart = null;
let selectionBox = null;

// DOM Elements
let canvas;
let canvasContainer;
let svgCanvas;
let backgroundGrid;
let zoomLevel;
let colorPicker;
let colorWheelPicker;
let colorWheelCanvas;
let colorPreviewBox;
let colorHexInput;

// Color presets
const colors = [
    '#007acc', '#dc3545', '#28a745', '#ffc107', '#6f42c1',
    '#17a2b8', '#fd7e14', '#e83e8c', '#20c997', '#6c757d',
    '#343a40', '#f8f9fa', '#0056b3', '#721c24', '#155724'
];