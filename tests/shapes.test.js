import { test } from 'vitest';
import assert from 'node:assert/strict';
import { SHAPES, polygon } from '../src/tools/formes/shapes.js';

test('identifiants uniques et champs requis', () => {
  assert.equal(new Set(SHAPES.map((s) => s.id)).size, SHAPES.length);
  for (const s of SHAPES) {
    assert.match(s.d, /^M/, s.id);
    assert.ok(!/NaN|undefined/.test(s.d), s.id);
    assert.equal(s.start.length, 2, s.id);
    assert.ok(Math.hypot(...s.dir) > 0, s.id);
  }
});
test('polygone régulier : n sommets', () => {
  assert.equal(polygon(6).d.split('L').length, 6);
});
