// Viewport Management - Zoom, Pan, Coordinate Conversion

function handleZoom(e) {
    e.preventDefault();

    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldBeforeX = (mouseX - panX) / zoom;
    const worldBeforeY = (mouseY - panY) / zoom;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoom = Math.max(0.1, Math.min(5, zoom * delta));

    panX = mouseX - worldBeforeX * zoom;
    panY = mouseY - worldBeforeY * zoom;

    updateTransform();
}

function screenToWorld(screenX, screenY) {
    const rect = canvasContainer.getBoundingClientRect();
    return {
        x: (screenX - rect.left - panX) / zoom,
        y: (screenY - rect.top - panY) / zoom
    };
}

function updateTransform() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    svgCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

    const gridSize = 50 * zoom;
    backgroundGrid.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    backgroundGrid.style.backgroundPosition = `${panX % gridSize}px ${panY % gridSize}px`;

    zoomLevel.textContent = Math.round(zoom * 100) + '%';
    updateAllConnections();
}

function updateElementPosition(element, type) {
    const elId = type === 'node' ? `node-${element.id}` : `comment-${element.id}`;
    const el = document.getElementById(elId);
    if (el) {
        el.style.left = element.x + 'px';
        el.style.top = element.y + 'px';
    }
}

function handleCanvasPanStart(e) {
    // Start drag selection
    if (e.button === 0 && (e.target === canvasContainer || e.target === backgroundGrid || e.target === canvas)) {
        if (!e.shiftKey) {
            clearSelection();
        }

        isSelecting = true;
        const rect = canvasContainer.getBoundingClientRect();
        selectionStart = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        selectionBox = document.createElement('div');
        selectionBox.className = 'selection-box';
        canvasContainer.appendChild(selectionBox);
        e.preventDefault();
        return;
    }

    if (e.button === 1) {
        isPanning = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        canvasContainer.classList.add('panning');
        e.preventDefault();
    }
}

function handleMouseMove(e) {
    if (isPanning && !dragState && !resizeState && !isConnecting && !isSelecting) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        panX += dx;
        panY += dy;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        updateTransform();
    }

    if (isSelecting && selectionBox) {
        const rect = canvasContainer.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const left = Math.min(selectionStart.x, currentX);
        const top = Math.min(selectionStart.y, currentY);
        const width = Math.abs(currentX - selectionStart.x);
        const height = Math.abs(currentY - selectionStart.y);

        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
    }

    if (dragState) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        const dx = worldPos.x - dragState.offsetX - dragState.element.x;
        const dy = worldPos.y - dragState.offsetY - dragState.element.y;

        dragState.element.x = worldPos.x - dragState.offsetX;
        dragState.element.y = worldPos.y - dragState.offsetY;
        updateElementPosition(dragState.element, dragState.type);

        // Move all selected nodes together
        if (dragState.type === 'node' && selectedNodes.length > 1) {
            selectedNodes.forEach(nodeId => {
                if (nodeId !== dragState.element.id) {
                    const node = nodes.find(n => n.id === nodeId);
                    if (node) {
                        node.x += dx;
                        node.y += dy;
                        updateElementPosition(node, 'node');
                        updateConnectionsForNode(node.id);
                    }
                }
            });
        }

        // Move all selected comments together
        if ((dragState.type === 'node' || dragState.type === 'comment') && (selectedNodes.length > 0 || selectedComments.length > 0)) {
            selectedComments.forEach(commentId => {
                if (commentId !== dragState.element.id) {
                    const comment = comments.find(c => c.id === commentId);
                    if (comment) {
                        comment.x += dx;
                        comment.y += dy;
                        updateElementPosition(comment, 'comment');
                    }
                }
            });

            // Also move nodes if dragging a comment
            if (dragState.type === 'comment') {
                selectedNodes.forEach(nodeId => {
                    const node = nodes.find(n => n.id === nodeId);
                    if (node) {
                        node.x += dx;
                        node.y += dy;
                        updateElementPosition(node, 'node');
                        updateConnectionsForNode(node.id);
                    }
                });
            }
        }

        if (dragState.type === 'node') {
            updateConnectionsForNode(dragState.element.id);
        }
    }

    if (resizeState) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        const element = resizeState.element;
        const elId = resizeState.isComment ? `comment-${element.id}` : `node-${element.id}`;
        const el = document.getElementById(elId);

        if (resizeState.direction === 'right' || resizeState.direction === 'corner') {
            const newWidth = Math.max(180, worldPos.x - element.x);
            element.width = newWidth;
            el.style.width = newWidth + 'px';
        }

        if (resizeState.direction === 'bottom' || resizeState.direction === 'corner') {
            const newHeight = Math.max(resizeState.isComment ? 100 : 120, worldPos.y - element.y);
            element.height = newHeight;
            el.style.height = newHeight + 'px';
        }

        if (resizeState.type === 'node') {
            updateConnectionsForNode(element.id);
        }
    }

    if (isConnecting && tempLine) {
        updateTempLine(e.clientX, e.clientY);
    }
}

function handleMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        canvasContainer.classList.remove('panning');
    }

    if (isSelecting && selectionBox) {
        finalizeSelection();
        isSelecting = false;
        selectionStart = null;
        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }
    }

    if (dragState) {
        const isSelected = (dragState.type === 'node' && selectedNodes.includes(dragState.element.id)) ||
                          (dragState.type === 'comment' && selectedComments.includes(dragState.element.id));

        if (!isSelected) {
            const elId = dragState.type === 'node' ? `node-${dragState.element.id}` : `comment-${dragState.element.id}`;
            const el = document.getElementById(elId);
            if (el) el.classList.remove('selected');
        }
        dragState = null;
    }

    if (resizeState) {
        resizeState = null;
    }
}

function startDrag(e, element, type) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const worldPos = screenToWorld(e.clientX, e.clientY);
    dragState = {
        element: element,
        type: type,
        offsetX: worldPos.x - element.x,
        offsetY: worldPos.y - element.y
    };

    const elId = type === 'node' ? `node-${element.id}` : `comment-${element.id}`;
    document.getElementById(elId).classList.add('selected');
}

function startResize(e, element, direction, isComment) {
    e.preventDefault();
    e.stopPropagation();

    resizeState = {
        element: element,
        direction: direction,
        isComment: isComment,
        type: isComment ? 'comment' : 'node'
    };
}