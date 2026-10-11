import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_SKILLS } from '../scripts/copy-engine.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const tree = (dir) => walk(dir).map((path) => relative(dir, path)).sort();

for (const skill of ENGINE_SKILLS) {
  test(`${skill} carries an exact copy of src/`, () => {
    const copy = join(repo, 'skills', skill, 'scripts');
    assert.deepEqual(tree(copy), tree(join(repo, 'src')), 'run npm run engine');
    for (const file of tree(join(repo, 'src'))) {
      assert.equal(readFileSync(join(copy, file), 'utf8'), readFileSync(join(repo, 'src', file), 'utf8'), `${file} differs; run npm run engine`);
    }
  });
}

test('GitHub marks the copies as generated', () => {
  assert.match(readFileSync(join(repo, '.gitattributes'), 'utf8'), /^skills\/\*\/scripts\/\*\* linguist-generated=true$/m);
});
