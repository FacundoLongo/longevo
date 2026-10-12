import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from '../src/lib/apply.mjs';
import { scan } from '../src/scan.mjs';
import { makeRepo } from './helpers/fixture.mjs';

const read = (root, path) => readFileSync(join(root, path), 'utf8');
const BLOCK = {
  commands: [{ label: 'Run all tests', command: 'pnpm test' }, { label: 'Run one test', command: 'pnpm vitest run src/cart.test.ts' }],
  triggers: [{ glob: 'src/pay/**', doc: 'docs/pay.md' }],
  testingDoc: true,
  coverageDoc: true,
  creating: ['docs/testing.md', 'docs/coverage.md'],
};
const repo = () => makeRepo({ 'AGENTS.md': '# Rules\n\n- Use pnpm.\n', 'src/pay/a.ts': '1', 'docs/pay.md': '# Pay\n', 'package.json': '{"scripts":{"test":"vitest"}}' });

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
  apply('block', root, {});
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
  apply('block', root, {});
  const agents = read(root, 'AGENTS.md');
  assert.equal(agents, '# Rules\r\n\r\n- Use pnpm.\r\n\r\n<!-- longevo:start -->\r\n## Longevo\r\n- Start each session with the `longevo-init` skill.\r\n<!-- longevo:end -->\r\n');
  assert.equal(apply('block', root, {}).status, 'unchanged');
  apply('import', root, {});
  assert.equal(read(root, 'CLAUDE.md'), '@AGENTS.md\r\n\r\n# Claude\r\n');
});

test('markers inside a code fence are an example, not the block', () => {
  const example = '```markdown\n<!-- longevo:start -->\n## Longevo\n<!-- longevo:end -->\n```\n';
  const root = makeRepo({ 'AGENTS.md': `# Rules\n\n${example}` });
  apply('block', root, {});
  const text = read(root, 'AGENTS.md');
  assert.ok(text.startsWith(`# Rules\n\n${example}`), text);
  assert.ok(text.endsWith('<!-- longevo:start -->\n## Longevo\n- Start each session with the `longevo-init` skill.\n<!-- longevo:end -->\n'), text);
  assert.equal(apply('block', root, {}).status, 'unchanged');
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
  assert.equal(apply('block', root, {}).status, 'unchanged');
  assert.equal(read(root, 'AGENTS.md'), text);
});

test('a CRLF file whose end marker is the last line gets no stray carriage return', () => {
  const root = makeRepo({ 'AGENTS.md': '# A\r\n<!-- longevo:start -->\r\nold\r\n<!-- longevo:end -->' });
  apply('block', root, {});
  assert.equal(read(root, 'AGENTS.md'), '# A\r\n<!-- longevo:start -->\r\n## Longevo\r\n- Start each session with the `longevo-init` skill.\r\n<!-- longevo:end -->');
});
