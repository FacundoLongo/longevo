// Every write target stays inside the repo, links in both directions are one
// file, redaction catches real secret shapes and leaves ordinary code alone, the sync report puts what the
// skill needs first, rules written by the format get no false findings, and source dates are safe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../src/lib/apply.mjs';
import { parseFrontmatter } from '../src/lib/frontmatter.mjs';
import { scope } from '../src/lib/repo.mjs';
import { findRules, ruleFindings } from '../src/lib/rules.mjs';
import { redact } from '../src/lib/security.mjs';
import { sourceFindings } from '../src/lib/sources.mjs';
import { isTestFile } from '../src/lib/tests.mjs';
import { scan } from '../src/scan.mjs';
import { syncReport } from '../src/sync.mjs';
import { gitIn, makeRepo } from './helpers/fixture.mjs';

const read = (path) => readFileSync(path, 'utf8');
const outsideDir = () => realpathSync(mkdtempSync(join(tmpdir(), 'longevo-out-')));
const listed = (root) => gitIn(root, 'ls-files').split('\n').filter(Boolean);

test('fixed write targets that link outside the repo are refused', () => {
  const out = outsideDir();
  writeFileSync(join(out, 'shared.md'), '# Shared\n');
  writeFileSync(join(out, 'settings.json'), '{"theme":"dark"}');
  const cases = [
    ['coverage', (root) => symlinkSync(out, join(root, 'docs'))],
    ['sources', (root) => { mkdirSync(join(root, 'docs')); symlinkSync(join(out, 'shared.md'), join(root, 'docs', 'sources.md')); }],
    ['gemini', (root) => symlinkSync(out, join(root, '.gemini'))],
    ['block', (root) => symlinkSync(join(out, 'shared.md'), join(root, 'AGENTS.md'))],
  ];
  for (const [op, link] of cases) {
    const root = makeRepo({ 'src/a.ts': '1', 'docs-x/a.md': '---\nsources:\n  - url: https://a\n    checked: 2026-10-01\n---\n' });
    link(root);
    assert.throws(() => apply(op, root, op === 'block' ? { commands: [] } : {}), /outside the repo/, op);
  }
  assert.equal(read(join(out, 'shared.md')), '# Shared\n');
  assert.equal(read(join(out, 'settings.json')), '{"theme":"dark"}');
  assert.ok(!existsSync(join(out, 'coverage.md')));
});

test('apply refuses to run inside the git folder', () => {
  const root = makeRepo({ 'a.ts': '1' });
  assert.throws(() => apply('block', join(root, '.git'), {}), /inside \.git/);
  assert.ok(!existsSync(join(root, '.git', 'AGENTS.md')));
});

test('an AGENTS.md that links to CLAUDE.md is one file for every agent', () => {
  const root = makeRepo({ 'CLAUDE.md': '# Rules\n- Use pnpm\n' });
  symlinkSync('CLAUDE.md', join(root, 'AGENTS.md'));
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', 'link');
  const report = scan(root, { home: root });
  assert.ok(!report.findings.some((f) => ['claude-sees-only-claude-md', 'rules-not-shared'].includes(f.id)), JSON.stringify(report.findings));
  assert.throws(() => apply('import', root, {}), /same file/);
  assert.equal(read(join(root, 'CLAUDE.md')), '# Rules\n- Use pnpm\n');
});

test('redaction catches real secret shapes', () => {
  const secrets = [
    '"password": "hunter2hunter2xx"',
    '"apiKey": "AIzaSyA1234567890abcdefghijklmnopqrstu"',
    'api_key = "abcd1234efgh5678"',
    'stripe = sk_live_abcdefghijklmnop1234',
    'DATABASE_URL=postgres://admin:SuperS3cretPw@db.example.com/app',
    'slack: xoxb-1234567890-abcdefghij',
    'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    'export api_key=abc123secretvalue',
    'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  ];
  for (const line of secrets) assert.match(redact(line), /\[redacted\]/, line);
});

test('redaction leaves ordinary code alone', () => {
  for (const line of ['CACHE_KEY = "user-profile-v2"', 'PRIMARY_KEY = "account_id_field"', 'const token = getTokenFromHeader(req);', 'const API_KEY = process.env.API_KEY;']) {
    assert.equal(redact(line), line, line);
  }
});

test('the sync report puts findings, declined and file states before the docs', () => {
  const root = makeRepo({ 'docs/a.md': '---\ncovers: ["a.ts"]\nverified: 2026-10-01\n---\n# A\n', 'a.ts': '1' });
  const keys = Object.keys(syncReport(root, { home: root, today: '2026-10-11' }));
  for (const key of ['findings', 'declined', 'coverage', 'sourcesFile']) assert.ok(keys.indexOf(key) < keys.indexOf('docs'), key);
});

test('rules are checked against the disk, not only against the scanned file list', () => {
  const root = makeRepo({ 'docs/r.md': '### R-A-001 · x\nSource: s\nCode: src/a.ts:1\nStatus: implemented without test\n', 'src/a.ts': '1\n' });
  const rules = findRules(scope(root), listed(root));
  assert.deepEqual(ruleFindings(scope(root), rules, []), []);
});

test('rules written by the format get no false findings', () => {
  assert.ok(isTestFile('src/refunds/__tests__/refund.js'));
  const doc = '### R-A-001 · Planned\nSource: s\nCode: src/planned.ts:1\nStatus: missing\n\n### R-A-002 · No source yet\nCode: src/a.ts:1\nStatus: no source\n';
  const root = makeRepo({ 'docs/r.md': doc, 'src/a.ts': '1\n' });
  const files = listed(root);
  assert.deepEqual(ruleFindings(scope(root), findRules(scope(root), files), []), []);
});

test('quoted values with comments keep their value', () => {
  const { data } = parseFrontmatter('---\nsources:\n  - url: https://a\n    checked: "2026-08-01" # by Ana\n---\n');
  assert.equal(data.sources[0].checked, '2026-08-01');
});

test('checked needs a url, and dates Longevo cannot read count as old', () => {
  const root = makeRepo({ 'docs/a.md': '---\nsources:\n  - title: No link\n    checked: 2026-01-01\n---\n' });
  assert.throws(() => apply('checked', root, { doc: 'docs/a.md' }), /url/);
  const found = sourceFindings([{ url: 'a', citedBy: ['d'], checked: 'last week' }, { url: 'b', citedBy: ['d'], checked: '2026/01/01' }], '2026-10-11');
  assert.deepEqual(found.map((f) => f.evidence[0]), ['a', 'b']);
});
