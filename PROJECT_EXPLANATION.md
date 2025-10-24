# Node Editor - Project Documentation

## Overview
This is a web-based node editor application built with vanilla JavaScript, HTML, and CSS. It allows users to create, connect, and organize nodes in a visual graph structure, similar to tools like Blender's node editor or Unreal Engine's Blueprint system.

## Architecture Overview

### Project Structure
```
NodeEditor/
├── index.html              # Main HTML structure
├── css/
│   └── style.css          # All styling
└── js/
    ├── state.js           # Global state management
    ├── viewport.js        # Pan, zoom, coordinate conversion
    ├── selection.js       # Multi-select functionality
    ├── connections.js     # Connection lines between nodes
    ├── nodes.js           # Node creation and rendering
    ├── comments.js        # Comment boxes (background organization)
    ├── groups.js          # Group nodes (NEW - nested navigation)
    ├── color-picker.js    # Color selection UI
    ├── file-operations.js # Save/load functionality
    └── main.js            # Initialization and event setup
```

## Core Concepts (For C#/C++ Developers)

### 1. State Management (state.js)
Coming from C#/C++, think of this as your global singleton state. Unlike C++ where you might use a class with static members, JavaScript uses simple module-level variables.

```javascript
// This is like having static members in a C++ class
let nodes = [];              // std::vector<Node>
let comments = [];           // std::vector<Comment>
let connections = [];        // std::vector<Connection>
let nodeIdCounter = 1;       // Simple ID generation (no GUIDs)
```

**Key Differences from C#/C++:**
- No strong typing (though TypeScript could add this)
- Arrays are dynamic (like `std::vector` or `List<T>`)
- Objects are dictionaries of properties (like `Dictionary<string, object>` in C#)

### 2. Coordinate Systems (viewport.js)

The app uses **two coordinate systems** (similar to game engines):

#### Screen Coordinates
- Pixel positions relative to the browser window
- Where mouse events occur
- Origin at top-left of viewport

#### World Coordinates
- Logical positions of nodes in the infinite canvas
- Independent of zoom/pan
- Where nodes are actually positioned

```javascript
// Conversion function (like a camera transform in games)
function screenToWorld(screenX, screenY) {
    const rect = canvasContainer.getBoundingClientRect();
    return {
        x: (screenX - rect.left - panX) / zoom,
        y: (screenY - rect.top - panY) / zoom
    };
}
```

**Transform Formula:**
```
world_x = (screen_x - pan_x) / zoom
screen_x = (world_x * zoom) + pan_x
```

This is similar to:
- OpenGL/DirectX view-projection matrices
- Unity's `Camera.ScreenToWorldPoint()`
- WPF's `RenderTransform`

### 3. Event-Driven Architecture

Unlike C++'s polling loops or C#'s event delegates, JavaScript uses DOM event listeners:

```javascript
// Similar to C# events: button.Click += HandleClick
canvasContainer.addEventListener('mousedown', handleCanvasPanStart);

// The handler receives an event object (like EventArgs in C#)
function handleCanvasPanStart(e) {
    if (e.button === 0) { /* Left click */
        // Handle selection
    }
    if (e.button === 1 || e.button === 2) { /* Middle/Right click */
        // Handle panning
    }
}
```

### 4. Node Data Structure

Nodes are plain JavaScript objects (like C# anonymous types or C++ structs):

```javascript
const node = {
    id: 1,                    // int
    x: 100,                   // float (world coordinates)
    y: 150,                   // float
    width: 220,               // float (pixels)
    height: 150,              // float
    text: 'Enter text...',    // string
    color: '#007acc',         // string (hex color)
    title: 'Node 1',          // string
    inputs: [{ id: 1 }],      // array of objects
    outputs: [{ id: 1 }],     // array of objects
    inputIdCounter: 2,        // int
    outputIdCounter: 2,       // int
    parentGroup: null,        // int? (nullable - null means root level)
    isGroup: false            // bool (for group nodes)
};
```

**Equivalent C# class:**
```csharp
class Node {
    public int Id { get; set; }
    public float X { get; set; }
    public float Y { get; set; }
    public float Width { get; set; }
    public float Height { get; set; }
    public string Text { get; set; }
    public string Color { get; set; }
    public string Title { get; set; }
    public List<ConnectionPoint> Inputs { get; set; }
    public List<ConnectionPoint> Outputs { get; set; }
    public int InputIdCounter { get; set; }
    public int OutputIdCounter { get; set; }
    public int? ParentGroup { get; set; }
    public bool IsGroup { get; set; }
}
```

## Key Systems Explained

### 1. Rendering System (nodes.js)

**Pattern:** Immediate Mode UI (like Dear ImGui in C++)

The `renderNode()` function creates DOM elements dynamically:

```javascript
function renderNode(node) {
    // Create a div element (like new UIElement() in WPF)
    const nodeEl = document.createElement('div');
    nodeEl.className = 'node';
    nodeEl.id = `node-${node.id}`;

    // Set CSS properties (like setting DependencyProperties)
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';
    nodeEl.style.width = node.width + 'px';
    nodeEl.style.height = node.height + 'px';

    // Set inner HTML (like XAML in WPF)
    nodeEl.innerHTML = `
        <div class="node-header">
            <input class="node-title-input" value="${node.title}">
            ...
        </div>
    `;

    // Add to DOM tree (like Controls.Add() in WinForms)
    canvas.appendChild(nodeEl);
}
```

**Think of it as:**
- WPF: Creating `UIElement` objects and adding to visual tree
- WinForms: Creating `Control` objects and adding to `Controls` collection
- C++ Qt: Creating `QWidget` objects

### 2. Connection System (connections.js)

Connections use **SVG** (Scalable Vector Graphics) for smooth curved lines:

```javascript
function renderConnection(conn) {
    // Get world positions of connection points
    const fromPos = getConnectionPointPosition(conn.fromNode, conn.fromPoint, 'output');
    const toPos = getConnectionPointPosition(conn.toNode, conn.toPoint, 'input');

    // Create Bezier curve control points
    const controlDist = Math.abs(toPos.x - fromPos.x) * 0.5;

    // SVG path data (like GDI+ or Direct2D path commands)
    const path = `M ${fromPos.x},${fromPos.y}
                  C ${fromPos.x + controlDist},${fromPos.y}
                    ${toPos.x - controlDist},${toPos.y}
                    ${toPos.x},${toPos.y}`;
}
```

**Bezier Curves:**
- M = MoveTo (starting point)
- C = CubicBezierTo (curve with 2 control points + end point)

Similar to:
- C++ GDI+: `GraphicsPath::AddBezier()`
- C# WPF: `PathGeometry` with `BezierSegment`
- Direct2D: `ID2D1PathGeometry`

### 3. Drag & Drop System (viewport.js)

**State Machine Pattern:**

```
[No Drag] --mousedown--> [Dragging]
[Dragging] --mousemove--> [Update Position]
[Dragging] --mouseup--> [No Drag]
```

```javascript
// Global state (like a member variable)
let dragState = null;

function startDrag(e, element, type) {
    // Enter dragging state
    const worldPos = screenToWorld(e.clientX, e.clientY);
    dragState = {
        element: element,
        type: type,
        offsetX: worldPos.x - element.x,
        offsetY: worldPos.y - element.y
    };
}

function handleMouseMove(e) {
    if (dragState) {
        // Update while dragging
        const worldPos = screenToWorld(e.clientX, e.clientY);
        dragState.element.x = worldPos.x - dragState.offsetX;
        dragState.element.y = worldPos.y - dragState.offsetY;
        updateElementPosition(dragState.element, dragState.type);
    }
}

function handleMouseUp(e) {
    // Exit dragging state
    dragState = null;
}
```

**Similar to:**
- WPF: `DragDrop.DoDragDrop()`
- WinForms: `Control.DoDragDrop()`
- C++/Win32: `WM_MOUSEMOVE` + state tracking

### 4. Group Node System (groups.js)

**Hierarchical Navigation Pattern:**

Group nodes create a **tree structure** where nodes can be nested:

```
Root Level
├── Node 1
├── Group A
│   ├── Node 2
│   ├── Node 3
│   └── Group B
│       ├── Node 4
│       └── Node 5
└── Node 6
```

**Data Structure:**
```javascript
// Current view state
let currentGroupId = null;        // null = root level
let navigationStack = [];         // Stack for breadcrumb navigation

// Each node tracks its parent
node.parentGroup = null;          // ID of parent group (null = root)

// Group nodes store child references
groupNode.isGroup = true;
groupNode.childNodes = [];        // IDs (though not actively used in current impl)
```

**Navigation Stack:**
```javascript
// When entering a group:
navigationStack.push({
    groupId: previousGroupId,
    view: { zoom, panX, panY }    // Save view state
});
currentGroupId = newGroupId;

// When going back:
const previous = navigationStack.pop();
currentGroupId = previous.groupId;
zoom = previous.view.zoom;        // Restore view
```

**Rendering Logic:**
```javascript
function renderCurrentGroup() {
    // Only show nodes in current group
    const visibleNodes = nodes.filter(n => n.parentGroup === currentGroupId);
    visibleNodes.forEach(node => renderNode(node));

    // Same for connections - only show if both nodes are visible
    const visibleConnections = connections.filter(conn => {
        const fromNode = nodes.find(n => n.id === conn.fromNode);
        const toNode = nodes.find(n => n.id === conn.toNode);
        return fromNode?.parentGroup === currentGroupId &&
               toNode?.parentGroup === currentGroupId;
    });
}
```

**Similar to:**
- File system navigation (folders within folders)
- Scene graph in game engines (Unity hierarchy)
- Tree view controls (WinForms TreeView, WPF TreeView)
- Visual Studio's code folding/regions

### 5. Transform System

**CSS Transforms** (GPU-accelerated):

```javascript
function updateTransform() {
    // Apply transform to canvas (like Matrix transform in GDI+)
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    svgCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}
```

**Matrix representation (what's happening behind the scenes):**
```
[zoom  0    panX]   [x]   [x*zoom + panX]
[0     zoom panY] × [y] = [y*zoom + panY]
[0     0    1   ]   [1]   [1            ]
```

This is exactly like:
- C# WPF: `MatrixTransform`
- C++ Direct2D: `D2D1::Matrix3x2F`
- OpenGL: Model-View matrix

### 6. File Serialization (file-operations.js)

**JSON Serialization** (like JSON.NET in C# or nlohmann/json in C++):

```javascript
function saveToFile() {
    // Create a data object (like a DTO in C#)
    const data = {
        nodes: nodes,
        comments: comments,
        connections: connections,
        nodeIdCounter: nodeIdCounter,
        commentIdCounter: commentIdCounter,
        connectionIdCounter: connectionIdCounter,
        view: { zoom, panX, panY },
        currentGroupId: currentGroupId,
        navigationStack: navigationStack
    };

    // Serialize to JSON string
    const json = JSON.stringify(data, null, 2);  // null, 2 = pretty print

    // Create download blob
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `node-graph-${Date.now()}.json`;
    a.click();
}
```

**Equivalent C# code:**
```csharp
// Using System.Text.Json
var data = new {
    nodes,
    comments,
    connections,
    nodeIdCounter,
    // ... etc
};

string json = JsonSerializer.Serialize(data, new JsonSerializerOptions {
    WriteIndented = true
});

File.WriteAllText("graph.json", json);
```

## CSS Layout System

### Flexbox (Similar to WPF StackPanel)

```css
.node-header {
    display: flex;              /* Enable flexbox */
    justify-content: space-between;  /* Spread items */
    align-items: center;        /* Vertical alignment */
}
```

**WPF Equivalent:**
```xml
<StackPanel Orientation="Horizontal"
            HorizontalAlignment="Stretch">
    <TextBox HorizontalAlignment="Left" />
    <Button HorizontalAlignment="Right" />
</StackPanel>
```

### Positioning

```css
.node {
    position: absolute;    /* Manual positioning (like Canvas in WPF) */
    left: 100px;          /* X position */
    top: 150px;           /* Y position */
}
```

**WPF Equivalent:**
```xml
<Canvas>
    <Rectangle Canvas.Left="100" Canvas.Top="150" />
</Canvas>
```

### Z-Index (Layering)

```css
.comment-area {
    z-index: 1;    /* Back layer */
}
.node {
    z-index: 100;  /* Front layer */
}
```

Like:
- WPF: `Panel.ZIndex`
- WinForms: `Control.BringToFront()` / `SendToBack()`

## Advanced JavaScript Concepts Used

### 1. Closures
```javascript
header.addEventListener('dblclick', (e) => {
    // This arrow function can access 'node' from outer scope
    if (node.isGroup) {
        openGroup(node.id);
    }
});
```

**C# Lambda Equivalent:**
```csharp
header.MouseDoubleClick += (sender, e) => {
    // Captures 'node' variable
    if (node.IsGroup) {
        OpenGroup(node.Id);
    }
};
```

### 2. Template Literals
```javascript
const html = `
    <div class="header">
        <input value="${node.title}">
    </div>
`;
```

**C# Equivalent:**
```csharp
string html = $@"
    <div class=""header"">
        <input value=""{node.Title}"">
    </div>
";
```

### 3. Array Methods (LINQ-like)

```javascript
// filter (like LINQ Where)
const visibleNodes = nodes.filter(n => n.parentGroup === currentGroupId);

// find (like LINQ FirstOrDefault)
const node = nodes.find(n => n.id === nodeId);

// forEach (like foreach loop)
nodes.forEach(node => renderNode(node));

// map (like LINQ Select)
const ids = nodes.map(n => n.id);
```

**C# LINQ Equivalent:**
```csharp
var visibleNodes = nodes.Where(n => n.ParentGroup == currentGroupId);
var node = nodes.FirstOrDefault(n => n.Id == nodeId);
nodes.ForEach(node => RenderNode(node));
var ids = nodes.Select(n => n.Id);
```

### 4. Destructuring
```javascript
const { zoom, panX, panY } = data.view;

// Equivalent to:
const zoom = data.view.zoom;
const panX = data.view.panX;
const panY = data.view.panY;
```

**C# 7.0+ Deconstruction:**
```csharp
var (zoom, panX, panY) = data.View;
```

## Performance Considerations

### 1. DOM Manipulation
- **Expensive:** Creating/destroying DOM elements
- **Cheap:** Updating CSS properties
- **Optimization:** Reuse elements when possible, batch updates

**Similar to:**
- WPF: Virtualization in `ItemsControl`
- WinForms: `SuspendLayout()` / `ResumeLayout()`

### 2. Event Delegation
- Events bubble up the DOM tree
- Can listen on parent instead of each child
- Like WPF's routed events

### 3. Transform vs. Repositioning
```javascript
// FAST: GPU-accelerated transform
element.style.transform = 'translate(10px, 20px)';

// SLOWER: Triggers layout recalculation
element.style.left = '10px';
element.style.top = '20px';
```

## Common Patterns Used

### 1. State Machine Pattern
```
Idle → (mousedown) → Panning → (mousemove) → Update Pan
                              ↓ (mouseup)
                              Idle
```

### 2. Observer Pattern
DOM events act as observers:
```javascript
canvasContainer.addEventListener('mousedown', handler);
// When mousedown occurs, all subscribed handlers are called
```

### 3. Command Pattern (implicitly in save/load)
Each save file is a snapshot that can restore the entire state.

### 4. Composite Pattern (Group Nodes)
Groups contain other nodes, which can themselves be groups (tree structure).

## How to Extend the System

### Adding a New Node Property

1. **Update the data structure** (nodes.js):
```javascript
const node = {
    // ... existing properties
    myNewProperty: 'default value'
};
```

2. **Update the render function** (nodes.js):
```javascript
nodeEl.innerHTML = `
    <div>My Property: ${node.myNewProperty}</div>
`;
```

3. **Update file operations** (file-operations.js):
Already handled automatically via `JSON.stringify(nodes)`

### Adding a New Feature

1. Create a new `.js` file
2. Add it to `index.html` script list
3. Use existing global variables from `state.js`
4. Hook into event system in `main.js`

## Browser DevTools Tips

### Debugging
```javascript
console.log(nodes);           // Print to console
debugger;                     // Breakpoint (like Debugger.Break() in C#)
```

### Inspecting Elements
- Right-click element → "Inspect"
- See computed CSS styles
- Modify live in DevTools

### Performance Profiling
- F12 → Performance tab
- Record → Perform action → Stop
- See frame-by-frame breakdown

## Comparison to Desktop Frameworks

| Web (This Project) | C# WPF | C++ Qt | WinForms |
|-------------------|---------|---------|-----------|
| HTML/CSS | XAML | QML | Designer |
| DOM | Visual Tree | QObject Tree | Control Hierarchy |
| addEventListener | Events (+= ) | signals/slots | Events (+= ) |
| style.transform | TransformGroup | QTransform | Matrix |
| JSON | JSON.NET | QJsonDocument | JSON.NET |
| Flexbox | StackPanel | QBoxLayout | FlowLayoutPanel |

## Key Takeaways for C#/C++ Developers

1. **No Manual Memory Management** - Garbage collected (like C#)
2. **Dynamic Typing** - Variables don't have types (use TypeScript for types)
3. **Event-Driven** - Everything is async and event-based
4. **Single-Threaded** - But non-blocking via promises/async
5. **Prototype-Based** - Objects inherit from other objects (not classes)
6. **Functional Style** - Functions are first-class citizens
7. **DOM is Your UI** - HTML elements = UI controls

## Further Learning

1. **Modern JavaScript (ES6+)** - Arrow functions, destructuring, modules
2. **TypeScript** - Adds C#-like type safety to JavaScript
3. **Canvas API** - For more complex 2D rendering (like GDI+)
4. **WebGL** - For 3D graphics (like OpenGL/DirectX)
5. **React/Vue/Angular** - Frameworks for larger applications
6. **Electron** - Turn web apps into desktop apps

## Conclusion

This project demonstrates core concepts of interactive web applications:
- State management
- Event handling
- Coordinate transformations
- Custom rendering
- Hierarchical data structures
- File I/O

The skills learned here translate directly to game development, desktop applications, and larger web projects. The architecture is similar to professional node editors used in Blender, Unreal Engine, and Unity's Shader Graph.
