import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from '../src/lib/apply.mjs';
import { scan } from '../src/scan.mjs';
import { gitIn, makeRepo } from './helpers/fixture.mjs';

const read = (root, path) => readFileSync(join(root, path), 'utf8');
const readPath = (path) => readFileSync(path, 'utf8');
const BLOCK = {
  commands: [{ label: 'Run all tests', command: 'pnpm test' }, { label: 'Run one test', command: 'pnpm vitest run src/cart.test.ts' }],
  triggers: [{ glob: 'src/pay/**', doc: 'docs/pay.md' }],
  testingDoc: true,
  coverageDoc: true,
  creating: ['docs/testing.md', 'docs/coverage.md'],
};
const repo = () => makeRepo({ 'AGENTS.md': '# Rules\n\n- Use pnpm.\n', 'src/pay/a.ts': '1', 'docs/pay.md': '# Pay\n', 'package.json': '{"scripts":{"test":"vitest"}}' });
const outside = () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'longevo-outside-')));
  writeFileSync(join(dir, 'notes.md'), '# Notes\n');
  return dir;
};
const outsideDir = () => realpathSync(mkdtempSync(join(tmpdir(), 'longevo-out-')));

test('writes the block at the end of AGENTS.md', () => {
  const root = repo();
  const result = apply('block', root, BLOCK);
  assert.equal(result.status, 'written');
  assert.deepEqual(result.lines, { before: null, after: 7 });
  assert.equal(read(root, 'AGENTS.md'), [
    '# Rules', '', '- Use pnpm.', '',
    '<!-- longevo:start -->',
    '## Longevo',
    '- Run all tests: `pnpm test`',
    '- Run one test: `pnpm vitest run src/cart.test.ts`',
    '- If you write or change tests, read `docs/testing.md`.',
    '- If you change `src/pay/**`, read `docs/pay.md`.',
    '- What is tested and documented: `docs/coverage.md`.',
    '- Start each session with the `longevo-init` skill.',
    '<!-- longevo:end -->', '',
  ].join('\n'));
});

test('is idempotent and keeps text outside the markers', () => {
  const root = repo();
  apply('block', root, BLOCK);
  const edited = read(root, 'AGENTS.md').replace('- Use pnpm.', '- Use pnpm.\n- Added by hand.');
  writeFileSync(join(root, 'AGENTS.md'), edited);
  assert.equal(apply('block', root, BLOCK).status, 'unchanged');
  assert.equal(read(root, 'AGENTS.md'), edited);
});

test('replaces the block in place and sorts triggers', () => {
  const root = makeRepo({ 'AGENTS.md': 'Top\n<!-- longevo:start -->\nold\n<!-- longevo:end -->\nBottom\n', 'a/x.ts': '1', 'b/x.ts': '1', 'docs/a.md': '#', 'docs/b.md': '#' });
  const result = apply('block', root, { triggers: [{ glob: 'b/**', doc: 'docs/b.md' }, { glob: 'a/**', doc: 'docs/a.md' }] });
  assert.deepEqual(result.lines, { before: 1, after: 4 });
  const text = read(root, 'AGENTS.md');
  assert.ok(text.startsWith('Top\n<!-- longevo:start -->\n## Longevo\n- If you change `a/**`, read `docs/a.md`.\n- If you change `b/**`'));
  assert.ok(text.endsWith('<!-- longevo:end -->\nBottom\n'));
});

test('creates AGENTS.md when there is none', () => {
  const root = makeRepo({ 'README.md': '# App\n' });
  apply('block', root, { commands: [] });
  assert.equal(read(root, 'AGENTS.md'), '<!-- longevo:start -->\n## Longevo\n- Start each session with the `longevo-init` skill.\n<!-- longevo:end -->\n');
});

test('writes nothing when a doc is missing, a glob matches nothing or the block is too long', () => {
  const root = repo();
  const before = read(root, 'AGENTS.md');
  assert.throws(() => apply('block', root, { triggers: [{ glob: 'src/pay/**', doc: 'docs/nope.md' }] }), /docs\/nope\.md does not exist/);
  assert.throws(() => apply('block', root, { triggers: [{ glob: 'gone/**', doc: 'docs/pay.md' }] }), /gone\/\*\* matches no file/);
  assert.throws(() => apply('block', root, { testingDoc: true }), /docs\/testing\.md does not exist/);
  assert.throws(() => apply('block', root, { commands: [{ label: 'Run', command: 'a `b`' }] }), /backticks/);
  const many = Array.from({ length: 11 }, (_, i) => ({ label: `Run ${i}`, command: `make t${i}` }));
  assert.throws(() => apply('block', root, { commands: many }), /more than 12 lines/);
  assert.equal(read(root, 'AGENTS.md'), before);
});

test('adds @AGENTS.md once, with the right path from .claude', () => {
  const root = makeRepo({ 'AGENTS.md': '# R\n', 'CLAUDE.md': '# Claude\n', '.claude/CLAUDE.md': '# More\n' });
  assert.equal(apply('import', root, {}).status, 'written');
  assert.equal(read(root, 'CLAUDE.md'), '@AGENTS.md\n\n# Claude\n');
  assert.equal(apply('import', root, {}).status, 'unchanged');
  apply('import', root, { file: '.claude/CLAUDE.md' });
  assert.equal(read(root, '.claude/CLAUDE.md'), '@../AGENTS.md\n\n# More\n');
});

test('import refuses to create a CLAUDE.md', () => {
  const root = makeRepo({ 'AGENTS.md': '# R\n' });
  assert.throws(() => apply('import', root, {}), /no CLAUDE\.md/);
  assert.ok(!existsSync(join(root, 'CLAUDE.md')));
});

test('sets the Gemini context files and keeps other settings', () => {
  const root = makeRepo({ '.gemini/settings.json': JSON.stringify({ theme: 'dark', context: { fileName: 'GEMINI.md' } }) });
  apply('gemini', root, {});
  assert.deepEqual(JSON.parse(read(root, '.gemini/settings.json')), { theme: 'dark', context: { fileName: ['GEMINI.md', 'AGENTS.md'] } });
  assert.equal(apply('gemini', root, {}).status, 'unchanged');
  const fresh = makeRepo({ 'a.txt': 'a' });
  apply('gemini', fresh, {});
  assert.deepEqual(JSON.parse(read(fresh, '.gemini/settings.json')), { context: { fileName: ['AGENTS.md', 'GEMINI.md'] } });
});

test('writes nothing when .gemini/settings.json is not plain JSON', () => {
  const root = makeRepo({ '.gemini/settings.json': '{ // comment\n "a": 1 }' });
  assert.throws(() => apply('gemini', root, {}), /not plain JSON/);
  assert.equal(read(root, '.gemini/settings.json'), '{ // comment\n "a": 1 }');
});

test('adds frontmatter and checks the globs', () => {
  const root = repo();
  apply('frontmatter', root, { doc: 'docs/pay.md', covers: ['src/pay/**'], verified: '2026-10-11' });
  assert.equal(read(root, 'docs/pay.md'), '---\ncovers: ["src/pay/**"]\nverified: 2026-10-11\n---\n\n# Pay\n');
  assert.throws(() => apply('frontmatter', root, { doc: 'docs/pay.md', covers: ['gone/**'] }), /matches no file/);
  assert.throws(() => apply('frontmatter', root, { doc: 'docs/nope.md', covers: ['src/pay/**'] }), /does not exist/);
});

test('uses today as the verified date when none is given', () => {
  const root = repo();
  apply('frontmatter', root, { doc: 'docs/pay.md', covers: ['src/pay/**'] }, { today: '2030-01-02' });
  assert.match(read(root, 'docs/pay.md'), /verified: 2030-01-02/);
});

test('verified false writes covers only, so sync checks the doc before it gets a date', () => {
  const root = repo();
  apply('frontmatter', root, { doc: 'docs/pay.md', covers: ['src/pay/**'], verified: false });
  assert.equal(read(root, 'docs/pay.md'), '---\ncovers: ["src/pay/**"]\n---\n\n# Pay\n');
  assert.throws(() => apply('frontmatter', root, { doc: 'docs/pay.md', covers: ['src/pay/**'], verified: 'soon' }), /must be a date/);
});

test('verified false removes a verified date the doc already had', () => {
  const root = makeRepo({ 'docs/pay.md': '---\ntitle: Pay\nverified: 2025-01-01\n---\n# Pay\n', 'src/pay/a.ts': '1' });
  apply('frontmatter', root, { doc: 'docs/pay.md', covers: ['src/pay/**'], verified: false });
  assert.equal(read(root, 'docs/pay.md'), '---\ntitle: Pay\ncovers: ["src/pay/**"]\n---\n# Pay\n');
});

test('import adds the AGENTS.md of the folder when CLAUDE.md imports another one', () => {
  const nested = makeRepo({ 'AGENTS.md': '# R\n', 'packages/a/AGENTS.md': '# A\n', 'packages/a/CLAUDE.md': '@../../AGENTS.md\n' });
  assert.equal(apply('import', join(nested, 'packages/a'), {}).status, 'written');
  assert.equal(read(nested, 'packages/a/CLAUDE.md'), '@AGENTS.md\n\n@../../AGENTS.md\n');
  const missing = makeRepo({ 'packages/a/AGENTS.md': '# A\n', 'packages/a/CLAUDE.md': '@../AGENTS.md\n' });
  assert.equal(apply('import', join(missing, 'packages/a'), {}).status, 'written');
  const dotClaude = makeRepo({ 'AGENTS.md': '# R\n', '.claude/CLAUDE.md': '@AGENTS.md\n' });
  apply('import', dotClaude, {});
  assert.equal(read(dotClaude, '.claude/CLAUDE.md'), '@../AGENTS.md\n\n@AGENTS.md\n');
  const done = makeRepo({ 'AGENTS.md': '# R\n', 'CLAUDE.md': '# Claude\n@./AGENTS.md\n' });
  assert.equal(apply('import', done, {}).status, 'unchanged');
});

test('writes the coverage record, then reports it as unchanged', () => {
  const root = makeRepo({ 'src/a.ts': '1', 'src/a.test.ts': 'test()' });
  assert.equal(apply('coverage', root, {}).status, 'written');
  assert.match(read(root, 'docs/coverage.md'), /^# Coverage\n/);
  assert.equal(apply('coverage', root, {}).status, 'unchanged');
  assert.equal(scan(root, { home: root }).coverage.upToDate, true);
});

test('remembers declined changes inside .git and the scan returns them', () => {
  const root = repo();
  apply('decline', root, { keys: ['import:CLAUDE.md', 'block'] });
  apply('decline', root, { keys: ['block'] });
  assert.deepEqual(JSON.parse(read(root, '.git/longevo/declined.json')), ['block', 'import:CLAUDE.md']);
  assert.deepEqual(scan(root, { home: root }).declined, ['block', 'import:CLAUDE.md']);
});

test('rejects an unknown operation', () => {
  assert.throws(() => apply('delete', repo(), {}), /Unknown apply operation/);
});

test('the CLI reads the input from stdin and reports errors as JSON', () => {
  const root = repo();
  const cli = fileURLToPath(new URL('../src/longevo.mjs', import.meta.url));
  const failed = spawnSync(process.execPath, [cli, 'apply', 'import', '--cwd', root], { input: '{}', encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.match(JSON.parse(failed.stdout).error, /no CLAUDE\.md/);
  const ok = spawnSync(process.execPath, [cli, 'apply', 'block', '--cwd', root], { input: JSON.stringify({ triggers: [{ glob: 'src/pay/**', doc: 'docs/pay.md' }] }), encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout);
  assert.equal(JSON.parse(ok.stdout).status, 'written');
});

test('verify sets only the verified date', () => {
  const root = makeRepo({ 'docs/a.md': '---\ncovers: ["src/**"]\nverified: 2026-01-01\n---\n# A\n', 'src/x.ts': '1' });
  apply('verify', root, { doc: 'docs/a.md' }, { today: '2026-10-11' });
  assert.equal(read(root, 'docs/a.md'), '---\ncovers: ["src/**"]\nverified: 2026-10-11\n---\n# A\n');
  assert.throws(() => apply('verify', makeRepo({ 'docs/b.md': '# B\n' }), { doc: 'docs/b.md' }), /has no covers/);
});

test('updates one source and keeps the others', () => {
  const text = '---\ntitle: x\nsources:\n  - url: https://a\n    checked: 2026-01-01\n  - url: https://b\n    title: B\n    checked: 2026-02-02\n---\n# A\n';
  const root = makeRepo({ 'docs/a.md': text });
  apply('checked', root, { doc: 'docs/a.md', url: 'https://b' }, { today: '2026-10-11' });
  assert.equal(read(root, 'docs/a.md'), '---\ntitle: x\nsources:\n  - url: https://a\n    checked: 2026-01-01\n  - url: https://b\n    title: B\n    checked: 2026-10-11\n---\n# A\n');
  assert.throws(() => apply('checked', root, { doc: 'docs/a.md', url: 'https://zzz' }), /does not cite/);
});

test('writes docs/sources.md', () => {
  const root = makeRepo({ 'docs/a.md': '---\nsources:\n  - url: https://a\n    checked: 2026-10-01\n---\n' });
  assert.equal(apply('sources', root, {}).status, 'written');
  assert.match(read(root, 'docs/sources.md'), /\| https:\/\/a \| docs\/a\.md \| 2026-10-01 \|/);
  assert.equal(apply('sources', root, {}).status, 'unchanged');
});

test('verifying twice in one day still changes the verified line', () => {
  const root = makeRepo({ 'docs/a.md': '---\ncovers: ["src/**"]\nverified: 2026-10-11\n---\n# A\n', 'src/x.ts': '1' });
  const result = apply('verify', root, { doc: 'docs/a.md' }, { today: '2026-10-11', now: new Date(2026, 9, 11, 18, 35, 12) });
  assert.equal(result.status, 'written');
  assert.match(read(root, 'docs/a.md'), /^verified: 2026-10-11T18:35:12$/m);
});

test('creates a brief with its frontmatter and sections', () => {
  const root = makeRepo({ 'src/refunds/a.ts': '1' });
  const result = apply('brief', root, { slug: 'partial-refunds', task: 'https://github.com/o/r/issues/7', covers: ['src/refunds/**'] }, { today: '2026-10-11' });
  assert.equal(result.file, 'docs/work/2026-10-11-partial-refunds/brief.md');
  const text = read(root, result.file);
  assert.ok(text.startsWith('---\nstatus: open\ntask: "https://github.com/o/r/issues/7"\ncovers: ["src/refunds/**"]\n---\n\n# Partial refunds\n'), text);
  for (const heading of ['Goal', 'Rules that apply', 'Affected code and docs', 'Golden tests', 'What must not change', 'Open questions', 'Acceptance criteria', 'Tests']) {
    assert.match(text, new RegExp(`^## ${heading}$`, 'm'));
  }
});

test('refuses a slug that is not kebab case', () => {
  const root = makeRepo({ 'a.ts': '1' });
  for (const slug of ['../x', 'a/b', 'Has Spaces', 'dot.slug', '', 'x'.repeat(81)]) {
    assert.throws(() => apply('brief', root, { slug, task: 'x', covers: ['a.ts'] }), /kebab/, slug);
  }
});

test('never overwrites a brief', () => {
  const root = makeRepo({ 'a.ts': '1' });
  apply('brief', root, { slug: 'x', task: 't', covers: ['a.ts'] }, { today: '2026-10-11' });
  assert.throws(() => apply('brief', root, { slug: 'x', task: 't', covers: ['a.ts'] }, { today: '2026-10-11' }), /already exists/);
});

test('marks a brief done', () => {
  const root = makeRepo({ 'a.ts': '1', 'docs/a.md': '# A\n' });
  const { file } = apply('brief', root, { slug: 'x', task: 't', covers: ['a.ts'] }, { today: '2026-10-11' });
  assert.equal(apply('done', root, { doc: file }).status, 'written');
  assert.match(read(root, file), /^status: done$/m);
  assert.throws(() => apply('done', root, { doc: 'docs/a.md' }), /not a brief/);
});

test('block and import keep CRLF line endings', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\r\n\r\n- Use pnpm.\r\n', 'CLAUDE.md': '# Claude\r\n' });
  apply('block', root, { commands: [] });
  const agents = read(root, 'AGENTS.md');
  assert.equal(agents, '# Rules\r\n\r\n- Use pnpm.\r\n\r\n<!-- longevo:start -->\r\n## Longevo\r\n- Start each session with the `longevo-init` skill.\r\n<!-- longevo:end -->\r\n');
  assert.equal(apply('block', root, { commands: [] }).status, 'unchanged');
  apply('import', root, {});
  assert.equal(read(root, 'CLAUDE.md'), '@AGENTS.md\r\n\r\n# Claude\r\n');
});

test('markers inside a code fence are an example, not the block', () => {
  const example = '```markdown\n<!-- longevo:start -->\n## Longevo\n<!-- longevo:end -->\n```\n';
  const root = makeRepo({ 'AGENTS.md': `# Rules\n\n${example}` });
  apply('block', root, { commands: [] });
  const text = read(root, 'AGENTS.md');
  assert.ok(text.startsWith(`# Rules\n\n${example}`), text);
  assert.ok(text.endsWith('<!-- longevo:start -->\n## Longevo\n- Start each session with the `longevo-init` skill.\n<!-- longevo:end -->\n'), text);
  assert.equal(apply('block', root, { commands: [] }).status, 'unchanged');
});

test('checked keeps comment lines and other items of the sources list', () => {
  const text = '---\nsources:\n  # Owned by the billing team.\n  - url: https://a\n    title: A # main page\n    checked: 2026-01-01\n  - https://b\n---\n# A\n';
  const root = makeRepo({ 'docs/a.md': text });
  apply('checked', root, { doc: 'docs/a.md', url: 'https://a' }, { today: '2026-10-11' });
  assert.equal(read(root, 'docs/a.md'), text.replace('checked: 2026-01-01', 'checked: 2026-10-11'));
  apply('checked', root, { doc: 'docs/a.md', url: 'https://b' }, { today: '2026-10-11' });
  assert.match(read(root, 'docs/a.md'), /  # Owned by the billing team\.\n  - url: https:\/\/a\n    title: A # main page\n    checked: 2026-10-11\n  - url: https:\/\/b\n    checked: 2026-10-11\n---/);
});

test('checked handles inline source lists and a comment on the sources line', () => {
  const inline = makeRepo({ 'docs/a.md': '---\nsources: [https://a.com, https://b.com]\n---\n# A\n' });
  apply('checked', inline, { doc: 'docs/a.md', url: 'https://b.com' }, { today: '2026-10-11' });
  assert.match(read(inline, 'docs/a.md'), /sources:\n  - url: https:\/\/a\.com\n  - url: https:\/\/b\.com\n    checked: 2026-10-11\n---/);
  const commented = makeRepo({ 'docs/a.md': '---\nsources: # cited by the rules\n  - url: https://a.com\n---\n# A\n' });
  apply('checked', commented, { doc: 'docs/a.md', url: 'https://a.com' }, { today: '2026-10-11' });
  assert.equal(read(commented, 'docs/a.md'), '---\nsources: # cited by the rules\n  - url: https://a.com\n    checked: 2026-10-11\n---\n# A\n');
});

test('checked writes at the indent of the item fields and never inside a nested map', () => {
  const nested = '---\nsources:\n  - url: https://a\n    archive:\n      checked: 2019-01-01\n    checked: 2020-01-01\n---\n';
  const root = makeRepo({ 'docs/a.md': nested, 'docs/b.md': '---\nsources:\n  -   url: https://b\n      title: B\n---\n' });
  apply('checked', root, { doc: 'docs/a.md', url: 'https://a' }, { today: '2026-10-11' });
  assert.equal(read(root, 'docs/a.md'), nested.replace('checked: 2020-01-01', 'checked: 2026-10-11'));
  apply('checked', root, { doc: 'docs/b.md', url: 'https://b' }, { today: '2026-10-11' });
  assert.equal(read(root, 'docs/b.md'), '---\nsources:\n  -   url: https://b\n      title: B\n      checked: 2026-10-11\n---\n');
});

test('a bare source URL keeps its comment when it gets a checked date', () => {
  const root = makeRepo({ 'docs/a.md': '---\nsources:\n  - https://a.com # main policy\n---\n' });
  apply('checked', root, { doc: 'docs/a.md', url: 'https://a.com' }, { today: '2026-10-11' });
  assert.equal(read(root, 'docs/a.md'), '---\nsources:\n  - url: https://a.com # main policy\n    checked: 2026-10-11\n---\n');
});

test('a fence closes only on a matching fence, so markers after it are the block', () => {
  const text = '# Rules\n\n~~~text\n```\n~~~\n\n<!-- longevo:start -->\n## Longevo\n- Start each session with the `longevo-init` skill.\n<!-- longevo:end -->\n';
  const root = makeRepo({ 'AGENTS.md': text });
  assert.equal(apply('block', root, { commands: [] }).status, 'unchanged');
  assert.equal(read(root, 'AGENTS.md'), text);
});

test('a CRLF file whose end marker is the last line gets no stray carriage return', () => {
  const root = makeRepo({ 'AGENTS.md': '# A\r\n<!-- longevo:start -->\r\nold\r\n<!-- longevo:end -->' });
  apply('block', root, { commands: [] });
  assert.equal(read(root, 'AGENTS.md'), '# A\r\n<!-- longevo:start -->\r\n## Longevo\r\n- Start each session with the `longevo-init` skill.\r\n<!-- longevo:end -->');
});

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
  assert.throws(() => apply('block', root, { commands: [] }), /marker/);
  assert.equal(read(root, 'AGENTS.md'), text);
});

test('markers mentioned inside a sentence are not a block', () => {
  const text = 'Longevo owns the text between `<!-- longevo:start -->` and `<!-- longevo:end -->`.\n';
  const root = makeRepo({ 'AGENTS.md': text });
  assert.equal(scan(root, { home: root }).block.exists, false);
  apply('block', root, { commands: [] });
  const after = read(root, 'AGENTS.md');
  assert.ok(after.startsWith(text));
  assert.match(after, /\n<!-- longevo:start -->\n## Longevo\n/);
});

test('two blocks stop the write', () => {
  const block = '<!-- longevo:start -->\nx\n<!-- longevo:end -->\n';
  const root = makeRepo({ 'AGENTS.md': `${block}\n${block}` });
  assert.throws(() => apply('block', root, { commands: [] }), /more than one/);
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

test('declined changes can be shown again', () => {
  const root = makeRepo({ 'a.txt': 'a' });
  apply('decline', root, { keys: ['block', 'coverage'] });
  assert.deepEqual(apply('undecline', root, { keys: ['block'] }).declined, ['coverage']);
  assert.deepEqual(apply('undecline', root, { all: true }).declined, []);
  assert.ok(!existsSync(join(root, 'docs')));
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
  assert.equal(readPath(join(out, 'shared.md')), '# Shared\n');
  assert.equal(readPath(join(out, 'settings.json')), '{"theme":"dark"}');
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
  assert.equal(readPath(join(root, 'CLAUDE.md')), '# Rules\n- Use pnpm\n');
});

test('apply never writes into .git spelled in another case', () => {
  const root = makeRepo({ 'src/a.ts': '1' });
  mkdirSync(join(root, '.git', 'notes'), { recursive: true });
  writeFileSync(join(root, '.git', 'notes', 'doc.md'), '---\ncovers: ["src/**"]\nverified: 2026-01-01\n---\n');
  for (const doc of ['.GIT/notes/doc.md', '.Git/notes/doc.md', 'x/../.git/notes/doc.md']) {
    assert.throws(() => apply('verify', root, { doc }), /\.git|inside the repo/i, doc);
  }
  assert.match(read(root, '.git/notes/doc.md'), /verified: 2026-01-01/);
});

test('a fenced example in a CRLF file stays an example', () => {
  const example = '```md\r\n<!-- longevo:start -->\r\n## Longevo\r\n<!-- longevo:end -->\r\n```\r\n';
  const root = makeRepo({ 'AGENTS.md': `# A\r\n\r\n${example}` });
  apply('block', root, { commands: [{ label: 'Run all tests', command: 'npm test' }] });
  const text = read(root, 'AGENTS.md');
  assert.ok(text.startsWith(`# A\r\n\r\n${example}`), text);
  assert.ok(text.endsWith('- Run all tests: `npm test`\r\n- Start each session with the `longevo-init` skill.\r\n<!-- longevo:end -->\r\n'), text);
});

test('an unclosed fence stops the block write', () => {
  const text = '# A\n\n```md\n<!-- longevo:start -->\n';
  const root = makeRepo({ 'AGENTS.md': text });
  assert.throws(() => apply('block', root, { commands: [] }), /ends inside a code fence/);
  assert.equal(read(root, 'AGENTS.md'), text);
});

test('sources: extra spaces after the dash and comments survive a checked date', () => {
  const root = makeRepo({
    'docs/a.md': '---\nsources:\n  -   https://a.com\n---\n',
    'docs/b.md': '---\nsources: [https://a.com, https://b.com] # cited by the rules\n---\n',
    'docs/c.md': '---\nsources:\n  - "https://a.com" # main\n---\n',
  });
  for (const doc of ['docs/a.md', 'docs/b.md', 'docs/c.md']) apply('checked', root, { doc, url: 'https://a.com' }, { today: '2026-10-11' });
  assert.equal(read(root, 'docs/a.md'), '---\nsources:\n  -   url: https://a.com\n      checked: 2026-10-11\n---\n');
  assert.match(read(root, 'docs/b.md'), /^sources: # cited by the rules\n  - url: https:\/\/a\.com\n    checked: 2026-10-11\n  - url: https:\/\/b\.com\n---/m);
  assert.equal(read(root, 'docs/c.md'), '---\nsources:\n  - url: https://a.com # main\n    checked: 2026-10-11\n---\n');
});

test('a block before an unclosed fence is still updated in place', () => {
  const text = '<!-- longevo:start -->\n## Longevo\n- old\n<!-- longevo:end -->\n\n## Examples\n```sh\nnpm test\n';
  const root = makeRepo({ 'AGENTS.md': text });
  assert.equal(apply('block', root, { commands: [] }).status, 'written');
  assert.equal(read(root, 'AGENTS.md'), text.replace('- old', '- Start each session with the `longevo-init` skill.'));
});

test('an explicit empty block input is refused; empty lists are a deliberate choice', () => {
  const root = makeRepo({ 'AGENTS.md': '# A\n\n<!-- longevo:start -->\n## Longevo\n- Run all tests: `npm test`\n<!-- longevo:end -->\n' });
  const before = read(root, 'AGENTS.md');
  assert.throws(() => apply('block', root, {}), /no commands, triggers, testingDoc or coverageDoc/);
  assert.equal(read(root, 'AGENTS.md'), before);
  assert.equal(apply('block', root, { commands: [] }).status, 'written');
});
