import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_SKILLS } from '../scripts/copy-engine.mjs';
import { parseArgs } from '../src/longevo.mjs';
import { makeRepo } from './helpers/fixture.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const tree = (dir) => walk(dir).map((path) => relative(dir, path)).sort();
const cli = fileURLToPath(new URL('../src/longevo.mjs', import.meta.url));
const read = (root, path) => readFileSync(join(root, path), 'utf8');

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

test('an option with no value is an error, also when another option follows it', () => {
  assert.throws(() => parseArgs(['scan', '--cwd']), /--cwd needs a value/);
  assert.throws(() => parseArgs(['scan', '--cwd', '--session']), /--cwd needs a value/);
});

test('apply does not wait for stdin in operations without input', async () => {
  const root = makeRepo({ 'docs/a.md': '---\nsources:\n  - url: https://a\n    checked: 2026-10-01\n---\n' });
  // stdin stays open and empty, like a terminal that leaves a pipe attached.
  const child = spawn(process.execPath, [cli, 'apply', 'sources', '--cwd', root], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (chunk) => { out += chunk; });
  const code = await new Promise((done) => {
    const timer = setTimeout(() => { child.kill(); done('timeout'); }, 10_000);
    child.on('exit', (status) => { clearTimeout(timer); done(status); });
  });
  child.stdin.destroy();
  assert.equal(code, 0, out);
  assert.equal(JSON.parse(out).status, 'written');
});

test('apply block with an open empty stdin refuses instead of writing an empty block', async () => {
  const root = makeRepo({ 'AGENTS.md': '# A\n\n<!-- longevo:start -->\n## Longevo\n- Run all tests: `npm test`\n- Start each session with the `longevo-init` skill.\n<!-- longevo:end -->\n' });
  const before = read(root, 'AGENTS.md');
  const child = spawn(process.execPath, [cli, 'apply', 'block', '--cwd', root], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (chunk) => { out += chunk; });
  const code = await new Promise((done) => {
    const timer = setTimeout(() => { child.kill(); done('timeout'); }, 10_000);
    child.on('exit', (status) => { clearTimeout(timer); done(status); });
  });
  child.stdin.destroy();
  assert.equal(code, 1, out);
  assert.match(JSON.parse(out).error, /apply block needs its input as JSON on stdin/);
  assert.equal(read(root, 'AGENTS.md'), before);
});

test('errors are redacted and a bad frontmatter line is named by its number', () => {
  const root = makeRepo({ 'docs/bad.md': '---\ncovers: ["src/**"]\nweird AKIA1234567890ABCDEF line\n---\n', 'src/a.ts': '1' });
  const result = spawnSync(process.execPath, [cli, 'apply', 'verify', '--cwd', root], { input: '{"doc": "docs/bad.md"}', encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).error, 'docs/bad.md: Cannot read line 3 of the frontmatter.');
  const url = spawnSync(process.execPath, [cli, 'apply', 'checked', '--cwd', root], { input: '{"doc": "docs/bad.md", "url": "https://user:hunter2hunter2@host/x"}', encoding: 'utf8' });
  assert.equal(url.stdout.includes('hunter2hunter2'), false, url.stdout);
});

test('apply refuses ops that need input when stdin is empty or closed, but import runs', () => {
  const root = makeRepo({ 'AGENTS.md': '# A\n\n<!-- longevo:start -->\n## Longevo\n- Run all tests: `npm test`\n<!-- longevo:end -->\n', 'CLAUDE.md': '# C\n' });
  const before = read(root, 'AGENTS.md');
  const block = spawnSync(process.execPath, [cli, 'apply', 'block', '--cwd', root], { input: '', encoding: 'utf8' });
  assert.equal(block.status, 1);
  assert.match(JSON.parse(block.stdout).error, /apply block needs its input as JSON on stdin/);
  assert.equal(read(root, 'AGENTS.md'), before);
  const explicit = spawnSync(process.execPath, [cli, 'apply', 'decline', '--cwd', root], { input: '{"keys": []}', encoding: 'utf8' });
  assert.equal(explicit.status, 0, explicit.stdout);
  const imported = spawnSync(process.execPath, [cli, 'apply', 'import', '--cwd', root], { input: '', encoding: 'utf8' });
  assert.equal(imported.status, 0, imported.stdout);
});
