import { test } from 'vitest';
import assert from 'node:assert/strict';
import { generate, solve } from '../src/tools/labyrinthe/maze.js';

test('reproductible avec la même graine', () => {
  assert.deepEqual(generate(10, 12, 42).walls, generate(10, 12, 42).walls);
  assert.notDeepEqual(generate(10, 12, 42).walls, generate(10, 12, 43).walls);
});
test('labyrinthe parfait : cols*rows-1 passages et chemin valide', () => {
  for (const [c, r, s] of [
    [8, 11, 1],
    [14, 19, 2],
    [28, 38, 3],
  ]) {
    const m = generate(c, r, s);
    let open = 0;
    m.walls.forEach((row) =>
      row.forEach((w) => {
        if (!w[1]) open++;
        if (!w[2]) open++;
      }),
    );
    assert.equal(open, c * r - 1);
    const p = solve(m);
    assert.deepEqual(p[0], [0, 0]);
    assert.deepEqual(p.at(-1), [c - 1, r - 1]);
    for (let k = 1; k < p.length; k++)
      assert.equal(Math.abs(p[k][0] - p[k - 1][0]) + Math.abs(p[k][1] - p[k - 1][1]), 1);
  }
});

import {
  generateRound,
  solveRound,
  roundNeighbors,
  roundLinked,
} from '../src/tools/labyrinthe/maze.js';

test('labyrinthe rond : arbre couvrant, reproductible, chemin entrée → centre', () => {
  for (const [rings, seed] of [
    [5, 1],
    [8, 2],
    [15, 3],
  ]) {
    const m = generateRound(rings, seed);
    const cells = m.counts.reduce((a, b) => a + b, 0);
    assert.equal(m.links.size, cells - 1);
    assert.deepEqual([...m.links], [...generateRound(rings, seed).links]);
    const p = solveRound(m);
    assert.deepEqual(p[0], [rings - 1, 0]);
    assert.deepEqual(p.at(-1), [0, 0]);
    for (let k = 1; k < p.length; k++) {
      const [a, b] = [p[k - 1], p[k]];
      assert.ok(roundNeighbors(m, ...a).some((n) => n[0] === b[0] && n[1] === b[1]));
      assert.ok(roundLinked(m, ...a, ...b));
    }
  }
});

import { generateMask, solveMask, MASKS } from '../src/tools/labyrinthe/maze.js';

test('labyrinthes en forme : arbre couvrant des cases de la forme, chemin entrée → sortie', () => {
  for (const shape of Object.keys(MASKS)) {
    for (const n of [10, 16, 34]) {
      const m = generateMask(shape, n, 5);
      let cells = 0,
        open = 0;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          if (!m.inside[y][x]) continue;
          cells++;
          if (!m.walls[y][x][1]) open++;
          if (!m.walls[y][x][2]) open++;
        }
      if (m.exit[2] === 1 || m.exit[2] === 2) open--; // l'ouverture de sortie n'est pas un passage entre deux cases
      assert.equal(open, cells - 1, `${shape} ${n}`);
      assert.ok(cells > n, `${shape} ${n} trop petit`);
      const p = solveMask(m);
      assert.deepEqual(p[0], m.entrance);
      assert.deepEqual(p.at(-1), [m.exit[0], m.exit[1]]);
    }
  }
});
