// Fixes from the step 2 review: writes stay inside the repo, markers are whole lines, inputs are checked,
// hooks outside the repo are not read, drift ignores noise when it counts big commits, and declines can be undone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../src/lib/apply.mjs';
import { renderCoverage } from '../src/lib/coverage.mjs';
import { livingDocs } from '../src/lib/docs.mjs';
import { hooks } from '../src/lib/hooks.mjs';
import { hotspots } from '../src/lib/hotspots.mjs';
import { scope } from '../src/lib/repo.mjs';
import { redact } from '../src/lib/security.mjs';
import { scan } from '../src/scan.mjs';
import { gitIn, makeRepo, writeFiles } from './helpers/fixture.mjs';

const read = (root, path) => readFileSync(join(root, path), 'utf8');
const listed = (root) => gitIn(root, 'ls-files').split('\n').filter(Boolean);
const outside = () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'longevo-outside-')));
  writeFileSync(join(dir, 'notes.md'), '# Notes\n');
  return dir;
};
const commit = (root, files, message) => {
  writeFiles(root, files);
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', message);
};

test('apply never writes outside the repo, into .git or into code files', () => {
  const out = outside();
  const root = makeRepo({ 'AGENTS.md': '# R\n', 'CLAUDE.md': '# C\n', 'src/a.js': 'x\n', 'docs/a.md': '# A\n' });
  const rel = `../${out.split('/').pop()}/notes.md`;
  assert.throws(() => apply('frontmatter', root, { doc: rel, covers: ['src/**'] }), /inside the repo/);
  assert.throws(() => apply('frontmatter', root, { doc: '.git/config', covers: ['src/**'] }), /\.git/);
  assert.throws(() => apply('frontmatter', root, { doc: 'src/a.js', covers: ['src/**'] }), /Markdown/);
  assert.throws(() => apply('verify', root, { doc: rel }), /inside the repo/);
  assert.throws(() => apply('import', root, { file: rel }), /inside the repo/);
  assert.throws(() => apply('import', root, { file: 'src/a.js' }), /CLAUDE\.md/);
  assert.throws(() => apply('block', root, { triggers: [{ glob: 'src/**', doc: rel }] }), /inside the repo/);
  assert.equal(readFileSync(join(out, 'notes.md'), 'utf8'), '# Notes\n');
  assert.equal(read(root, 'src/a.js'), 'x\n');
  assert.doesNotMatch(read(root, '.git/config'), /covers/);
});

test('apply refuses a doc that links outside the repo', () => {
  const out = outside();
  const root = makeRepo({ 'src/a.ts': '1' });
  mkdirSync(join(root, 'docs'));
  symlinkSync(join(out, 'notes.md'), join(root, 'docs', 'link.md'));
  assert.throws(() => apply('frontmatter', root, { doc: 'docs/link.md', covers: ['src/**'] }), /outside the repo/);
  assert.equal(readFileSync(join(out, 'notes.md'), 'utf8'), '# Notes\n');
});

test('a start marker without an end marker stops the write', () => {
  const text = '# Rules\n<!-- longevo:start -->\n## My rules\n- Use pnpm.\n- Never push to main.\n';
  const root = makeRepo({ 'AGENTS.md': text });
  assert.throws(() => apply('block', root, {}), /marker/);
  assert.equal(read(root, 'AGENTS.md'), text);
});

test('markers mentioned inside a sentence are not a block', () => {
  const text = 'Longevo owns the text between `<!-- longevo:start -->` and `<!-- longevo:end -->`.\n';
  const root = makeRepo({ 'AGENTS.md': text });
  assert.equal(scan(root, { home: root }).block.exists, false);
  apply('block', root, {});
  const after = read(root, 'AGENTS.md');
  assert.ok(after.startsWith(text));
  assert.match(after, /\n<!-- longevo:start -->\n## Longevo\n/);
});

test('two blocks stop the write', () => {
  const block = '<!-- longevo:start -->\nx\n<!-- longevo:end -->\n';
  const root = makeRepo({ 'AGENTS.md': `${block}\n${block}` });
  assert.throws(() => apply('block', root, {}), /more than one/);
});

test('a CLAUDE.md that links to AGENTS.md is one file for every agent', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n- Use pnpm\n' });
  symlinkSync('AGENTS.md', join(root, 'CLAUDE.md'));
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', 'link');
  const report = scan(root, { home: root });
  assert.ok(!report.findings.some((f) => f.id === 'claude-sees-only-claude-md' || f.id === 'rules-not-shared'), JSON.stringify(report.findings));
  assert.ok(report.instructions.loads['claude-code'].includes('AGENTS.md'));
  assert.throws(() => apply('import', root, {}), /link/);
  assert.equal(read(root, 'AGENTS.md'), '# Rules\n- Use pnpm\n');
});

test('block triggers, created docs, dates and Gemini settings are checked', () => {
  const root = makeRepo({ 'src/a.ts': '1', 'docs/a.md': '---\ncovers: ["src/**"]\nverified: 2026-10-01\n---\n' });
  assert.throws(() => apply('block', root, { triggers: [{ glob: 'src/**', doc: 'docs/a.md`\n<!-- longevo:end -->' }] }), /backticks/);
  assert.throws(() => apply('block', root, { triggers: [{ glob: 'src/**`', doc: 'docs/a.md' }] }), /backticks/);
  assert.throws(() => apply('block', root, { testingDoc: true, creating: ['../x.md'] }), /inside the repo/);
  assert.throws(() => apply('verify', root, { doc: 'docs/a.md', verified: 'yesterday' }), /YYYY-MM-DD/);
  assert.throws(() => apply('verify', root, { doc: 'docs/a.md', verified: '2026-10-11\n---' }), /YYYY-MM-DD/);
  assert.throws(() => apply('frontmatter', root, { doc: 'docs/a.md', covers: ['src/**'], verified: 'soon' }), /YYYY-MM-DD/);
  for (const settings of ['null', '[]', '{"context":"x"}']) {
    const gem = makeRepo({ '.gemini/settings.json': settings });
    assert.throws(() => apply('gemini', gem, {}), /Add "AGENTS\.md"/, settings);
    assert.equal(read(gem, '.gemini/settings.json'), settings);
  }
});

test('hooks outside the repo are not read', () => {
  const home = outside();
  mkdirSync(join(home, 'hooks'));
  writeFileSync(join(home, 'hooks', 'pre-commit'), '#!/bin/sh\nexport API_KEY=abc123secretvalue\n');
  const root = makeRepo({ 'a.txt': 'a' });
  gitIn(root, 'config', 'core.hooksPath', join(home, 'hooks'));
  assert.deepEqual(hooks(scope(root), listed(root)), []);
});

test('redaction catches KEY, TOKEN and SECRET variables', () => {
  assert.equal(redact('export API_KEY=abc123secretvalue'), 'export [redacted]');
  assert.equal(redact('STRIPE_SECRET: "sk_live_abcdefgh"'), '[redacted]');
});

test('a commit with real code and many generated files still counts', () => {
  const root = makeRepo({ '.gitattributes': 'gen/** linguist-generated=true\n', 'docs/pay.md': '---\ncovers: ["src/pay/**"]\nverified: 2026-10-01\n---\n', 'src/pay/a.ts': '1' });
  commit(root, { 'src/pay/a.ts': '2', ...Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`gen/f${i}.ts`, 'x'])) }, 'codegen and a fix');
  const files = listed(root);
  const generated = new Set(files.filter((f) => f.startsWith('gen/')));
  assert.equal(livingDocs(scope(root), files, generated).living[0].stale, true);
  assert.ok(hotspots(scope(root), files, [], { generated }).files.some((f) => f.file === 'src/pay/a.ts' && f.commits === 2));
});

test('the coverage record stays fast with 200k files in one area', () => {
  const files = Array.from({ length: 200_000 }, (_, i) => `src/main/f${i}.java`);
  const started = Date.now();
  renderCoverage({ files, packages: [], tests: [], docs: [{ path: 'docs/a.md', covers: ['src/main/**'], verified: '2026-10-01' }] });
  assert.ok(Date.now() - started < 5000, `took ${Date.now() - started} ms`);
});

test('declined changes can be shown again', () => {
  const root = makeRepo({ 'a.txt': 'a' });
  apply('decline', root, { keys: ['block', 'coverage'] });
  assert.deepEqual(apply('undecline', root, { keys: ['block'] }).declined, ['coverage']);
  assert.deepEqual(apply('undecline', root, { all: true }).declined, []);
  assert.ok(!existsSync(join(root, 'docs')));
});
