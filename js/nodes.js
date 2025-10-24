// Node Management - Creating, rendering, and managing nodes

function ensureRootStartNode() {
    // Check if START node exists in root group (null)
    const existingStart = nodes.find(n => n.isRoot && n.parentGroup === null);
    if (!existingStart) {
        createStartNodeAt(null, 0, 0);
    }
}

function createStartNodeAt(parentGroup, x, y) {
    const id = nodeIdCounter++;

    const node = {
        id: id,
        x: x,
        y: y,
        width: 220,
        height: 100,
        text: '',
        color: '#28a745', // Green for root
        title: 'START',
        inputs: [],
        outputs: [{ id: 1, type: CONNECTION_TYPE.EXEC }],
        isRoot: true,
        isSystemNode: true, // Can't be deleted but can be moved
        parentGroup: parentGroup
    };

    nodes.push(node);
    if (parentGroup === currentGroupId) {
        renderNode(node);
    }
    return node;
}

function createRootNode() {
    if (isPlaying) return;

    // Check if root node already exists in current group
    const existingRoot = nodes.find(n => n.isRoot && n.parentGroup === currentGroupId);
    if (existingRoot) {
        alert('A root node already exists in this group! Only one root node is allowed.');
        return;
    }

    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const centerWorld = screenToWorld(centerX, centerY);

    createStartNodeAt(currentGroupId, centerWorld.x - 110, centerWorld.y - 75);
}

function createInNode(groupId, groupNodeId) {
    const id = nodeIdCounter++;
    const node = {
        id: id,
        x: 50,
        y: 100,
        width: 180,
        height: 80,
        text: '',
        color: '#17a2b8', // Cyan for IN
        title: 'IN',
        inputs: [{ id: 1, type: CONNECTION_TYPE.EXEC }], // Has input in data, but won't show visually
        outputs: [{ id: 1, type: CONNECTION_TYPE.EXEC }],
        isInNode: true,
        isSystemNode: true,
        linkedGroupNode: groupNodeId,
        parentGroup: groupId
    };

    nodes.push(node);
    if (groupId === currentGroupId) {
        renderNode(node);
    }
    return node;
}

function createOutNode(groupId, groupNodeId, outIndex = 0) {
    const id = nodeIdCounter++;
    const node = {
        id: id,
        x: 600,
        y: 100 + (outIndex * 150),
        width: 180,
        height: 80,
        text: '',
        color: '#fd7e14', // Orange for OUT
        title: 'OUT ' + (outIndex + 1),
        inputs: [{ id: 1, type: CONNECTION_TYPE.EXEC }],
        outputs: [{ id: 1, type: CONNECTION_TYPE.EXEC }], // Has output in data, but won't show visually
        isOutNode: true,
        isSystemNode: true,
        linkedGroupNode: groupNodeId,
        outIndex: outIndex,
        parentGroup: groupId
    };

    nodes.push(node);
    if (groupId === currentGroupId) {
        renderNode(node);
    }
    return node;
}

function createNode() {
    if (isPlaying) return;
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
        text: '',
        color: '#007acc',
        title: 'Node ' + id,
        inputs: [{ id: 1, type: CONNECTION_TYPE.EXEC }],
        outputs: [{ id: 1, type: CONNECTION_TYPE.EXEC }],
        parentGroup: currentGroupId // Track which group this node belongs to
    };

    nodes.push(node);
    renderNode(node);
}

function renderNode(node) {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'node';
    if (node.isGroup) {
        nodeEl.classList.add('group-node');
    }
    nodeEl.id = `node-${node.id}`;
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';
    nodeEl.style.width = node.width + 'px';
    nodeEl.style.height = node.height + 'px';
    nodeEl.style.borderColor = node.color;
    nodeEl.style.setProperty('--node-color', node.color);

    let contentHtml;
    if (node.isRoot) {
        contentHtml = '<div class="node-content" style="display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: #28a745;">▶ START</div>';
    } else if (node.isInNode) {
        contentHtml = '<div class="node-content" style="display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; color: #17a2b8;">⬇ IN</div>';
    } else if (node.isOutNode) {
        contentHtml = '<div class="node-content" style="display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; color: #fd7e14;">⬆ OUT</div>';
    } else if (node.isGroup) {
        contentHtml = '<div class="node-content" style="display: flex; align-items: center; justify-content: center; font-size: 14px; color: #888;">Double-click to open</div>';
    } else {
        contentHtml = '<div class="node-content"><textarea placeholder="Enter text here..." oninput="updateNodeText(' + node.id + ', this.value)" onmousedown="event.stopPropagation()">' + node.text + '</textarea></div>';
    }

    nodeEl.innerHTML = `
        <div class="node-header">
            <input class="node-title-input" value="${node.title}" readonly onchange="updateNodeTitle(${node.id}, this.value)">
            <div class="node-controls">
                <button class="node-btn color-btn" style="background: ${node.color};" onclick="showColorPicker(event, ${node.id}, 'node')">●</button>
                <button class="node-btn" onclick="deleteNode(${node.id})">×</button>
            </div>
        </div>
        ${contentHtml}
        <div class="connection-points"></div>
        <div class="resize-handle right"></div>
        <div class="resize-handle bottom"></div>
        <div class="resize-handle corner"></div>
    `;

    canvas.appendChild(nodeEl);

    const textarea = nodeEl.querySelector('textarea');
    if (textarea) {
        textarea.addEventListener('focus', (e) => {
            if (isPlaying) {
                e.target.blur();
            }
        });
    }

    const titleInput = nodeEl.querySelector('.node-title-input');

    titleInput.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (titleInput.hasAttribute('readonly')) {
            e.preventDefault();
        }
    });

    titleInput.addEventListener('dblclick', (e) => {
        if (isPlaying) return;
        e.stopPropagation();
        titleInput.removeAttribute('readonly');
        titleInput.focus();
        titleInput.select();
    });

    titleInput.addEventListener('blur', (e) => {
        titleInput.setAttribute('readonly', 'true');
    });

    titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            titleInput.blur();
        }
    });

    const header = nodeEl.querySelector('.node-header');

    // Double-click to open group nodes
    header.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('node-title-input')) return;
        if (e.target.closest('.node-btn')) return;

        if (node.isGroup) {
            e.preventDefault();
            e.stopPropagation();
            openGroup(node.id);
        }
    });

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

    // Don't render input points for IN nodes (connection is on group node from outside)
    if (!node.isInNode) {
        node.inputs.forEach((input, index) => {
            const point = document.createElement('div');
            const connectionType = input.type || CONNECTION_TYPE.EXEC;
            point.className = 'connection-point input';
            if (connectionType === CONNECTION_TYPE.DATA) {
                point.classList.add('data');
            }
            point.style.color = node.color;
            const top = ((index + 1) / (inputCount + 1)) * 100;
            point.style.top = `${top}%`;
            point.dataset.nodeId = node.id;
            point.dataset.pointId = input.id;
            point.dataset.type = 'input';
            point.dataset.connectionType = connectionType;

            // Add label if provided
            if (input.label) {
                const label = document.createElement('span');
                label.className = 'connection-point-label input-label';
                label.textContent = input.label;
                point.appendChild(label);
            }

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
    }

    // Don't render output points for OUT nodes (connection is on group node from outside)
    if (!node.isOutNode) {
        node.outputs.forEach((output, index) => {
            const point = document.createElement('div');
            const connectionType = output.type || CONNECTION_TYPE.EXEC;
            point.className = 'connection-point output';
            if (connectionType === CONNECTION_TYPE.DATA) {
                point.classList.add('data');
            }
            point.style.color = node.color;
            const top = ((index + 1) / (outputCount + 1)) * 100;
            point.style.top = `${top}%`;
            point.dataset.nodeId = node.id;
            point.dataset.pointId = output.id;
            point.dataset.type = 'output';
            point.dataset.connectionType = connectionType;

            // Add label if provided
            if (output.label) {
                const label = document.createElement('span');
                label.className = 'connection-point-label output-label';
                label.textContent = output.label;
                point.appendChild(label);
            }

            // For group nodes, add label with OUT node name
            if (node.isGroup && node.outNodeIds && node.outNodeIds[index]) {
                const outNode = nodes.find(n => n.id === node.outNodeIds[index]);
                if (outNode) {
                    // Convert node color to rgba for background
                    const hex = node.color.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    const bgColor = `rgba(${r}, ${g}, ${b}, 0.9)`;

                    const label = document.createElement('span');
                    label.className = 'connection-label';
                    label.textContent = outNode.title;
                    label.style.background = bgColor;
                    label.style.borderColor = node.color;
                    point.appendChild(label);
                }
            }

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
    }

    updateConnectionsForNode(node.id);
}

// Removed addInput and addOutput - nodes now have fixed 1 input and 1 output

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
    if (isPlaying) return;
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
        node.title = title;

        // If this is an OUT node, update the parent group's connection labels
        if (node.isOutNode && node.linkedGroupNode) {
            const groupNode = nodes.find(n => n.id === node.linkedGroupNode);
            if (groupNode) {
                updateConnectionPoints(groupNode);
            }
        }
    }
}

function updateNodeText(nodeId, text) {
    if (isPlaying) return;
    const node = nodes.find(n => n.id === nodeId);
    if (node) node.text = text;
}

function deleteNode(nodeId) {
    if (isPlaying) return;

    // Prevent deleting system nodes
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.isSystemNode) {
        alert('Cannot delete system nodes (START, IN, OUT). They are required for execution.');
        return;
    }

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