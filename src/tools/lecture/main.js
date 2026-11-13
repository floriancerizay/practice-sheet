import '../../styles/fonts.css';
import '../../styles/panel.css';
import '../../styles/base.css';
import '../../styles/print.css';
import './lecture.css';
import { initNav } from '../../shared/nav.js';
import { applyPage } from '../../shared/page.js';
import { colorPicker, initShare, readQuery, segmented } from '../../shared/panel.js';
import { segment } from './graphemes.js';
import { headHTML } from '../../shared/sheet-header.js';

initNav('lecture');

const $ = (id) => document.getElementById(id);
const KEY = 'hs-lecture';
const OLD_DEFAULT_TEXT =
  'Le petit chat mange une souris. Les enfants jouent dans le jardin avec un ballon.';
const COLORS = ['c-v', 'c-c', 'c-xv', 'c-xc', 'c-m'];
const FIELDS = ['text', 'title', 'font', 'palette', 'layout', 'page', 'fs', 'lh', 'ls', ...COLORS];
const CHECKS = ['hints', 'showName'];
// présentations : police, taille (pt), interligne, espacement des lettres (em)
const LAYOUTS = {
  classic: { font: 'Andika', fs: 22, lh: 1.9, ls: 0.05 },
  dyslexia: { font: 'OpenDyslexic', fs: 18, lh: 2.3, ls: 0.12 },
};
const PALETTES = {
  def: {
    'c-v': '#d62828',
    'c-c': '#111111',
    'c-xv': '#1d5fd1',
    'c-xc': '#1a8f3c',
    'c-m': '#9a9a9a',
    hints: false,
  },
  // Okabe-Ito : distinguable avec les trois formes courantes de daltonisme ; indices (souligné/gras) en plus.
  cb: {
    'c-v': '#d55e00',
    'c-c': '#111111',
    'c-xv': '#0072b2',
    'c-xc': '#8a6d00',
    'c-m': '#888888',
    hints: true,
  },
  bw: {
    'c-v': '#111111',
    'c-c': '#111111',
    'c-xv': '#111111',
    'c-xc': '#111111',
    'c-m': '#888888',
    hints: true,
  },
};
function applyPalette(name) {
  const p = PALETTES[name];
  if (!p) return;
  COLORS.forEach((c) => ($(c).value = p[c]));
  $('hints').checked = p.hints;
  refreshColors.forEach((r) => r());
}
function applyLayout(name) {
  const l = LAYOUTS[name];
  if (!l) return;
  for (const [k, v] of Object.entries(l)) $(k).value = v;
}
/** « Classique » ou « Dyslexie » tant que les réglages fins correspondent à la présentation, sinon « Personnalisée ». */
function detectLayout() {
  const match = Object.entries(LAYOUTS).find(([, l]) =>
    Object.entries(l).every(([k, v]) => String($(k).value) === String(v)),
  );
  $('layout').value = match ? match[0] : 'custom';
  refreshLayout();
}
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

function wordHTML(word) {
  return segment(word)
    .map((g) => `<span class="t-${g.type}">${esc(g.g)}</span>`)
    .join('');
}

function render() {
  applyPage($('page').value);
  const out = $('out');
  out.className = `reading${$('hints').checked ? ' hints' : ''}`;
  const s = out.style;
  COLORS.forEach((c) => s.setProperty(`--${c}`, $(c).value));
  s.setProperty('--fs', `${$('fs').value}pt`);
  s.setProperty('--lh', $('lh').value);
  s.setProperty('--ls', `${$('ls').value}em`);
  s.setProperty('--ff', `"${$('font').value}", sans-serif`);
  out.innerHTML = $('text')
    .value.split(/(\p{L}+)/u)
    .map((p, k) => (k % 2 ? wordHTML(p) : esc(p)))
    .join('');
  $('head').innerHTML = headHTML({
    title: $('title').value.trim(),
    showName: $('showName').checked,
  });
  save();
}

function save() {
  const o = { hints: $('hints').checked, showName: $('showName').checked };
  FIELDS.forEach((f) => (o[f] = $(f).value));
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* stockage indisponible */
  }
}
function restore() {
  let o = {};
  try {
    o = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    /* stockage indisponible */
  }
  // ancien texte par défaut (en minuscules), mémorisé tel quel : on repart du texte par défaut actuel
  if (o.text === OLD_DEFAULT_TEXT) delete o.text;
  readQuery(o, FIELDS, CHECKS);
  FIELDS.forEach((f) => o[f] != null && ($(f).value = o[f]));
  CHECKS.forEach((k) => o[k] != null && ($(k).checked = o[k]));
}

const colorNames = (c) => $(c).dataset.name;
const refreshColors = COLORS.map((c) => colorPicker($(c), colorNames(c)));
const refreshLayout = segmented($('layout'));
const refreshPage = segmented($('page'));
[...CHECKS, ...FIELDS].forEach((f) => $(f).addEventListener('input', render));
COLORS.forEach((c) => $(c).addEventListener('input', () => ($('palette').value = 'custom')));
$('hints').addEventListener('input', () => ($('palette').value = 'custom'));
$('palette').addEventListener('input', () => {
  applyPalette($('palette').value);
  render();
});
$('layout').addEventListener('input', () => {
  applyLayout($('layout').value);
  render();
});
['font', 'fs', 'lh', 'ls'].forEach((f) => $(f).addEventListener('input', detectLayout));
$('print').addEventListener('click', () => window.print());
initShare($('share'), () => {
  const o = {};
  FIELDS.forEach((f) => (o[f] = $(f).value));
  CHECKS.forEach((f) => (o[f] = $(f).checked));
  return o;
});

restore();
refreshColors.forEach((r) => r());
refreshPage();
detectLayout();
await Promise.all([...$('font').options].map((o) => document.fonts.load(`22pt "${o.value}"`)));
render();
