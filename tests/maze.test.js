import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  generate,
  solve,
  bestOf,
  countChoices,
  rectDegree,
  rectOpenings,
} from '../src/tools/labyrinthe/maze.js';

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
    m.walls.forEach((row, y) =>
      row.forEach((w, x) => {
        // l'entrée et la sortie sont des murs ouverts sur le bord : ce ne sont pas des passages entre deux cases
        if (!w[1] && x < c - 1) open++;
        if (!w[2] && y < r - 1) open++;
      }),
    );
    assert.equal(open, c * r - 1);
    const p = solve(m);
    assert.deepEqual(p[0], [m.entrance[0], m.entrance[1]]);
    assert.deepEqual(p.at(-1), [m.exit[0], m.exit[1]]);
    for (let k = 1; k < p.length; k++)
      assert.equal(Math.abs(p[k][0] - p[k - 1][0]) + Math.abs(p[k][1] - p[k - 1][1]), 1);
  }
});

test('entrée et sortie : ouvertures du bord, distinctes, variables selon la graine', () => {
  const ends = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const m = generate(12, 9, seed);
    for (const [x, y, d] of [m.entrance, m.exit]) {
      assert.ok(rectOpenings(12, 9).some((o) => o[0] === x && o[1] === y && o[2] === d));
      assert.equal(m.walls[y][x][d], false);
    }
    assert.notDeepEqual(m.entrance, m.exit);
    ends.add(`${m.entrance}`);
  }
  assert.ok(ends.size > 10, 'entrances not varied enough');
});

test("far : plus far est grand, plus la sortie est loin de l'entrée", () => {
  let near = 0,
    farther = 0;
  for (let seed = 1; seed <= 30; seed++) {
    near += solve(generate(20, 20, seed, 0.2)).length;
    farther += solve(generate(20, 20, seed, 1)).length;
  }
  assert.ok(farther > near * 1.5, `${near} / ${farther}`);
});

test("bestOf : reproductible, et dans la fourchette quand c'est possible", () => {
  const build = (seed) => generate(14, 19, seed, 0.75);
  const measure = (m) => countChoices(solve(m), (c) => rectDegree(m, c));
  for (const seed of [1, 2, 3, 4, 5]) {
    const a = bestOf(build, measure, [8, 15], seed),
      b = bestOf(build, measure, [8, 15], seed);
    assert.deepEqual(a.walls, b.walls);
    const v = measure(a);
    assert.ok(v >= 8 && v <= 15, `graine ${seed} : ${v} carrefours`);
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
    assert.deepEqual(p[0], [rings - 1, m.start]);
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
      // les ouvertures d'entrée et de sortie ne sont pas des passages entre deux cases
      for (const [x, y, d] of [m.entrance, m.exit])
        if (d === 1 || d === 2) open -= m.walls[y][x][d] ? 0 : 1;
      assert.equal(open, cells - 1, `${shape} ${n}`);
      assert.ok(cells > n, `${shape} ${n} trop petit`);
      const p = solveMask(m);
      assert.deepEqual(p[0], [m.entrance[0], m.entrance[1]]);
      assert.deepEqual(p.at(-1), [m.exit[0], m.exit[1]]);
      assert.equal(m.walls[m.entrance[1]][m.entrance[0]][m.entrance[2]], false);
    }
  }
});
