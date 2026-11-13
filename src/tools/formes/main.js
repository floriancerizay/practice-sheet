import '../../styles/fonts.css';
import '../../styles/panel.css';
import '../../styles/base.css';
import '../../styles/print.css';
import { initNav } from '../../shared/nav.js';
import { applyPage, pageSize } from '../../shared/page.js';
import { initShare, readQuery, segmented } from '../../shared/panel.js';
import { SHAPES } from './shapes.js';
import { renderSheets } from './formes.js';

initNav('formes');

const $ = (id) => document.getElementById(id);
const FIELDS = ['size', 'gap', 'rowsPerShape', 'dotRows', 'dotStyle', 'bg', 'title', 'page'];
const CHECKS = ['arrows', 'modelEach', 'gray', 'showName'];
const KEY = 'hs-formes';
let selected = new Set(['cercle', 'carre', 'triangle']);

for (const g of ['formes', 'traits', 'graphisme']) {
  const box = $(g);
  for (const s of SHAPES.filter((s) => s.group === g)) {
    const l = document.createElement('label');
    l.className = 'check';
    l.innerHTML = `<input type="checkbox" data-shape="${s.id}"> ${s.label}`;
    box.append(l);
  }
}
const boxes = () => [...document.querySelectorAll('[data-shape]')];
const syncBoxes = () => boxes().forEach((b) => (b.checked = selected.has(b.dataset.shape)));

function save() {
  const o = { shapes: [...selected] };
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
  if (q.has('shapes')) o.shapes = q.get('shapes').split(',');
  FIELDS.forEach((f) => o[f] != null && ($(f).value = o[f]));
  CHECKS.forEach((f) => o[f] != null && ($(f).checked = o[f]));
  if (Array.isArray(o.shapes)) selected = new Set(o.shapes);
}

function render() {
  const num = (id, d) => parseFloat($(id).value) || d;
  applyPage($('page').value);
  const cfg = {
    page: pageSize($('page').value),
    size: Math.min(60, Math.max(8, num('size', 25))),
    gap: Math.max(0, num('gap', 8)),
    rowsPerShape: Math.max(1, num('rowsPerShape', 2)),
    dotRows: Math.max(0, num('dotRows', 1)),
    dotStyle: $('dotStyle').value,
    bg: $('bg').value,
    arrows: $('arrows').checked,
    modelEach: $('modelEach').checked,
    gray: $('gray').checked,
    title: $('title').value.trim(),
    showName: $('showName').checked,
  };
  renderSheets(
    $('sheets'),
    cfg,
    SHAPES.map((s) => s.id).filter((id) => selected.has(id)),
  );
  save();
}

document.addEventListener('change', (e) => {
  const b = e.target.closest('[data-shape]');
  if (!b) return;
  b.checked ? selected.add(b.dataset.shape) : selected.delete(b.dataset.shape);
  render();
});
document.querySelectorAll('[data-pick]').forEach((b) =>
  b.addEventListener('click', () => {
    const grp = b.dataset.group;
    for (const s of SHAPES.filter((s) => !grp || s.group === grp))
      b.dataset.pick === 'all' ? selected.add(s.id) : selected.delete(s.id);
    syncBoxes();
    render();
  }),
);
$('print').addEventListener('click', () => window.print());
initShare($('share'), () => {
  const o = { shapes: [...selected].join(',') };
  FIELDS.forEach((f) => (o[f] = $(f).value));
  CHECKS.forEach((f) => (o[f] = $(f).checked));
  return o;
});
const refreshSegments = [...document.querySelectorAll('select[data-seg]')].map(segmented);
[...FIELDS, ...CHECKS].forEach((f) => $(f).addEventListener('input', render));

restore();
refreshSegments.forEach((r) => r());
syncBoxes();
render();
