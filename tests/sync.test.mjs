import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { syncReport } from '../src/sync.mjs';
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
