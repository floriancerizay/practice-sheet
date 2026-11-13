import assert from 'node:assert/strict';
import { test } from 'vitest';
import { checkColoring, colorGraph } from '../src/tools/carte/fourcolor.js';

test('grille de pays : coloriage valide en 4 couleurs', () => {
  // graphe planaire : grille 5x5, voisins en croix
  const n = 5;
  const neighbors = Array.from({ length: n * n }, (_, i) => {
    const [x, y] = [i % n, Math.floor(i / n)];
    return [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
      .filter(([a, b]) => a >= 0 && a < n && b >= 0 && b < n)
      .map(([a, b]) => b * n + a);
  });
  const { colors, used } = colorGraph(neighbors);
  assert.ok(used <= 4);
  assert.deepEqual(checkColoring(neighbors, colors), []);
});

test('graphe complet K5 : cinq couleurs nécessaires', () => {
  const neighbors = Array.from({ length: 5 }, (_, i) => [0, 1, 2, 3, 4].filter((j) => j !== i));
  const { colors, used } = colorGraph(neighbors);
  assert.equal(used, 5);
  assert.deepEqual(checkColoring(neighbors, colors), []);
});
