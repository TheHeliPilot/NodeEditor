// Selection Management - Multi-select functionality

function finalizeSelection() {
    if (!selectionBox) return;

    const rect = selectionBox.getBoundingClientRect();
    const containerRect = canvasContainer.getBoundingClientRect();

    const boxWorld = {
        x1: (rect.left - containerRect.left - panX) / zoom,
        y1: (rect.top - containerRect.top - panY) / zoom,
        x2: (rect.right - containerRect.left - panX) / zoom,
        y2: (rect.bottom - containerRect.top - panY) / zoom
    };

    nodes.forEach(node => {
        const nodeRight = node.x + node.width;
        const nodeBottom = node.y + node.height;

        const overlaps = !(node.x > boxWorld.x2 ||
                         nodeRight < boxWorld.x1 ||
                         node.y > boxWorld.y2 ||
                         nodeBottom < boxWorld.y1);

        if (overlaps) {
            addToSelection(node.id, 'node');
        }
    });

    comments.forEach(comment => {
        const commentRight = comment.x + comment.width;
        const commentBottom = comment.y + comment.height;

        const overlaps = !(comment.x > boxWorld.x2 ||
                         commentRight < boxWorld.x1 ||
                         comment.y > boxWorld.y2 ||
                         commentBottom < boxWorld.y1);

        if (overlaps) {
            addToSelection(comment.id, 'comment');
        }
    });
}

function clearSelection() {
    selectedNodes.forEach(nodeId => {
        const el = document.getElementById(`node-${nodeId}`);
        if (el) el.classList.remove('selected');
    });
    selectedComments.forEach(commentId => {
        const el = document.getElementById(`comment-${commentId}`);
        if (el) el.classList.remove('selected');
    });
    selectedNodes = [];
    selectedComments = [];
}

function addToSelection(id, type) {
    if (type === 'node') {
        if (!selectedNodes.includes(id)) {
            selectedNodes.push(id);
            const el = document.getElementById(`node-${id}`);
            if (el) el.classList.add('selected');
        }
    } else if (type === 'comment') {
        if (!selectedComments.includes(id)) {
            selectedComments.push(id);
            const el = document.getElementById(`comment-${id}`);
            if (el) el.classList.add('selected');
        }
    }
}

function removeFromSelection(id, type) {
    if (type === 'node') {
        selectedNodes = selectedNodes.filter(nodeId => nodeId !== id);
        const el = document.getElementById(`node-${id}`);
        if (el) el.classList.remove('selected');
    } else if (type === 'comment') {
        selectedComments = selectedComments.filter(commentId => commentId !== id);
        const el = document.getElementById(`comment-${id}`);
        if (el) el.classList.remove('selected');
    }
}

function toggleSelection(id, type) {
    if (type === 'node') {
        if (selectedNodes.includes(id)) {
            removeFromSelection(id, 'node');
        } else {
            addToSelection(id, 'node');
        }
    } else if (type === 'comment') {
        if (selectedComments.includes(id)) {
            removeFromSelection(id, 'comment');
        } else {
            addToSelection(id, 'comment');
        }
    }
}