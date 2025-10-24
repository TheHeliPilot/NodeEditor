// Connection Management - Lines between nodes

function startConnection(e, nodeId, pointId) {
    if (isEditingBlocked()) return;

    e.preventDefault();
    e.stopPropagation();

    isConnecting = true;
    connectionStart = { nodeId, pointId };

    tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempLine.classList.add('connection-line', 'temp');
    svgCanvas.appendChild(tempLine);

    document.addEventListener('mouseup', cancelConnection);
}

function updateTempLine(clientX, clientY) {
    const startNode = nodes.find(n => n.id === connectionStart.nodeId);
    if (!startNode) return;

    const outputIndex = startNode.outputs.findIndex(o => o.id === connectionStart.pointId);
    const outputCount = startNode.outputs.length;
    const topPercent = ((outputIndex + 1) / (outputCount + 1));

    const x1 = startNode.x + startNode.width;
    const y1 = startNode.y + 40 + (startNode.height - 40) * topPercent;

    const endWorld = screenToWorld(clientX, clientY);

    const path = createBezierPath(x1, y1, endWorld.x, endWorld.y);
    tempLine.setAttribute('d', path);
}

function endConnection(e, toNodeId, toPointId, type) {
    e.preventDefault();
    e.stopPropagation();

    if (!isConnecting || !connectionStart || connectionStart.nodeId === toNodeId) {
        cancelConnection();
        return;
    }

    // Get connection types to validate
    const fromNode = nodes.find(n => n.id === connectionStart.nodeId);
    const toNode = nodes.find(n => n.id === toNodeId);

    if (!fromNode || !toNode) {
        cancelConnection();
        return;
    }

    const fromOutput = fromNode.outputs.find(o => o.id === connectionStart.pointId);
    const toInput = toNode.inputs.find(i => i.id === toPointId);

    if (!fromOutput || !toInput) {
        cancelConnection();
        return;
    }

    const fromType = fromOutput.type || CONNECTION_TYPE.EXEC;
    const toType = toInput.type || CONNECTION_TYPE.EXEC;

    // Prevent connecting different types
    if (fromType !== toType) {
        alert('Cannot connect different types (execution vs data)');
        cancelConnection();
        return;
    }

    let finalFromNode = connectionStart.nodeId;
    let finalFromPoint = connectionStart.pointId;
    let finalToNode = toNodeId;
    let finalToPoint = toPointId;

    // If connecting FROM a group node output, find the corresponding OUT node
    if (fromNode && fromNode.isGroup) {
        const outputIndex = fromNode.outputs.findIndex(o => o.id === finalFromPoint);
        if (outputIndex >= 0 && fromNode.outNodeIds && fromNode.outNodeIds[outputIndex]) {
            const outNode = nodes.find(n => n.id === fromNode.outNodeIds[outputIndex]);
            if (outNode) {
                finalFromNode = outNode.id;
                finalFromPoint = outNode.outputs[0].id; // Connect from OUT node's output
            }
        }
    }

    // If connecting TO a group node input, find the IN node
    if (toNode && toNode.isGroup) {
        const inNode = nodes.find(n => n.isInNode && n.linkedGroupNode === toNode.id);
        if (inNode) {
            finalToNode = inNode.id;
            finalToPoint = inNode.inputs[0].id; // Connect to IN node's input
        }
    }

    // Check if connection already exists from this output or to this input
    const existingFromConnection = connections.find(c =>
        c.fromNode === finalFromNode && c.fromPoint === finalFromPoint
    );
    const existingToConnection = connections.find(c =>
        c.toNode === finalToNode && c.toPoint === finalToPoint
    );

    if (existingFromConnection) {
        // Remove old connection from this output
        deleteConnection(existingFromConnection.id);
    }

    if (existingToConnection) {
        // Remove old connection to this input
        deleteConnection(existingToConnection.id);
    }

    const connection = {
        id: connectionIdCounter++,
        fromNode: finalFromNode,
        fromPoint: finalFromPoint,
        toNode: finalToNode,
        toPoint: finalToPoint,
        connectionType: fromType // Store the connection type
    };

    connections.push(connection);
    renderConnection(connection);
    cancelConnection();
}

function cancelConnection() {
    isConnecting = false;
    connectionStart = null;
    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }
    document.removeEventListener('mouseup', cancelConnection);
}

function renderConnection(connection) {
    const fromNode = nodes.find(n => n.id === connection.fromNode);
    const toNode = nodes.find(n => n.id === connection.toNode);
    if (!fromNode || !toNode) return;

    const gradientId = `gradient-${connection.id}`;
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.id = gradientId;
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', fromNode.color);

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', toNode.color);

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    svgCanvas.appendChild(gradient);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.id = `conn-${connection.id}`;
    line.classList.add('connection-line');
    line.setAttribute('stroke', `url(#${gradientId})`);
    line.style.pointerEvents = 'stroke';

    line.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        deleteConnection(connection.id);
    });

    svgCanvas.appendChild(line);
    updateConnection(connection);
}

function updateConnection(connection) {
    let fromNode = nodes.find(n => n.id === connection.fromNode);
    let toNode = nodes.find(n => n.id === connection.toNode);
    const line = document.getElementById(`conn-${connection.id}`);

    if (!fromNode || !toNode || !line) return;

    // Visual node for rendering (might be different from data node)
    let visualFromNode = fromNode;
    let visualToNode = toNode;
    let visualOutputIndex = 0;
    let visualInputIndex = 0;

    // If FROM node is OUT node, use the group node position instead
    if (fromNode.isOutNode && fromNode.linkedGroupNode) {
        visualFromNode = nodes.find(n => n.id === fromNode.linkedGroupNode);
        if (!visualFromNode) visualFromNode = fromNode;
        // Find which output index this OUT node corresponds to
        visualOutputIndex = fromNode.outIndex !== undefined ? fromNode.outIndex : 0;
    } else {
        visualOutputIndex = fromNode.outputs.findIndex(o => o.id === connection.fromPoint);
    }

    // If TO node is IN node, use the group node position instead
    if (toNode.isInNode && toNode.linkedGroupNode) {
        visualToNode = nodes.find(n => n.id === toNode.linkedGroupNode);
        if (!visualToNode) visualToNode = toNode;
        // IN node always uses input index 0 on the group
        visualInputIndex = 0;
    } else {
        visualInputIndex = toNode.inputs.findIndex(i => i.id === connection.toPoint);
    }

    if (visualOutputIndex === -1 || visualInputIndex === -1) return;

    const outputCount = Math.max(visualFromNode.outputs.length, 1);
    const inputCount = Math.max(visualToNode.inputs.length, 1);

    // Use visual node positions for drawing
    const x1 = visualFromNode.x + visualFromNode.width;
    const y1 = visualFromNode.y + 40 + (visualFromNode.height - 40) * ((visualOutputIndex + 1) / (outputCount + 1));
    const x2 = visualToNode.x;
    const y2 = visualToNode.y + 40 + (visualToNode.height - 40) * ((visualInputIndex + 1) / (inputCount + 1));

    const path = createBezierPath(x1, y1, x2, y2);
    line.setAttribute('d', path);

    const gradientId = `gradient-${connection.id}`;
    const gradient = document.getElementById(gradientId);
    if (gradient) {
        gradient.setAttribute('x1', x1);
        gradient.setAttribute('y1', y1);
        gradient.setAttribute('x2', x2);
        gradient.setAttribute('y2', y2);

        const stops = gradient.querySelectorAll('stop');
        if (stops.length >= 2) {
            stops[0].setAttribute('stop-color', visualFromNode.color);
            stops[1].setAttribute('stop-color', visualToNode.color);
        }
    }
}

function createBezierPath(x1, y1, x2, y2) {
    const distance = Math.abs(x2 - x1);
    const offset = Math.min(distance * 0.5, 150);
    return `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
}

function updateConnectionsForNode(nodeId) {
    connections.forEach(conn => {
        if (conn.fromNode === nodeId || conn.toNode === nodeId) {
            updateConnection(conn);
        }
    });
}

function updateGroupNodeConnections(groupNodeId) {
    // Find all IN/OUT nodes that belong to this group
    const inNode = nodes.find(n => n.isInNode && n.linkedGroupNode === groupNodeId);
    const groupNode = nodes.find(n => n.id === groupNodeId);

    if (inNode) {
        updateConnectionsForNode(inNode.id);
    }

    if (groupNode && groupNode.outNodeIds) {
        groupNode.outNodeIds.forEach(outNodeId => {
            updateConnectionsForNode(outNodeId);
        });
    }
}

function updateAllConnections() {
    connections.forEach(conn => updateConnection(conn));
}

function deleteConnection(connId) {
    connections = connections.filter(c => c.id !== connId);
    const line = document.getElementById(`conn-${connId}`);
    if (line) line.remove();

    const gradient = document.getElementById(`gradient-${connId}`);
    if (gradient) gradient.remove();
}