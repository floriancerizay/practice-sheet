import {
  generate,
  solve,
  generateRound,
  solveRound,
  generateMask,
  solveMask,
  roundDegree,
  roundLinked,
  roundNeighbors,
  rectDegree,
  maskDegree,
  countChoices,
  bestOf,
  MASKS,
} from './maze.js';
import { chains, openGap, polyPath, roundedPath, roundedPolyline } from './contour.js';
import { OUTLINES } from './outlines.js';
import { generateLetters } from './letters.js';
import { esc, headHeight } from '../../shared/sheet-header.js';
import { renderPages, rowBox } from '../../shared/sheets.js';
import { usableHeight, usableWidth } from '../../shared/page.js';

export const LEVELS = { facile: [8, 11], moyen: [14, 19], difficile: [20, 28], expert: [28, 38] };
export const RINGS = { facile: 5, moyen: 8, difficile: 11, expert: 15 };
export const GRID = { facile: 10, moyen: 16, difficile: 24, expert: 34 }; // cases par côté (formes libres)
export const LETTER_GRID = { facile: [5, 7], moyen: [7, 10], difficile: [9, 13], expert: [11, 16] }; // labyrinthes de lettres
/** Éloignement de la sortie (0 : près de l'entrée, 1 : le plus loin possible), par niveau. */
export const FAR = { facile: 0.6, moyen: 0.75, difficile: 0.9, expert: 1 };
/**
 * Difficulté visée : nombre d'embranchements sur le chemin de l'entrée à la sortie, par forme et par niveau.
 * Plusieurs labyrinthes sont tirés (même graine) jusqu'à en trouver un dans la fourchette.
 */
export const CHOICES = {
  rect: { facile: [4, 9], moyen: [8, 15], difficile: [15, 26], expert: [28, 44] },
  round: { facile: [2, 6], moyen: [5, 12], difficile: [8, 18], expert: [14, 28] },
  mask: { facile: [3, 6], moyen: [8, 13], difficile: [14, 22], expert: [26, 40] },
};
/** Graine d'une feuille : les feuilles d'un même lot sont toutes différentes. */
export const sheetSeed = (seed, k) => (seed + k * 7919) >>> 0;
/** Styles de murs : traits droits, coins arrondis, ou couloirs dessinés comme des tubes. */
export const STYLES = ['droit', 'arrondi', 'tubes'];
/** Contour des formes libres : en escalier (cases) ou lisse. */
export const CONTOURS = ['cases', 'lisse'];
const LABEL = 6; // bande réservée aux libellés (mm)
const TUBE = 0.55; // largeur d'un tube, en fraction de la case
const OW = 0.3; // demi-épaisseur du trait de contour d'un tube (mm)
const ARROW = 5; // longueur des flèches d'entrée et de sortie (mm)
const f = (n) => +n.toFixed(2);

const wallWidth = (cell) => Math.min(0.7, cell * 0.12);
const solutionStroke = (w) =>
  `fill="none" stroke="#d03030" stroke-width="${f(w)}" stroke-linejoin="round" stroke-linecap="round"`;
/** Flèche pleine allant de `tail` à `tip`. */
function arrow(tail, tip) {
  const dx = tip[0] - tail[0],
    dy = tip[1] - tail[1],
    l = Math.hypot(dx, dy) || 1;
  const u = [dx / l, dy / l],
    v = [-u[1], u[0]];
  const base = [tip[0] - u[0] * 2.3, tip[1] - u[1] * 2.3];
  const pt = (p, k, w) => [p[0] + v[0] * k * w, p[1] + v[1] * k * w];
  const pts = [
    pt(tail, 1, 0.5),
    pt(base, 1, 0.5),
    pt(base, 1, 1.8),
    tip,
    pt(base, -1, 1.8),
    pt(base, -1, 0.5),
    pt(tail, -1, 0.5),
  ];
  return `<polygon points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="#111" stroke="#111" stroke-width="0.3" stroke-linejoin="round"/>`;
}
/** Flèche d'entrée : pointe vers le labyrinthe, au bord de l'ouverture `gap`, côté `out` (vecteur unitaire vers l'extérieur). */
const arrowIn = (gap, out) =>
  arrow(
    [gap[0] + out[0] * (0.6 + ARROW), gap[1] + out[1] * (0.6 + ARROW)],
    [gap[0] + out[0] * 0.6, gap[1] + out[1] * 0.6],
  );
/** Flèche de sortie : part de l'ouverture `gap` vers l'extérieur. */
const arrowOut = (gap, out) =>
  arrow(
    [gap[0] + out[0] * 0.6, gap[1] + out[1] * 0.6],
    [gap[0] + out[0] * (0.6 + ARROW), gap[1] + out[1] * (0.6 + ARROW)],
  );

/** Segments de murs -> chemin SVG : traits droits, ou chaînes à coins arrondis. */
function wallsD(segs, style, cell) {
  if (style === 'arrondi') {
    return chains(segs)
      .map((c) => roundedPath(c.points, c.closed, Math.min(cell * 0.3, 3)))
      .join('');
  }
  return segs.map(([a, b]) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`).join('');
}
const wallsPath = (d, w) =>
  `<path d="${d}" fill="none" stroke="#111" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * Couloirs : polylignes -> tubes (contour sombre, intérieur blanc). Les polylignes de `open` (entrée et sortie)
 * se terminent par un bout plat : le tube reste ouvert, sans trait de fermeture.
 */
function tubesMarkup(net, open, cell) {
  const W = TUBE * cell;
  const layer = (polys, cap, color, width) =>
    polys.length
      ? `<path d="${polys.map((p) => polyPath(p)).join('')}" fill="none" stroke="${color}" stroke-width="${f(width)}" stroke-linecap="${cap}" stroke-linejoin="round"/>`
      : '';
  return (
    layer(net, 'round', '#111', W + 2 * OW) +
    layer(open, 'butt', '#111', W + 2 * OW) +
    layer(net, 'round', '#fff', W) +
    layer(open, 'butt', '#fff', W)
  );
}

const DXY = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

// ---------------------------------------------------------------- labyrinthe rectangulaire

function rectSegments(m, cell) {
  const segs = [];
  for (let y = 0; y < m.rows; y++)
    for (let x = 0; x < m.cols; x++) {
      const [top, right, bottom, left] = m.walls[y][x],
        X = x * cell,
        Y = y * cell;
      // chaque mur interne n'est tracé qu'une fois (côtés bas et gauche) ; l'entrée et la sortie sont des murs ouverts
      if (top && y === 0)
        segs.push([
          [X, Y],
          [X + cell, Y],
        ]);
      if (left)
        segs.push([
          [X, Y],
          [X, Y + cell],
        ]);
      if (right && x === m.cols - 1)
        segs.push([
          [X + cell, Y],
          [X + cell, Y + cell],
        ]);
      if (bottom)
        segs.push([
          [X, Y + cell],
          [X + cell, Y + cell],
        ]);
    }
  return segs;
}

/** Centre d'une case et milieu du côté `d` de cette case. */
const cellCentre = (x, y, cell) => [(x + 0.5) * cell, (y + 0.5) * cell];
const edgeMid = (x, y, d, cell) => {
  const c = cellCentre(x, y, cell);
  return [c[0] + DXY[d][0] * cell * 0.5, c[1] + DXY[d][1] * cell * 0.5];
};

function rectPassages(m, cell) {
  const c = (x, y) => cellCentre(x, y, cell);
  const [ex, ey, ed] = m.entrance,
    [sx, sy, sd] = m.exit;
  const open = [
    [edgeMid(ex, ey, ed, cell), c(ex, ey)],
    [c(sx, sy), edgeMid(sx, sy, sd, cell)],
  ];
  const net = [];
  for (let y = 0; y < m.rows; y++)
    for (let x = 0; x < m.cols; x++) {
      if (x + 1 < m.cols && !m.walls[y][x][1]) net.push([c(x, y), c(x + 1, y)]);
      if (y + 1 < m.rows && !m.walls[y][x][2]) net.push([c(x, y), c(x, y + 1)]);
    }
  return { net, open };
}

function mazeSVG(m, cell, AH, o) {
  const tubes = o.style === 'tubes';
  const w = m.cols * cell,
    h = m.rows * cell,
    ox = (o.aw - w) / 2,
    oy = (AH - h) / 2;
  const [ex, ey, ed] = m.entrance,
    [sx, sy, sd] = m.exit;
  const gapIn = edgeMid(ex, ey, ed, cell),
    gapOut = edgeMid(sx, sy, sd, cell);
  let s = `<g transform="translate(${f(ox)} ${f(oy)})">`;
  if (tubes) {
    const { net, open } = rectPassages(m, cell);
    s += tubesMarkup(net, open, cell);
  } else s += wallsPath(wallsD(rectSegments(m, cell), o.style, cell), wallWidth(cell));
  if (o.solution) {
    const pts = [gapIn, ...solve(m).map(([x, y]) => cellCentre(x, y, cell)), gapOut];
    s += `<polyline points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" ${solutionStroke(tubes ? TUBE * cell * 0.25 : Math.min(0.9, cell * 0.2))}/>`;
  }
  s += arrowIn(gapIn, DXY[ed]);
  s += arrowOut(gapOut, DXY[sd]);
  return s + '</g>';
}

// ---------------------------------------------------------------- labyrinthe rond

const TAU = 2 * Math.PI;

function roundSVG(m, R, cx, cy, o) {
  const tubes = o.style === 'tubes';
  const dr = R / m.rings;
  const P = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const centre = (r, i) =>
    r === 0 ? [cx, cy] : P((r + 0.5) * dr, (TAU * (i + 0.5)) / m.counts[r]);
  const n0 = m.counts[m.rings - 1],
    ea = (TAU * (m.start + 0.5)) / n0;
  const arcPts = (r, a0, a1) => {
    const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 36)));
    return Array.from({ length: steps + 1 }, (_, k) => P(r, a0 + ((a1 - a0) * k) / steps));
  };
  const linked = (r, i, r2, i2) => roundLinked(m, r, i, r2, i2);
  let s = '';

  if (tubes) {
    const open = [[P(R, ea), centre(m.rings - 1, m.start)]];
    const polys = [];
    for (let r = 1; r < m.rings; r++)
      for (let i = 0; i < m.counts[r]; i++) {
        const a = (TAU * (i + 0.5)) / m.counts[r];
        for (const [r2, i2] of roundNeighbors(m, r, i)) {
          if (!linked(r, i, r2, i2) || r2 < r || (r2 === r && i2 < i)) continue;
          if (r2 === r) {
            // même anneau : arc de centre à centre
            let da = (TAU * (i2 + 0.5)) / m.counts[r] - a;
            da = ((((da + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
            polys.push(arcPts((r + 0.5) * dr, a, a + da));
          } else if (r2 > r) {
            // vers l'anneau extérieur : radial à l'angle de la cellule extérieure, puis arc jusqu'à son centre
            const a2 = (TAU * (i2 + 0.5)) / m.counts[r2];
            polys.push([
              centre(r2, i2),
              P(r2 * dr, a2),
              P((r2 - 0.5) * dr, a2),
              ...arcPts((r2 - 0.5) * dr, a2, a).slice(1),
            ]);
          }
        }
      }
    // liaisons avec le centre : radiales directes
    for (let i = 0; i < m.counts[1]; i++)
      if (linked(0, 0, 1, i)) polys.push([centre(1, i), [cx, cy]]);
    s += tubesMarkup(polys, open, dr);
  } else if (o.style === 'arrondi') {
    const segs = [];
    const add = (pts) => pts.slice(1).forEach((q, k) => segs.push([pts[k], q]));
    for (let r = 1; r < m.rings; r++) {
      const n = m.counts[r],
        k = n / m.counts[r - 1];
      for (let i = 0; i < n; i++) {
        const a0 = (TAU * i) / n,
          a1 = (TAU * (i + 1)) / n;
        if (!linked(r, i, r - 1, Math.floor(i / k))) add(arcPts(r * dr, a0, a1));
        if (!linked(r, i, r, (i + 1) % n)) segs.push([P(r * dr, a1), P((r + 1) * dr, a1)]);
        if (r === m.rings - 1 && i !== m.start) add(arcPts(R, a0, a1));
      }
    }
    s += wallsPath(wallsD(segs, 'arrondi', dr), wallWidth(dr));
  } else {
    const arc = (r, a0, a1) => {
      const [x0, y0] = P(r, a0),
        [x1, y1] = P(r, a1);
      return `M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y1)}`;
    };
    let d = '';
    for (let r = 1; r < m.rings; r++) {
      const n = m.counts[r],
        k = n / m.counts[r - 1];
      for (let i = 0; i < n; i++) {
        const a0 = (TAU * i) / n,
          a1 = (TAU * (i + 1)) / n;
        if (!linked(r, i, r - 1, Math.floor(i / k))) d += arc(r * dr, a0, a1); // mur intérieur
        if (!linked(r, i, r, (i + 1) % n)) {
          const [x0, y0] = P(r * dr, a1),
            [x1, y1] = P((r + 1) * dr, a1);
          d += `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`;
        } // mur radial
        if (r === m.rings - 1 && i !== m.start) d += arc(R, a0, a1); // bord extérieur, sauf l'entrée
      }
    }
    s += wallsPath(d, wallWidth(dr));
  }

  if (o.solution) {
    const mid = centre;
    const cells = solveRound(m),
      pts = [P(R, ea)];
    cells.forEach(([r, i], k) => {
      if (k) {
        const [pr, pi] = cells[k - 1];
        if (pr === r) {
          // même anneau : on suit l'arc
          const n = m.counts[r],
            a = (TAU * (pi + 0.5)) / n;
          let da = (TAU * (i + 0.5)) / n - a;
          da = ((((da + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
          for (let t = 1; t < 6; t++) pts.push(P((r + 0.5) * dr, a + (da * t) / 6));
        } else {
          // changement d'anneau : on passe par la frontière, à l'angle de la cellule extérieure
          const [hr, hi] = r > pr ? [r, i] : [pr, pi];
          pts.push(P(Math.max(r, pr) * dr, (TAU * (hi + 0.5)) / m.counts[hr]));
        }
      }
      pts.push(mid(r, i));
    });
    s += `<polyline points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" ${solutionStroke(tubes ? TUBE * dr * 0.25 : Math.min(0.9, dr * 0.2))}/>`;
  }
  const sr = tubes ? TUBE * dr * 0.4 : Math.min(dr * 0.45, 3.5); // étoile d'arrivée au centre
  s += `<polygon points="${[...Array(10)]
    .map((_, k) =>
      P(k % 2 ? sr * 0.45 : sr, (Math.PI * k) / 5)
        .map(f)
        .join(','),
    )
    .join(' ')}" fill="#111"/>`;
  return s + arrowIn(P(R, ea), [Math.sin(ea), -Math.cos(ea)]);
}

// ---------------------------------------------------------------- formes libres (cœur, triangle…)

/** Distance le long du rayon `p + t·d` jusqu'à la première intersection avec les contours fermés `loops` (Infinity si aucune). */
function rayHit(loops, p, d, max) {
  let best = Infinity;
  for (const pts of loops)
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      const ex = b[0] - a[0],
        ey = b[1] - a[1];
      const den = d[0] * ey - d[1] * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den,
        u = ((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) / den;
      if (t > 1e-6 && t < best && t <= max && u >= 0 && u <= 1) best = t;
    }
  return best;
}
/** Point le plus proche de `p` sur les contours `loops` : { pt, dist }. */
function nearestOnLoops(loops, p) {
  let best = { pt: p, dist: Infinity };
  for (const pts of loops)
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      const ex = b[0] - a[0],
        ey = b[1] - a[1];
      const u = Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / (ex * ex + ey * ey || 1)),
      );
      const q = [a[0] + u * ex, a[1] + u * ey],
        dist = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (dist < best.dist) best = { pt: q, dist };
    }
  return best;
}

/**
 * Contour lisse : les murs du bord de la grille sont remplacés par la courbe, donc un mur qui finit sur le bord
 * peut s'arrêter avant elle. On prolonge chaque extrémité libre (un seul mur y arrive) qui touche l'extérieur
 * jusqu'à la courbe : en ligne droite si elle est à moins d'une case et demie, sinon par un petit trait vers
 * son point le plus proche.
 */
function reachContour(segs, m, cell, loops) {
  const key = (p) => `${Math.round(p[0] / cell)},${Math.round(p[1] / cell)}`;
  const degree = new Map();
  for (const [a, b] of segs)
    for (const p of [a, b]) degree.set(key(p), (degree.get(key(p)) ?? 0) + 1);
  // l'extrémité touche l'extérieur si l'une des quatre cases autour du sommet est hors de la forme
  const onEdge = (p) => {
    const vx = Math.round(p[0] / cell),
      vy = Math.round(p[1] / cell);
    return [
      [vx - 1, vy - 1],
      [vx, vy - 1],
      [vx - 1, vy],
      [vx, vy],
    ].some(([x, y]) => !m.inside[y]?.[x]);
  };
  const extra = [];
  const out = segs.map((seg) => {
    const ends = [seg[0], seg[1]].map((p, i) => {
      const q = seg[1 - i];
      if (degree.get(key(p)) !== 1 || !onEdge(p)) return p;
      const len = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1,
        d = [(p[0] - q[0]) / len, (p[1] - q[1]) / len];
      const t = rayHit(loops, p, d, cell * 1.5);
      if (t < Infinity) return [p[0] + d[0] * (t + 0.3), p[1] + d[1] * (t + 0.3)];
      const near = nearestOnLoops(loops, p);
      if (near.dist > 1e-6 && near.dist < cell * 0.9) extra.push([p, near.pt]);
      return p;
    });
    return ends;
  });
  return [...out, ...extra];
}

function maskSegments(m, cell, smooth, loops) {
  const segs = [];
  for (let y = 0; y < m.n; y++)
    for (let x = 0; x < m.n; x++) {
      if (!m.inside[y][x]) continue;
      const [top, right, bottom, left] = m.walls[y][x],
        X = x * cell,
        Y = y * cell;
      const out = (dx, dy) => !m.inside[y + dy]?.[x + dx]; // voisin hors de la forme : le mur n'est dessiné que de ce côté
      // contour lisse : les murs du bord sont remplacés par la courbe de la forme
      if (top && out(0, -1) && !smooth)
        segs.push([
          [X, Y],
          [X + cell, Y],
        ]);
      if (left && !(smooth && out(-1, 0)))
        segs.push([
          [X, Y],
          [X, Y + cell],
        ]);
      if (right && out(1, 0) && !smooth)
        segs.push([
          [X + cell, Y],
          [X + cell, Y + cell],
        ]);
      if (bottom && !(smooth && out(0, 1)))
        segs.push([
          [X, Y + cell],
          [X + cell, Y + cell],
        ]);
    }
  return smooth ? reachContour(segs, m, cell, loops) : segs;
}

function maskPassages(m, cell) {
  const c = (x, y) => [(x + 0.5) * cell, (y + 0.5) * cell];
  const [ex, ey, ed] = m.entrance,
    [sx, sy, sd] = m.exit;
  const open = [
    [edgeMid(ex, ey, ed, cell), c(ex, ey)],
    [c(sx, sy), edgeMid(sx, sy, sd, cell)],
  ];
  const net = [];
  for (let y = 0; y < m.n; y++)
    for (let x = 0; x < m.n; x++) {
      if (!m.inside[y][x]) continue;
      if (x + 1 < m.n && m.inside[y][x + 1] && !m.walls[y][x][1]) net.push([c(x, y), c(x + 1, y)]);
      if (y + 1 < m.n && m.inside[y + 1]?.[x] && !m.walls[y][x][2])
        net.push([c(x, y), c(x, y + 1)]);
    }
  return { net, open };
}

/** Contour lisse de la forme (coins arrondis), ouvert devant l'entrée et la sortie. */
function smoothOutline(shape, m, cell) {
  const N = m.n * cell,
    rad = N * 0.035;
  const loops = OUTLINES[shape]().map(({ points }) =>
    roundedPolyline(
      points.map(([u, v]) => [u * N, v * N]),
      rad,
      cell / 6,
    ),
  );
  const c = (x, y) => [(x + 0.5) * cell, (y + 0.5) * cell];
  const [ex, ey, ed] = m.entrance,
    [sx, sy, sd] = m.exit;
  const half = cell * 0.45;
  const gaps = [
    { from: c(ex, ey), dir: DXY[ed] },
    { from: c(sx, sy), dir: DXY[sd] },
  ];
  let parts = loops.map((points) => ({ points, closed: true })),
    reach = [0, 0];
  gaps.forEach((g, k) => {
    const next = [];
    for (const p of parts) {
      const r = openGap(p, g.from, g.dir, half, cell * 1.6);
      reach[k] = Math.max(reach[k], r.reach);
      next.push(...r.parts);
    }
    parts = next;
  });
  return {
    loops,
    clip: loops.map((l) => polyPath(l, true)).join(''),
    d: parts.map((p) => polyPath(p.points, p.closed)).join(''),
    reach,
  };
}

function maskSVG(m, cell, AH, o) {
  const tubes = o.style === 'tubes';
  const smooth = o.contour === 'lisse' && !tubes && OUTLINES[o.shape];
  const ox = (o.aw - m.n * cell) / 2,
    oy = (AH - m.n * cell) / 2;
  const c = (x, y) => [(x + 0.5) * cell, (y + 0.5) * cell];
  const [ex, ey, ed] = m.entrance,
    [sx, sy, sd] = m.exit;
  let s = `<g transform="translate(${f(ox)} ${f(oy)})">`;
  let reach = [0, 0];
  if (tubes) {
    const { net, open } = maskPassages(m, cell);
    s += tubesMarkup(net, open, cell);
  } else if (smooth) {
    const out = smoothOutline(o.shape, m, cell);
    reach = out.reach;
    s += `<clipPath id="${o.clipId}"><path d="${out.clip}"/></clipPath>`;
    s += `<g clip-path="url(#${o.clipId})">${wallsPath(wallsD(maskSegments(m, cell, true, out.loops), o.style, cell), wallWidth(cell))}</g>`;
    s += wallsPath(out.d, wallWidth(cell));
  } else s += wallsPath(wallsD(maskSegments(m, cell, false), o.style, cell), wallWidth(cell));
  // ouvertures : bord de la case, ou contour lisse quand il est plus loin
  const inDist = reach[0] || cell * 0.5,
    outDist = reach[1] || cell * 0.5;
  const gapIn = [c(ex, ey)[0] + DXY[ed][0] * inDist, c(ex, ey)[1] + DXY[ed][1] * inDist],
    gapOut = [c(sx, sy)[0] + DXY[sd][0] * outDist, c(sx, sy)[1] + DXY[sd][1] * outDist];
  if (o.solution) {
    const pts = [gapIn, ...solveMask(m).map(([x, y]) => c(x, y)), gapOut];
    s += `<polyline points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" ${solutionStroke(tubes ? TUBE * cell * 0.25 : Math.min(0.9, cell * 0.2))}/>`;
  }
  s += arrowIn(gapIn, DXY[ed]);
  s += arrowOut(gapOut, DXY[sd]);
  return s + '</g>';
}

// ---------------------------------------------------------------- labyrinthe de lettres

function lettersSVG(g, cell, AH, o) {
  const w = g.cols * cell,
    h = g.rows * cell,
    ox = (o.aw - w) / 2,
    oy = (AH - h) / 2;
  const [ex, ey, ed] = g.entrance,
    [sx, sy, sd] = g.exit;
  const gapIn = edgeMid(ex, ey, ed, cell),
    gapOut = edgeMid(sx, sy, sd, cell);
  let s = `<g transform="translate(${f(ox)} ${f(oy)})">`;
  // grille légère, puis cadre épais ouvert à l'entrée et à la sortie
  let grid = '';
  for (let x = 1; x < g.cols; x++) grid += `M${f(x * cell)} 0V${f(h)}`;
  for (let y = 1; y < g.rows; y++) grid += `M0 ${f(y * cell)}H${f(w)}`;
  s += `<path d="${grid}" fill="none" stroke="#999" stroke-width="0.25"/>`;
  const open = new Set([`${ex},${ey},${ed}`, `${sx},${sy},${sd}`]);
  let frame = '';
  const side = (x, y, d, [x0, y0], [x1, y1]) => {
    if (!open.has(`${x},${y},${d}`)) frame += `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`;
  };
  for (let x = 0; x < g.cols; x++) {
    side(x, 0, 0, [x * cell, 0], [(x + 1) * cell, 0]);
    side(x, g.rows - 1, 2, [x * cell, h], [(x + 1) * cell, h]);
  }
  for (let y = 0; y < g.rows; y++) {
    side(0, y, 3, [0, y * cell], [0, (y + 1) * cell]);
    side(g.cols - 1, y, 1, [w, y * cell], [w, (y + 1) * cell]);
  }
  s += wallsPath(frame, wallWidth(cell));
  // corrigé : large trait translucide sous les lettres, pour qu'elles restent lisibles
  if (o.solution) {
    const pts = [gapIn, ...g.path.map(([x, y]) => cellCentre(x, y, cell)), gapOut];
    s += `<polyline points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="none" stroke="#d03030" stroke-opacity="0.35" stroke-width="${f(cell * 0.45)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const size = cell * 0.5;
  s += `<g font-family="Andika, sans-serif" font-size="${f(size)}" text-anchor="middle" fill="#111">`;
  for (let y = 0; y < g.rows; y++)
    for (let x = 0; x < g.cols; x++)
      s += `<text x="${f((x + 0.5) * cell)}" y="${f((y + 0.5) * cell + size * 0.35)}">${esc(g.cells[y][x])}</text>`;
  s += '</g>';
  s += arrowIn(gapIn, DXY[ed]);
  s += arrowOut(gapOut, DXY[sd]);
  return s + '</g>';
}

// ---------------------------------------------------------------- pages

/**
 * Pages du lot : `cfg.sheets` labyrinthes, tous différents (une page chacun). Corrigé : 'none' | 'sheet' (sur la
 * feuille) | 'end' (pages à part à la fin). La forme 'word' remplace les murs par une grille de lettres.
 */
export function buildPages(cfg) {
  const AW = usableWidth(cfg.page),
    AH = usableHeight(cfg.page) - headHeight(cfg),
    round = cfg.shape === 'round',
    level = LEVELS[cfg.level] ? cfg.level : 'moyen',
    style = STYLES.includes(cfg.style) ? cfg.style : 'droit',
    contour = CONTOURS.includes(cfg.contour) ? cfg.contour : 'cases',
    sheets = Math.min(30, Math.max(1, Math.floor(cfg.sheets) || 1));
  const wrap = (inner) => rowBox(cfg.page, AH, inner);
  let uid = 0;
  // marge pour les flèches d'entrée et de sortie, qui peuvent être de n'importe quel côté
  const side = Math.min(AW - 2 * LABEL, AH - 2 * LABEL);
  let make;
  if (cfg.shape === 'word') {
    const [cols, rows] = LETTER_GRID[level],
      cell = Math.min((AW - 2 * LABEL) / cols, (AH - 2 * LABEL) / rows);
    make = (k, solution) =>
      wrap(
        lettersSVG(
          generateLetters(cols, rows, sheetSeed(cfg.seed, k), {
            text: cfg.letterText,
            far: FAR[level],
          }),
          cell,
          AH,
          { solution, aw: AW },
        ),
      );
  } else if (round) {
    const rings = RINGS[level],
      R = side / 2;
    make = (k, solution) =>
      wrap(
        roundSVG(
          bestOf(
            (seed) => generateRound(rings, seed),
            (m) => countChoices(solveRound(m), (c) => roundDegree(m, c)),
            CHOICES.round[level],
            sheetSeed(cfg.seed, k),
          ),
          R,
          AW / 2,
          AH / 2,
          { style, solution, aw: AW },
        ),
      );
  } else if (MASKS[cfg.shape]) {
    const n = GRID[level],
      cell = side / n;
    make = (k, solution) =>
      wrap(
        maskSVG(
          bestOf(
            (seed) => generateMask(cfg.shape, n, seed, FAR[level]),
            (m) => countChoices(solveMask(m), (c) => maskDegree(m, c)),
            CHOICES.mask[level],
            sheetSeed(cfg.seed, k),
          ),
          cell,
          AH,
          {
            style,
            contour,
            solution,
            aw: AW,
            shape: cfg.shape,
            clipId: `lab-clip-${cfg.seed}-${k}-${uid++}`,
          },
        ),
      );
  } else {
    const [cols, rows] = LEVELS[level],
      cell = Math.min((AW - 2 * LABEL) / cols, (AH - 2 * LABEL) / rows);
    make = (k, solution) =>
      wrap(
        mazeSVG(
          bestOf(
            (seed) => generate(cols, rows, seed, FAR[level]),
            (m) => countChoices(solve(m), (c) => rectDegree(m, c)),
            CHOICES.rect[level],
            sheetSeed(cfg.seed, k),
          ),
          cell,
          AH,
          { style, solution, aw: AW },
        ),
      );
  }
  const idx = [...Array(sheets).keys()];
  const pages = idx.map((k) => ({ title: cfg.title, svg: make(k, cfg.solution === 'sheet') }));
  if (cfg.solution === 'end')
    idx.forEach((k) => pages.push({ title: `Corrigé ${k + 1}`, svg: make(k, true) }));
  return pages;
}

export function renderSheets(target, cfg) {
  renderPages(
    target,
    cfg,
    buildPages(cfg).map((p) => ({ title: p.title, html: p.svg })),
  );
}
