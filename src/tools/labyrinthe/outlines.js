import { isoLoops } from './contour.js';
import { heartField, regular } from './maze.js';

/** Contours « lisses » des formes libres, en coordonnées du carré unité : liste de { points, closed }. */
const polygon = (pts) => [{ points: pts, closed: true }];

export const OUTLINES = {
  heart: () => {
    // le contour se pince en deux points (creux du haut et pointe) : marching squares le rend en deux moitiés
    // à raccorder (les deux plus longues chaînes, qui partent du même creux et arrivent à la même pointe)
    const [left, right] = isoLoops(heartField, [-0.05, -0.05, 1.05, 1.05], 220).sort(
      (a, b) => b.points.length - a.points.length,
    );
    return [{ points: [...left.points, ...right.points.slice(1, -1).reverse()], closed: true }];
  },
  triangle: () =>
    polygon([
      [0.5, 0],
      [1, 1],
      [0, 1],
    ]),
  diamond: () =>
    polygon([
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ]),
  hexagon: () => polygon(regular(6, 0.5)),
};
