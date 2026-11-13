// Segmentation d'un mot français en graphèmes (heuristique, sans analyse phonétique complète).
// Types : 'v' voyelle simple, 'xv' voyelle complexe (ou, on, an…), 'c' consonne simple,
//         'xc' consonne complexe (ch, ph, gn, qu…), 'm' lettre muette.
import { FINAL_SOUNDED, ENT_SOUNDED, ILL_AS_IL, ES_SOUNDED } from './exceptions.js';

const VOW = 'aeiouyàâäéèêëîïôöùûüœæ';
const isV = (c) => !!c && VOW.includes(c);

const TRI = {
  eau: 'xv',
  oeu: 'xv',
  ain: 'xv',
  aim: 'xv',
  ein: 'xv',
  oin: 'xv',
  ill: 'xc',
  ouill: 'xc',
};
const BI_V = new Set([
  'ou',
  'au',
  'ai',
  'ei',
  'oi',
  'eu',
  'oe',
  'ui',
  'on',
  'an',
  'en',
  'in',
  'un',
  'om',
  'am',
  'em',
  'im',
  'œu',
]);
const BI_C = new Set(['ch', 'ph', 'gn', 'qu']);
const NASAL = new Set([
  'on',
  'an',
  'en',
  'in',
  'un',
  'om',
  'am',
  'em',
  'im',
  'ain',
  'aim',
  'ein',
  'oin',
]);

function nasalOk(g, next) {
  const last = g[g.length - 1];
  if (isV(next)) return false;
  if (last === 'n') return next !== 'n';
  if (last === 'm') return next === 'b' || next === 'p';
  return true;
}

/** Retourne [{g, type}] pour un mot (lettres uniquement). */
export function segment(word) {
  const w = word.toLowerCase().normalize('NFC');
  const out = [];
  // Zone finale muette
  let end = w.length,
    tail = [];
  const len = w.length;
  if (len > 2 && w.endsWith('ent') && !ENT_SOUNDED.has(w) && !w.endsWith('ment') && len >= 5) {
    tail = [{ g: word.slice(len - 3), type: 'm' }];
    end = len - 3;
    // le « e » de « ent » est lu par le segment suivant comme un tout muet
  } else if (len > 3 && w.endsWith('es') && !ES_SOUNDED.has(w)) {
    tail = [{ g: word.slice(len - 2), type: 'm' }];
    end = len - 2;
  } else if (len > 1 && w.endsWith('e') && !isV(w[len - 2])) {
    tail = [{ g: word.slice(len - 1), type: 'm' }];
    end = len - 1;
  } else if (len > 1 && w.endsWith('e') && isV(w[len - 2]) && len > 2) {
    tail = [{ g: word.slice(len - 1), type: 'm' }];
    end = len - 1; // ex. « joue », « vue »
  } else if (
    len > 2 &&
    /[stxdpz]$/.test(w) &&
    !FINAL_SOUNDED.has(w) &&
    !(w.endsWith('z') && !w.endsWith('ez'))
  ) {
    tail = [{ g: word.slice(len - 1), type: 'm' }];
    end = len - 1;
  }
  const tailVowel = tail.length > 0 && /^e/i.test(tail[0].g) && tail[0].g.toLowerCase() !== 'ent';
  const body = w.slice(0, end);
  const bodyOrig = word.slice(0, end);
  let i = 0;
  while (i < body.length) {
    const rest = body.slice(i);
    const next = (n) => body[i + n] ?? (tailVowel ? 'e' : undefined);
    let took = 0,
      type = null;
    // « ill » : exceptions
    for (const [t, ty] of Object.entries(TRI)) {
      if (!rest.startsWith(t)) continue;
      if (t === 'ill' && (ILL_AS_IL.has(w) || i === 0)) continue;
      if (t === 'ouill') continue;
      if (NASAL.has(t) && !nasalOk(t, next(t.length))) continue;
      took = t.length;
      type = ty;
      break;
    }
    if (!took) {
      const two = rest.slice(0, 2);
      if (BI_C.has(two)) {
        took = 2;
        type = 'xc';
      } else if (two === 'gu' && /^[eiéèêï]/.test(body.slice(i + 2) || (tailVowel ? 'e' : ''))) {
        took = 2;
        type = 'xc';
      } else if (BI_V.has(two) && (!NASAL.has(two) || nasalOk(two, next(2)))) {
        took = 2;
        type = 'xv';
      }
    }
    if (!took) {
      const c = body[i];
      took = 1;
      type = c === 'h' ? 'm' : isV(c) ? 'v' : 'c';
    }
    out.push({ g: bodyOrig.slice(i, i + took), type });
    i += took;
  }
  return out.concat(tail);
}
