// Execution System - Play mode and control flow execution

// Runtime execution state
let executionVariables = {}; // Runtime variable values during execution

function togglePlay() {
    if (isPlaying) {
        stopExecution();
    } else {
        startExecution();
    }
}

function startExecution() {
    // Find root node
    const rootNode = nodes.find(n => n.isRoot && n.parentGroup === currentGroupId);

    if (!rootNode) {
        alert('No root node found! Create a root node first.');
        return;
    }

    // Initialize runtime variables
    executionVariables = {};
    variables.forEach(v => {
        executionVariables[v.id] = v.value;
    });

    isPlaying = true;
    currentExecutionNode = rootNode.id;

    // Update UI
    const playBtn = document.getElementById('play-btn');
    playBtn.textContent = '⏹ Stop';
    playBtn.style.background = '#dc3545';

    // Add play mode visual to canvas
    canvasContainer.classList.add('play-mode');

    // Clear dialogue history and show panel
    clearDialogueHistory();
    dialoguePanel.classList.add('active');

    // Highlight current node
    updateExecutionHighlight();

    // Auto-advance past START node
    setTimeout(() => advanceExecution(), 100);
}

function stopExecution() {
    isPlaying = false;
    currentExecutionNode = null;

    // Update UI
    const playBtn = document.getElementById('play-btn');
    playBtn.textContent = '▶ Play';
    playBtn.style.background = '#28a745';

    // Remove play mode visual
    canvasContainer.classList.remove('play-mode');

    // Hide dialogue panel
    dialoguePanel.classList.remove('active');

    // Remove highlights
    document.querySelectorAll('.node').forEach(node => {
        node.classList.remove('executing');
    });
}

function advanceExecution() {
    if (!isPlaying || !currentExecutionNode) return;

    let nextNodeId = findNextNode(currentExecutionNode);

    if (!nextNodeId) {
        // End of execution - just stop
        stopExecution();
        return;
    }

    // Move to next node
    currentExecutionNode = nextNodeId;
    updateExecutionHighlight();

    // Auto-skip system nodes (IN, OUT, Group, START) until we hit a regular text node
    const nextNode = nodes.find(n => n.id === nextNodeId);
    if (nextNode && shouldSkipNode(nextNode)) {
        // Auto-advance after a short delay
        setTimeout(() => advanceExecution(), 150);
    }
}

function shouldSkipNode(node) {
    // Skip system nodes, IN/OUT nodes, group nodes, START nodes, and variable/branch/math nodes
    const skipTypes = ['variableGet', 'variableSet', 'branch', 'math'];
    return node.isSystemNode || node.isInNode || node.isOutNode || node.isGroup || node.isRoot || skipTypes.includes(node.nodeType);
}

function evaluateDataInput(nodeId, inputId) {
    // Find the connection to this input
    const connection = connections.find(c =>
        c.toNode === nodeId && c.toPoint === inputId && c.connectionType === CONNECTION_TYPE.DATA
    );

    if (!connection) return null;

    const sourceNode = nodes.find(n => n.id === connection.fromNode);
    if (!sourceNode) return null;

    // Evaluate based on node type
    if (sourceNode.nodeType === 'variableGet') {
        return executionVariables[sourceNode.variableId];
    } else if (sourceNode.nodeType === 'math') {
        const input1 = evaluateDataInput(sourceNode.id, sourceNode.inputs[0].id);
        const input2 = evaluateDataInput(sourceNode.id, sourceNode.inputs[1].id);

        if (input1 === null || input2 === null) return null;

        switch (sourceNode.operation) {
            case 'add': return input1 + input2;
            case 'subtract': return input1 - input2;
            case 'multiply': return input1 * input2;
            case 'divide': return input2 !== 0 ? input1 / input2 : 0;
            default: return null;
        }
    }

    return null;
}

function executeNode(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Handle variable set nodes
    if (node.nodeType === 'variableSet') {
        const value = evaluateDataInput(nodeId, node.inputs[1].id); // Second input is the value
        if (value !== null) {
            executionVariables[node.variableId] = value;
        }
    }
}

function findNextNode(currentNodeId) {
    // Find the output connection from current node
    const currentNode = nodes.find(n => n.id === currentNodeId);
    if (!currentNode) {
        return null;
    }

    // Execute the node (for variable set, etc.)
    executeNode(currentNodeId);

    // Handle branch nodes specially
    if (currentNode.nodeType === 'branch') {
        const inputA = evaluateDataInput(currentNodeId, currentNode.inputs[1].id);
        const inputB = evaluateDataInput(currentNodeId, currentNode.inputs[2].id);

        const result = inputA === inputB;

        // Find the correct output connection based on result
        const outputId = result ? currentNode.outputs[0].id : currentNode.outputs[1].id;
        const connection = connections.find(c =>
            c.fromNode === currentNodeId &&
            c.fromPoint === outputId &&
            c.connectionType === CONNECTION_TYPE.EXEC
        );

        return connection ? connection.toNode : null;
    }

    // Find execution connection from this node's output
    const connection = connections.find(c =>
        c.fromNode === currentNodeId &&
        c.connectionType === CONNECTION_TYPE.EXEC
    );

    if (!connection) {
        // No more connections
        return null;
    }

    // Just return the next node - IN/OUT nodes are handled by auto-skip in advanceExecution
    return connection.toNode;
}

function updateExecutionHighlight() {
    // Remove all execution highlights
    document.querySelectorAll('.node').forEach(node => {
        node.classList.remove('executing');
    });

    // Add highlight to current node
    if (currentExecutionNode) {
        const nodeEl = document.getElementById(`node-${currentExecutionNode}`);
        if (nodeEl) {
            nodeEl.classList.add('executing');
        }

        // Update dialogue panel with current node's text
        const currentNode = nodes.find(n => n.id === currentExecutionNode);
        if (currentNode && !shouldSkipNode(currentNode)) {
            updateDialogueDisplay(currentNode);
        }
    }
}

function updateDialogueDisplay(node) {
    if (!dialogueContent) return;

    // Create new message element
    const messageDiv = document.createElement('div');
    messageDiv.className = 'dialogue-message';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'dialogue-message-title';
    titleDiv.textContent = node.title || 'Node';

    const textDiv = document.createElement('div');
    textDiv.className = 'dialogue-message-text';
    textDiv.textContent = node.text || '';

    messageDiv.appendChild(titleDiv);
    messageDiv.appendChild(textDiv);

    // Append to dialogue content
    dialogueContent.appendChild(messageDiv);

    // Auto-scroll to bottom
    dialogueContent.scrollTop = dialogueContent.scrollHeight;
}

function clearDialogueHistory() {
    if (dialogueContent) {
        dialogueContent.innerHTML = '';
    }
}

function isInPlayMode() {
    return isPlaying;
}
