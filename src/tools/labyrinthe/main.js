import '../../styles/fonts.css';
import '../../styles/panel.css';
import '../../styles/base.css';
import '../../styles/print.css';
import { initNav } from '../../shared/nav.js';
import { applyPage, pageSize } from '../../shared/page.js';
import { initShare, readQuery, segmented } from '../../shared/panel.js';
import { renderSheets } from './labyrinthe.js';

initNav('labyrinthe');

const $ = (id) => document.getElementById(id);
const FIELDS = ['shape', 'style', 'contour', 'level', 'solution', 'title', 'page'];
const CHECKS = ['showName'];
const KEY = 'hs-labyrinthe';
const FREE_SHAPES = ['heart', 'triangle', 'diamond', 'hexagon'];
const newSeed = () => Math.floor(Math.random() * 1e6);
// la graine n'est pas affichée : elle change avec « Nouveau labyrinthe » et voyage dans le lien de partage
let seed = newSeed();

function save() {
  const o = { seed };
  FIELDS.forEach((f) => (o[f] = $(f).value));
  CHECKS.forEach((f) => (o[f] = $(f).checked));
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
  const q = readQuery(o, FIELDS, CHECKS);
  if (q.has('seed')) o.seed = q.get('seed');
  FIELDS.forEach((f) => o[f] != null && ($(f).value = o[f]));
  CHECKS.forEach((f) => o[f] != null && ($(f).checked = o[f]));
  if (o.seed != null && Number.isFinite(parseInt(o.seed, 10))) seed = parseInt(o.seed, 10);
}

function render() {
  // le contour ne concerne que les formes libres, et pas le style « tubes »
  $('contour-row').hidden = !FREE_SHAPES.includes($('shape').value) || $('style').value === 'tubes';
  applyPage($('page').value);
  renderSheets($('sheets'), {
    page: pageSize($('page').value),
    shape: $('shape').value,
    style: $('style').value,
    contour: $('contour').value,
    level: $('level').value,
    sheets: 1,
    seed,
    solution: $('solution').value,
    title: $('title').value.trim(),
    showName: $('showName').checked,
  });
  save();
}

$('shuffle').addEventListener('click', () => {
  seed = newSeed();
  render();
});
$('print').addEventListener('click', () => window.print());
initShare($('share'), () => {
  const o = { seed };
  FIELDS.forEach((f) => (o[f] = $(f).value));
  CHECKS.forEach((f) => (o[f] = $(f).checked));
  return o;
});
const refreshSegments = [...document.querySelectorAll('select[data-seg]')].map(segmented);
[...FIELDS, ...CHECKS].forEach((f) => $(f).addEventListener('input', render));

restore();
refreshSegments.forEach((r) => r());
render();
