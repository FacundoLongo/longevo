import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewReport } from '../src/review.mjs';
import { gitIn, makeRepo, writeFiles } from './helpers/fixture.mjs';

const BASE = {
  'docs/domain/refunds.md': '---\ncovers: ["src/refunds/**"]\nverified: 2026-10-01\n---\n### R-REF-001 · A refund expires after 48 hours\nCode: src/refunds/policy.ts:1\nStatus: implemented without test\n',
  'src/refunds/policy.ts': 'export const HOURS = 48;\n',
  'docs/work/2026-10-01-shorter-window/brief.md': '---\nstatus: open\ntask: "#7"\ncovers: ["src/refunds/**"]\n---\n# Brief\n',
};
const branch = () => {
  const root = makeRepo(BASE);
  gitIn(root, 'branch', '-M', 'main');
  gitIn(root, 'checkout', '-q', '-b', 'shorter-window');
  writeFiles(root, { 'src/refunds/policy.ts': 'export const HOURS = 24;\n' });
  gitIn(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'Shorten the window');
  writeFiles(root, { 'src/refunds/policy.test.ts': "vi.mock('../db')\nexpect(save).toHaveBeenCalledTimes(1)\nexpect(a).toHaveBeenCalled()\nexpect(b).toHaveBeenCalledWith(1)\n" });
  return root;
};

test('reviews the branch against main, with untracked files', () => {
  const root = branch();
  const report = reviewReport(root);
  assert.equal(report.base.ref, 'main');
  assert.match(report.base.commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(report.changed.map((c) => c.path).sort(), ['src/refunds/policy.test.ts', 'src/refunds/policy.ts']);
  assert.deepEqual(report.docsToUpdate, [{ doc: 'docs/domain/refunds.md', files: ['src/refunds/policy.test.ts', 'src/refunds/policy.ts'], newest: gitIn(root, 'rev-parse', 'HEAD').trim().slice(0, 12) }]);
  assert.deepEqual(report.rules.map((r) => r.id), ['R-REF-001']);
  assert.deepEqual(report.tests.map((t) => [t.file, t.mocksStorage, t.callAsserts]), [['src/refunds/policy.test.ts', true, 3]]);
  assert.deepEqual(report.code, ['src/refunds/policy.ts']);
  assert.equal(report.brief.path, 'docs/work/2026-10-01-shorter-window/brief.md');
  assert.equal(report.nothing, false);
  assert.deepEqual(report.diffLines, { added: 5, removed: 1 });
});

test('lists untracked files with the status untracked', () => {
  const report = reviewReport(branch());
  assert.ok(report.changed.some((c) => c.path === 'src/refunds/policy.test.ts' && c.status === 'untracked'));
});

test('uses --base when given', () => {
  const root = branch();
  const report = reviewReport(root, { base: 'HEAD' });
  assert.equal(report.base.ref, 'HEAD');
  assert.deepEqual(report.changed.map((c) => c.path), ['src/refunds/policy.test.ts']);
});

test('never prints a secret from the diff', () => {
  const root = branch();
  const token = `ghp_${'c'.repeat(36)}`;
  writeFiles(root, { 'src/config.ts': `export const TOKEN = "${token}";\n` });
  const report = reviewReport(root);
  assert.deepEqual(report.security.map((s) => [s.file, s.line]), [['src/config.ts', 1]]);
  assert.ok(!JSON.stringify(report).includes(token));
});

test('says when there is nothing to review', () => {
  for (const git of [true, false]) assert.equal(reviewReport(makeRepo({ 'a.ts': '1' }, { git })).nothing, true);
});

test('the CLI prints the review report', () => {
  const cli = fileURLToPath(new URL('../src/longevo.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'review', '--cwd', branch()], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout);
  assert.equal(JSON.parse(result.stdout).base.ref, 'main');
});

test('marks generated files and leaves them out of the diff command', () => {
  const root = branch();
  writeFiles(root, { '.gitattributes': 'gen/** linguist-generated=true\n', 'gen/client.ts': 'export {};\n' });
  gitIn(root, 'add', '-A');
  gitIn(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'codegen');
  const report = reviewReport(root);
  assert.equal(report.changed.find((c) => c.path === 'gen/client.ts').skipped, 'generated');
  assert.ok(!report.code.includes('gen/client.ts'));
  assert.ok(report.diffCommand.includes(':(top,exclude,attr:linguist-generated=true)'));
});

test('skips secrets in generated files', () => {
  const root = branch();
  const token = `ghp_${'d'.repeat(36)}`;
  writeFiles(root, { '.gitattributes': 'gen/** linguist-generated=true\n', 'gen/keys.ts': `export const T = "${token}";\n` });
  gitIn(root, 'add', '-A');
  gitIn(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'codegen');
  assert.deepEqual(reviewReport(root).security, []);
});

test('returns the changes the user declined, so the list can leave them out', async () => {
  const root = branch();
  const { apply } = await import('../src/lib/apply.mjs');
  apply('decline', root, { keys: ['verify:docs/domain/refunds.md'] });
  assert.deepEqual(reviewReport(root).declined, ['verify:docs/domain/refunds.md']);
});

test('a repo with no commits yet reviews its files against an empty tree', () => {
  const root = makeRepo({ 'src/a.ts': 'export const A = 1;\n' }, { git: false });
  gitIn(root, 'init', '-q');
  gitIn(root, 'add', 'src/a.ts');
  writeFiles(root, { 'src/b.ts': 'export const B = 2;\n' });
  const report = reviewReport(root);
  assert.equal(report.nothing, false);
  assert.equal(report.base.fallback, 'no-commits');
  assert.deepEqual(report.changed.map((c) => `${c.path}:${c.status}`), ['src/a.ts:added', 'src/b.ts:untracked']);
  assert.equal(report.diffLines.added, 2);
});

test('a secret on an unchanged line the reviewer sees in the diff is listed as context', () => {
  const root = makeRepo({ 'conf.py': 'a = 1\nb = 2\nc = 3\npassword = "hunter2hunter2"\nd = 4\ne = 5\nf = 6\n' });
  gitIn(root, 'branch', '-M', 'main');
  gitIn(root, 'checkout', '-q', '-b', 'tweak');
  writeFiles(root, { 'conf.py': 'a = 1\nb = 2\nc = 3\npassword = "hunter2hunter2"\nd = 4\ne = 50\nf = 6\n' });
  gitIn(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'Change e');
  const report = reviewReport(root);
  assert.deepEqual(report.security, [{ file: 'conf.py', line: 4, kind: 'secret value', context: true }]);
  assert.ok(report.diffCommand.includes('-U3'));
});

test('a file name with a space keeps its name in the security list and in the skip check', () => {
  const root = makeRepo({ '.gitattributes': 'gen/** linguist-generated=true\n', 'my file.txt': 'x\n', 'gen/api client.ts': 'x\n' });
  gitIn(root, 'branch', '-M', 'main');
  gitIn(root, 'checkout', '-q', '-b', 'secrets');
  writeFiles(root, { 'my file.txt': 'x\npassword = "hunter2hunter2"\n', 'gen/api client.ts': 'x\npassword = "hunter2hunter2"\n' });
  gitIn(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'Add');
  assert.deepEqual(reviewReport(root).security.map((s) => s.file), ['my file.txt']);
});
