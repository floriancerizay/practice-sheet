/** Géométrie des murs : chaînage de segments, coins arrondis, contours lisses (marching squares). Aucune dépendance au DOM. */

const f = (n) => +n.toFixed(2);
const key = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;

/**
 * Relie des segments [[x0, y0], [x1, y1]] en chaînes de points. Une chaîne s'arrête aux sommets où se croisent
 * 1, 3 murs ou plus ; ce qui reste (sommets à 2 murs seulement) forme des boucles fermées.
 * @returns {{ points: number[][], closed: boolean }[]}
 */
export function chains(segments) {
  const pos = new Map();
  const adj = new Map();
  const link = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a).add(b);
  };
  for (const [p, q] of segments) {
    const a = key(p),
      b = key(q);
    if (a === b) continue;
    pos.set(a, p);
    pos.set(b, q);
    link(a, b);
    link(b, a);
  }
  const seen = new Set();
  const edge = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const out = [];
  const walk = (start, first) => {
    const points = [pos.get(start)];
    let prev = start,
      cur = first,
      closed = false;
    seen.add(edge(prev, cur));
    for (;;) {
      if (cur === start) {
        closed = true;
        break;
      }
      points.push(pos.get(cur));
      const next = adj.get(cur);
      if (next.size !== 2) break;
      const [n] = [...next].filter((k) => k !== prev);
      if (n === undefined || seen.has(edge(cur, n))) break;
      seen.add(edge(cur, n));
      prev = cur;
      cur = n;
    }
    out.push({ points, closed });
  };
  for (const [k, ns] of adj) {
    if (ns.size === 2) continue;
    for (const n of ns) if (!seen.has(edge(k, n))) walk(k, n);
  }
  for (const [k, ns] of adj) for (const n of ns) if (!seen.has(edge(k, n))) walk(k, n);
  return out;
}

/**
 * Chemin SVG d'une chaîne dont les coins sont arrondis (courbe de Bézier quadratique de rayon `r`).
 * Les sommets presque alignés (virage < `minTurn` radians) restent des points simples.
 */
export function roundedPath(points, closed, r, minTurn = 0.35) {
  const P = (p) => `${f(p[0])} ${f(p[1])}`;
  const n = points.length;
  if (n < 2) return '';
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const corner = (a, v, b) => {
    const [ux, uy] = [v[0] - a[0], v[1] - a[1]],
      [wx, wy] = [b[0] - v[0], b[1] - v[1]];
    const lu = Math.hypot(ux, uy),
      lw = Math.hypot(wx, wy);
    if (!lu || !lw) return `L${P(v)}`;
    const turn = Math.abs(Math.atan2(ux * wy - uy * wx, ux * wx + uy * wy));
    if (turn < minTurn) return `L${P(v)}`;
    const t = Math.min(r, lu / 2, lw / 2);
    const p1 = [v[0] - (ux / lu) * t, v[1] - (uy / lu) * t],
      p2 = [v[0] + (wx / lw) * t, v[1] + (wy / lw) * t];
    return `L${P(p1)}Q${P(v)} ${P(p2)}`;
  };
  if (!closed || n < 3) {
    let d = `M${P(points[0])}`;
    for (let i = 1; i < n - 1; i++) d += corner(points[i - 1], points[i], points[i + 1]);
    return `${d}L${P(points[n - 1])}`;
  }
  const start = mid(points[0], points[1]);
  let d = `M${P(start)}`;
  for (let k = 1; k <= n; k++) {
    const i = k % n;
    d += corner(points[(i + n - 1) % n], points[i], points[(i + 1) % n]);
  }
  return `${d}L${P(start)}Z`;
}

/**
 * Polygone fermé aux coins arrondis, rendu en polyligne dense (pas de `step` au plus) : les ouvertures
 * (openGap) peuvent alors être découpées n'importe où, y compris au milieu d'un long côté.
 */
export function roundedPolyline(points, r, step, minTurn = 0.35) {
  const n = points.length;
  const entries = [],
    exits = [],
    rounded = [];
  for (let i = 0; i < n; i++) {
    const a = points[(i + n - 1) % n],
      v = points[i],
      b = points[(i + 1) % n];
    const [ux, uy] = [v[0] - a[0], v[1] - a[1]],
      [wx, wy] = [b[0] - v[0], b[1] - v[1]];
    const lu = Math.hypot(ux, uy),
      lw = Math.hypot(wx, wy);
    const turn = lu && lw ? Math.abs(Math.atan2(ux * wy - uy * wx, ux * wx + uy * wy)) : 0;
    const t = Math.min(r, lu / 2, lw / 2);
    const ok = turn >= minTurn && t > 0;
    rounded.push(ok);
    entries.push(ok ? [v[0] - (ux / lu) * t, v[1] - (uy / lu) * t] : v);
    exits.push(ok ? [v[0] + (wx / lw) * t, v[1] + (wy / lw) * t] : v);
  }
  const out = [];
  const line = (a, b) => {
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let i = 1; i <= k; i++)
      out.push([a[0] + ((b[0] - a[0]) * i) / k, a[1] + ((b[1] - a[1]) * i) / k]);
  };
  out.push(exits[0]);
  for (let k = 1; k <= n; k++) {
    const i = k % n;
    line(exits[(i + n - 1) % n], entries[i]);
    if (rounded[i]) {
      const [p0, c, p1] = [entries[i], points[i], exits[i]];
      for (let s = 1; s <= 8; s++) {
        const t = s / 8,
          q = 1 - t;
        out.push([
          q * q * p0[0] + 2 * q * t * c[0] + t * t * p1[0],
          q * q * p0[1] + 2 * q * t * c[1] + t * t * p1[1],
        ]);
      }
    }
  }
  out.pop(); // le dernier point redouble le premier
  return out;
}

/** Chemin SVG « polyligne » (sans arrondi). */
export const polyPath = (points, closed = false) =>
  `M${points.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}${closed ? 'Z' : ''}`;

/**
 * Contours de {F <= 0} par marching squares sur une grille res x res couvrant [x0, x1] x [y0, y1].
 * Les points sont interpolés linéairement : le résultat est lisse même avec une grille modeste.
 * @returns {{ points: number[][], closed: boolean }[]}
 */
export function isoLoops(F, [x0, y0, x1, y1], res) {
  const X = (i) => x0 + ((x1 - x0) * i) / res,
    Y = (j) => y0 + ((y1 - y0) * j) / res;
  const v = Array.from({ length: res + 1 }, (_, j) =>
    Array.from({ length: res + 1 }, (_, i) => F(X(i), Y(j))),
  );
  // intersection sur l'arête entre les nœuds (i, j) et (i2, j2) : toujours calculée dans le même sens
  const at = (i, j, i2, j2) => {
    const a = v[j][i],
      b = v[j2][i2];
    const t = a / (a - b);
    return [X(i) + t * (X(i2) - X(i)), Y(j) + t * (Y(j2) - Y(j))];
  };
  const segs = [];
  for (let j = 0; j < res; j++)
    for (let i = 0; i < res; i++) {
      const [a, b, c, d] = [v[j][i], v[j][i + 1], v[j + 1][i + 1], v[j + 1][i]].map((z) => z <= 0);
      const E = {};
      if (a !== b) E.top = at(i, j, i + 1, j);
      if (b !== c) E.right = at(i + 1, j, i + 1, j + 1);
      if (d !== c) E.bottom = at(i, j + 1, i + 1, j + 1);
      if (a !== d) E.left = at(i, j, i, j + 1);
      const k = Object.keys(E);
      if (k.length === 2) segs.push([E[k[0]], E[k[1]]]);
      else if (k.length === 4) {
        segs.push([E.top, E.left]);
        segs.push([E.bottom, E.right]);
      }
    }
  return chains(segs);
}

/** Aire (signée, valeur absolue) d'un polygone. */
export function area(points) {
  let s = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    s += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return Math.abs(s) / 2;
}

/**
 * Retire d'un contour les points situés « devant » une ouverture : à moins de `half` de l'axe qui part de `from`
 * dans la direction `dir` (vecteur unitaire), sur au plus `max` de longueur. Renvoie les morceaux restants (chaînes ouvertes) et l'avancée maximale
 * des points retirés le long de l'axe (pour placer une étiquette).
 */
export function openGap({ points, closed }, from, dir, half, max = Infinity) {
  const gone = points.map((p) => {
    const dx = p[0] - from[0],
      dy = p[1] - from[1];
    const along = dx * dir[0] + dy * dir[1],
      across = Math.abs(dx * dir[1] - dy * dir[0]);
    return along > 0 && along < max && across < half;
  });
  let reach = 0;
  points.forEach((p, i) => {
    if (gone[i]) reach = Math.max(reach, (p[0] - from[0]) * dir[0] + (p[1] - from[1]) * dir[1]);
  });
  if (!gone.some(Boolean)) return { parts: [{ points, closed }], reach: 0 };
  // on démarre juste après un point retiré pour ne pas couper un morceau en deux
  const n = points.length;
  let s = 0;
  if (closed) {
    while (!gone[s]) s++;
  }
  const parts = [];
  let cur = [];
  for (let k = 0; k < n; k++) {
    const i = closed ? (s + 1 + k) % n : k;
    if (gone[i]) {
      if (cur.length > 1) parts.push({ points: cur, closed: false });
      cur = [];
    } else cur.push(points[i]);
  }
  if (cur.length > 1) parts.push({ points: cur, closed: false });
  return { parts, reach };
}
