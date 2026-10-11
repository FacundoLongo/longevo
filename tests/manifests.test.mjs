import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const pkg = read('package.json');

for (const path of ['.claude-plugin/plugin.json', 'gemini-extension.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json']) {
  test(`${path} is named longevo and matches the package version`, () => {
    const manifest = read(path);
    assert.equal(manifest.name, 'longevo');
    assert.equal(manifest.version, pkg.version);
  });
}

test('the Claude Code marketplace lists the plugin from the repo root', () => {
  const market = read('.claude-plugin/marketplace.json');
  assert.equal(market.name, 'longevo');
  assert.deepEqual(market.plugins.map((p) => [p.name, p.source, p.version]), [['longevo', './', pkg.version]]);
});

test('Codex and Cursor manifests point at the skills folder', () => {
  assert.equal(read('.codex-plugin/plugin.json').skills, './skills/');
  assert.equal(read('.cursor-plugin/plugin.json').skills, './skills/');
});
