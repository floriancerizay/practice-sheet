/* Logique de l'application : état, contrôles, chargement des données, persistance. */
import '../../styles/fonts.css';
import '../../styles/pico.css';
import '../../styles/panel.css';
import '../../styles/base.css';
import './carte.css';
import { initNav } from '../../shared/nav.js';
import topo110 from 'world-atlas/countries-110m.json?url';
import topo50 from 'world-atlas/countries-50m.json?url';
import { CONTINENTS, REGIONS } from './data/countries.js';
import { FONTS, PALETTES } from './data/style.js';
import { MapView, PAGES } from './map.js';

const KEY = 'printmap.v5';
const TOPO = { 110: topo110, 50: topo50 };
const DEFAULTS = {
  format: 'A4L',
  title: '',
  showName: true,
  projection: 'naturalEarth',
  region: 'world',
  centerLon: 0,
  precision: '110',
  fill: true,
  palette: 'pastel',
  ocean: true,
  stroke: 0.2,
  showCountries: true,
  dots: false,
  cityLevel: 2,
  showOceans: true,
  font: FONTS[0].css,
  fontScale: 0.8,
  graticule: false,
  tropics: false,
  compass: true,
  scale: false,
  hl: [],
  flags: false,
};
const RESET_VIEW = new Set(['projection', 'region', 'format', 'centerLon']);
const RELAYOUT = new Set(['title', 'showName']);

const $ = (sel) => document.querySelector(sel);
const cache = {};
let state = loadState();
let view;

/* ---------- persistance ---------- */
function encode(o) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))));
}
function decode(s) {
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0))));
}

function loadState() {
  let saved;
  try {
    const h = location.hash.slice(1);
    saved = h.startsWith('s=') ? decode(h.slice(2)) : JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    saved = {};
  }
  const out = JSON.parse(JSON.stringify(DEFAULTS));
  for (const k in DEFAULTS)
    if (k in saved && typeof saved[k] === typeof DEFAULTS[k]) out[k] = saved[k];
  out.hl = Array.isArray(saved.hl) ? saved.hl.filter((x) => typeof x === 'string') : [];
  if (!PAGES[out.format]) out.format = 'A4L';
  if (!PALETTES[out.palette]) out.palette = 'pastel';
  if (!FONTS.some((f) => f.css === out.font)) out.font = FONTS[0].css;
  if (!REGIONS[out.region]) out.region = 'world';
  return out;
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* stockage indisponible */
  }
}

/* ---------- petits utilitaires ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
  }, 3200);
}

function applyPage() {
  const [pw, ph] = PAGES[state.format];
  const r = document.documentElement.style;
  r.setProperty('--ratio', pw / ph);
  r.setProperty('--pw', pw + 'mm');
  r.setProperty('--ph', ph + 'mm');
  $('#page-style').textContent = `@page { size: ${pw}mm ${ph}mm; margin: 0; }`;
}

/* ---------- interface ---------- */
function buildUI() {
  const reg = $('#region');
  Object.entries(REGIONS).forEach(([k, v]) => reg.add(new Option(v.label, k)));
  const fo = $('#font');
  FONTS.forEach((f) => {
    const o = new Option(f.label, f.css);
    o.style.fontFamily = f.css;
    fo.add(o);
  });
  const pal = $('#palettes');
  Object.entries(PALETTES).forEach(([k, p]) => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.key = 'palette';
    b.dataset.value = k;
    b.innerHTML = `<span class="dots">${p.colors
      .slice(0, 4)
      .map((c) => `<i style="background:${c}"></i>`)
      .join('')}</span>${p.label}`;
    pal.appendChild(b);
  });

  const hc = $('#hl-continent');
  hc.add(new Option('Choisir un continent…', ''));
  Object.entries(CONTINENTS).forEach(([k, c]) => hc.add(new Option(c.label, k)));
  hc.addEventListener('change', () => {
    const names = new Set(CONTINENTS[hc.value].names);
    hc.value = '';
    set(
      'hl',
      view.features.filter((f) => names.has(f.key)).map((f) => f.key),
    );
  });
  $('#hl-clear').onclick = () => set('hl', []);
  view.onPick = (key) => {
    const l = state.hl.includes(key) ? state.hl.filter((k) => k !== key) : state.hl.concat(key);
    set('hl', l);
  };

  document.querySelectorAll('[data-key]').forEach((el) => {
    const key = el.dataset.key;
    const num = (v) => (el.dataset.type === 'number' || el.type === 'range' ? +v : v);
    if (el.tagName === 'BUTTON')
      el.addEventListener('click', () => set(key, num(el.dataset.value)));
    else
      el.addEventListener('input', () =>
        set(key, el.type === 'checkbox' ? el.checked : num(el.value)),
      );
  });

  $('#z-in').onclick = () => view.zoomBy(1.6);
  $('#z-out').onclick = () => view.zoomBy(1 / 1.6);
  $('#z-center').onclick = () => view.recenter();
  $('#btn-print').onclick = () => {
    applyPage();
    window.print();
  };
  $('#btn-svg').onclick = () => run(view.exportSVG(), 'Fichier SVG enregistré !');
  $('#btn-png').onclick = () => run(view.exportPNG(), 'Image PNG enregistrée !');
  $('#btn-link').onclick = () => {
    const url = location.href.split('#')[0] + '#s=' + encode(state);
    history.replaceState(null, '', url);
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
      () => toast('Lien copié ! '),
      () => toast('Copie le lien dans la barre d’adresse '),
    );
  };
  $('#btn-reset').onclick = () => {
    if (!confirm('Tout remettre comme au début ?')) return;
    state = JSON.parse(JSON.stringify(DEFAULTS));
    view.state = state;
    persist();
    history.replaceState(null, '', location.pathname);
    syncUI();
    applyPage();
    loadAndRender();
  };
}

function run(promise, msg) {
  promise.then(
    () => toast(msg),
    (e) => {
      console.error(e);
      toast('Oups, l’export a échoué ');
    },
  );
}

function syncUI() {
  document.querySelectorAll('[data-key]').forEach((el) => {
    const v = state[el.dataset.key];
    if (el.tagName === 'BUTTON') el.classList.toggle('active', String(v) === el.dataset.value);
    else if (el.type === 'checkbox') el.checked = !!v;
    else if (document.activeElement !== el) el.value = v;
  });
  $('#hint-nofill').hidden = state.fill;
  $('#palettes').hidden = !state.fill;
  $('#hl-count').textContent = state.hl.length ? `${state.hl.length} pays en surbrillance.` : '';
  $('#hl-clear').hidden = !state.hl.length;
  $('#row-center').hidden = state.region !== 'world' || state.projection === 'globe';
  $('#row-dots').hidden = !state.showCountries;
  const labels = state.showCountries || state.cityLevel > 0 || state.showOceans;
  $('#row-font').hidden = !labels;
  $('#row-fontscale').hidden = !labels;
}

function set(key, val) {
  state[key] = val;
  persist();
  syncUI();
  if (key === 'format') applyPage();
  if (key === 'precision') return loadAndRender();
  if (RESET_VIEW.has(key)) view.rebuild(true);
  else if (RELAYOUT.has(key)) view.rebuild(false);
  else view.draw();
}

/* ---------- données ---------- */
async function loadAndRender() {
  const loading = $('#loading');
  loading.className = 'loading';
  loading.textContent = 'Chargement de la carte…';
  loading.hidden = false;
  try {
    const p = state.precision;
    if (!cache[p]) cache[p] = await (await fetch(TOPO[p])).json();
    view.setData(cache[p]);
    view.rebuild(true);
    loading.hidden = true;
  } catch (e) {
    console.error(e);
    loading.className = 'loading err';
    loading.textContent = 'Impossible de charger la carte. Recharge la page.';
  }
}

function init() {
  initNav('carte');
  view = new MapView($('#map'), $('#tooltip'));
  view.state = state;
  buildUI();
  syncUI();
  applyPage();
  loadAndRender();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => view.draw());
}

init();
