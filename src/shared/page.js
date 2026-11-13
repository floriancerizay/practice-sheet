/** Format de la page : A4 ou A3, portrait ou paysage. Les dimensions sont en millimètres. */
export const PAGES = {
  A4P: { w: 210, h: 297 },
  A4L: { w: 297, h: 210 },
  A3P: { w: 297, h: 420 },
  A3L: { w: 420, h: 297 },
};
export const DEFAULT_PAGE = 'A4P';
export const MARGIN = 10; // mm, tout autour

/** Dimensions de la page à partir de sa clé (repli sur A4 portrait). */
export const pageSize = (key) => ({ ...(PAGES[key] ?? PAGES[DEFAULT_PAGE]), margin: MARGIN });
/** Largeur utile d'une ligne, en mm. */
export const usableWidth = (page = pageSize()) => page.w - 2 * page.margin;
/** Hauteur utile d'une feuille (sans l'en-tête), en mm. */
export const usableHeight = (page = pageSize()) => page.h - 2 * page.margin;

let current = PAGES[DEFAULT_PAGE].w;

/** Aperçu à l'échelle : 1 si la feuille tient dans la zone, sinon réduit pour qu'elle tienne en largeur. */
export function fitPreview(widthMm = current) {
  const area = document.querySelector('.preview');
  if (!area) return;
  const px = (widthMm * 96) / 25.4;
  const zoom = Math.min(1, Math.max(0.3, (area.clientWidth - 32) / px));
  document.documentElement.style.setProperty('--zoom', String(zoom));
}

/**
 * Applique le format à la page : variables CSS (`--pw`, `--ph`) pour les feuilles de l'aperçu, et règle `@page`
 * pour l'impression. L'aperçu est réduit quand la feuille est plus large que la zone d'affichage.
 */
export function applyPage(key) {
  const { w, h } = pageSize(key);
  const root = document.documentElement.style;
  root.setProperty('--pw', `${w}mm`);
  root.setProperty('--ph', `${h}mm`);
  let style = document.getElementById('page-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'page-style';
    document.head.append(style);
  }
  style.textContent = `@page { size: ${w}mm ${h}mm; margin: 0; }`;
  current = w;
  fitPreview(w);
}

if (typeof window !== 'undefined') window.addEventListener('resize', () => fitPreview());
