// Color Picker - Preset colors and custom color wheel

function initColorPicker() {
    const grid = colorPicker.querySelector('.color-grid');
    colors.forEach(color => {
        const div = document.createElement('div');
        div.className = 'color-option';
        div.style.background = color;
        div.onclick = () => applyColor(color);
        grid.appendChild(div);
    });
}

function initColorWheel() {
    const ctx = colorWheelCanvas.getContext('2d');
    const centerX = colorWheelCanvas.width / 2;
    const centerY = colorWheelCanvas.height / 2;
    const radius = centerX - 5;

    // Draw smoother wheel
    const imageData = ctx.createImageData(colorWheelCanvas.width, colorWheelCanvas.height);
    const data = imageData.data;

    for (let y = 0; y < colorWheelCanvas.height; y++) {
        for (let x = 0; x < colorWheelCanvas.width; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const i = (y * colorWheelCanvas.width + x) * 4;

            if (distance <= radius) {
                const angle = Math.atan2(dy, dx);
                const hue = (angle * 180 / Math.PI + 360) % 360;
                const sat = (distance / radius) * 100;
                const rgb = hslToRgb(hue, sat, 50);
                data[i] = rgb.r; data[i+1] = rgb.g; data[i+2] = rgb.b; data[i+3] = 255;
            } else data[i+3] = 0;
        }
    }
    ctx.putImageData(imageData, 0, 0);

    // Add soft edge blend
    ctx.globalCompositeOperation = "destination-in";
    const fade = ctx.createRadialGradient(centerX, centerY, radius - 3, centerX, centerY, radius);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fade;
    ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // --- Interaction helpers ---
    const ring = document.createElement('div');
    ring.className = 'color-wheel-ring';
    colorWheelPicker.appendChild(ring);

    const preview = document.createElement('div');
    preview.className = 'color-wheel-center-preview';
    colorWheelPicker.appendChild(preview);

    let isDragging = false;

    const handlePick = (e) => {
        const rect = colorWheelCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ctx = colorWheelCanvas.getContext('2d');
        const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        const hex = rgbToHex(d[0], d[1], d[2]);
        selectedCustomColor = hex;
        updateColorPreview(hex);
        updateRing(x, y, hex);
    };

    colorWheelCanvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        handlePick(e);
    });
    colorWheelCanvas.addEventListener('mousemove', (e) => isDragging && handlePick(e));
    colorWheelCanvas.addEventListener('mouseup', () => isDragging = false);
    colorWheelCanvas.addEventListener('mouseleave', () => isDragging = false);

    function updateRing(x, y, color) {
        ring.style.left = `${x - 10}px`;
        ring.style.top = `${y - 10}px`;
        ring.style.background = color;
        preview.style.background = color;
        colorWheelPicker.style.boxShadow = `0 0 30px 6px ${hexToRgba(color, 0.4)}`;
    }
}


function pickColorFromWheel(e) {
    const rect = colorWheelCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = colorWheelCanvas.width / 2;
    const centerY = colorWheelCanvas.height / 2;
    
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radius = centerX - 5;
    
    if (distance <= radius) {
        const ctx = colorWheelCanvas.getContext('2d');
        const imageData = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        const hex = rgbToHex(imageData[0], imageData[1], imageData[2]);
        selectedCustomColor = hex;
        updateColorPreview(hex);
    }
}

function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    
    let r, g, b;
    
    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }
    
    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
    };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function updateColorPreview(color) {
    colorPreviewBox.style.background = color;
    colorHexInput.value = color;
}

function toggleInstructions() {
    const instructions = document.querySelector('.instructions');
    instructions.classList.toggle('collapsed');
}

function openColorWheel() {
    customColorPickerTarget = colorPickerTarget;
    colorWheelPicker.classList.add('active');
    
    // Position near color picker
    const pickerRect = colorPicker.getBoundingClientRect();
    colorWheelPicker.style.left = pickerRect.right + 10 + 'px';
    colorWheelPicker.style.top = pickerRect.top + 'px';
    
    updateColorPreview(selectedCustomColor);
}

function closeColorWheel() {
    colorWheelPicker.classList.remove('active');
}

function applyCustomColor() {
    if (customColorPickerTarget) {
        applyColor(selectedCustomColor);
    }
    closeColorWheel();
}

function showColorPicker(e, id, type) {
    e.stopPropagation();
    colorPickerTarget = { id, type };
    colorPicker.style.left = e.clientX + 'px';
    colorPicker.style.top = e.clientY + 'px';
    colorPicker.classList.add('active');
}

function applyColor(color) {
    if (!colorPickerTarget) return;

    const { id, type } = colorPickerTarget;

    if (type === 'node') {
        const node = nodes.find(n => n.id === id);
        if (node) {
            node.color = color;
            const nodeEl = document.getElementById(`node-${id}`);
            nodeEl.style.borderColor = color;
            nodeEl.querySelector('.color-btn').style.background = color;
            nodeEl.querySelectorAll('.connection-point').forEach(pt => {
                pt.style.color = color;
            });

            nodeEl.querySelectorAll('.add-connection-btn').forEach(btn => {
                btn.style.color = color;
                btn.style.borderColor = color;
            });

            updateConnectionsForNode(id);
        }
    } else if (type === 'comment') {
        const comment = comments.find(c => c.id === id);
        if (comment) {
            comment.color = color;
            const commentEl = document.getElementById(`comment-${id}`);

            commentEl.style.backgroundColor = hexToRgba(color, 0.1);
            commentEl.style.borderColor = hexToRgba(color, 0.4);

            const header = commentEl.querySelector('.comment-header');
            header.style.background = hexToRgba(color, 0.15);

            const title = commentEl.querySelector('.comment-title');
            title.style.color = '#ffffff';

            commentEl.querySelector('.color-btn').style.background = color;
        }
    }

    colorPicker.classList.remove('active');
    colorPickerTarget = null;
}