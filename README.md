# Node Editor

A visual node-based editor for creating flowcharts, diagrams, and node graphs. Built with vanilla JavaScript, HTML, and CSS.

## Features

- **Node Creation**: Create customizable nodes with inputs and outputs
- **Connections**: Connect nodes with gradient-colored bezier curves
- **Multi-Select**: Select multiple nodes/comments with Shift+Click or drag selection
- **Comments**: Add background comment boxes to organize your graph
- **Zoom & Pan**: Infinite canvas with zoom (mouse wheel) and pan (middle mouse button)
- **Color Customization**: Choose from preset colors or use the custom color wheel
- **Resizable**: Resize nodes and comments by dragging edges/corners
- **Save/Load**: Export and import your graphs as JSON files

## Controls

- **Click**: Select a node or comment
- **Shift+Click**: Add to multi-selection
- **Drag empty space**: Box select multiple items
- **Drag header**: Move selected node(s)/comment(s)
- **Drag corners/edges**: Resize nodes and comments
- **Double-click title**: Rename nodes and comments
- **Color dot button**: Open color picker
- **+ buttons**: Add input/output connection points
- **Right-click connection point**: Remove connection point
- **Mouse wheel**: Zoom in/out
- **Middle mouse button**: Pan the canvas
- **Right-click connection line**: Delete connection

## Project Structure

```
node-editor/
├── index.html              # Main HTML file
├── css/
│   └── style.css          # All styling
├── js/
│   ├── state.js           # Global state and variables
│   ├── viewport.js        # Zoom, pan, coordinate conversion
│   ├── selection.js       # Multi-select functionality
│   ├── connections.js     # Connection management
│   ├── nodes.js           # Node creation and management
│   ├── comments.js        # Comment areas
│   ├── color-picker.js    # Color picker with custom wheel
│   ├── file-operations.js # Save/load functionality
│   └── main.js            # Initialization and setup
└── README.md              # This file
```

## Getting Started

### Option 1: Direct File Opening
1. Open `index.html` in your web browser
2. Start creating nodes and connections!

### Option 2: Using a Local Server (Recommended)

**Using WebStorm:**
1. Open the project in WebStorm
2. Right-click `index.html` → "Open in Browser"
3. Or click the browser icon in the top-right corner

**Using Python:**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```
Then open `http://localhost:8000` in your browser

**Using Node.js (http-server):**
```bash
npx http-server
```

## File Format

Saved files are in JSON format and include:
- All nodes with their positions, sizes, text, and colors
- All comments with their properties
- All connections between nodes
- Current viewport state (zoom and pan position)
- ID counters for maintaining unique IDs

## Browser Compatibility

Works in all modern browsers that support:
- ES6 JavaScript
- CSS Grid
- SVG manipulation
- Canvas API

Tested on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Future Enhancements

Potential features to add:
- Undo/Redo functionality
- Node templates/presets
- Export to image (PNG/SVG)
- Keyboard shortcuts
- Node grouping
- Search/filter nodes
- Minimap for navigation
- Custom node types with specific behaviors

## License

Free to use and modify for personal and commercial projects.

## Credits

Created as a visual tool for organizing ideas, workflows, and data flows.