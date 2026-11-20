// En-tête commun à toutes les feuilles : titre (vide = aucun) et ligne « Prénom / Date » (case à cocher).
export const HEAD_H = 14; // mm
export const headHeight = (cfg) => (cfg.showName || cfg.title ? HEAD_H : 0);
export const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

export function headHTML(cfg) {
  if (!headHeight(cfg)) return '';
  const left = cfg.showName ? `<span>Prénom : <span class="blank"></span></span>` : '<span></span>';
  const right = cfg.showName
    ? `<span>Date : <span class="blank" style="width:35mm"></span></span>`
    : '<span></span>';
  return `<header class="sh-head">${left}<span class="title">${esc(cfg.title || '')}</span>${right}</header>`;
}

const FONT_MM = (11 * 25.4) / 72; // 11 pt
let measureCtx;
/** Largeur en mm d'un texte en Andika 11 pt (mesurée dans le navigateur). */
function textMm(text, weight = '400') {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx.font = `${weight} 100px Andika`;
  return (measureCtx.measureText(text).width / 100) * FONT_MM;
}

/**
 * En-tête en SVG (unité : mm), pour les exports : même mise en page que `headHTML`, sur une largeur de `width` mm.
 * `title` est le titre ('' : aucun), `showName` la ligne « Prénom / Date ».
 */
export function headSVG(title, showName, width) {
  const base = 3.9, // ligne de base du texte
    ruleY = base - 0.15;
  const L = showName ? textMm(`Prénom : `) + 2 + 60 : 0,
    R = showName ? textMm(`Date : `) + 2 + 35 : 0;
  const tw = title ? textMm(title, '700') : 0;
  let s = `<g font-family="Andika, sans-serif" font-size="${FONT_MM.toFixed(3)}" fill="#000">`;
  if (showName) {
    const lx = textMm(`Prénom : `) + 2;
    s += `<text x="0" y="${base}">Prénom :</text><line x1="${lx.toFixed(2)}" y1="${ruleY}" x2="${(lx + 60).toFixed(2)}" y2="${ruleY}" stroke="#555" stroke-width="0.3"/>`;
    const rx = width - R;
    s += `<text x="${rx.toFixed(2)}" y="${base}">Date :</text><line x1="${(width - 35).toFixed(2)}" y1="${ruleY}" x2="${width}" y2="${ruleY}" stroke="#555" stroke-width="0.3"/>`;
  }
  if (title)
    s += `<text x="${(L + (width - L - R - tw) / 2).toFixed(2)}" y="${base}" font-weight="700">${esc(title)}</text>`;
  return s + '</g>';
}
