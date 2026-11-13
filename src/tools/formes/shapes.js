// Formes et traits à tracer. Boîte 100 de haut (y vers le bas) ; largeur `w` (100 par défaut).
// `start` = point de départ, `dir` = sens du geste au départ (vecteur), `closed` = figure fermée.
const f = (n) => +n.toFixed(2);
const pts = (a) => a.map(([x, y], k) => `${k ? 'L' : 'M'}${f(x)} ${f(y)}`).join(' ');

/** Polygone régulier à n côtés, premier sommet en haut, sens horaire. */
export function polygon(n, r = 47, cx = 50, cy = 52) {
  const v = [...Array(n)].map((_, k) => [
    cx + r * Math.sin((2 * Math.PI * k) / n),
    cy - r * Math.cos((2 * Math.PI * k) / n),
  ]);
  return { d: pts(v) + ' Z', start: v[0], dir: [v[1][0] - v[0][0], v[1][1] - v[0][1]] };
}
function star(n = 5, R = 48, r = 20, cx = 50, cy = 53) {
  const v = [...Array(2 * n)].map((_, k) => {
    const rr = k % 2 ? r : R,
      a = (Math.PI * k) / n;
    return [cx + rr * Math.sin(a), cy - rr * Math.cos(a)];
  });
  return { d: pts(v) + ' Z', start: v[0], dir: [v[1][0] - v[0][0], v[1][1] - v[0][1]] };
}
function spiral() {
  const v = [];
  for (let t = 0; t <= 3 * 2 * Math.PI; t += 0.25)
    v.push([
      50 + (3 + (14 * t) / (2 * Math.PI)) * Math.cos(t),
      50 + (3 + (14 * t) / (2 * Math.PI)) * Math.sin(t),
    ]);
  return { d: pts(v), start: v[0], dir: [v[1][0] - v[0][0], v[1][1] - v[0][1]] };
}

/** Motif répété `n` fois tous les 40 unités à partir de x0 ; `unit(x)` renvoie les segments d'une répétition. */
const chain = (x0, n, head, unit) =>
  head(x0) + [...Array(n)].map((_, k) => unit(x0 + 40 * k)).join(' ');

const P5 = polygon(5),
  P6 = polygon(6),
  ST = star();
export const SHAPES = [
  {
    id: 'cercle',
    label: 'Cercle',
    group: 'formes',
    closed: true,
    d: 'M50 4 A46 46 0 0 1 50 96 A46 46 0 0 1 50 4 Z',
    start: [50, 4],
    dir: [1, 0],
  },
  {
    id: 'ovale',
    label: 'Ovale',
    group: 'formes',
    closed: true,
    d: 'M50 22 A46 28 0 0 1 50 78 A46 28 0 0 1 50 22 Z',
    start: [50, 22],
    dir: [1, 0],
  },
  {
    id: 'carre',
    label: 'Carré',
    group: 'formes',
    closed: true,
    d: 'M6 6 H94 V94 H6 Z',
    start: [6, 6],
    dir: [1, 0],
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    group: 'formes',
    closed: true,
    d: 'M4 24 H96 V76 H4 Z',
    start: [4, 24],
    dir: [1, 0],
  },
  {
    id: 'triangle',
    label: 'Triangle',
    group: 'formes',
    closed: true,
    d: 'M50 6 L95 92 L5 92 Z',
    start: [50, 6],
    dir: [45, 86],
  },
  {
    id: 'losange',
    label: 'Losange',
    group: 'formes',
    closed: true,
    d: 'M50 3 L94 50 L50 97 L6 50 Z',
    start: [50, 3],
    dir: [44, 47],
  },
  {
    id: 'demi',
    label: 'Demi-cercle',
    group: 'formes',
    closed: true,
    d: 'M4 70 A46 46 0 0 1 96 70 Z',
    start: [4, 70],
    dir: [0, -1],
  },
  { id: 'pentagone', label: 'Pentagone', group: 'formes', closed: true, ...P5 },
  { id: 'hexagone', label: 'Hexagone', group: 'formes', closed: true, ...P6 },
  { id: 'etoile', label: 'Étoile', group: 'formes', closed: true, ...ST },
  {
    id: 'coeur',
    label: 'Cœur',
    group: 'formes',
    closed: true,
    d: 'M50 92 C8 62 4 36 18 18 C32 4 46 12 50 28 C54 12 68 4 82 18 C96 36 92 62 50 92 Z',
    start: [50, 92],
    dir: [-1, -0.75],
  },
  {
    id: 'croix',
    label: 'Croix',
    group: 'formes',
    closed: true,
    d: 'M36 4 H64 V36 H96 V64 H64 V96 H36 V64 H4 V36 H36 Z',
    start: [36, 4],
    dir: [1, 0],
  },
  {
    id: 'horizontale',
    label: 'Ligne horizontale',
    group: 'traits',
    w: 150,
    d: 'M5 50 H145',
    start: [5, 50],
    dir: [1, 0],
  },
  {
    id: 'verticale',
    label: 'Ligne verticale',
    group: 'traits',
    d: 'M50 5 V95',
    start: [50, 5],
    dir: [0, 1],
  },
  {
    id: 'oblique',
    label: 'Oblique',
    group: 'traits',
    d: 'M8 95 L92 5',
    start: [8, 95],
    dir: [1, -1],
  },
  {
    id: 'zigzag',
    label: 'Zigzag',
    group: 'traits',
    w: 150,
    d: 'M5 75 L28 25 L51 75 L74 25 L97 75 L120 25 L143 75',
    start: [5, 75],
    dir: [1, -2],
  },
  {
    id: 'vagues',
    label: 'Vagues',
    group: 'traits',
    w: 150,
    d: 'M5 50 C20 10 35 10 50 50 C65 90 80 90 95 50 C110 10 125 10 140 50',
    start: [5, 50],
    dir: [1, -1],
  },
  {
    id: 'creneaux',
    label: 'Créneaux',
    group: 'traits',
    w: 150,
    d: 'M5 80 V20 H35 V80 H65 V20 H95 V80 H125 V20 H145',
    start: [5, 80],
    dir: [0, -1],
  },
  { id: 'spirale', label: 'Spirale', group: 'traits', ...spiral() },
  {
    id: 'ponts',
    label: 'Ponts',
    group: 'graphisme',
    w: 150,
    start: [15, 80],
    dir: [0, -1],
    d: chain(
      15,
      3,
      (x) => `M${x} 80`,
      (x) => `C${x} 15 ${x + 40} 15 ${x + 40} 80`,
    ),
  },
  {
    id: 'coupes',
    label: 'Coupes',
    group: 'graphisme',
    w: 150,
    start: [15, 20],
    dir: [0, 1],
    d: chain(
      15,
      3,
      (x) => `M${x} 20`,
      (x) => `C${x} 85 ${x + 40} 85 ${x + 40} 20`,
    ),
  },
  {
    id: 'boucles',
    label: 'Boucles',
    group: 'graphisme',
    w: 150,
    start: [10, 70],
    dir: [1, -0.3],
    d: chain(
      10,
      3,
      (x) => `M${x} 70`,
      (x) => `C${x + 20} 70 ${x + 32} 8 ${x + 18} 8 C${x + 4} 8 ${x + 20} 70 ${x + 40} 70`,
    ),
  },
];
export const SHAPE_BY_ID = Object.fromEntries(SHAPES.map((s) => [s.id, s]));
export const shapeWidth = (s) => s.w ?? 100;
