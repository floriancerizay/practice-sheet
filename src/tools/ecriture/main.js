import '../../styles/fonts.css';
import '../../styles/panel.css';
import '../../styles/base.css';
import '../../styles/print.css';
import { initNav } from '../../shared/nav.js';
import { applyPage, pageSize } from '../../shared/page.js';
import { initShare, readQuery, segmented } from '../../shared/panel.js';
import { loadFonts, parseItems, renderSheets } from './sheet.js';

initNav('ecriture');

const $ = (id) => document.getElementById(id);
const FIELDS = [
  'text',
  'mode',
  'style',
  'ruling',
  'i',
  'gap',
  'rowsPerItem',
  'dotRows',
  'dotStyle',
  'title',
  'page',
];
const CHECKS = ['arrows', 'modelEach', 'gray', 'showName'];
const KEY = 'hs-ecriture';

function save() {
  const o = {};
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
  if (q.has('text') && !q.has('mode')) o.mode = 'words';
  FIELDS.forEach((f) => o[f] != null && ($(f).value = o[f]));
  CHECKS.forEach((f) => o[f] != null && ($(f).checked = o[f]));
}

function render() {
  const num = (id) => parseFloat($(id).value) || 0;
  applyPage($('page').value);
  const cfg = {
    page: pageSize($('page').value),
    mode: $('mode').value,
    style: $('style').value,
    ruling: $('ruling').value,
    i: num('i') || 2.5,
    gap: num('gap'),
    rowsPerItem: Math.max(1, num('rowsPerItem')),
    dotRows: num('dotRows'),
    dotStyle: $('dotStyle').value,
    arrows: $('arrows').checked,
    modelEach: $('modelEach').checked,
    gray: $('gray').checked,
    title: $('title').value.trim(),
    showName: $('showName').checked,
  };
  renderSheets($('sheets'), cfg, parseItems($('text').value, cfg.mode));
  save();
}

document.querySelectorAll('[data-fill]').forEach((b) =>
  b.addEventListener('click', () => {
    $('text').value = b.dataset.fill;
    $('mode').value = b.dataset.mode;
    render();
  }),
);
$('print').addEventListener('click', () => window.print());
initShare($('share'), () => {
  const o = {};
  FIELDS.forEach((f) => (o[f] = $(f).value));
  CHECKS.forEach((f) => (o[f] = $(f).checked));
  return o;
});
const refreshSegments = [...document.querySelectorAll('select[data-seg]')].map(segmented);
[...FIELDS, ...CHECKS].forEach((f) => $(f).addEventListener('input', render));

restore();
refreshSegments.forEach((r) => r());
await loadFonts();
render();
