import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ISO } from '../src/tools/carte/data/countries.js';
import { flagUrl } from '../src/tools/carte/data/flags.js';

test('chaque pays avec un code ISO a un drapeau', () => {
  assert.match(flagUrl('France'), /fr\.svg/);
  assert.equal(flagUrl('Pays inconnu'), null);
  const missing = Object.keys(ISO).filter((name) => !flagUrl(name));
  assert.deepEqual(missing, []);
});

test('les drapeaux sont bien trouvés (au moins 200)', () => {
  const found = Object.keys(ISO).filter((name) => flagUrl(name));
  assert.ok(found.length >= 200, `${found.length} drapeaux`);
});
