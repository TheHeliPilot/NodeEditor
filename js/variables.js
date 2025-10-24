// Variable System - Managing variables and variable-related nodes

function toggleVariablePanel() {
    if (!variablePanel) return;
    variablePanel.classList.toggle('active');
}

function addVariable() {
    const nameInput = document.getElementById('var-name-input');
    const typeSelect = document.getElementById('var-type-select');

    const name = nameInput.value.trim();
    const type = typeSelect.value;

    if (!name) {
        alert('Please enter a variable name');
        return;
    }

    // Check if variable name already exists
    if (variables.find(v => v.name === name)) {
        alert('Variable with this name already exists');
        return;
    }

    const variable = {
        id: variableIdCounter++,
        name: name,
        type: type,
        value: getDefaultValue(type)
    };

    variables.push(variable);
    renderVariableList();
    nameInput.value = '';
}

function getDefaultValue(type) {
    switch (type) {
        case 'Number': return 0;
        case 'String': return '';
        case 'Boolean': return false;
        default: return null;
    }
}

function deleteVariable(varId) {
    variables = variables.filter(v => v.id !== varId);
    renderVariableList();
}

function renderVariableList() {
    if (!variableList) return;

    variableList.innerHTML = '';

    variables.forEach(variable => {
        const item = document.createElement('div');
        item.className = 'variable-item';

        item.innerHTML = `
            <div class="variable-info">
                <div class="variable-name">${variable.name}</div>
                <div class="variable-type">${variable.type}</div>
            </div>
            <div class="variable-actions">
                <button class="variable-btn get" onclick="createVariableGetNode(${variable.id})">Get</button>
                <button class="variable-btn set" onclick="createVariableSetNode(${variable.id})">Set</button>
                <button class="variable-btn delete" onclick="deleteVariable(${variable.id})">×</button>
            </div>
        `;

        variableList.appendChild(item);
    });
}

function createVariableGetNode(varId) {
    const variable = variables.find(v => v.id === varId);
    if (!variable) return;

    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const centerWorld = screenToWorld(centerX, centerY);

    const id = nodeIdCounter++;
    const node = {
        id: id,
        x: centerWorld.x - 100,
        y: centerWorld.y - 40,
        width: 200,
        height: 80,
        color: '#28a745',
        title: 'Get ' + variable.name,
        inputs: [],
        outputs: [{ id: 1, type: CONNECTION_TYPE.DATA, dataType: variable.type }],
        nodeType: 'variableGet',
        variableId: varId,
        parentGroup: currentGroupId
    };

    nodes.push(node);
    renderNode(node);
}

function createVariableSetNode(varId) {
    const variable = variables.find(v => v.id === varId);
    if (!variable) return;

    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const centerWorld = screenToWorld(centerX, centerY);

    const id = nodeIdCounter++;
    const node = {
        id: id,
        x: centerWorld.x - 100,
        y: centerWorld.y - 50,
        width: 200,
        height: 100,
        color: '#ffc107',
        title: 'Set ' + variable.name,
        inputs: [
            { id: 1, type: CONNECTION_TYPE.EXEC },
            { id: 2, type: CONNECTION_TYPE.DATA, dataType: variable.type }
        ],
        outputs: [{ id: 1, type: CONNECTION_TYPE.EXEC }],
        nodeType: 'variableSet',
        variableId: varId,
        parentGroup: currentGroupId
    };

    nodes.push(node);
    renderNode(node);
}

function createBranchNode() {
    if (isPlaying) return;

    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const centerWorld = screenToWorld(centerX, centerY);

    const id = nodeIdCounter++;
    const node = {
        id: id,
        x: centerWorld.x - 100,
        y: centerWorld.y - 60,
        width: 200,
        height: 120,
        color: '#17a2b8',
        title: 'Branch',
        inputs: [
            { id: 1, type: CONNECTION_TYPE.EXEC },
            { id: 2, type: CONNECTION_TYPE.DATA, dataType: 'Any', label: 'A' },
            { id: 3, type: CONNECTION_TYPE.DATA, dataType: 'Any', label: 'B' }
        ],
        outputs: [
            { id: 1, type: CONNECTION_TYPE.EXEC, label: 'True' },
            { id: 2, type: CONNECTION_TYPE.EXEC, label: 'False' }
        ],
        nodeType: 'branch',
        parentGroup: currentGroupId
    };

    nodes.push(node);
    renderNode(node);
}

function createMathNode(operation = 'add') {
    if (isPlaying) return;

    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const centerWorld = screenToWorld(centerX, centerY);

    const operations = {
        'add': { symbol: '+', title: 'Add' },
        'subtract': { symbol: '-', title: 'Subtract' },
        'multiply': { symbol: '×', title: 'Multiply' },
        'divide': { symbol: '÷', title: 'Divide' }
    };

    const op = operations[operation] || operations['add'];

    const id = nodeIdCounter++;
    const node = {
        id: id,
        x: centerWorld.x - 90,
        y: centerWorld.y - 50,
        width: 180,
        height: 100,
        color: '#6f42c1',
        title: op.title,
        inputs: [
            { id: 1, type: CONNECTION_TYPE.DATA, dataType: 'Number', label: 'A' },
            { id: 2, type: CONNECTION_TYPE.DATA, dataType: 'Number', label: 'B' }
        ],
        outputs: [{ id: 1, type: CONNECTION_TYPE.DATA, dataType: 'Number' }],
        nodeType: 'math',
        operation: operation,
        parentGroup: currentGroupId
    };

    nodes.push(node);
    renderNode(node);
}
