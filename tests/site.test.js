import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'vitest';
import { TOOLS } from '../src/shared/tools.js';

test('chaque outil a sa page et son module de démarrage', () => {
  assert.equal(new Set(TOOLS.map((t) => t.id)).size, TOOLS.length);
  for (const { id, href } of TOOLS) {
    assert.ok(existsSync(`src/${href}`), `page ${href}`);
    assert.ok(existsSync(`src/tools/${id}/main.js`), `module ${id}`);
    assert.match(readFileSync(`src/${href}`, 'utf8'), new RegExp(`/tools/${id}/main\\.js`), href);
  }
});
