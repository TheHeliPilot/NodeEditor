// Comment Areas - Background boxes for organizing nodes

function addComment() {
    if (isPlaying) return;
    const id = commentIdCounter++;

    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const centerWorld = screenToWorld(centerX, centerY);

    const comment = {
        id: id,
        x: centerWorld.x - 200,
        y: centerWorld.y - 150,
        width: 400,
        height: 300,
        title: 'Comment ' + id,
        color: '#ffc107',
        parentGroup: currentGroupId
    };

    comments.push(comment);
    renderComment(comment);
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderComment(comment) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment-area';
    commentEl.id = `comment-${comment.id}`;
    commentEl.style.left = comment.x + 'px';
    commentEl.style.top = comment.y + 'px';
    commentEl.style.width = comment.width + 'px';
    commentEl.style.height = comment.height + 'px';

    commentEl.style.backgroundColor = hexToRgba(comment.color, 0.1);
    commentEl.style.borderColor = hexToRgba(comment.color, 0.4);

    commentEl.innerHTML = `
        <div class="comment-header" style="background: ${hexToRgba(comment.color, 0.15)};">
            <input class="comment-title" style="color: #ffffff;" readonly value="${comment.title}" onchange="updateCommentTitle(${comment.id}, this.value)">
            <div class="node-controls">
                <button class="node-btn color-btn" style="background: ${comment.color};" onclick="showColorPicker(event, ${comment.id}, 'comment')">●</button>
                <button class="node-btn" onclick="deleteComment(${comment.id})">×</button>
            </div>
        </div>
        <div class="resize-handle right"></div>
        <div class="resize-handle bottom"></div>
        <div class="resize-handle corner"></div>
    `;

    canvas.appendChild(commentEl);

    const titleInput = commentEl.querySelector('.comment-title');
    titleInput.addEventListener('dblclick', (e) => {
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

    commentEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-btn')) return;
        if (e.target.classList.contains('comment-title') && !e.target.hasAttribute('readonly')) return;
        if (e.target.classList.contains('resize-handle')) return;

        if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            toggleSelection(comment.id, 'comment');
            return;
        }

        if (!selectedComments.includes(comment.id)) {
            clearSelection();
            addToSelection(comment.id, 'comment');
        }

        startDrag(e, comment, 'comment');
    });

    commentEl.querySelector('.resize-handle.right').addEventListener('mousedown', (e) => startResize(e, comment, 'right', true));
    commentEl.querySelector('.resize-handle.bottom').addEventListener('mousedown', (e) => startResize(e, comment, 'bottom', true));
    commentEl.querySelector('.resize-handle.corner').addEventListener('mousedown', (e) => startResize(e, comment, 'corner', true));
}

function updateCommentTitle(commentId, title) {
    const comment = comments.find(c => c.id === commentId);
    if (comment) comment.title = title;
}

function deleteComment(commentId) {
    if (isPlaying) return;
    comments = comments.filter(c => c.id !== commentId);
    const el = document.getElementById(`comment-${commentId}`);
    if (el) el.remove();
}