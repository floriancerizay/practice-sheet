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
  const left = cfg.showName ? '<span>Prénom : <span class="blank"></span></span>' : '<span></span>';
  const right = cfg.showName
    ? '<span>Date : <span class="blank" style="width:35mm"></span></span>'
    : '<span></span>';
  return `<header class="sh-head">${left}<span class="title">${esc(cfg.title || '')}</span>${right}</header>`;
}
