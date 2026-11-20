/**
 * Export des feuilles affichées en SVG ou en PNG (300 dpi), une image par page.
 * Feuilles faites de rangées SVG (écriture, formes, labyrinthes) : un vrai SVG, en-tête compris.
 * Feuille de texte HTML (lecture) : le texte est placé dans un <foreignObject>.
 */
import { fontFaceCss } from '../tools/carte/data/fonts-embed.js';
import { fitPreview } from './page.js';
import { HEAD_H, headSVG } from './sheet-header.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const PX = 96 / 25.4; // pixels CSS par mm

/** Télécharge `blob` sous le nom `name`. */
export function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Règles @font-face des polices citées dans `families` (attributs font-family ou liste donnée). */
async function fontsCss(families) {
  const css = await Promise.all([...new Set(families)].map((f) => fontFaceCss(f).catch(() => '')));
  return css.join('');
}
const familiesIn = (markup) =>
  [...markup.matchAll(/font-family[=:]\s*["']?([^"',;>]+)/g)].map((m) => m[1].trim());

/** SVG autonome d'une feuille faite de rangées SVG. */
async function railSVG(sheet, page) {
  const m = page.margin;
  let y = m,
    body = '';
  for (const el of sheet.children) {
    if (el.classList.contains('sh-head')) {
      const title = el.querySelector('.title')?.textContent ?? '';
      const named = !!el.querySelector('.blank');
      body += `<g transform="translate(${m} ${y})">${headSVG(title, named, page.w - 2 * m)}</g>`;
      y += HEAD_H;
    } else if (el.matches('svg.row-svg')) {
      const [, , w, h] = el.getAttribute('viewBox').split(/\s+/).map(Number);
      body += `<svg x="${m}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible">${el.innerHTML}</svg>`;
      y += h;
    }
  }
  const fonts = await fontsCss(['Andika', ...familiesIn(body)]);
  return {
    w: page.w,
    h: page.h,
    svg: `<svg xmlns="${SVG_NS}" width="${page.w}mm" height="${page.h}mm" viewBox="0 0 ${page.w} ${page.h}"><style>${fonts}</style><rect width="${page.w}" height="${page.h}" fill="#fff"/>${body}</svg>`,
  };
}

/** Règles CSS de la page (hors @font-face et @media), pour que la feuille HTML garde son aspect hors du site. */
function pageCss() {
  let css = '';
  for (const sheet of document.styleSheets) {
    try {
      for (const r of sheet.cssRules) if (r instanceof CSSStyleRule) css += r.cssText + '\n';
    } catch {
      /* feuille de style inaccessible */
    }
  }
  return css;
}

/** SVG autonome d'une feuille de texte HTML (foreignObject). */
async function htmlSVG(sheet, page) {
  const w = Math.round(page.w * PX),
    h = Math.max(Math.round(page.h * PX), Math.ceil(sheet.scrollHeight));
  const clone = sheet.cloneNode(true);
  clone.style.cssText += `;width:${page.w}mm;min-height:${page.h}mm;margin:0;box-shadow:none;zoom:1;`;
  const wrap = document.createElement('div');
  wrap.setAttribute('xmlns', XHTML_NS);
  const style = document.createElement('style');
  style.textContent = pageCss();
  wrap.append(style, clone);
  const out = sheet.querySelector('.reading') ?? sheet;
  const fonts = await fontsCss([
    'Andika',
    ...getComputedStyle(out)
      .fontFamily.split(',')
      .map((f) => f.trim().replace(/["']/g, '')),
  ]);
  return {
    w: page.w,
    h: (h / PX).toFixed(2) * 1,
    svg:
      `<svg xmlns="${SVG_NS}" width="${page.w}mm" height="${(h / PX).toFixed(2)}mm" viewBox="0 0 ${w} ${h}">` +
      `<style>${fonts}</style><rect width="${w}" height="${h}" fill="#fff"/>` +
      `<foreignObject width="${w}" height="${h}">${new XMLSerializer().serializeToString(wrap)}</foreignObject></svg>`,
  };
}

/** Convertit un SVG autonome en PNG à 300 dpi. */
export async function svgToPng({ w, h, svg }) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    const k = 300 / 25.4;
    const cw = Math.round(w * k),
      ch = Math.round(h * k);
    img.width = cw;
    img.height = ch;
    img.src = url;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    return await new Promise((res, rej) =>
      cv.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Branche les boutons d'export. `name` : début du nom de fichier ; `getPage()` : format de page
 * (largeur, hauteur et marge en mm). Plusieurs pages : un fichier par page (`name-1.png`, `name-2.png`...).
 */
export function initExport({ svg, png }, name, getPage) {
  const run = (button, ext) =>
    button.addEventListener('click', async () => {
      const label = button.textContent;
      button.disabled = true;
      button.textContent = 'Export…';
      const root = document.documentElement.style;
      const zoom = root.getPropertyValue('--zoom');
      root.setProperty('--zoom', '1'); // mesures et copies à l'échelle réelle
      try {
        const sheets = [...document.querySelectorAll('.sheet')];
        const page = getPage();
        const files = [];
        for (const sheet of sheets)
          files.push(
            sheet.querySelector('svg.row-svg')
              ? await railSVG(sheet, page)
              : await htmlSVG(sheet, page),
          );
        for (const [i, file] of files.entries()) {
          const blob =
            ext === 'svg'
              ? new Blob([file.svg], { type: 'image/svg+xml;charset=utf-8' })
              : await svgToPng(file);
          download(`${name}${files.length > 1 ? `-${i + 1}` : ''}.${ext}`, blob);
          if (i < files.length - 1) await pause(300);
        }
        button.textContent = 'Fichier enregistré';
      } catch {
        button.textContent = 'Échec de l’export';
      } finally {
        if (zoom) root.setProperty('--zoom', zoom);
        else fitPreview();
        setTimeout(() => {
          button.textContent = label;
          button.disabled = false;
        }, 1800);
      }
    });
  run(svg, 'svg');
  run(png, 'png');
}
