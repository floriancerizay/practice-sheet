// Labyrinthes de mots : grille de lettres sans murs où l'on passe de case en case (haut, bas, gauche, droite) en lisant
// les lettres d'un mot dans l'ordre (le mot se répète jusqu'à la sortie). Le chemin à trouver vient d'un labyrinthe parfait.
import { generate, solve, rng } from './maze.js';

const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
/** Lettre de base en majuscule : « é » -> « E ». */
const base = (ch) => ch.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();

/** Lettres saisies (accents conservés), sans espaces ni ponctuation ; « A » par défaut. */
export function lettersOf(text) {
  const l = [...String(text ?? '')].filter((c) => /\p{L}/u.test(c));
  return l.length ? l : ['A'];
}

/**
 * Génère la grille pour le mot `text`. Les cases hors du chemin contiennent des lettres absentes du mot, dans la casse
 * du mot. Renvoie { cols, rows, entrance, exit, cells (lettres), path (cases du chemin) }.
 */
export function generateLetters(cols, rows, seed, { text, far = 0.9 }) {
  const rand = rng(seed ^ 0x9e3779b9);
  const m = generate(cols, rows, seed, far);
  const letters = lettersOf(text);
  const lower = letters[0] === letters[0].toLowerCase() && letters[0] !== letters[0].toUpperCase();
  const target = new Set(letters.map(base));
  const pool = ALPHABET.filter((c) => !target.has(c));
  const others = pool.length >= 3 ? pool : ALPHABET;
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => {
      const ch = others[Math.floor(rand() * others.length)];
      return lower ? ch.toLowerCase() : ch;
    }),
  );
  const path = solve(m);
  path.forEach(([x, y], k) => {
    cells[y][x] = letters[k % letters.length];
  });
  return { cols, rows, entrance: m.entrance, exit: m.exit, cells, path };
}
