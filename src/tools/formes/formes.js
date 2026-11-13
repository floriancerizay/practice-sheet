import { headHTML, headHeight } from '../../shared/sheet-header.js';
import { usableHeight, usableWidth } from '../../shared/page.js';
import { SHAPES, SHAPE_BY_ID, shapeWidth } from './shapes.js';

const DEFS =
  '<defs><marker id="fm-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#d03030"/></marker></defs>';

function background(cfg, h) {
  const W = usableWidth(cfg.page);
  if (cfg.bg !== 'grid') return '';
  const c = cfg.gray ? '#cfcfcf' : '#cdbfe8';
  let s = '';
  for (let x = 0; x <= W + 0.01; x += 5)
    s += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${c}" stroke-width=".15"/>`;
  for (let y = 0; y <= h + 0.01; y += 5)
    s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${c}" stroke-width=".15"/>`;
  return s;
}

/** Une forme dessinée en (x, y), de hauteur `size` mm. kind = 'model' | 'dots'. */
function cell(shape, x, y, size, cfg, kind) {
  const sc = size / 100,
    dotted = kind === 'dots';
  const sw = (dotted ? 0.35 : 0.6) / sc;
  const ink = dotted ? (cfg.dotStyle === 'gray' ? '#bbb' : '#666') : '#111';
  const dash =
    dotted && cfg.dotStyle !== 'gray' ? ` stroke-dasharray="${1.4 / sc} ${1.4 / sc}"` : '';
  const dw = dotted && cfg.dotStyle === 'gray' ? sw * 1.8 : sw;
  let out = `<g transform="translate(${x} ${y}) scale(${sc})" fill="none" stroke="${ink}" stroke-width="${dw}" stroke-linecap="round" stroke-linejoin="round"${dash}>`;
  out += `<path d="${shape.d}"${!dotted && cfg.arrows && !shape.closed ? ' marker-end="url(#fm-arrow)"' : ''}/>`;
  if (!dotted && cfg.arrows) {
    const [sx, sy] = shape.start,
      [dx, dy] = shape.dir,
      l = Math.hypot(dx, dy) || 1;
    if (shape.closed) {
      const ex = sx + (dx / l) * 16,
        ey = sy + (dy / l) * 16;
      out += `<path d="M${sx} ${sy} L${ex} ${ey}" stroke="#d03030" stroke-width="${sw * 0.7}" marker-end="url(#fm-arrow)"/>`;
    }
    out += `<circle cx="${sx}" cy="${sy}" r="${2.6}" fill="#d03030" stroke="none"/>`;
  }
  return out + '</g>';
}

export function rowSVG(cfg, shape, kind) {
  const W = usableWidth(cfg.page);
  const size = cfg.size,
    h = Math.ceil((size + 4) / 5) * 5,
    y = (h - size) / 2;
  const cw = (size * shapeWidth(shape)) / 100,
    pitch = cw + cfg.gap;
  let body = '',
    x = 2.5,
    n = 0;
  while (x + cw <= W - 1) {
    if (n === 0) {
      if (kind === 'dots' || cfg.__first || cfg.modelEach)
        body += cell(shape, x, y, size, cfg, 'model');
    } else if (kind === 'dots') body += cell(shape, x, y, size, cfg, 'dots');
    n++;
    x += pitch;
  }
  return {
    h,
    svg: `<svg class="row-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}mm" height="${h}mm">${DEFS}${background(cfg, h)}${body}</svg>`,
  };
}

export function buildPages(cfg, ids) {
  const rows = [];
  for (const id of ids) {
    const shape = SHAPE_BY_ID[id];
    if (!shape) continue;
    for (let r = 0; r < cfg.rowsPerShape; r++)
      rows.push(rowSVG({ ...cfg, __first: r === 0 }, shape, r < cfg.dotRows ? 'dots' : 'blank'));
  }
  const avail = usableHeight(cfg.page) - headHeight(cfg);
  const pages = [];
  let cur = [],
    used = 0;
  for (const r of rows) {
    if (used + r.h > avail && cur.length) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(r.svg);
    used += r.h;
  }
  if (cur.length) pages.push(cur);
  return pages.length ? pages : [[rowSVG(cfg, SHAPES[0], 'blank').svg]];
}

export function renderSheets(target, cfg, ids) {
  target.innerHTML = buildPages(cfg, ids)
    .map((rows) => `<section class="sheet">${headHTML(cfg)}${rows.join('')}</section>`)
    .join('');
}
