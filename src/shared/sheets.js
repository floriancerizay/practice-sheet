/** Briques communes des feuilles : rangées SVG, découpage en pages, assemblage avec l'en-tête. */
import { headHTML, headHeight } from './sheet-header.js';
import { usableHeight, usableWidth } from './page.js';

/** Boîte SVG d'une rangée (largeur utile de la page, hauteur `h`, unités en mm). */
export const rowBox = (page, h, inner) => {
  const W = usableWidth(page);
  return `<svg class="row-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}mm" height="${h}mm">${inner}</svg>`;
};

/**
 * Rangées d'exercices : `rowsPerItem` rangées par élément, les `dotRows` premières en pointillés.
 * `makeRow(cfg, item, kind)` renvoie `{ h, svg }` ; `cfg.__first` vaut true pour la première rangée d'un élément.
 */
export function buildRows(cfg, items, rowsPerItem, makeRow) {
  const rows = [];
  for (const item of items)
    for (let r = 0; r < rowsPerItem; r++)
      rows.push(makeRow({ ...cfg, __first: r === 0 }, item, r < cfg.dotRows ? 'dots' : 'blank'));
  return rows;
}

/** Répartit des rangées `{ h, svg }` en pages (liste de chaînes SVG) selon la hauteur utile restante. */
export function paginate(cfg, rows) {
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
  return pages;
}

/** Affiche des pages `{ title?, html }` : une feuille chacune, avec l'en-tête. */
export function renderPages(target, cfg, pages) {
  target.innerHTML = pages
    .map(
      (p) =>
        `<section class="sheet">${headHTML({ ...cfg, title: p.title ?? cfg.title })}${p.html}</section>`,
    )
    .join('');
}
