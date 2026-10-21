// Chart and bar tooltips, confirm dialogs, copy buttons. No framework on purpose.
(() => {
  const tip = document.getElementById('tip');

  function show(text, x, y) {
    tip.textContent = text;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, y - r.height - 12)}px`;
  }
  const hide = () => { tip.hidden = true; };

  document.addEventListener('mousemove', e => {
    const el = e.target.closest('[data-tip]');
    if (!el) return hide();
    const svg = el.ownerSVGElement;
    if (svg && el.dataset.x) {
      // Line charts: move the crosshair and dot to the hovered point.
      const cross = svg.querySelector('.cross');
      const dot = svg.querySelector('.hover-dot');
      cross.setAttribute('x1', el.dataset.x);
      cross.setAttribute('x2', el.dataset.x);
      dot.setAttribute('cx', el.dataset.x);
      dot.setAttribute('cy', el.dataset.y);
      svg.classList.add('hovering');
      const pt = svg.createSVGPoint();
      pt.x = Number(el.dataset.x);
      pt.y = Number(el.dataset.y);
      const p = pt.matrixTransform(svg.getScreenCTM());
      return show(el.dataset.tip, p.x, p.y);
    }
    show(el.dataset.tip, e.clientX, e.clientY);
  });
  document.addEventListener('mouseout', e => {
    const svg = e.target.ownerSVGElement;
    if (svg && !svg.contains(e.relatedTarget)) svg.classList.remove('hovering');
  });

  document.addEventListener('submit', e => {
    const msg = e.target.dataset.confirm;
    if (msg && !confirm(msg)) e.preventDefault();
  });

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const input = document.querySelector(btn.dataset.copy);
    input.select();
    try { await navigator.clipboard.writeText(input.value); } catch { document.execCommand('copy'); }
    const old = btn.textContent;
    btn.textContent = 'Skopírované';
    setTimeout(() => { btn.textContent = old; }, 1500);
  });
})();
