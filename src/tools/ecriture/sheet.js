import { esc } from '../../shared/sheet-header.js';
import { buildRows, paginate, renderPages, rowBox } from '../../shared/sheets.js';
import { usableWidth } from '../../shared/page.js';
import { STROKES, STROKE_W, STROKE_H, LETTERS, hasStrokes } from './strokes.js';

// em = taille de police en interlignes ; la ligne de base est à 4 interlignes du haut d'une rangée (8 interlignes).
const FONTS = {
  script: { family: 'Andika', em: 4.4 },
  cursive: { family: 'Playwrite FR Trad', em: 3.8 },
  moderne: { family: 'Playwrite FR Moderne', em: 3.8 },
  trace: { family: 'Andika', em: 4.4 },
};
export const fontFamily = (style) => FONTS[style]?.family ?? FONTS.script.family;

const ctx = document.createElement('canvas').getContext('2d');

export function textWidthMm(text, style, i) {
  const f = FONTS[style];
  ctx.font = `100px "${f.family}"`;
  return (ctx.measureText(text).width / 100) * f.em * i;
}

export async function loadFonts() {
  await Promise.all(
    Object.values(FONTS).map((f) => document.fonts.load(`100px "${f.family}"`, 'aAéÉ0')),
  );
}

/** Découpe le texte saisi en éléments à exercer. */
export function parseItems(text, mode) {
  const t = text;
  return mode === 'words' ? t.split(/\s+/).filter(Boolean) : [...t].filter((c) => !/\s/.test(c));
}

function ruling(cfg, h) {
  const W = usableWidth(cfg.page);
  const i = cfg.i;
  let s = '';
  if (cfg.ruling === 'seyes') {
    const thin = cfg.gray ? '#d8d8d8' : '#cdbfe8',
      bold = cfg.gray ? '#9a9a9a' : '#8a72c4',
      vert = cfg.gray ? '#bdbdbd' : '#a893d6';
    for (let x = 0; x <= W + 0.01; x += 4 * i)
      s += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${vert}" stroke-width=".2"/>`;
    for (let k = 0; k <= 8; k++)
      s += `<line x1="0" y1="${k * i}" x2="${W}" y2="${k * i}" stroke="${k % 4 ? thin : bold}" stroke-width="${k % 4 ? 0.15 : 0.3}"/>`;
  } else if (cfg.ruling === 'lines4') {
    const c = cfg.gray ? '#9a9a9a' : '#5b7fd0';
    s += `<line x1="0" y1="0" x2="${W}" y2="0" stroke="${c}" stroke-width=".2" opacity=".6"/>`;
    s += `<line x1="0" y1="${2 * i}" x2="${W}" y2="${2 * i}" stroke="${c}" stroke-width=".2" stroke-dasharray="1 1"/>`;
    s += `<line x1="0" y1="${4 * i}" x2="${W}" y2="${4 * i}" stroke="${cfg.gray ? '#555' : '#d04a4a'}" stroke-width=".35"/>`;
    s += `<line x1="0" y1="${6 * i}" x2="${W}" y2="${6 * i}" stroke="${c}" stroke-width=".2" opacity=".6"/>`;
  } else if (cfg.ruling === 'baseline') {
    s += `<line x1="0" y1="${4 * i}" x2="${W}" y2="${4 * i}" stroke="#777" stroke-width=".3"/>`;
  }
  return s;
}

/** Dessine une cellule (un modèle) ; renvoie [svg, largeur]. */
function cell(text, x, cfg, kind) {
  const i = cfg.i,
    base = 4 * i;
  const dotted = kind === 'dots';
  if (cfg.style === 'trace' && hasStrokes(text)) {
    let out = '',
      cx = x;
    for (const ch of text) {
      if (LETTERS[ch]) {
        const [cw, strokes] = LETTERS[ch];
        const sw = dotted ? 0.1 : 0.2;
        out += `<g transform="translate(${cx} ${base}) scale(${i})" fill="none" stroke="${dotted ? '#777' : '#222'}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${dotted ? ' stroke-dasharray=".35 .35"' : ''}>`;
        let n = 0;
        for (const [sx, sy, d, opt] of strokes) {
          if (opt === 'dot') {
            out += dotted
              ? `<circle cx="${sx}" cy="${sy}" r=".12"/>`
              : `<circle cx="${sx}" cy="${sy}" r=".14" fill="#222"/>`;
            continue;
          }
          n++;
          out += `<path d="${d}"${!dotted && cfg.arrows ? ' marker-end="url(#hs-arrow)"' : ''}/>`;
          if (!dotted && cfg.arrows)
            out += `<circle cx="${sx}" cy="${sy}" r=".1" fill="#d03030" stroke="none"/><text x="${sx - 0.45}" y="${sy - 0.08}" font-size=".65" fill="#d03030" stroke="none" font-family="Andika">${n}</text>`;
        }
        out += '</g>';
        cx += cw * i + 0.6 * i;
        continue;
      }
      const h = 4 * i,
        sc = h / STROKE_H,
        w = STROKE_W * sc;
      const sw = (dotted ? 0.3 : 0.5) / sc;
      out += `<g transform="translate(${cx} ${base - h}) scale(${sc})" fill="none" stroke="${dotted ? '#777' : '#222'}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${dotted ? ` stroke-dasharray="${1.2 / sc} ${1.2 / sc}"` : ''}>`;
      STROKES[ch].forEach(([sx, sy, d], n) => {
        out += `<path d="${d}"${!dotted && cfg.arrows ? ' marker-end="url(#hs-arrow)"' : ''}/>`;
        if (!dotted && cfg.arrows)
          out += `<circle cx="${sx}" cy="${sy}" r="${(2.4 / sc) * 0.35}" fill="#d03030" stroke="none"/><text x="${sx - 5}" y="${sy - 3}" font-size="12" fill="#d03030" stroke="none" font-family="Andika">${n + 1}</text>`;
      });
      out += '</g>';
      cx += w + 0.6 * i;
    }
    return [out, cx - x - 0.6 * i];
  }
  const f = FONTS[cfg.style === 'trace' ? 'script' : cfg.style];
  const w = textWidthMm(text, cfg.style === 'trace' ? 'script' : cfg.style, i);
  const attrs = `x="${x}" y="${base}" font-family="${f.family}" font-size="${f.em * i}"`;
  const look = !dotted
    ? 'fill="#111"'
    : cfg.dotStyle === 'gray'
      ? 'fill="#bbb"'
      : `fill="none" stroke="#666" stroke-width=".22" stroke-dasharray=".7 .7"`;
  return [`<text ${attrs} ${look}>${esc(text)}</text>`, w];
}

const DEFS = `<defs><marker id="hs-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#d03030"/></marker></defs>`;

/** Une rangée : svg en chaîne. rowKind = 'dots' | 'blank'. */
export function rowSVG(cfg, item, rowKind) {
  const W = usableWidth(cfg.page);
  const i = cfg.i,
    h = 8 * i,
    gap = (cfg.mode === 'words' ? cfg.gap + 1 : cfg.gap) * i;
  let body = '',
    x = 1,
    n = 0;
  while (n === 0 || rowKind === 'dots') {
    const first = n === 0;
    const [svg, w] = cell(item, x, cfg, first ? 'model' : 'dots');
    if (x + w > W - 1) break;
    if (!first || cfg.__first || cfg.modelEach || rowKind === 'dots') body += svg;
    n++;
    x += w + gap;
  }
  return { h, svg: rowBox(cfg.page, h, `${DEFS}${ruling(cfg, h)}${body}`) };
}

/** Construit toutes les rangées puis les répartit en pages. */
export function buildPages(cfg, items) {
  const pages = paginate(cfg, buildRows(cfg, items, cfg.rowsPerItem, rowSVG));
  return pages.length ? pages : [[rowSVG(cfg, '', 'blank').svg]];
}

export function renderSheets(target, cfg, items) {
  renderPages(
    target,
    cfg,
    buildPages(cfg, items).map((rows) => ({ html: rows.join('') })),
  );
}
