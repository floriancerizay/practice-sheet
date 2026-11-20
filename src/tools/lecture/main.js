import './lecture.css';
import { $, createTool } from '../../shared/tool.js';
import { colorPicker } from '../../shared/panel.js';
import { segment } from './graphemes.js';
import { esc, headHTML } from '../../shared/sheet-header.js';

const OLD_DEFAULT_TEXT =
  'Le petit chat mange une souris. Les enfants jouent dans le jardin avec un ballon.';
const COLORS = ['c-v', 'c-c', 'c-xv', 'c-xc', 'c-m'];
// présentations : police, taille (pt), interligne, espacement des lettres (em), épaisseur
const LAYOUTS = {
  classic: { font: 'Andika', fs: 22, lh: 1.9, ls: 0.05, fw: 700 },
  dyslexia: { font: 'OpenDyslexic', fs: 18, lh: 2.3, ls: 0.12, fw: 400 },
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
  // Méthode Alvarez : voyelles en rouge, consonnes en bleu, sons complexes (graphèmes) en vert.
  alvarez: {
    'c-v': '#e03a33',
    'c-c': '#1f5fae',
    'c-xv': '#2f9a45',
    'c-xc': '#2f9a45',
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
// polices disposant d'une vraie graisse semi-grasse (600) ; les autres n'ont que normale et grasse
const SEMIBOLD = new Set(['Lexend']);
/** Masque « Semi-grasse » pour les polices qui ne l'ont pas (elle passe alors en « Grasse »). */
function syncWeights() {
  const semi = SEMIBOLD.has($('font').value);
  $('fw').querySelector('option[value="600"]').hidden = !semi;
  tool.seg('fw')();
  if (!semi && $('fw').value === '600') {
    $('fw').value = '700';
    tool.seg('fw')();
    tool.draw();
  }
}
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
  syncWeights();
}
/** « Classique » ou « Dyslexie » tant que les réglages fins correspondent à la présentation, sinon « Personnalisée ». */
function detectLayout() {
  syncWeights();
  const match = Object.entries(LAYOUTS).find(([, l]) =>
    Object.entries(l).every(([k, v]) => String($(k).value) === String(v)),
  );
  $('layout').value = match ? match[0] : 'custom';
  tool.seg('layout')();
}

function wordHTML(word) {
  return segment(word)
    .map((g) => `<span class="t-${g.type}">${esc(g.g)}</span>`)
    .join('');
}

function render({ title, showName }) {
  const out = $('out');
  out.className = `reading${$('hints').checked ? ' hints' : ''}`;
  const s = out.style;
  COLORS.forEach((c) => s.setProperty(`--${c}`, $(c).value));
  s.setProperty('--fs', `${$('fs').value}pt`);
  s.setProperty('--lh', $('lh').value);
  s.setProperty('--ls', `${$('ls').value}em`);
  s.setProperty('--fw', $('fw').value);
  s.setProperty('--ff', `"${$('font').value}", sans-serif`);
  out.innerHTML = $('text')
    .value.split(/(\p{L}+)/u)
    .map((p, k) => (k % 2 ? wordHTML(p) : esc(p)))
    .join('');
  $('head').innerHTML = headHTML({ title, showName });
}

const tool = createTool({
  id: 'lecture',
  fields: ['text', 'font', 'palette', 'layout', 'fs', 'lh', 'ls', 'fw', ...COLORS],
  checks: ['hints'],
  state: {
    // ancien texte par défaut (en minuscules), mémorisé tel quel : on repart du texte par défaut actuel
    migrate: (o) => o.text === OLD_DEFAULT_TEXT && delete o.text,
  },
  async ready() {
    refreshColors.forEach((r) => r());
    detectLayout();
    await Promise.all(
      [...$('font').options].flatMap((o) =>
        [400, 700].map((w) => document.fonts.load(`${w} 22pt "${o.value}"`)),
      ),
    );
  },
  render,
});

const refreshColors = COLORS.map((c) => colorPicker($(c), $(c).dataset.name));
COLORS.forEach((c) => $(c).addEventListener('input', () => ($('palette').value = 'custom')));
$('hints').addEventListener('input', () => ($('palette').value = 'custom'));
$('palette').addEventListener('input', () => {
  applyPalette($('palette').value);
  tool.draw();
});
$('layout').addEventListener('input', () => {
  applyLayout($('layout').value);
  tool.draw();
});
['font', 'fs', 'lh', 'ls', 'fw'].forEach((f) => $(f).addEventListener('input', detectLayout));
await tool.start();
