import {
  generate,
  solve,
  generateRound,
  solveRound,
  generateMask,
  solveMask,
  roundLinked,
  roundNeighbors,
  MASKS,
} from './maze.js';
import { chains, openGap, polyPath, roundedPath, roundedPolyline } from './contour.js';
import { OUTLINES } from './outlines.js';
import { headHTML, headHeight } from '../../shared/sheet-header.js';
import { usableHeight, usableWidth } from '../../shared/page.js';

export const LEVELS = { facile: [8, 11], moyen: [14, 19], difficile: [20, 28], expert: [28, 38] };
export const RINGS = { facile: 5, moyen: 8, difficile: 11, expert: 15 };
export const GRID = { facile: 10, moyen: 16, difficile: 24, expert: 34 }; // cases par côté (formes libres)
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
 * Couloirs : polylignes -> tubes (contour sombre, intérieur blanc). Les polylignes de `open` (entrée et sortie) se
 * terminent par un bout plat : le tube reste ouvert, sans trait de fermeture.
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

// ---------------------------------------------------------------- labyrinthe rectangulaire

function rectSegments(m, cell) {
  const segs = [];
  for (let y = 0; y < m.rows; y++)
    for (let x = 0; x < m.cols; x++) {
      const [top, right, bottom, left] = m.walls[y][x],
        X = x * cell,
        Y = y * cell;
      // chaque mur interne n'est tracé qu'une fois (côtés bas et gauche)
      if (top && y === 0 && x > 0)
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
      if (bottom && !(x === m.cols - 1 && y === m.rows - 1))
        segs.push([
          [X, Y + cell],
          [X + cell, Y + cell],
        ]);
    }
  return segs;
}

function rectPassages(m, cell) {
  const c = (x, y) => [(x + 0.5) * cell, (y + 0.5) * cell];
  const open = [
    [[0.5 * cell, 0], c(0, 0)],
    [c(m.cols - 1, m.rows - 1), [(m.cols - 0.5) * cell, m.rows * cell]],
  ];
  const net = [];
  for (let y = 0; y < m.rows; y++)
    for (let x = 0; x < m.cols; x++) {
      if (x + 1 < m.cols && !m.walls[y][x][1]) net.push([c(x, y), c(x + 1, y)]);
      if (y + 1 < m.rows && !m.walls[y][x][2]) net.push([c(x, y), c(x, y + 1)]);
    }
  return { net, open };
}

function mazeSVG(m, cell, o) {
  const tubes = o.style === 'tubes';
  const w = m.cols * cell,
    h = m.rows * cell,
    ox = (o.aw - w) / 2;
  let s = `<g transform="translate(${f(ox)} ${LABEL})">`;
  if (tubes) {
    const { net, open } = rectPassages(m, cell);
    s += tubesMarkup(net, open, cell);
  } else s += wallsPath(wallsD(rectSegments(m, cell), o.style, cell), wallWidth(cell));
  if (o.solution) {
    const pts = solve(m).map(([x, y]) => `${f((x + 0.5) * cell)},${f((y + 0.5) * cell)}`);
    s += `<polyline points="${[`${f(0.5 * cell)},0`, ...pts, `${f((m.cols - 0.5) * cell)},${f(h)}`].join(' ')}" ${solutionStroke(tubes ? TUBE * cell * 0.25 : Math.min(0.9, cell * 0.2))}/>`;
  }
  s += arrowIn([0.5 * cell, 0], [0, -1]);
  s += arrowOut([(m.cols - 0.5) * cell, h], [0, 1]);
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
    ea = Math.PI / n0;
  const arcPts = (r, a0, a1) => {
    const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 36)));
    return Array.from({ length: steps + 1 }, (_, k) => P(r, a0 + ((a1 - a0) * k) / steps));
  };
  const linked = (r, i, r2, i2) => roundLinked(m, r, i, r2, i2);
  let s = '';

  if (tubes) {
    const open = [[P(R, ea), centre(m.rings - 1, 0)]];
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
        if (r === m.rings - 1 && i > 0) add(arcPts(R, a0, a1));
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
        if (r === m.rings - 1 && i > 0) d += arc(R, a0, a1); // bord extérieur, entrée = cellule 0
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

const DXY = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function maskSegments(m, cell, smooth) {
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
  return segs;
}

function maskPassages(m, cell) {
  const c = (x, y) => [(x + 0.5) * cell, (y + 0.5) * cell];
  const [ex, ey] = m.entrance,
    [sx, sy, sd] = m.exit;
  const open = [
    [[c(ex, ey)[0], ey * cell], c(ex, ey)],
    [c(sx, sy), [c(sx, sy)[0] + DXY[sd][0] * cell * 0.5, c(sx, sy)[1] + DXY[sd][1] * cell * 0.5]],
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
  const [ex, ey] = m.entrance,
    [sx, sy, sd] = m.exit;
  const half = cell * 0.45;
  const gaps = [
    { from: c(ex, ey), dir: [0, -1] },
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
  const [ex, ey] = m.entrance,
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
    s += `<g clip-path="url(#${o.clipId})">${wallsPath(wallsD(maskSegments(m, cell, true), o.style, cell), wallWidth(cell))}</g>`;
    s += wallsPath(out.d, wallWidth(cell));
  } else s += wallsPath(wallsD(maskSegments(m, cell, false), o.style, cell), wallWidth(cell));
  // ouvertures : bord de la case, ou contour lisse quand il est plus loin
  const inDist = reach[0] || cell * 0.5,
    outDist = reach[1] || cell * 0.5;
  const gapIn = [c(ex, ey)[0], c(ex, ey)[1] - inDist],
    gapOut = [c(sx, sy)[0] + DXY[sd][0] * outDist, c(sx, sy)[1] + DXY[sd][1] * outDist];
  if (o.solution) {
    const pts = [gapIn, ...solveMask(m).map(([x, y]) => c(x, y)), gapOut];
    s += `<polyline points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" ${solutionStroke(tubes ? TUBE * cell * 0.25 : Math.min(0.9, cell * 0.2))}/>`;
  }
  s += arrowIn(gapIn, [0, -1]);
  s += arrowOut(gapOut, DXY[sd]);
  return s + '</g>';
}

// ---------------------------------------------------------------- pages

/** Une page par labyrinthe ; corrigé : 'none' | 'sheet' (sur la feuille) | 'end' (pages à part à la fin). */
export function buildPages(cfg) {
  const AW = usableWidth(cfg.page),
    AH = usableHeight(cfg.page) - headHeight(cfg),
    round = cfg.shape === 'round',
    style = STYLES.includes(cfg.style) ? cfg.style : 'droit',
    contour = CONTOURS.includes(cfg.contour) ? cfg.contour : 'cases';
  const wrap = (inner) =>
    `<svg class="row-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${AW} ${AH}" width="${AW}mm" height="${AH}mm">${inner}</svg>`;
  let uid = 0;
  const side = Math.min(AW, AH - 2 * LABEL);
  let make;
  if (round) {
    const rings = RINGS[cfg.level] ?? RINGS.moyen,
      R = side / 2;
    make = (k, solution) =>
      wrap(
        roundSVG(generateRound(rings, cfg.seed + k), R, AW / 2, AH / 2, {
          style,
          solution,
          aw: AW,
        }),
      );
  } else if (MASKS[cfg.shape]) {
    const n = GRID[cfg.level] ?? GRID.moyen,
      cell = side / n;
    make = (k, solution) =>
      wrap(
        maskSVG(generateMask(cfg.shape, n, cfg.seed + k), cell, AH, {
          style,
          contour,
          solution,
          aw: AW,
          shape: cfg.shape,
          clipId: `lab-clip-${cfg.seed}-${k}-${uid++}`,
        }),
      );
  } else {
    const [cols, rows] = LEVELS[cfg.level] ?? LEVELS.moyen,
      cell = Math.min(AW / cols, (AH - 2 * LABEL) / rows);
    make = (k, solution) =>
      wrap(mazeSVG(generate(cols, rows, cfg.seed + k), cell, { style, solution, aw: AW }));
  }
  const idx = [...Array(cfg.sheets).keys()];
  const pages = idx.map((k) => ({ title: cfg.title, svg: make(k, cfg.solution === 'sheet') }));
  if (cfg.solution === 'end')
    idx.forEach((k) => pages.push({ title: `Corrigé ${k + 1}`, svg: make(k, true) }));
  return pages;
}

export function renderSheets(target, cfg) {
  target.innerHTML = buildPages(cfg)
    .map((p) => `<section class="sheet">${headHTML({ ...cfg, title: p.title })}${p.svg}</section>`)
    .join('');
}
