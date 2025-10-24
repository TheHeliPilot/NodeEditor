// Group Node Management - Creating and managing group nodes with nested content

function createGroupNode() {
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
        color: '#9c27b0', // Purple color to distinguish groups
        title: 'Group ' + id,
        inputs: [{ id: 1, type: CONNECTION_TYPE.EXEC }],
        outputs: [{ id: 1, type: CONNECTION_TYPE.EXEC }],
        isGroup: true,
        parentGroup: currentGroupId, // Track which group this node belongs to
        outNodeIds: [] // Track OUT nodes for this group
    };

    nodes.push(node);
    renderNode(node);

    // Create IN and OUT nodes inside the group
    createInNode(id, id);
    const firstOut = createOutNode(id, id, 0);
    node.outNodeIds.push(firstOut.id);
    updateGroupNodeSize(node);
}

function openGroup(groupId) {
    const group = nodes.find(n => n.id === groupId && n.isGroup);
    if (!group) return;

    // Save current view state
    const currentView = { zoom, panX, panY };

    // Push current group to navigation stack
    navigationStack.push({
        groupId: currentGroupId,
        view: currentView
    });

    // Navigate into the group
    currentGroupId = groupId;

    // Clear and render the group's contents
    renderCurrentGroup();
    updateBreadcrumbs();
}

function closeGroup() {
    if (navigationStack.length === 0) return;

    // Pop previous group from stack
    const previous = navigationStack.pop();
    currentGroupId = previous.groupId;

    // Restore view state
    zoom = previous.view.zoom;
    panX = previous.view.panX;
    panY = previous.view.panY;

    // Render the parent group
    renderCurrentGroup();
    updateBreadcrumbs();
}

function renderCurrentGroup() {
    // Clear canvas
    canvas.innerHTML = '';
    svgCanvas.innerHTML = '';
    clearSelection();

    // Render comments first (so they appear behind nodes)
    const visibleComments = comments.filter(c => c.parentGroup === currentGroupId);
    visibleComments.forEach(comment => renderComment(comment));

    // Render nodes
    const visibleNodes = nodes.filter(n => n.parentGroup === currentGroupId);
    visibleNodes.forEach(node => renderNode(node));

    // Render connections
    const visibleConnections = connections.filter(conn => {
        const fromNode = nodes.find(n => n.id === conn.fromNode);
        const toNode = nodes.find(n => n.id === conn.toNode);
        if (!fromNode || !toNode) return false;

        // Special handling for IN/OUT nodes - they belong to the group but connections should be visible from parent
        // If FROM is an OUT node, check if its linked group is at current level
        if (fromNode.isOutNode && fromNode.linkedGroupNode) {
            const linkedGroup = nodes.find(n => n.id === fromNode.linkedGroupNode);
            if (linkedGroup && linkedGroup.parentGroup === currentGroupId) {
                return toNode.parentGroup === currentGroupId;
            }
        }

        // If TO is an IN node, check if its linked group is at current level
        if (toNode.isInNode && toNode.linkedGroupNode) {
            const linkedGroup = nodes.find(n => n.id === toNode.linkedGroupNode);
            if (linkedGroup && linkedGroup.parentGroup === currentGroupId) {
                return fromNode.parentGroup === currentGroupId;
            }
        }

        // Normal case: both nodes should be at current level
        return fromNode.parentGroup === currentGroupId &&
               toNode.parentGroup === currentGroupId;
    });
    visibleConnections.forEach(conn => renderConnection(conn));

    updateTransform();
}

function addOutNodeToCurrentGroup() {
    if (currentGroupId !== null) {
        addOutNodeToGroup(currentGroupId);
    }
}

function updateBreadcrumbs() {
    let breadcrumbContainer = document.getElementById('breadcrumb-container');
    let backButton = document.getElementById('back-button');
    let addOutBtn = document.getElementById('add-out-btn');
    if (!breadcrumbContainer) return;

    breadcrumbContainer.innerHTML = '';

    // Show/hide back button and add out button
    if (backButton) {
        backButton.style.display = (currentGroupId !== null) ? 'block' : 'none';
    }
    if (addOutBtn) {
        addOutBtn.style.display = (currentGroupId !== null) ? 'block' : 'none';
    }

    // Add root breadcrumb
    const rootCrumb = document.createElement('span');
    rootCrumb.className = 'breadcrumb-item';
    rootCrumb.textContent = 'Root';
    rootCrumb.onclick = () => navigateToGroup(null);
    breadcrumbContainer.appendChild(rootCrumb);

    // Build breadcrumb trail
    const trail = [];
    for (let i = 0; i < navigationStack.length; i++) {
        trail.push(navigationStack[i].groupId);
    }
    if (currentGroupId !== null) {
        trail.push(currentGroupId);
    }

    // Add group breadcrumbs
    trail.forEach((groupId, index) => {
        const group = nodes.find(n => n.id === groupId);
        if (!group) return;

        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = ' > ';
        breadcrumbContainer.appendChild(separator);

        const crumb = document.createElement('span');
        crumb.className = 'breadcrumb-item';
        crumb.textContent = group.title;

        // Only make it clickable if it's not the current group
        if (index < trail.length - 1) {
            crumb.onclick = () => navigateToGroup(groupId);
        } else {
            crumb.classList.add('current');
        }

        breadcrumbContainer.appendChild(crumb);
    });
}

function navigateToGroup(targetGroupId) {
    // Navigate to a specific group in the breadcrumb trail
    if (targetGroupId === currentGroupId) return;

    // If going to root
    if (targetGroupId === null) {
        navigationStack = [];
        currentGroupId = null;
        renderCurrentGroup();
        updateBreadcrumbs();
        return;
    }

    // Find the target in the navigation stack
    const targetIndex = navigationStack.findIndex(item => item.groupId === targetGroupId);

    if (targetIndex !== -1) {
        // Pop stack up to (but not including) the target
        navigationStack = navigationStack.slice(0, targetIndex + 1);
        const previous = navigationStack.pop();
        currentGroupId = previous.groupId;

        // Restore view
        zoom = previous.view.zoom;
        panX = previous.view.panX;
        panY = previous.view.panY;

        renderCurrentGroup();
        updateBreadcrumbs();
    }
}

function moveSelectedToGroup(targetGroupId) {
    // Move selected nodes and comments into a group
    selectedNodes.forEach(nodeId => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && !node.isGroup) {
            node.parentGroup = targetGroupId;
        }
    });

    selectedComments.forEach(commentId => {
        const comment = comments.find(c => c.id === commentId);
        if (comment) {
            comment.parentGroup = targetGroupId;
        }
    });

    renderCurrentGroup();
}

function isGroupNode(node) {
    return node && node.isGroup === true;
}

function addOutNodeToGroup(groupId) {
    if (isPlaying) return;

    const groupNode = nodes.find(n => n.id === groupId && n.isGroup);
    if (!groupNode) return;

    const outIndex = groupNode.outNodeIds.length;
    const newOut = createOutNode(groupId, groupId, outIndex);
    groupNode.outNodeIds.push(newOut.id);

    // Add new output point to group node
    groupNode.outputs.push({ id: groupNode.outputs.length + 1, type: CONNECTION_TYPE.EXEC });

    // Update group node size and render
    updateGroupNodeSize(groupNode);
    const groupEl = document.getElementById(`node-${groupId}`);
    if (groupEl) {
        groupEl.style.height = groupNode.height + 'px';
        updateConnectionPoints(groupNode);
        updateGroupNodeConnections(groupId);
    }
}

function updateGroupNodeSize(groupNode) {
    if (!groupNode.isGroup) return;

    const outCount = groupNode.outNodeIds.length;
    // Minimum height increases with OUT nodes
    const minHeight = 100 + (outCount * 40);
    if (groupNode.height < minHeight) {
        groupNode.height = minHeight;
    }

    // Ensure outputs match out nodes
    while (groupNode.outputs.length < outCount) {
        groupNode.outputs.push({ id: groupNode.outputs.length + 1 });
    }
}
