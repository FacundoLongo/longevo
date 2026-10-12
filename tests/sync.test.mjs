import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scope } from '../src/lib/repo.mjs';
import { commitsTouching, diffSince, syncReport } from '../src/sync.mjs';
import { gitIn, makeRepo, writeFiles } from './helpers/fixture.mjs';

const commit = (root, files, message) => {
  writeFiles(root, files);
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', message);
};
const DOC = [
  '---',
  'covers: ["src/refunds/**"]',
  'verified: 2026-10-01',
  'sources:',
  '  - url: https://notion.so/refunds',
  '    checked: 2026-08-01',
  '---',
  '# Refunds',
  '',
  'See `src/refunds/policy.ts` and `src/gone.ts`.',
  '',
  '### R-REF-001 · A refund expires after 48 hours',
  'Source: Notion · Refund policy',
  'Code: src/refunds/policy.ts:1',
  'Test: "rejects a refund after 48 hours"',
  'Status: implemented and tested',
  '',
].join('\n');

test('reports a stale doc with the commits and the diff that changed its code', () => {
  const root = makeRepo({ 'docs/domain/refunds.md': DOC, 'src/refunds/policy.ts': 'export const HOURS = 48;\n' });
  commit(root, { 'src/refunds/policy.ts': 'export const HOURS = 72;\n' }, 'Extend the refund window');
  const report = syncReport(root, { home: root, today: '2026-10-11' });
  const [doc] = report.docs;
  assert.equal(doc.stale, true);
  assert.deepEqual(doc.commits.map((c) => c.subject), ['Extend the refund window']);
  assert.match(doc.anchor, /^[0-9a-f]{40}$/);
  assert.match(doc.diff, /-export const HOURS = 48;\n\+export const HOURS = 72;/);
  assert.equal(doc.truncated, false);
  assert.deepEqual(doc.missingPaths, ['src/gone.ts']);
  const found = report.findings.map((f) => f.id);
  for (const id of ['doc-stale', 'rule-test-missing', 'source-not-checked']) assert.ok(found.includes(id), id);
  assert.deepEqual(report.rules.map((r) => r.id), ['R-REF-001']);
  assert.equal(report.sourcesFile.exists, false);
  assert.equal(report.coverage.exists, false);
});

test('works with no living docs and outside git', () => {
  for (const git of [true, false]) {
    const report = syncReport(makeRepo({ 'a.ts': '1' }, { git }), { home: '/nonexistent', today: '2026-10-11' });
    assert.deepEqual([report.docs, report.rules, report.sources, report.findings], [[], [], [], []]);
  }
});

test('the CLI prints the sync report', () => {
  const cli = fileURLToPath(new URL('../src/longevo.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'sync', '--cwd', makeRepo({ 'a.ts': '1' })], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout);
  assert.equal(JSON.parse(result.stdout).version, 2);
});

test('lists each missing path once', () => {
  const root = makeRepo({ 'docs/a.md': '---\ncovers: ["a.ts"]\nverified: 2026-10-01\n---\nSee `src/gone.ts`, then `src/gone.ts` again.\n', 'a.ts': '1' });
  assert.deepEqual(syncReport(root, { home: root, today: '2026-10-11' }).docs[0].missingPaths, ['src/gone.ts']);
});

test('returns the changes the user declined', async () => {
  const { apply } = await import('../src/lib/apply.mjs');
  const root = makeRepo({ 'a.ts': '1' });
  apply('decline', root, { keys: ['coverage'] });
  assert.deepEqual(syncReport(root, { home: root, today: '2026-10-11' }).declined, ['coverage']);
});

test('commits and diffs read in chunks match one call, so long file lists never hit the argument limit', () => {
  const root = makeRepo({ 'docs/domain/refunds.md': DOC, 'src/refunds/policy.ts': '1\n', 'src/refunds/a.ts': '1\n', 'src/refunds/b.ts': '1\n' });
  const anchor = gitIn(root, 'rev-parse', 'HEAD').trim();
  commit(root, { 'src/refunds/a.ts': '2\n' }, 'Change a');
  commit(root, { 'src/refunds/b.ts': '2\n', 'src/refunds/policy.ts': '2\n' }, 'Change b and policy');
  commit(root, { 'src/refunds/a.ts': '3\n' }, 'Change a again');
  const sc = scope(root);
  const files = ['src/refunds/a.ts', 'src/refunds/b.ts', 'src/refunds/policy.ts'];
  assert.deepEqual(commitsTouching(sc, anchor, files, { chunk: 1 }), commitsTouching(sc, anchor, files));
  assert.deepEqual(commitsTouching(sc, anchor, files).map((c) => c.subject), ['Change a again', 'Change b and policy', 'Change a']);
  assert.deepEqual(diffSince(sc, anchor, files, { left: 1500 }, { chunk: 1 }), diffSince(sc, anchor, files, { left: 1500 }));
});

test('a finished brief whose criteria are already rules is not proposed again', () => {
  const brief = '---\nstatus: done\ntask: "#7"\ncovers: ["src/refunds/**"]\n---\n# Brief\n';
  const root = makeRepo({ 'docs/work/2026-10-01-shorter-window/brief.md': brief, 'docs/work/2026-10-02-fees/brief.md': brief, 'src/refunds/policy.ts': '1\n' });
  assert.deepEqual(syncReport(root, { home: root }).briefs.done.map((b) => b.path), ['docs/work/2026-10-01-shorter-window/brief.md', 'docs/work/2026-10-02-fees/brief.md']);
  commit(root, { 'docs/domain/refunds.md': '### R-REF-002 · A refund expires after 24 hours\nSource: docs/work/2026-10-01-shorter-window/brief.md\nStatus: missing\n' }, 'Move the criteria');
  assert.deepEqual(syncReport(root, { home: root }).briefs.done.map((b) => b.path), ['docs/work/2026-10-02-fees/brief.md']);
});

test('a rule citing a brief whose name only starts with another brief does not hide it', () => {
  const brief = '---\nstatus: done\ntask: "#7"\ncovers: ["src/**"]\n---\n# Brief\n';
  const root = makeRepo({ 'docs/work/2026-10-11-auth/brief.md': brief, 'src/a.ts': '1\n', 'docs/domain/auth.md': '### R-AUTH-001 · Tokens expire\nSource: docs/work/2026-10-11-auth-tokens/brief.md\nStatus: missing\n' });
  assert.deepEqual(syncReport(root, { home: root }).briefs.done.map((b) => b.path), ['docs/work/2026-10-11-auth/brief.md']);
});
