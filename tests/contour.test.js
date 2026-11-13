import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  area,
  chains,
  isoLoops,
  openGap,
  roundedPath,
  roundedPolyline,
} from '../src/tools/labyrinthe/contour.js';
import { OUTLINES } from '../src/tools/labyrinthe/outlines.js';

const square = [
  [
    [0, 0],
    [1, 0],
  ],
  [
    [1, 0],
    [1, 1],
  ],
  [
    [1, 1],
    [0, 1],
  ],
  [
    [0, 1],
    [0, 0],
  ],
];

test('chains : un carré forme une boucle fermée', () => {
  const c = chains(square);
  assert.equal(c.length, 1);
  assert.equal(c[0].closed, true);
  assert.equal(c[0].points.length, 4);
});

test('chains : un T se découpe en trois chaînes ouvertes', () => {
  const c = chains([
    [
      [0, 0],
      [1, 0],
    ],
    [
      [1, 0],
      [2, 0],
    ],
    [
      [1, 0],
      [1, 1],
    ],
  ]);
  assert.equal(c.length, 3);
  assert.ok(c.every((x) => !x.closed && x.points.length === 2));
});

test('chains : un coin à angle droit relie les deux segments', () => {
  const c = chains([
    [
      [0, 0],
      [1, 0],
    ],
    [
      [1, 0],
      [1, 1],
    ],
  ]);
  assert.equal(c.length, 1);
  assert.equal(c[0].points.length, 3);
});

test('roundedPath : les coins droits deviennent des courbes, pas les points alignés', () => {
  const corner = roundedPath(
    [
      [0, 0],
      [10, 0],
      [10, 10],
    ],
    false,
    2,
  );
  assert.match(corner, /Q10 0/);
  const straight = roundedPath(
    [
      [0, 0],
      [5, 0],
      [10, 0],
    ],
    false,
    2,
  );
  assert.ok(!straight.includes('Q'));
  const loop = roundedPath(
    square.map(([a]) => a),
    true,
    0.2,
  );
  assert.equal(loop.match(/Q/g).length, 4);
  assert.ok(loop.endsWith('Z'));
});

test('isoLoops : un disque est un seul contour d’aire proche de πr²', () => {
  const loops = isoLoops((x, y) => x * x + y * y - 1, [-1.5, -1.5, 1.5, 1.5], 60);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].closed, true);
  assert.ok(Math.abs(area(loops[0].points) - Math.PI) < 0.05);
});

test('contours des formes : fermés, dans le carré unité, aire plausible', () => {
  for (const [name, expected] of [
    ['heart', [0.62, 0.65]],
    ['triangle', [0.5, 0.5]],
    ['diamond', [0.5, 0.5]],
    ['hexagon', [0.6, 0.8]],
  ]) {
    const loops = OUTLINES[name]();
    assert.equal(loops.length, 1, name);
    const a = area(loops[0].points);
    assert.ok(a >= expected[0] - 1e-6 && a <= expected[1] + 1e-6, `${name} ${a}`);
    for (const [x, y] of loops[0].points)
      assert.ok(x > -0.06 && x < 1.06 && y > -0.06 && y < 1.06, name);
  }
});

test('openGap : retire la portion du contour devant l’ouverture', () => {
  const loop = {
    points: [
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    closed: true,
  };
  // axe vertical vers le haut depuis le milieu du carré : coupe le bord haut (y = 0)
  const dense = {
    points: [...Array(40)].map((_, k) => [(k / 39) * 10, 0]),
    closed: false,
  };
  const r = openGap(dense, [5, 5], [0, -1], 1, 6);
  assert.equal(r.parts.length, 2);
  assert.ok(Math.abs(r.reach - 5) < 1e-9);
  const whole = openGap(loop, [5, 5], [0, -1], 1, 6);
  assert.equal(whole.parts.length, 1);
  assert.equal(whole.parts[0].closed, false);
});

test('roundedPolyline : polygone dense, coins rognés, aire un peu plus petite', () => {
  const poly = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  const dense = roundedPolyline(poly, 2, 0.5);
  for (let i = 0; i < dense.length; i++) {
    const [a, b] = [dense[i], dense[(i + 1) % dense.length]];
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) <= 0.6, `pas ${i}`);
  }
  const a = area(dense);
  assert.ok(a < 100 && a > 100 - 4 * (4 - Math.PI) * 2 - 1, `aire ${a}`);
});

test('openGap sur un polygone dense : un côté droit peut être ouvert en son milieu', () => {
  const dense = roundedPolyline(
    [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
    ],
    1,
    0.5,
  );
  const { parts, reach } = openGap({ points: dense, closed: true }, [10, 10], [0, -1], 1, 15);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].closed, false);
  assert.ok(Math.abs(reach - 10) < 1e-9);
});
