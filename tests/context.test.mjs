import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contextReport } from '../src/context.mjs';
import { gitIn, makeRepo, writeFiles } from './helpers/fixture.mjs';

const commit = (root, files, message) => {
  writeFiles(root, files);
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', message);
};
const REPO = {
  'docs/domain/refunds.md': '---\ncovers: ["src/refunds/**"]\nverified: 2026-10-01\n---\n### R-REF-001 · A refund expires after 48 hours\nCode: src/refunds/policy.ts:1\nTest: "rejects late refunds"\nStatus: implemented and tested\n',
  'docs/testing.md': '# Testing\n\n## Golden tests\n\n- `src/refunds/policy.test.ts`: real database\n\n## Rules\n\n- `src/other.test.ts` is not golden\n',
  'src/refunds/policy.ts': 'export const HOURS = 48;\n',
  'src/refunds/policy.test.ts': "test('rejects late refunds', () => {})\n",
  'src/cart/cart.ts': '1\n',
  'docs/work/2026-10-01-old/brief.md': '---\nstatus: open\ntask: "#12"\ncovers: ["src/refunds/**"]\n---\n# Old\n',
};

test('collects docs, rules, near tests, golden tests and open briefs for some paths', () => {
  const report = contextReport(makeRepo(REPO), { paths: ['src/refunds/policy.ts'] });
  assert.deepEqual(report.docs.map((d) => d.path), ['docs/domain/refunds.md']);
  assert.deepEqual(report.rules.map((r) => r.id), ['R-REF-001']);
  assert.deepEqual(report.tests.near.map((t) => t.file), ['src/refunds/policy.test.ts']);
  assert.deepEqual(report.golden, ['src/refunds/policy.test.ts']);
  assert.deepEqual(report.briefs.map((b) => b.path), ['docs/work/2026-10-01-old/brief.md']);
});

test('says which paths match nothing', () => {
  const report = contextReport(makeRepo(REPO), { paths: ['src/gone/**', 'src/cart/**'] });
  assert.deepEqual(report.paths, [{ pattern: 'src/gone/**', files: 0 }, { pattern: 'src/cart/**', files: 1 }]);
  assert.deepEqual(report.rules, []);
});

test('finds tests by file name across languages', () => {
  const root = makeRepo({ 'svc/cart.py': '1', 'svc/tests/test_cart.py': 'x', 'pkg/cart.go': '1', 'pkg/cart_test.go': 'x', 'app/Cart.java': '1', 'app/test/CartTest.java': 'x' });
  const report = contextReport(root, { paths: ['svc/cart.py', 'pkg/cart.go', 'app/Cart.java'] });
  assert.deepEqual(report.tests.near.map((t) => t.file).sort(), ['app/test/CartTest.java', 'pkg/cart_test.go', 'svc/tests/test_cart.py']);
});

test('the CLI takes a comma-separated list of paths', () => {
  const cli = fileURLToPath(new URL('../src/longevo.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'context', '--cwd', makeRepo(REPO), '--paths', 'src/refunds/policy.ts,src/cart/**'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout);
  assert.deepEqual(JSON.parse(result.stdout).paths.map((p) => p.files), [1, 1]);
});

test('golden tests are paths, not other code names in the section', () => {
  const root = makeRepo({ ...REPO, 'tests/a.test.mjs': 'x', 'docs/testing.md': '## Golden tests\n\n- `tests/a.test.mjs`: builds a repo with `makeRepo` and `writeFiles`.\n' });
  assert.deepEqual(contextReport(root, { paths: ['src/cart/**'] }).golden, ['tests/a.test.mjs']);
});

test('an open brief for code that does not exist yet is found by the same paths', async () => {
  const { apply } = await import('../src/lib/apply.mjs');
  const root = makeRepo({ 'src/a.ts': '1' });
  apply('brief', root, { slug: 'new-refunds', task: 't', covers: ['src/refunds/**'] }, { today: '2026-10-12' });
  assert.deepEqual(contextReport(root, { paths: ['src/refunds/**'] }).briefs.map((b) => b.path), ['docs/work/2026-10-12-new-refunds/brief.md']);
  assert.deepEqual(contextReport(root, { paths: ['src/refunds/policy.ts'] }).briefs.map((b) => b.path), ['docs/work/2026-10-12-new-refunds/brief.md']);
  assert.deepEqual(contextReport(root, { paths: ['src/orders/**'] }).briefs, []);
});

test('near tests put the same folder first before the list is cut', () => {
  const files = { 'packages/zz/src/index.ts': '1\n', 'packages/zz/src/index.test.ts': 'x\n' };
  for (let i = 0; i < 25; i += 1) files[`apps/a${String(i).padStart(2, '0')}/index.test.ts`] = 'x\n';
  const report = contextReport(makeRepo(files), { paths: ['packages/zz/src/index.ts'] });
  assert.equal(report.tests.near[0].file, 'packages/zz/src/index.test.ts');
});

test('golden tests are files that exist', async () => {
  const root = makeRepo({ 'docs/testing.md': '## Golden tests\n\n- `tests/a.test.mjs`: good\n- `docs/testing.md`: not a test\n- `src/**/*.e2e.ts`: a glob\n', 'tests/a.test.mjs': 'x' });
  assert.deepEqual(contextReport(root, { paths: ['tests/**'] }).golden, ['tests/a.test.mjs']);
  assert.ok(readFileSync(join(root, 'docs/testing.md'), 'utf8'));
});

test('context gives how often each path changes, not only for the busiest ten files', async () => {
  const { contextReport } = await import('../src/context.mjs');
  const root = makeRepo(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`src/f${i}.ts`, '0'])));
  for (let round = 1; round <= 3; round += 1) commit(root, Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`src/f${i}.ts`, String(round)])), `round ${round}`);
  commit(root, { 'src/f11.ts': '1' }, 'quiet file');
  assert.deepEqual(contextReport(root, { paths: ['src/f11.ts'] }).hotspots.map((h) => h.file), ['src/f11.ts']);
});
