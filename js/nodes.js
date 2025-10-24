// Node Management - Creating, rendering, and managing nodes

function createNode() {
    const id = nodeIdCounter++;

    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const centerWorld = screenToWorld(centerX, centerY);

    const node = {
        id: id,
        x: centerWorld.x - 110,
        y: centerWorld.y - 75,
        width: 220,
        height: 150,
        text: 'Enter text here...',
        color: '#007acc',
        title: 'Node ' + id,
        inputs: [{ id: 1 }],
        outputs: [{ id: 1 }],
        inputIdCounter: 2,
        outputIdCounter: 2
    };

    nodes.push(node);
    renderNode(node);
}

function renderNode(node) {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'node';
    nodeEl.id = `node-${node.id}`;
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';
    nodeEl.style.width = node.width + 'px';
    nodeEl.style.height = node.height + 'px';
    nodeEl.style.borderColor = node.color;

    nodeEl.innerHTML = `
        <div class="node-header">
            <input class="node-title-input" value="${node.title}" readonly onchange="updateNodeTitle(${node.id}, this.value)" onmousedown="event.stopPropagation()">
            <div class="node-controls">
                <button class="node-btn color-btn" style="background: ${node.color};" onclick="showColorPicker(event, ${node.id}, 'node')">●</button>
                <button class="node-btn" onclick="deleteNode(${node.id})">×</button>
            </div>
        </div>
        <div class="node-content">
            <textarea oninput="updateNodeText(${node.id}, this.value)" onmousedown="event.stopPropagation()">${node.text}</textarea>
        </div>
        <div class="connection-points"></div>
        <button class="add-connection-btn input" style="color: ${node.color}; border-color: ${node.color};" onclick="addInput(${node.id})">+</button>
        <button class="add-connection-btn output" style="color: ${node.color}; border-color: ${node.color};" onclick="addOutput(${node.id})">+</button>
        <div class="resize-handle right"></div>
        <div class="resize-handle bottom"></div>
        <div class="resize-handle corner"></div>
    `;

    canvas.appendChild(nodeEl);

    const titleInput = nodeEl.querySelector('.node-title-input');
    
    // Prevent single clicks from doing anything
    titleInput.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });

    // Only allow editing on double-click
    titleInput.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
        titleInput.removeAttribute('readonly');
        titleInput.focus();
        titleInput.select();
    });

    titleInput.addEventListener('blur', (e) => {
        titleInput.setAttribute('readonly', 'true');
    });

    titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleInput.blur();
        }
    });

    const header = nodeEl.querySelector('.node-header');
    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-btn')) return;
        if (e.target.classList.contains('node-title-input') && !e.target.hasAttribute('readonly')) return;

        if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            toggleSelection(node.id, 'node');
            return;
        }

        if (!selectedNodes.includes(node.id)) {
            clearSelection();
            addToSelection(node.id, 'node');
        }

        startDrag(e, node, 'node');
    });

    nodeEl.querySelector('.resize-handle.right').addEventListener('mousedown', (e) => startResize(e, node, 'right', false));
    nodeEl.querySelector('.resize-handle.bottom').addEventListener('mousedown', (e) => startResize(e, node, 'bottom', false));
    nodeEl.querySelector('.resize-handle.corner').addEventListener('mousedown', (e) => startResize(e, node, 'corner', false));

    updateConnectionPoints(node);
}

function updateConnectionPoints(node) {
    const nodeEl = document.getElementById(`node-${node.id}`);
    const pointsContainer = nodeEl.querySelector('.connection-points');
    pointsContainer.innerHTML = '';

    const inputCount = node.inputs.length;
    const outputCount = node.outputs.length;

    node.inputs.forEach((input, index) => {
        const point = document.createElement('div');
        point.className = 'connection-point input';
        point.style.color = node.color;
        const top = ((index + 1) / (inputCount + 1)) * 100;
        point.style.top = `${top}%`;
        point.dataset.nodeId = node.id;
        point.dataset.pointId = input.id;
        point.dataset.type = 'input';

        point.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        point.addEventListener('mouseup', (e) => endConnection(e, node.id, input.id, 'input'));

        point.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (node.inputs.length > 1) {
                removeInput(node.id, input.id);
            }
        });

        pointsContainer.appendChild(point);
    });

    node.outputs.forEach((output, index) => {
        const point = document.createElement('div');
        point.className = 'connection-point output';
        point.style.color = node.color;
        const top = ((index + 1) / (outputCount + 1)) * 100;
        point.style.top = `${top}%`;
        point.dataset.nodeId = node.id;
        point.dataset.pointId = output.id;
        point.dataset.type = 'output';

        point.addEventListener('mousedown', (e) => startConnection(e, node.id, output.id));

        point.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (node.outputs.length > 1) {
                removeOutput(node.id, output.id);
            }
        });

        pointsContainer.appendChild(point);
    });

    updateConnectionsForNode(node.id);
}

function addInput(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
        node.inputs.push({ id: node.inputIdCounter++ });
        updateConnectionPoints(node);
    }
}

function addOutput(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
        node.outputs.push({ id: node.outputIdCounter++ });
        updateConnectionPoints(node);
    }
}

function removeInput(nodeId, inputId) {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
        connections = connections.filter(conn => {
            if (conn.toNode === nodeId && conn.toPoint === inputId) {
                const line = document.getElementById(`conn-${conn.id}`);
                if (line) line.remove();
                const gradient = document.getElementById(`gradient-${conn.id}`);
                if (gradient) gradient.remove();
                return false;
            }
            return true;
        });

        node.inputs = node.inputs.filter(i => i.id !== inputId);
        updateConnectionPoints(node);
    }
}

function removeOutput(nodeId, outputId) {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
        connections = connections.filter(conn => {
            if (conn.fromNode === nodeId && conn.fromPoint === outputId) {
                const line = document.getElementById(`conn-${conn.id}`);
                if (line) line.remove();
                const gradient = document.getElementById(`gradient-${conn.id}`);
                if (gradient) gradient.remove();
                return false;
            }
            return true;
        });

        node.outputs = node.outputs.filter(o => o.id !== outputId);
        updateConnectionPoints(node);
    }
}

function updateNodeTitle(nodeId, title) {
    const node = nodes.find(n => n.id === nodeId);
    if (node) node.title = title;
}

function updateNodeText(nodeId, text) {
    const node = nodes.find(n => n.id === nodeId);
    if (node) node.text = text;
}

function deleteNode(nodeId) {
    connections = connections.filter(conn => {
        if (conn.fromNode === nodeId || conn.toNode === nodeId) {
            const line = document.getElementById(`conn-${conn.id}`);
            if (line) line.remove();
            const gradient = document.getElementById(`gradient-${conn.id}`);
            if (gradient) gradient.remove();
            return false;
        }
        return true;
    });

    nodes = nodes.filter(n => n.id !== nodeId);
    const nodeEl = document.getElementById(`node-${nodeId}`);
    if (nodeEl) nodeEl.remove();
}