// Edge cases of CLI options, apply input and links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from '../src/lib/apply.mjs';
import { parseArgs } from '../src/longevo.mjs';
import { syncReport } from '../src/sync.mjs';
import { makeRepo } from './helpers/fixture.mjs';

const cli = fileURLToPath(new URL('../src/longevo.mjs', import.meta.url));
const read = (root, path) => readFileSync(join(root, path), 'utf8');

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

test('a dangling linked folder gives a clear error and writes nothing', () => {
  const root = makeRepo({ 'src/a.ts': '1' });
  symlinkSync('gone', join(root, 'docs'));
  assert.throws(() => apply('brief', root, { slug: 'x', task: 't', covers: ['src/**'] }, { today: '2026-10-11' }), /docs is a link to a folder that does not exist/);
  assert.equal(existsSync(join(root, 'gone')), false);
});

test('dates must be real calendar dates', () => {
  const root = makeRepo({ 'docs/a.md': '---\ncovers: ["src/**"]\nverified: 2026-01-01\n---\n', 'src/x.ts': '1' });
  for (const verified of ['2026-13-45', '2026-02-30', '2026-10-11T25:00:00']) {
    assert.throws(() => apply('verify', root, { doc: 'docs/a.md', verified }), /verified must be a date/, verified);
  }
  assert.equal(apply('verify', root, { doc: 'docs/a.md', verified: '2028-02-29' }).status, 'written');
});

test('malformed block input gives a clear error', () => {
  const root = makeRepo({ 'AGENTS.md': '# A\n', 'docs/a.md': '# A\n', 'src/a.ts': '1' });
  assert.throws(() => apply('block', root, { commands: 'pnpm test' }), /commands must be a list/);
  assert.throws(() => apply('block', root, { triggers: [null] }), /Each trigger needs a glob and a doc/);
  assert.throws(() => apply('block', root, { commands: [null] }), /Each command needs a label and a command/);
  assert.throws(() => apply('block', root, { triggers: {} }), /triggers must be a list/);
  assert.equal(read(root, 'AGENTS.md'), '# A\n');
});

test('a doc the block names but nobody created says how to fix it', () => {
  const root = makeRepo({ 'AGENTS.md': '# A\n' });
  assert.throws(() => apply('block', root, { coverageDoc: true }), /docs\/coverage\.md does not exist\. If this run creates it, add it to creating\./);
});

test('outside git, decline and undecline say they cannot remember instead of failing', () => {
  const root = makeRepo({ 'a.md': '# A\n' }, { git: false });
  assert.deepEqual(apply('decline', root, { keys: ['coverage'] }), { op: 'decline', declined: [], stored: false, note: 'This folder is not a git repo, so declined changes are not remembered.' });
  assert.equal(apply('undecline', root, { all: true }).stored, false);
});

test('a folder that does not exist is an error, not an empty report', () => {
  const missing = join(realpathSync(tmpdir()), 'longevo-missing-folder-xyz');
  assert.throws(() => syncReport(missing), /does not exist/);
});

test('outside git the sync report says drift was not checked', () => {
  const root = makeRepo({ 'docs/a.md': '---\ncovers: ["src/**"]\nverified: 2026-01-01\n---\n', 'src/x.ts': '1' }, { git: false });
  assert.deepEqual(syncReport(root).notChecked, ['drift: this folder is not a git repo, so no doc can be stale']);
});

test('the frontmatter op adds the time on a second check the same day', () => {
  const root = makeRepo({ 'docs/a.md': '---\ncovers: ["src/**"]\nverified: 2026-10-11\n---\n', 'src/x.ts': '1', 'lib/y.ts': '1' });
  apply('frontmatter', root, { doc: 'docs/a.md', covers: ['src/**', 'lib/**'] }, { today: '2026-10-11', now: new Date(2026, 9, 11, 9, 5, 7) });
  assert.match(read(root, 'docs/a.md'), /^verified: 2026-10-11T09:05:07$/m);
});

test('import uses CLAUDE.md even when .claude links outside the repo', () => {
  const away = realpathSync(mkdtempSync(join(tmpdir(), 'longevo-away-')));
  writeFileSync(join(away, 'CLAUDE.md'), '# Home rules\n');
  const root = makeRepo({ 'CLAUDE.md': '# Rules\n', 'AGENTS.md': '# A\n' });
  symlinkSync(away, join(root, '.claude'));
  assert.equal(apply('import', root, {}).status, 'written');
  assert.ok(read(root, 'CLAUDE.md').startsWith('@AGENTS.md\n'));
  assert.equal(readFileSync(join(away, 'CLAUDE.md'), 'utf8'), '# Home rules\n');
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

test('a brief with covers that are not globs does not crash the review', async () => {
  const { reviewReport } = await import('../src/review.mjs');
  const root = makeRepo({ 'docs/work/2026-10-11-x/brief.md': '---\nstatus: open\ncovers:\n  paths: src/**\n---\n# X\n', 'src/a.ts': '1\n' });
  writeFileSync(join(root, 'src/a.ts'), '2\n');
  assert.equal(reviewReport(root).brief, null);
});
