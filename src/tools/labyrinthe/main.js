import { $, createTool } from '../../shared/tool.js';
import { renderSheets } from './labyrinthe.js';

const FREE_SHAPES = ['heart', 'triangle', 'diamond', 'hexagon'];
const newSeed = () => Math.floor(Math.random() * 1e6);
// la graine n'est pas affichée : elle change avec « Nouveau labyrinthe » et voyage dans le lien de partage
let seed = newSeed();

const tool = createTool({
  id: 'labyrinthe',
  fields: ['shape', 'style', 'contour', 'level', 'count', 'letterText', 'solution'],
  state: {
    save: () => ({ seed }),
    restore: (o, q) => q.has('seed') && (o.seed = q.get('seed')),
    apply: (o) => {
      if (o.seed != null && Number.isFinite(parseInt(o.seed, 10))) seed = parseInt(o.seed, 10);
    },
  },
  render({ page, title, showName }) {
    const word = $('shape').value === 'word';
    // la grille de mots remplace le style des murs
    $('style-card').hidden = word;
    $('letter-text-row').hidden = !word;
    $('letters-hint').hidden = !word;
    // le contour ne concerne que les formes libres, et pas le style « tubes »
    $('contour-row').hidden =
      !FREE_SHAPES.includes($('shape').value) || $('style').value === 'tubes';
    renderSheets($('sheets'), {
      page,
      title,
      showName,
      shape: $('shape').value,
      style: $('style').value,
      contour: $('contour').value,
      level: $('level').value,
      sheets: Math.min(30, Math.max(1, parseInt($('count').value, 10) || 1)),
      letterText: $('letterText').value,
      seed,
      solution: $('solution').value,
    });
  },
});

$('shuffle').addEventListener('click', () => {
  seed = newSeed();
  tool.draw();
});
await tool.start();
