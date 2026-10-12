// Redaction recall, review against the real merge base and safe from git config, renames, lockfiles, near
// tests ranked before the cut, untracked tests, and briefs for new code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, symlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { apply } from '../src/lib/apply.mjs';
import { scope } from '../src/lib/repo.mjs';
import { findRules, ruleFindings } from '../src/lib/rules.mjs';
import { redact } from '../src/lib/security.mjs';
import { contextReport } from '../src/context.mjs';
import { reviewReport } from '../src/review.mjs';
import { gitIn, makeRepo, writeFiles } from './helpers/fixture.mjs';

const commit = (root, message) => gitIn(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', message);
const listed = (root) => gitIn(root, 'ls-files').split('\n').filter(Boolean);

test('redaction catches secret words in names, like SECRET_KEY, db_password and api_token', () => {
  for (const line of ['SECRET_KEY = "django-insecure-abc123def456"', 'STRIPE_SECRET_KEY = "abcdefgh12345678"', 'db_password: hunter2hunter2', 'POSTGRES_PASSWORD: hunter2hunter2', 'client_secret: abcdefgh12345678', 'api_token: abcdefgh12345678', 'db.password=hunter2hunter2']) {
    assert.match(redact(line), /\[redacted\]/, line);
  }
});

test('redaction leaves look-alike names and placeholders alone', () => {
  for (const line of ['KEYBOARD_LAYOUT=us-international', 'SSH_KEY_PATH=./keys/id.pub', 'monkey=bananas-and-more', 'token: "${{ secrets.X }}"', 'token: "${{secrets.DEPLOY}}"']) {
    assert.equal(redact(line), line, line);
  }
});

test('redaction stays fast on very long lines', () => {
  const started = Date.now();
  redact(`${'a-'.repeat(40_000)}=x`);
  redact('x'.repeat(100_000));
  assert.ok(Date.now() - started < 1000, `${Date.now() - started} ms`);
});

const feature = () => {
  const root = makeRepo({ 'docs/domain/refunds.md': '---\ncovers: ["src/refunds/**"]\nverified: 2026-10-01\n---\n### R-REF-001 · x\nCode: src/refunds/policy.ts:1\nStatus: implemented without test\n', 'src/refunds/policy.ts': 'export const H = 48;\n', 'src/other.ts': '1\n' });
  gitIn(root, 'branch', '-M', 'main');
  gitIn(root, 'checkout', '-q', '-b', 'feature');
  writeFiles(root, { 'src/refunds/policy.ts': 'export const H = 24;\n' });
  commit(root, 'feature work');
  return root;
};

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

test('near tests put the same folder first before the list is cut', () => {
  const files = { 'packages/zz/src/index.ts': '1\n', 'packages/zz/src/index.test.ts': 'x\n' };
  for (let i = 0; i < 25; i += 1) files[`apps/a${String(i).padStart(2, '0')}/index.test.ts`] = 'x\n';
  const report = contextReport(makeRepo(files), { paths: ['packages/zz/src/index.ts'] });
  assert.equal(report.tests.near[0].file, 'packages/zz/src/index.test.ts');
});

test('a rule test written but not added to git yet is found', () => {
  const root = makeRepo({ 'docs/r.md': '### R-A-001 · x\nSource: s\nCode: a.ts:1\nTest: "handles the new case"\nStatus: implemented and tested\n', 'a.ts': '1\n' });
  writeFiles(root, { 'a.test.ts': "test('handles the new case', () => {})\n" });
  const files = [...listed(root), 'a.test.ts'];
  assert.deepEqual(ruleFindings(scope(root), findRules(scope(root), files), ['a.test.ts']), []);
});

test('a brief can cover code that does not exist yet, and never writes through a link', () => {
  const root = makeRepo({ 'src/a.ts': '1' });
  const result = apply('brief', root, { slug: 'loyalty', task: 'Add loyalty points', covers: ['src/loyalty/**'] }, { today: '2026-10-11' });
  assert.equal(result.status, 'written');
  assert.throws(() => apply('brief', root, { slug: 'x', task: 't', covers: ['../out/**'] }, { today: '2026-10-11' }), /inside the repo/);
  const dir = join(root, 'docs', 'work', '2026-10-11-linked');
  execFileSync('mkdir', ['-p', dir]);
  symlinkSync(join(root, 'src', 'new.ts'), join(dir, 'brief.md'));
  assert.throws(() => apply('brief', root, { slug: 'linked', task: 't', covers: ['src/**'] }, { today: '2026-10-11' }), /already exists/);
  assert.ok(!existsSync(join(root, 'src', 'new.ts')));
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

test('golden tests are files that exist', async () => {
  const root = makeRepo({ 'docs/testing.md': '## Golden tests\n\n- `tests/a.test.mjs`: good\n- `docs/testing.md`: not a test\n- `src/**/*.e2e.ts`: a glob\n', 'tests/a.test.mjs': 'x' });
  assert.deepEqual(contextReport(root, { paths: ['tests/**'] }).golden, ['tests/a.test.mjs']);
  assert.ok(readFileSync(join(root, 'docs/testing.md'), 'utf8'));
});
