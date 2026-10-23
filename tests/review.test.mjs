import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewReport } from '../src/review.mjs';
import { syncReport } from '../src/sync.mjs';
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
const commit = (root, message) => gitIn(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', message);
const commitFiles = (root, files, message) => {
  writeFiles(root, files);
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', message);
};
const feature = () => {
  const root = makeRepo({ 'docs/domain/refunds.md': '---\ncovers: ["src/refunds/**"]\nverified: 2026-10-01\n---\n### R-REF-001 · x\nCode: src/refunds/policy.ts:1\nStatus: implemented without test\n', 'src/refunds/policy.ts': 'export const H = 48;\n', 'src/other.ts': '1\n' });
  gitIn(root, 'branch', '-M', 'main');
  gitIn(root, 'checkout', '-q', '-b', 'feature');
  writeFiles(root, { 'src/refunds/policy.ts': 'export const H = 24;\n' });
  commit(root, 'feature work');
  return root;
};
const PEM = ['-----BEGIN RSA PRIVATE KEY-----', 'MIIEowIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gun', 'VTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u+qKhbwKfBstIs+bMY2Zkp18gnTxK', '-----END RSA PRIVATE KEY-----'];
const DOC = '---\ncovers: ["src/pay/**"]\nverified: 2026-01-01\n---\n# Pay\n';

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

test('a brief with covers that are not globs does not crash the review', async () => {
  const { reviewReport } = await import('../src/review.mjs');
  const root = makeRepo({ 'docs/work/2026-10-11-x/brief.md': '---\nstatus: open\ncovers:\n  paths: src/**\n---\n# X\n', 'src/a.ts': '1\n' });
  writeFileSync(join(root, 'src/a.ts'), '2\n');
  assert.equal(reviewReport(root).brief, null);
});

test('--base uses the merge base, not the tip of the branch', () => {
  const root = feature();
  gitIn(root, 'checkout', '-q', 'main');
  writeFiles(root, { 'src/mainonly.ts': '1\n' });
  gitIn(root, 'add', '-A');
  commit(root, 'main moves on');
  gitIn(root, 'checkout', '-q', 'feature');
  const report = reviewReport(root, { base: 'main' });
  assert.deepEqual(report.changed.map((c) => c.path), ['src/refunds/policy.ts']);
});

test('the diff ignores external diff tools, colors and missing prefixes', () => {
  const root = feature();
  writeFiles(root, { 'src/config.ts': `export const T = "ghp_${'e'.repeat(36)}";\n` });
  gitIn(root, 'add', '-A');
  commit(root, 'config');
  for (const [key, value] of [['diff.external', 'false'], ['color.ui', 'always'], ['diff.noprefix', 'true']]) gitIn(root, 'config', key, value);
  assert.deepEqual(reviewReport(root).security.map((s) => [s.file, s.line]), [['src/config.ts', 1]]);
});

test('an added line that starts with ++ is not a file header', () => {
  const root = feature();
  writeFiles(root, { 'notes.txt': 'one\n++ counter\ntoken: abcdefgh12345678\n' });
  gitIn(root, 'add', '-A');
  commit(root, 'notes');
  assert.deepEqual(reviewReport(root).security.map((s) => [s.file, s.line]), [['notes.txt', 3]]);
});

test('says why when there is no merge base', () => {
  const root = makeRepo({ 'a.ts': '1\n' });
  gitIn(root, 'checkout', '-q', '--orphan', 'lonely');
  writeFiles(root, { 'b.ts': '1\n' });
  gitIn(root, 'add', '-A');
  commit(root, 'lonely');
  const report = reviewReport(root);
  assert.equal(report.base.fallback, 'no-merge-base');
});

test('the diff command works from any folder and leaves out generated files and lockfiles', () => {
  const root = feature();
  writeFiles(root, { '.gitattributes': 'gen/** linguist-generated=true\n', 'gen/a.ts': '1\n', 'package-lock.json': '{}\n', 'apps/web/x.ts': '1\n' });
  gitIn(root, 'add', '-A');
  commit(root, 'more');
  const report = reviewReport(root);
  assert.equal(report.changed.find((c) => c.path === 'package-lock.json').skipped, 'lockfile');
  assert.equal(report.changed.find((c) => c.path === 'gen/a.ts').skipped, 'generated');
  const [command, ...args] = report.diffCommand;
  const out = execFileSync(command, args, { cwd: join(root, 'apps', 'web'), encoding: 'utf8' });
  assert.match(out, /src\/refunds\/policy\.ts/);
  assert.match(out, /apps\/web\/x\.ts/);
  assert.doesNotMatch(out, /gen\/a\.ts|package-lock\.json/);
});

test('a rename keeps the old path, so docs and rules of moved code are found', () => {
  const root = feature();
  // Git sees a rename when most of the file is the same; a one-line file that also changed is a delete and an add.
  writeFiles(root, { 'src/refunds/policy.ts': `export const H = 24;\n${Array.from({ length: 20 }, (_, i) => `export const L${i} = ${i};`).join('\n')}\n` });
  commit(root, 'grow');
  gitIn(root, 'checkout', '-q', 'main');
  gitIn(root, 'merge', '-q', '--ff-only', 'feature');
  gitIn(root, 'checkout', '-q', 'feature');
  gitIn(root, 'mv', 'src/refunds/policy.ts', 'src/billing.ts');
  commit(root, 'move');
  const report = reviewReport(root);
  assert.deepEqual(report.changed.find((c) => c.path === 'src/billing.ts').from, 'src/refunds/policy.ts');
  assert.deepEqual(report.rules.map((r) => r.id), ['R-REF-001']);
  assert.deepEqual(report.docsToUpdate.map((d) => d.doc), ['docs/domain/refunds.md']);
});

test('the brief named after the branch wins over another one that covers the same code', () => {
  const root = feature();
  writeFiles(root, {
    'docs/work/2026-09-01-refund-window/brief.md': '---\nstatus: open\ntask: "a"\ncovers: ["src/refunds/**"]\n---\n',
    'docs/work/2026-10-01-feature/brief.md': '---\nstatus: open\ntask: "b"\ncovers: ["src/refunds/**"]\n---\n',
  });
  gitIn(root, 'add', '-A');
  commit(root, 'briefs');
  assert.equal(reviewReport(root).brief.path, 'docs/work/2026-10-01-feature/brief.md');
});

test('review lists secrets on removed lines and every line of a private key', () => {
  const root = makeRepo({ 'config/app.yml': 'name: app\npassword: hunter2hunter2\n', 'src/a.ts': '1\n' });
  gitIn(root, 'branch', '-M', 'main');
  gitIn(root, 'checkout', '-q', '-b', 'clean-up');
  writeFiles(root, { 'config/app.yml': 'name: app\n', 'keys/k.pem': `${PEM.join('\n')}\n` });
  gitIn(root, 'add', '-A');
  gitIn(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'Remove the password, add a key');
  const { security } = reviewReport(root);
  assert.deepEqual(security.filter((s) => s.file === 'config/app.yml'), [{ file: 'config/app.yml', line: 2, kind: 'secret in yaml', removed: true }]);
  assert.deepEqual(security.filter((s) => s.file === 'keys/k.pem').map((s) => s.line), [1, 2, 3, 4]);
});

test('review says why when it is not a git repo, or on the default branch', () => {
  const plain = makeRepo({ 'a.ts': '1' }, { git: false });
  assert.equal(reviewReport(plain).base.fallback, 'no-git');
  const root = makeRepo({ 'a.ts': '1\n' });
  gitIn(root, 'branch', '-M', 'main');
  writeFiles(root, { 'a.ts': '2\n' });
  const report = reviewReport(root);
  assert.equal(report.base.fallback, 'on-default-branch');
});

test('a removed SQL comment line is a removed line, not a file header', () => {
  const root = makeRepo({ 'db/seed.sql': '-- seed data\npassword: hunter2hunter2\nselect 1;\n' });
  gitIn(root, 'branch', '-M', 'main');
  gitIn(root, 'checkout', '-q', '-b', 'clean');
  writeFiles(root, { 'db/seed.sql': 'select 1;\n' });
  gitIn(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'Clean the seed');
  assert.deepEqual(reviewReport(root).security, [{ file: 'db/seed.sql', line: 2, kind: 'secret in yaml', removed: true }]);
});

test('review gives each doc to update the newest commit under its covers, the same commit sync keys on', () => {
  const root = makeRepo({ 'docs/pay.md': DOC, 'src/pay/a.ts': '1', 'README.md': '# R\n' });
  gitIn(root, 'branch', '-M', 'main');
  gitIn(root, 'checkout', '-q', '-b', 'change');
  commitFiles(root, { 'src/pay/a.ts': '2' }, 'change pay');
  commitFiles(root, { 'README.md': '# R2\n' }, 'unrelated');
  const [entry] = reviewReport(root).docsToUpdate;
  const [doc] = syncReport(root, { home: root }).docs;
  assert.equal(entry.newest, doc.commits[0].hash);
  writeFiles(root, { 'src/pay/a.ts': '3' });
  assert.equal(reviewReport(root).docsToUpdate[0].newest, doc.commits[0].hash);
});
