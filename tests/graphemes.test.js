import { test } from 'vitest';
import assert from 'node:assert/strict';
import { segment } from '../src/tools/lecture/graphemes.js';

const show = (w) =>
  segment(w)
    .map((x) => `${x.g}:${x.type}`)
    .join(' ');

test('digrammes et trigrammes', () => {
  assert.equal(show('chat'), 'ch:xc a:v t:m');
  assert.equal(show('maison'), 'm:c ai:xv s:c on:xv');
  assert.equal(show('oiseau'), 'oi:xv s:c eau:xv');
  assert.equal(show('fille'), 'f:c ill:xc e:m');
  assert.equal(show('jardin'), 'j:c a:v r:c d:c in:xv');
});
test('nasales non nasales', () => {
  assert.equal(show('bonne'), 'b:c o:v n:c n:c e:m');
  assert.equal(show('reine'), 'r:c ei:xv n:c e:m');
});
test('lettres muettes', () => {
  assert.equal(show('petit'), 'p:c e:v t:c i:v t:m');
  assert.equal(show('ils'), 'i:v l:c s:m');
  assert.equal(show('mangent'), 'm:c an:xv g:c ent:m');
  assert.equal(show('moment'), 'm:c o:v m:c en:xv t:m');
  assert.equal(show('plus'), 'p:c l:c u:v s:c');
});
