import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildPages, CONTOURS, STYLES } from '../src/tools/labyrinthe/labyrinthe.js';
import { MASKS } from '../src/tools/labyrinthe/maze.js';
import { pageSize } from '../src/shared/page.js';

const shapes = ['rect', 'round', ...Object.keys(MASKS)];

test('toutes les combinaisons forme x style x contour produisent un SVG sain', () => {
  for (const shape of shapes)
    for (const style of STYLES)
      for (const contour of CONTOURS)
        for (const level of ['facile', 'expert']) {
          const pages = buildPages({
            shape,
            style,
            contour,
            level,
            sheets: 2,
            seed: 7,
            solution: 'end',
            title: '',
            showName: false,
          });
          assert.equal(pages.length, 4, `${shape}/${style}/${contour}`);
          for (const { svg } of pages) {
            assert.ok(!/NaN|undefined|Infinity/.test(svg), `${shape}/${style}/${contour}/${level}`);
            assert.match(svg, /<path d="M/, `${shape}/${style}`);
          }
        }
});

test('tubes : contour puis intérieur, avec l’entrée et la sortie ouvertes (bouts plats)', () => {
  const [{ svg }] = buildPages({
    shape: 'rect',
    style: 'tubes',
    contour: 'cases',
    level: 'moyen',
    sheets: 1,
    seed: 1,
    solution: 'none',
    title: '',
    showName: false,
  });
  assert.equal((svg.match(/stroke="#fff"/g) || []).length, 2);
  assert.equal((svg.match(/stroke-linecap="butt"/g) || []).length, 2);
});

test('flèches d’entrée et de sortie à la place des libellés', () => {
  for (const shape of ['rect', 'round', 'heart']) {
    const [{ svg }] = buildPages({
      shape,
      style: 'droit',
      contour: 'cases',
      level: 'moyen',
      sheets: 1,
      seed: 2,
      solution: 'none',
      title: '',
      showName: false,
    });
    assert.ok(!/Départ|Arrivée/.test(svg), shape);
    assert.ok((svg.match(/<polygon points=/g) || []).length >= (shape === 'round' ? 2 : 2), shape);
  }
});

test('coins arrondis : des courbes de Bézier, absentes du style droit', () => {
  const cfg = {
    shape: 'rect',
    level: 'moyen',
    sheets: 1,
    seed: 3,
    solution: 'none',
    title: '',
    showName: false,
    contour: 'cases',
  };
  assert.match(buildPages({ ...cfg, style: 'arrondi' })[0].svg, /Q/);
  assert.ok(!buildPages({ ...cfg, style: 'droit' })[0].svg.includes('Q'));
});

test('contour lisse : une zone de découpe unique par page, dans les formes libres seulement', () => {
  const base = {
    style: 'droit',
    contour: 'lisse',
    level: 'moyen',
    sheets: 3,
    seed: 5,
    solution: 'sheet',
    title: '',
    showName: false,
  };
  const pages = buildPages({ ...base, shape: 'heart' });
  const ids = pages.map((p) => /clipPath id="([^"]+)"/.exec(p.svg)[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!buildPages({ ...base, shape: 'rect' })[0].svg.includes('clipPath'));
});

test('les valeurs inconnues retombent sur les réglages par défaut', () => {
  const a = buildPages({
    shape: 'rect',
    level: 'moyen',
    sheets: 1,
    seed: 1,
    solution: 'none',
    title: '',
    showName: false,
    style: '??',
    contour: '??',
  });
  const b = buildPages({
    shape: 'rect',
    level: 'moyen',
    sheets: 1,
    seed: 1,
    solution: 'none',
    title: '',
    showName: false,
    style: 'droit',
    contour: 'cases',
  });
  assert.equal(a[0].svg, b[0].svg);
});

test('format de la page : le labyrinthe s’adapte (A4 paysage et A3)', () => {
  const base = {
    shape: 'rect',
    style: 'droit',
    contour: 'cases',
    level: 'moyen',
    sheets: 1,
    seed: 4,
    solution: 'none',
    title: '',
    showName: false,
  };
  const widths = ['A4P', 'A4L', 'A3P', 'A3L'].map((k) => {
    const [{ svg }] = buildPages({ ...base, page: pageSize(k) });
    assert.ok(!/NaN|undefined/.test(svg), k);
    return +/viewBox="0 0 ([\d.]+) /.exec(svg)[1];
  });
  assert.deepEqual(widths, [190, 277, 277, 400]);
});
