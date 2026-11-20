import assert from 'node:assert/strict';
import { test } from 'vitest';
import { generateLetters, lettersOf } from '../src/tools/labyrinthe/letters.js';
import { buildPages } from '../src/tools/labyrinthe/labyrinthe.js';
import { pageSize } from '../src/shared/page.js';

const base = (c) => c.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
const adjacent = ([a, b], [c, d]) => Math.abs(a - c) + Math.abs(b - d) === 1;

test('lettersOf : lettres seulement, « A » par défaut', () => {
  assert.deepEqual(lettersOf('Ma-is on!'), ['M', 'a', 'i', 's', 'o', 'n']);
  assert.deepEqual(lettersOf('  12 '), ['A']);
  assert.deepEqual(lettersOf(undefined), ['A']);
});

test("mode « word » : le chemin épelle le mot en boucle, les autres cases n'ont pas ses lettres", () => {
  for (const text of ['MAISON', 'été', 'a']) {
    for (const seed of [1, 2, 3]) {
      const g = generateLetters(7, 10, seed, { text });
      const word = lettersOf(text);
      assert.deepEqual([g.path[0][0], g.path[0][1]], [g.entrance[0], g.entrance[1]]);
      assert.deepEqual([g.path.at(-1)[0], g.path.at(-1)[1]], [g.exit[0], g.exit[1]]);
      g.path.forEach(([x, y], k) => {
        assert.equal(g.cells[y][x], word[k % word.length]);
        if (k) assert.ok(adjacent(g.path[k - 1], [x, y]));
      });
      const onPath = new Set(g.path.map(([x, y]) => `${x},${y}`));
      const letters = new Set(word.map(base));
      g.cells.forEach((row, y) =>
        row.forEach((ch, x) => {
          if (!onPath.has(`${x},${y}`)) assert.ok(!letters.has(base(ch)), `${text} ${ch}`);
        }),
      );
    }
  }
});

test('reproductible avec la même graine', () => {
  const o = { text: 'MAISON' };
  assert.deepEqual(generateLetters(7, 10, 5, o), generateLetters(7, 10, 5, o));
  assert.notDeepEqual(generateLetters(7, 10, 5, o).cells, generateLetters(7, 10, 6, o).cells);
});

test('pages : un labyrinthe différent par feuille, corrigé sur une page à part', () => {
  const cfg = {
    page: pageSize('A4P'),
    style: 'droit',
    level: 'moyen',
    sheets: 3,
    seed: 11,
    solution: 'end',
    title: '',
    showName: false,
  };
  for (const shape of ['rect', 'word']) {
    const pages = buildPages({ ...cfg, shape, letterText: 'MAISON' });
    assert.equal(pages.length, 6, shape);
    assert.equal(new Set(pages.slice(0, 3).map((p) => p.svg)).size, 3, shape);
    for (const { svg } of pages) assert.ok(!/NaN|undefined|Infinity/.test(svg), shape);
    if (shape === 'word') assert.match(pages[0].svg, /<text /);
  }
  assert.equal(buildPages({ ...cfg, sheets: 0, solution: 'none' }).length, 1);
});
