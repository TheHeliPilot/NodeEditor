// Small server-rendered SVG charts. Hover tooltips are wired up by public/app.js via data-tip.

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Round axis: a clean step (1, 2, 2.5, 5 × 10^n) and a max that is a whole number of steps. */
function niceScale(v) {
  const raw = Math.max(v, 4) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw && Number.isInteger(s)) || 10 * pow;
  const ticks = Math.ceil(v / step) || 1;
  return { max: step * ticks, ticks };
}

const compact = n => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(Math.round(n)));
const shortDate = day => `${Number(day.slice(8, 10))}.${Number(day.slice(5, 7))}.`;

const W = 640, H = 180, L = 36, R = 12, T = 12, B = 24;

function frame({ max, ticks }) {
  let out = '';
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    const y = T + (H - T - B) * (1 - i / ticks);
    out += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/>`;
    out += `<text class="tick" x="${L - 8}" y="${y + 4}" text-anchor="end">${compact(v)}</text>`;
  }
  return out;
}

function xLabels(points, x) {
  const every = Math.max(1, Math.ceil(points.length / 7));
  let out = '';
  points.forEach((p, i) => {
    const fromEnd = points.length - 1 - i;
    if (fromEnd % every === 0) out += `<text class="tick" x="${x(i)}" y="${H - 6}" text-anchor="middle">${shortDate(p.day)}</text>`;
  });
  return out;
}

/** Line with a faint area wash, a dot on the last value and a hover column per point. */
function line(points, { unit = '', name = '' } = {}) {
  const scale = niceScale(Math.max(...points.map(p => p.value), 1));
  const max = scale.max;
  const step = (W - L - R) / Math.max(points.length - 1, 1);
  const x = i => L + i * step;
  const y = v => T + (H - T - B) * (1 - v / max);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = `${path}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const last = points.at(-1);
  const hits = points.map((p, i) => `<rect class="hit" x="${(x(i) - step / 2).toFixed(1)}" y="${T}" width="${step.toFixed(1)}" height="${H - T - B}"
    data-x="${x(i).toFixed(1)}" data-y="${y(p.value).toFixed(1)}" data-tip="${esc(`${shortDate(p.day)}: ${p.value.toLocaleString('sk')}${unit}`)}"/>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)}">
    ${frame(scale)}
    <path class="area" d="${area}"/>
    <path class="line" d="${path}"/>
    <line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}"/>
    <circle class="hover-dot" r="4" cx="-10" cy="-10"/>
    <circle class="end-dot" r="4" cx="${x(points.length - 1)}" cy="${y(last.value)}"/>
    ${xLabels(points, x)}
    ${hits}
  </svg>`;
}

/** Columns, one per bucket (used for weekly totals). */
function columns(points, { unit = '', name = '', label = p => shortDate(p.day) } = {}) {
  const scale = niceScale(Math.max(...points.map(p => p.value), 1));
  const max = scale.max;
  const band = (W - L - R) / points.length;
  const bw = Math.min(24, band - 6);
  const base = H - B;
  let bars = '';
  points.forEach((p, i) => {
    const cx = L + band * i + band / 2;
    const h = ((H - T - B) * p.value) / max;
    const r = Math.min(1, h);
    const x0 = cx - bw / 2, y0 = base - h;
    // Barely softened top, square at the baseline.
    const d = h <= 0 ? '' : `M${x0},${base}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${base}Z`;
    bars += `<path class="col${i === points.length - 1 ? ' current' : ''}" d="${d}"/>`;
    bars += `<rect class="hit" x="${cx - band / 2}" y="${T}" width="${band}" height="${H - T - B}" data-tip="${esc(`${label(p)}: ${p.value.toLocaleString('sk')}${unit}`)}"/>`;
  });
  const every = Math.max(1, Math.ceil(points.length / 6));
  let labels = '';
  points.forEach((p, i) => {
    if ((points.length - 1 - i) % every === 0) {
      labels += `<text class="tick" x="${L + band * i + band / 2}" y="${H - 6}" text-anchor="middle">${shortDate(p.day)}</text>`;
    }
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)}">${frame(scale)}${bars}${labels}</svg>`;
}

module.exports = { line, columns, compact, shortDate };
