/**
 * Socle commun des outils à panneau de réglages (écriture, formes, labyrinthes, lecture) : styles, barre de
 * navigation, cartes « En-tête » et actions, mémorisation des réglages, lien de partage, impression et exports.
 * Chaque outil ne fournit que ses champs et sa fonction de rendu.
 */
import '../styles/fonts.css';
import '../styles/pico.css';
import '../styles/panel.css';
import '../styles/base.css';
import '../styles/print.css';
import { initExport } from './export.js';
import { initNav } from './nav.js';
import { applyPage, pageSize } from './page.js';
import { actionsCard, headerCard, initShare, readQuery, segmented } from './panel.js';

export const $ = (id) => document.getElementById(id);
/** Valeur numérique d'un champ, `fallback` s'il est vide ou invalide. */
export const num = (id, fallback = 0) => parseFloat($(id).value) || fallback;

/**
 * Prépare un outil.
 * - `id` : nom de l'outil (barre de navigation, clé de stockage `hs-<id>`, nom des fichiers exportés) ;
 * - `fields`, `checks` : ids des champs (valeur) et des cases à cocher propres à l'outil ; le titre, la ligne
 *   « Prénom / Date » et le format de page sont ajoutés automatiquement ;
 * - `state` (facultatif) : état en plus des champs — `save()` renvoie ce qu'il faut mémoriser (et partager, sauf si
 *   `share()` est fourni), `migrate(o)` corrige les anciennes valeurs, `restore(o, q)` lit l'adresse (`q`),
 *   `apply(o)` applique les valeurs lues ;
 * - `ready()` : appelée après la restauration, avant le premier rendu ;
 * - `render({ page, title, showName })` : dessine les feuilles.
 * Renvoie `{ start, draw, seg }` : `start()` restaure et dessine, `draw()` redessine et mémorise, `seg(id)` donne la
 * fonction de rafraîchissement du bouton segmenté `id`.
 */
export function createTool({ id, fields = [], checks = [], state = {}, ready, render }) {
  initNav(id);
  document.querySelector('.panel').append(headerCard(), actionsCard());
  const F = [...fields, 'title', 'page'],
    C = [...checks, 'showName'],
    key = `hs-${id}`;
  const collect = () => {
    const o = {};
    F.forEach((f) => (o[f] = $(f).value));
    C.forEach((f) => (o[f] = $(f).checked));
    return o;
  };
  const segments = new Map(
    [...document.querySelectorAll('select[data-seg]')].map((s) => [s.id, segmented(s)]),
  );

  function draw() {
    applyPage($('page').value);
    render({
      page: pageSize($('page').value),
      title: $('title').value.trim(),
      showName: $('showName').checked,
    });
    try {
      localStorage.setItem(key, JSON.stringify({ ...collect(), ...state.save?.() }));
    } catch {
      /* stockage indisponible */
    }
  }

  [...F, ...C].forEach((f) => $(f).addEventListener('input', draw));
  $('print').addEventListener('click', () => window.print());
  initExport({ svg: $('export-svg'), png: $('export-png') }, id, () => pageSize($('page').value));
  initShare($('share'), () => ({ ...collect(), ...(state.share ?? state.save)?.() }));

  async function start() {
    let o = {};
    try {
      o = JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      /* stockage indisponible */
    }
    state.migrate?.(o);
    const q = readQuery(o, F, C);
    state.restore?.(o, q);
    F.forEach((f) => o[f] != null && ($(f).value = o[f]));
    C.forEach((f) => o[f] != null && ($(f).checked = o[f]));
    state.apply?.(o);
    segments.forEach((refresh) => refresh());
    await ready?.();
    draw();
  }
  return { start, draw, seg: (name) => segments.get(name) };
}
