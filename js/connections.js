// Connection Management - Lines between nodes

function startConnection(e, nodeId, pointId) {
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

    const connection = {
        id: connectionIdCounter++,
        fromNode: connectionStart.nodeId,
        fromPoint: connectionStart.pointId,
        toNode: toNodeId,
        toPoint: toPointId
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
    const fromNode = nodes.find(n => n.id === connection.fromNode);
    const toNode = nodes.find(n => n.id === connection.toNode);
    const line = document.getElementById(`conn-${connection.id}`);

    if (!fromNode || !toNode || !line) return;

    const outputIndex = fromNode.outputs.findIndex(o => o.id === connection.fromPoint);
    const inputIndex = toNode.inputs.findIndex(i => i.id === connection.toPoint);

    if (outputIndex === -1 || inputIndex === -1) return;

    const outputCount = fromNode.outputs.length;
    const inputCount = toNode.inputs.length;

    const x1 = fromNode.x + fromNode.width;
    const y1 = fromNode.y + 40 + (fromNode.height - 40) * ((outputIndex + 1) / (outputCount + 1));
    const x2 = toNode.x;
    const y2 = toNode.y + 40 + (toNode.height - 40) * ((inputIndex + 1) / (inputCount + 1));

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
            stops[0].setAttribute('stop-color', fromNode.color);
            stops[1].setAttribute('stop-color', toNode.color);
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