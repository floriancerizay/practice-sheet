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

/** Génère un labyrinthe cols x rows. `walls[y][x][d]` = true si le mur existe. Entrée : haut de (0,0). Sortie : bas de (cols-1,rows-1). */
export function generate(cols, rows, seed) {
  const rand = rng(seed);
  const walls = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => [true, true, true, true]),
  );
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const stack = [[0, 0]];
  seen[0][0] = true;
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
  return { cols, rows, walls };
}

/** Chemin de l'entrée à la sortie : liste de cases [x, y]. */
export function solve({ cols, rows, walls }) {
  const prev = Array.from({ length: rows }, () => new Array(cols).fill(null));
  const q = [[0, 0]];
  prev[0][0] = [-1, -1];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === cols - 1 && y === rows - 1) break;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d],
        ny = y + DY[d];
      if (walls[y][x][d] || nx < 0 || ny < 0 || nx >= cols || ny >= rows || prev[ny][nx]) continue;
      prev[ny][nx] = [x, y];
      q.push([nx, ny]);
    }
  }
  const path = [];
  for (let c = [cols - 1, rows - 1]; c[0] >= 0; c = prev[c[1]][c[0]]) path.push(c);
  return path.reverse();
}

// ---- Labyrinthes ronds : anneaux concentriques, cellules (r, i), centre = (0, 0). Entrée par l'anneau extérieur (cellule 0), arrivée au centre.
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

export function generateRound(rings, seed) {
  const rand = rng(seed),
    counts = ringCounts(rings),
    m = { rings, counts, links: new Set() };
  const seen = counts.map((n) => new Array(n).fill(false));
  const stack = [[rings - 1, 0]];
  seen[rings - 1][0] = true;
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

/** Chemin de l'entrée (anneau extérieur, cellule 0) au centre : liste de cellules [r, i]. */
export function solveRound(m) {
  const start = [m.rings - 1, 0],
    prev = new Map([[`${start}`, null]]),
    q = [start];
  while (q.length) {
    const [r, i] = q.shift();
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

// ---- Labyrinthes en forme libre : grille n x n restreinte à un masque (cœur, triangle…). Entrée par le haut, sortie sur le contour.
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

/** Génère un labyrinthe parfait dans le masque ; les cases inaccessibles sont retirées. */
export function generateMask(shape, n, seed) {
  const rand = rng(seed),
    mask = MASKS[shape];
  const inside = Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x) => mask((x + 0.5) / n, (y + 0.5) / n)),
  );
  const top = inside.findIndex((row) => row.some(Boolean));
  const xs = inside[top].map((v, x) => (v ? x : -1)).filter((x) => x >= 0);
  const entrance = [xs[Math.floor(xs.length / 2)], top];
  const walls = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => [true, true, true, true]),
  );
  const seen = Array.from({ length: n }, () => new Array(n).fill(false));
  const ok = (x, y) => x >= 0 && y >= 0 && x < n && y < n && inside[y][x];
  const stack = [entrance],
    dist = new Map([[`${entrance}`, 0]]);
  seen[entrance[1]][entrance[0]] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = [0, 1, 2, 3].filter(
      (d) => ok(x + DX[d], y + DY[d]) && !seen[y + DY[d]][x + DX[d]],
    );
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
  // sortie : case du contour la plus éloignée de l'entrée (distance dans le labyrinthe), ouverte sur le côté extérieur
  let best = null;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!inside[y][x]) continue;
      const d = [0, 1, 2, 3].find(
        (k) => !ok(x + DX[k], y + DY[k]) && !(x === entrance[0] && y === entrance[1] && k === 0),
      );
      const dd = dist.get(`${x},${y}`);
      if (d !== undefined && (!best || dd > best.dd)) best = { x, y, d, dd };
    }
  walls[entrance[1]][entrance[0]][0] = false;
  walls[best.y][best.x][best.d] = false;
  return { n, inside, walls, entrance, exit: [best.x, best.y, best.d] };
}

export function solveMask(m) {
  const { n, walls } = m,
    key = (x, y) => y * n + x,
    prev = new Map([[key(...m.entrance), null]]),
    q = [m.entrance];
  while (q.length) {
    const [x, y] = q.shift();
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
