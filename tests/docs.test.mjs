import { test } from 'node:test';
import assert from 'node:assert/strict';
import { livingDocs } from '../src/lib/docs.mjs';
import { scope } from '../src/lib/repo.mjs';
import { gitIn, makeRepo, writeFiles } from './helpers/fixture.mjs';

const commit = (root, files, message) => {
  writeFiles(root, files);
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', message);
};
const listed = (root) => gitIn(root, 'ls-files').split('\n').filter(Boolean);
const docs = (root) => livingDocs(scope(root), listed(root), new Set());
const DOC = '---\ncovers: ["src/pay/**"]\nverified: 2026-10-01\n---\n# Pay\n';

test('a doc is stale when covered code changes after the verified line', () => {
  const root = makeRepo({ 'docs/pay.md': DOC, 'src/pay/a.ts': '1' });
  commit(root, { 'src/pay/a.ts': '2' }, 'change pay');
  const [doc] = docs(root).living;
  assert.equal(doc.stale, true);
  assert.deepEqual(doc.changed, ['src/pay/a.ts']);
  assert.equal(doc.verified, '2026-10-01');
});

test('a typo fix in the doc does not reset the check', () => {
  const root = makeRepo({ 'docs/pay.md': DOC, 'src/pay/a.ts': '1' });
  commit(root, { 'src/pay/a.ts': '2' }, 'change pay');
  commit(root, { 'docs/pay.md': DOC.replace('# Pay', '# Payments') }, 'typo');
  assert.equal(docs(root).living[0].stale, true);
});

test('a new verified date clears it, and code changed in the same commit does not count', () => {
  const root = makeRepo({ 'docs/pay.md': DOC, 'src/pay/a.ts': '1' });
  commit(root, { 'src/pay/a.ts': '2' }, 'change pay');
  commit(root, { 'src/pay/a.ts': '3', 'docs/pay.md': DOC.replace('2026-10-01', '2026-10-11') }, 'verify');
  assert.equal(docs(root).living[0].stale, false);
});

test('code outside covers does not count', () => {
  const root = makeRepo({ 'docs/pay.md': DOC, 'src/pay/a.ts': '1', 'src/other.ts': '1' });
  commit(root, { 'src/other.ts': '2' }, 'other');
  assert.equal(docs(root).living[0].stale, false);
});

test('lockfiles and big reformat commits do not make a doc stale', () => {
  const root = makeRepo({ 'docs/pay.md': DOC, 'src/pay/a.ts': '1' });
  commit(root, { 'src/pay/package-lock.json': '{}' }, 'lock');
  commit(root, Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`src/pay/f${i}.ts`, 'x'])), 'format');
  assert.equal(docs(root).living[0].stale, false);
});

test('a doc without a committed verified line is not stale', () => {
  const root = makeRepo({ 'src/pay/a.ts': '1' });
  writeFiles(root, { 'docs/pay.md': DOC });
  const result = livingDocs(scope(root), [...listed(root), 'docs/pay.md'], new Set());
  assert.equal(result.living[0].stale, false);
});

test('works outside git', () => {
  const root = makeRepo({ 'docs/pay.md': DOC, 'src/pay/a.ts': '1' }, { git: false });
  const result = livingDocs(scope(root), ['docs/pay.md', 'src/pay/a.ts'], new Set());
  assert.equal(result.living[0].stale, false);
});

test('reports covers that match nothing and broken frontmatter', () => {
  const root = makeRepo({ 'docs/a.md': '---\ncovers: ["gone/**"]\nverified: 2026-10-01\n---\n', 'docs/b.md': '---\ncovers: [x]\n' });
  const result = docs(root);
  assert.deepEqual(result.living[0].unmatched, ['gone/**']);
  assert.deepEqual(result.invalid.map((d) => d.path), ['docs/b.md']);
});

test('lists docs that could get frontmatter, without records or generated docs', () => {
  const root = makeRepo({
    'docs/api.md': '# API\n',
    'docs/decisions/d1.md': '# D1\n',
    'docs/work/2026-10-01-x/brief.md': '# B\n',
    'docs/coverage.md': '# C\n',
    'CHANGELOG.md': '# C\n',
    'docs/pay.md': DOC,
    'src/pay/a.ts': '1',
  });
  assert.deepEqual(docs(root).candidates, [{ path: 'docs/api.md', lines: 1 }]);
});

test('the scan reports stale docs and their candidates', async () => {
  const { scan } = await import('../src/scan.mjs');
  const root = makeRepo({ 'docs/pay.md': DOC, 'docs/api.md': '# API\n', 'src/pay/a.ts': '1' });
  commit(root, { 'src/pay/a.ts': '2' }, 'change pay');
  const report = scan(root, { home: root });
  assert.ok(report.findings.some((f) => f.id === 'doc-stale' && f.evidence[0] === 'docs/pay.md'));
  assert.deepEqual(report.docs.candidates, [{ path: 'docs/api.md', lines: 1 }]);
});

test('a verified line inside a code block of the doc is not the anchor', () => {
  const root = makeRepo({ 'docs/pay.md': `${DOC}\n\`\`\`yaml\nverified: 2025-01-01\n\`\`\`\n`, 'src/pay/a.ts': '1' });
  commit(root, { 'src/pay/a.ts': '2' }, 'change pay');
  commit(root, { 'docs/pay.md': `${DOC}\n\`\`\`yaml\nverified: 2025-02-02\n\`\`\`\n` }, 'edit the example');
  assert.equal(docs(root).living[0].stale, true);
});

test('a second check on the same day, written with a time, clears the doc', () => {
  const root = makeRepo({ 'docs/pay.md': DOC.replace('2026-10-01', '2026-10-11'), 'src/pay/a.ts': '1' });
  commit(root, { 'src/pay/a.ts': '2' }, 'change pay');
  assert.equal(docs(root).living[0].stale, true);
  commit(root, { 'docs/pay.md': DOC.replace('2026-10-01', '2026-10-11T18:35:12') }, 'verify again');
  assert.equal(docs(root).living[0].stale, false);
});

test('briefs and decisions with covers are records, not living docs', () => {
  const root = makeRepo({ 'docs/work/2026-10-01-x/brief.md': DOC, 'docs/decisions/pay.md': DOC, 'src/pay/a.ts': '1' });
  assert.deepEqual(docs(root).living, []);
});
