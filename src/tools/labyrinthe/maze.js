// Labyrinthes parfaits (un seul chemin entre deux cases), reproductibles grâce à une graine.
export function rng(seed) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Directions : 0 haut, 1 droite, 2 bas, 3 gauche.
const DX = [0, 1, 0, -1],
  DY = [-1, 0, 1, 0];

/** Ouvertures possibles sur le bord d'une grille cols x rows : [x, y, d] (case et côté). */
export function rectOpenings(cols, rows) {
  const o = [];
  for (let x = 0; x < cols; x++) o.push([x, 0, 0], [x, rows - 1, 2]);
  for (let y = 0; y < rows; y++) o.push([cols - 1, y, 1], [0, y, 3]);
  return o;
}

/** Distances (en cases) et prédécesseurs depuis la case `from`, en suivant les passages. */
function rectBfs({ cols, rows, walls }, from) {
  const dist = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  const prev = Array.from({ length: rows }, () => new Array(cols).fill(null));
  dist[from[1]][from[0]] = 0;
  const q = [from];
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d],
        ny = y + DY[d];
      if (walls[y][x][d] || nx < 0 || ny < 0 || nx >= cols || ny >= rows || dist[ny][nx] >= 0)
        continue;
      dist[ny][nx] = dist[y][x] + 1;
      prev[ny][nx] = [x, y];
      q.push([nx, ny]);
    }
  }
  return { dist, prev };
}

/**
 * Génère un labyrinthe parfait cols x rows. `walls[y][x][d]` = true si le mur existe.
 * L'entrée est une ouverture du bord tirée au hasard ; la sortie est une autre ouverture du bord, d'autant
 * plus éloignée de l'entrée (dans le labyrinthe) que `far` est proche de 1. `entrance` et `exit` sont [x, y, côté].
 */
export function generate(cols, rows, seed, far = 1) {
  const rand = rng(seed);
  const walls = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => [true, true, true, true]),
  );
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const start = [Math.floor(rand() * cols), Math.floor(rand() * rows)];
  const stack = [start];
  seen[start[1]][start[0]] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = [0, 1, 2, 3].filter((d) => {
      const nx = x + DX[d],
        ny = y + DY[d];
      return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny][nx];
    });
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const d = opts[Math.floor(rand() * opts.length)],
      nx = x + DX[d],
      ny = y + DY[d];
    walls[y][x][d] = false;
    walls[ny][nx][(d + 2) % 4] = false;
    seen[ny][nx] = true;
    stack.push([nx, ny]);
  }
  const m = { cols, rows, walls };
  const openings = rectOpenings(cols, rows);
  const entrance = openings[Math.floor(rand() * openings.length)];
  const { dist } = rectBfs(m, entrance);
  const others = openings
    .filter((o) => o[0] !== entrance[0] || o[1] !== entrance[1])
    .sort((a, b) => dist[a[1]][a[0]] - dist[b[1]][b[0]]);
  const exit = others[Math.round(Math.min(1, Math.max(0, far)) * (others.length - 1))];
  walls[entrance[1]][entrance[0]][entrance[2]] = false;
  walls[exit[1]][exit[0]][exit[2]] = false;
  return { ...m, entrance, exit };
}

/** Chemin de l'entrée à la sortie : liste de cases [x, y]. */
export function solve(m) {
  const { prev } = rectBfs(m, m.entrance);
  const path = [];
  for (let c = [m.exit[0], m.exit[1]]; c; c = prev[c[1]][c[0]]) path.push(c);
  return path.reverse();
}

/** Nombre de passages ouverts d'une case de la grille (sans compter l'entrée et la sortie). */
export const rectDegree = ({ cols, rows, walls }, [x, y]) =>
  [0, 1, 2, 3].filter(
    (d) =>
      !walls[y][x][d] && x + DX[d] >= 0 && y + DY[d] >= 0 && x + DX[d] < cols && y + DY[d] < rows,
  ).length;

/** Nombre d'embranchements sur le chemin : cases où l'on peut se tromper de direction. Mesure de difficulté. */
export const countChoices = (path, degree) =>
  path.reduce((n, c, k) => (k < path.length - 1 && degree(c) - (k ? 2 : 1) > 0 ? n + 1 : n), 0);

/**
 * Parmi `tries` labyrinthes tirés depuis la même graine, renvoie le premier dont la `measure` est dans [lo, hi],
 * sinon le plus proche : la difficulté est homogène d'une graine à l'autre, et le résultat reste reproductible.
 */
export function bestOf(build, measure, [lo, hi], seed, tries = 12) {
  let best = null,
    gap = Infinity;
  for (let j = 0; j < tries; j++) {
    const m = build((seed * 31 + j) >>> 0),
      v = measure(m),
      g = v < lo ? lo - v : v > hi ? v - hi : 0;
    if (g === 0) return m;
    if (g < gap) [best, gap] = [m, g];
  }
  return best;
}

// ---- Labyrinthes ronds : anneaux concentriques, cellules (r, i), centre = (0, 0). Entrée par l'anneau extérieur, arrivée au centre.
const ringCounts = (rings) => {
  const c = [1];
  for (let r = 1; r < rings; r++)
    c.push(
      c[r - 1] * Math.max(1, Math.round((2 * Math.PI * (r / rings)) / c[r - 1] / (1 / rings))),
    );
  return c;
};
const lk = (r, i, r2, i2) =>
  r < r2 || (r === r2 && i < i2) ? `${r}.${i}-${r2}.${i2}` : `${r2}.${i2}-${r}.${i}`;
export const roundLinked = (m, r, i, r2, i2) => m.links.has(lk(r, i, r2, i2));

/** Voisins d'une cellule ronde : [r, i] (même anneau, anneau intérieur, anneau extérieur). */
export function roundNeighbors(m, r, i) {
  const n = m.counts[r],
    out = [];
  if (r === 0) {
    for (let j = 0; j < m.counts[1]; j++) out.push([1, j]);
    return out;
  }
  if (n > 1) {
    out.push([r, (i + 1) % n]);
    if (n > 2) out.push([r, (i + n - 1) % n]);
  }
  out.push([r - 1, Math.floor((i * m.counts[r - 1]) / n)]);
  if (r + 1 < m.rings) {
    const k = m.counts[r + 1] / n;
    for (let j = 0; j < k; j++) out.push([r + 1, i * k + j]);
  }
  return out;
}

/** Labyrinthe rond ; `start` est la cellule d'entrée sur l'anneau extérieur, tirée au hasard. */
export function generateRound(rings, seed) {
  const rand = rng(seed),
    counts = ringCounts(rings),
    start = Math.floor(rand() * counts[rings - 1]),
    m = { rings, counts, links: new Set(), start };
  const seen = counts.map((n) => new Array(n).fill(false));
  const stack = [[rings - 1, start]];
  seen[rings - 1][start] = true;
  while (stack.length) {
    const [r, i] = stack[stack.length - 1];
    const opts = roundNeighbors(m, r, i).filter(([r2, i2]) => !seen[r2][i2]);
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const [r2, i2] = opts[Math.floor(rand() * opts.length)];
    m.links.add(lk(r, i, r2, i2));
    seen[r2][i2] = true;
    stack.push([r2, i2]);
  }
  return m;
}

/** Nombre de passages ouverts d'une cellule ronde. */
export const roundDegree = (m, [r, i]) =>
  roundNeighbors(m, r, i).filter(([r2, i2]) => roundLinked(m, r, i, r2, i2)).length;

/** Chemin de l'entrée (anneau extérieur) au centre : liste de cellules [r, i]. */
export function solveRound(m) {
  const start = [m.rings - 1, m.start],
    prev = new Map([[`${start}`, null]]),
    q = [start];
  for (let h = 0; h < q.length; h++) {
    const [r, i] = q[h];
    if (r === 0) break;
    for (const [r2, i2] of roundNeighbors(m, r, i)) {
      if (prev.has(`${r2},${i2}`) || !m.links.has(lk(r, i, r2, i2))) continue;
      prev.set(`${r2},${i2}`, [r, i]);
      q.push([r2, i2]);
    }
  }
  const path = [];
  for (let c = [0, 0]; c; c = prev.get(`${c}`)) path.push(c);
  return path.reverse();
}

// ---- Labyrinthes en forme libre : grille n x n restreinte à un masque (cœur, triangle…). Entrée et sortie sur le contour.
const inPoly = (u, v, P) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    if (
      P[i][1] > v !== P[j][1] > v &&
      u < ((P[j][0] - P[i][0]) * (v - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]
    )
      c = !c;
  }
  return c;
};
export const regular = (n, r, cx = 0.5, cy = 0.5) =>
  [...Array(n)].map((_, k) => [
    cx + r * Math.sin((2 * Math.PI * k) / n),
    cy - r * Math.cos((2 * Math.PI * k) / n),
  ]);
/** Champ du cœur (≤ 0 à l'intérieur) en coordonnées du carré unité. */
export const heartField = (u, v) => {
  const x = (u - 0.5) * 2.4,
    y = 1.3 - v * 2.4;
  return (x * x + y * y - 1) ** 3 - x * x * y ** 3;
};
export const MASKS = {
  heart: (u, v) => heartField(u, v) <= 0,
  triangle: (u, v) => Math.abs(u - 0.5) <= v / 2,
  diamond: (u, v) => Math.abs(u - 0.5) + Math.abs(v - 0.5) <= 0.5,
  hexagon: (u, v) =>
    inPoly(
      u,
      v,
      regular(6, 0.5).map(([x, y]) => [x, y]),
    ),
};

const DIRS = [0, 1, 2, 3];
/**
 * Génère un labyrinthe parfait dans le masque ; les cases inaccessibles sont retirées. L'entrée est une ouverture
 * du contour tirée au hasard, la sortie une autre ouverture, d'autant plus éloignée que `far` est proche de 1.
 * `entrance` et `exit` sont [x, y, côté].
 */
export function generateMask(shape, n, seed, far = 1) {
  const rand = rng(seed),
    mask = MASKS[shape];
  const inside = Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x) => mask((x + 0.5) / n, (y + 0.5) / n)),
  );
  const ok = (x, y) => x >= 0 && y >= 0 && x < n && y < n && inside[y][x];
  // ouvertures possibles : case de la forme ayant un voisin hors de la forme
  const openings = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (inside[y][x])
        for (const d of DIRS) if (!ok(x + DX[d], y + DY[d])) openings.push([x, y, d]);
  const walls = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => [true, true, true, true]),
  );
  const entrance = openings[Math.floor(rand() * openings.length)];
  const seen = Array.from({ length: n }, () => new Array(n).fill(false));
  const stack = [[entrance[0], entrance[1]]],
    dist = new Map([[`${entrance[0]},${entrance[1]}`, 0]]);
  seen[entrance[1]][entrance[0]] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = DIRS.filter((d) => ok(x + DX[d], y + DY[d]) && !seen[y + DY[d]][x + DX[d]]);
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const d = opts[Math.floor(rand() * opts.length)],
      nx = x + DX[d],
      ny = y + DY[d];
    walls[y][x][d] = false;
    walls[ny][nx][(d + 2) % 4] = false;
    seen[ny][nx] = true;
    dist.set(`${nx},${ny}`, dist.get(`${x},${y}`) + 1);
    stack.push([nx, ny]);
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) inside[y][x] = seen[y][x];
  const others = openings
    .filter(([x, y]) => inside[y][x] && (x !== entrance[0] || y !== entrance[1]))
    .sort((a, b) => dist.get(`${a[0]},${a[1]}`) - dist.get(`${b[0]},${b[1]}`));
  const exit = others[Math.round(Math.min(1, Math.max(0, far)) * (others.length - 1))];
  walls[entrance[1]][entrance[0]][entrance[2]] = false;
  walls[exit[1]][exit[0]][exit[2]] = false;
  return { n, inside, walls, entrance, exit };
}

/** Nombre de passages ouverts d'une case d'un labyrinthe en forme libre (sans compter l'entrée et la sortie). */
export const maskDegree = (m, [x, y]) =>
  DIRS.filter((d) => !m.walls[y][x][d] && m.inside[y + DY[d]]?.[x + DX[d]]).length;

export function solveMask(m) {
  const { n, walls } = m,
    key = (x, y) => y * n + x,
    start = [m.entrance[0], m.entrance[1]],
    prev = new Map([[key(...start), null]]),
    q = [start];
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    if (x === m.exit[0] && y === m.exit[1]) break;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d],
        ny = y + DY[d];
      if (
        walls[y][x][d] ||
        nx < 0 ||
        ny < 0 ||
        nx >= n ||
        ny >= n ||
        !m.inside[ny][nx] ||
        prev.has(key(nx, ny))
      )
        continue;
      prev.set(key(nx, ny), [x, y]);
      q.push([nx, ny]);
    }
  }
  const path = [];
  for (let c = [m.exit[0], m.exit[1]]; c; c = prev.get(key(...c))) path.push(c);
  return path.reverse();
}
