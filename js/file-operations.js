// File Operations - Save and Load functionality

function saveToFile() {
    const data = {
        nodes: nodes,
        comments: comments,
        connections: connections,
        nodeIdCounter: nodeIdCounter,
        commentIdCounter: commentIdCounter,
        connectionIdCounter: connectionIdCounter,
        view: { zoom, panX, panY }
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `node-graph-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function loadFromFile() {
    document.getElementById('file-input').click();
}

function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            loadData(data);
        } catch (err) {
            alert('Error loading file: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function loadData(data) {
    clearAll(true);

    nodes = data.nodes || [];
    comments = data.comments || [];
    connections = data.connections || [];
    nodeIdCounter = data.nodeIdCounter || 1;
    commentIdCounter = data.commentIdCounter || 1;
    connectionIdCounter = data.connectionIdCounter || 1;

    if (data.view) {
        zoom = data.view.zoom || 1;
        panX = data.view.panX || 0;
        panY = data.view.panY || 0;
    }

    comments.forEach(comment => renderComment(comment));
    nodes.forEach(node => renderNode(node));
    connections.forEach(conn => renderConnection(conn));
    updateTransform();
}

function clearAll(skipConfirm = false) {
    if (!skipConfirm && (nodes.length > 0 || comments.length > 0 || connections.length > 0)) {
        if (!confirm('Clear all nodes and connections?')) return;
    }

    nodes = [];
    comments = [];
    connections = [];
    canvas.innerHTML = '';
    svgCanvas.innerHTML = '';
    nodeIdCounter = 1;
    commentIdCounter = 1;
    connectionIdCounter = 1;
}