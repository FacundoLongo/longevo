// Secrets in diffs and errors, .git in another case, byte order marks, fences, rule and source parsing, and
// review keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from '../src/lib/apply.mjs';
import { livingDocs } from '../src/lib/docs.mjs';
import { scope } from '../src/lib/repo.mjs';
import { redact, securityFindings } from '../src/lib/security.mjs';
import { reviewReport } from '../src/review.mjs';
import { syncReport } from '../src/sync.mjs';
import { gitIn, makeRepo, writeFiles } from './helpers/fixture.mjs';

const cli = fileURLToPath(new URL('../src/longevo.mjs', import.meta.url));
const read = (root, path) => readFileSync(join(root, path), 'utf8');
const commit = (root, files, message) => {
  writeFiles(root, files);
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', message);
};
const listed = (root) => gitIn(root, 'ls-files').split('\n').filter(Boolean);
const PEM = ['-----BEGIN RSA PRIVATE KEY-----', 'MIIEowIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gun', 'VTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u+qKhbwKfBstIs+bMY2Zkp18gnTxK', '-----END RSA PRIVATE KEY-----'];

test('secrets on added or removed diff lines are redacted', () => {
  assert.equal(redact('+password: hunter2hunter2'), '+[redacted]');
  assert.equal(redact('-api_token: Zx9Qw8Er7Ty6Ui5'), '-[redacted]');
});

test('a private key is redacted from its first line to its last, and every line is reported', () => {
  const text = `const k = \`\n${PEM.map((line) => `+${line}`).join('\n')}\n\`;`;
  const out = redact(text);
  assert.equal(out.includes('MIIEow'), false, out);
  assert.equal(out.includes('VTLw7on'), false, out);
  assert.deepEqual(securityFindings('k.pem', PEM.join('\n')).map((f) => f.line), [1, 2, 3, 4]);
});

test('sync never prints a secret from a YAML file in its diff', () => {
  const root = makeRepo({ 'docs/config.md': '---\ncovers: ["config/**"]\nverified: 2026-01-01\n---\n# Config\n', 'config/app.yml': 'name: app\n' });
  commit(root, { 'config/app.yml': 'name: app\npassword: hunter2hunter2\napi_token: Zx9Qw8Er7Ty6Ui5\n' }, 'Add secrets');
  const out = JSON.stringify(syncReport(root, { home: root }));
  assert.equal(out.includes('hunter2hunter2'), false);
  assert.equal(out.includes('Zx9Qw8Er7Ty6Ui5'), false);
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

test('errors are redacted and a bad frontmatter line is named by its number', () => {
  const root = makeRepo({ 'docs/bad.md': '---\ncovers: ["src/**"]\nweird AKIA1234567890ABCDEF line\n---\n', 'src/a.ts': '1' });
  const result = spawnSync(process.execPath, [cli, 'apply', 'verify', '--cwd', root], { input: '{"doc": "docs/bad.md"}', encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).error, 'docs/bad.md: Cannot read line 3 of the frontmatter.');
  const url = spawnSync(process.execPath, [cli, 'apply', 'checked', '--cwd', root], { input: '{"doc": "docs/bad.md", "url": "https://user:hunter2hunter2@host/x"}', encoding: 'utf8' });
  assert.equal(url.stdout.includes('hunter2hunter2'), false, url.stdout);
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

test('a doc that starts with a byte order mark works like any other', () => {
  const doc = '﻿---\ncovers: ["src/**"]\nverified: 2026-01-01\n---\n# A\n';
  const root = makeRepo({ 'docs/a.md': doc, 'src/a.ts': '1' });
  commit(root, { 'src/a.ts': '2' }, 'change');
  const [living] = livingDocs(scope(root), listed(root), new Set()).living;
  assert.equal(living.stale, true);
  assert.equal(apply('verify', root, { doc: 'docs/a.md' }, { today: '2026-10-11' }).status, 'written');
  assert.equal(read(root, 'docs/a.md'), doc.replace('2026-01-01', '2026-10-11'));
  apply('frontmatter', root, { doc: 'docs/a.md', covers: ['src/**'], verified: '2026-10-12' });
  assert.equal(read(root, 'docs/a.md').match(/---/g).length, 2);
});

const commitAt = (root, files, message, { author, committer }) => {
  writeFiles(root, files);
  gitIn(root, 'add', ...Object.keys(files));
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', message], { cwd: root, env: { ...process.env, GIT_AUTHOR_DATE: `${author}T12:00:00`, GIT_COMMITTER_DATE: `${committer ?? author}T12:00:00` } });
};
const living = (root) => livingDocs(scope(root), listed(root), new Set()).living;
const DOC = '---\ncovers: ["src/pay/**"]\nverified: 2026-01-01\n---\n# Pay\n';

test('a big commit, like a squash merge, still makes a doc stale', () => {
  const root = makeRepo({ 'docs/pay.md': DOC, 'src/pay/a.ts': '1' });
  commit(root, { ...Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`src/other/f${i}.ts`, 'x'])), 'src/pay/a.ts': '2' }, 'Squash a big PR');
  assert.deepEqual(living(root)[0].changed, ['src/pay/a.ts']);
});

test('moving a stale doc keeps it stale', () => {
  const root = makeRepo({ 'docs/pay.md': DOC, 'src/pay/a.ts': '1' });
  const anchor = gitIn(root, 'rev-parse', 'HEAD').trim();
  commit(root, { 'src/pay/a.ts': '2' }, 'change');
  gitIn(root, 'mv', 'docs/pay.md', 'docs/domain-pay.md');
  gitIn(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'move the doc');
  const [doc] = living(root);
  assert.equal(doc.stale, true);
  assert.equal(doc.anchor, anchor);
});

test('commits after an uncommitted check count by their dates, not by where git stops walking', () => {
  const root = makeRepo({ 'src/pay/a.ts': '1' }, { git: false });
  gitIn(root, 'init', '-q');
  commitAt(root, { 'docs/pay.md': DOC, 'src/pay/a.ts': '1', 'src/pay/b.ts': '1', 'src/pay/c.ts': '1', 'src/pay/d.ts': '1' }, 'doc', { author: '2026-01-01' });
  commitAt(root, { 'src/pay/a.ts': '2' }, 'after the check', { author: '2026-05-01' });
  commitAt(root, { 'src/pay/b.ts': '2' }, 'clock skew, before the check', { author: '2026-03-01' });
  commitAt(root, { 'src/pay/c.ts': '2' }, 'after the check again', { author: '2026-05-02' });
  commitAt(root, { 'src/pay/d.ts': '2' }, 'written before, rebased after', { author: '2026-03-01', committer: '2026-05-03' });
  writeFiles(root, { 'docs/pay.md': DOC.replace('2026-01-01', '2026-04-01') });
  assert.deepEqual(living(root)[0].changed, ['src/pay/a.ts', 'src/pay/c.ts', 'src/pay/d.ts']);
});

test('pnpm, yarn and bun can run a package binary, so only missing scripts are flagged', async () => {
  const { scan } = await import('../src/scan.mjs');
  const root = makeRepo({
    'AGENTS.md': '# A\n- `pnpm vitest run src/a.test.ts`\n- `yarn eslint .`\n- `bun tsc --noEmit`\n- `pnpm test`\n- `npm run lint`\n- `pnpm build`\n- `yarn dev`\n',
    'package.json': '{"scripts":{},"devDependencies":{"vitest":"1","eslint":"9","typescript":"5"}}',
  });
  const missing = scan(root, { home: root }).findings.filter((f) => f.id === 'missing-command').map((f) => f.name);
  assert.deepEqual(missing.sort(), ['build', 'dev', 'lint', 'test']);
});

test('apply refuses ops that need input when stdin is empty or closed, but import runs', () => {
  const root = makeRepo({ 'AGENTS.md': '# A\n\n<!-- longevo:start -->\n## Longevo\n- Run all tests: `npm test`\n<!-- longevo:end -->\n', 'CLAUDE.md': '# C\n' });
  const before = read(root, 'AGENTS.md');
  const block = spawnSync(process.execPath, [cli, 'apply', 'block', '--cwd', root], { input: '', encoding: 'utf8' });
  assert.equal(block.status, 1);
  assert.match(JSON.parse(block.stdout).error, /apply block needs its input as JSON on stdin/);
  assert.equal(read(root, 'AGENTS.md'), before);
  const explicit = spawnSync(process.execPath, [cli, 'apply', 'decline', '--cwd', root], { input: '{"keys": []}', encoding: 'utf8' });
  assert.equal(explicit.status, 0, explicit.stdout);
  const imported = spawnSync(process.execPath, [cli, 'apply', 'import', '--cwd', root], { input: '', encoding: 'utf8' });
  assert.equal(imported.status, 0, imported.stdout);
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

test('test names: a backticked or quoted name after a path, but never a path or an apostrophe', async () => {
  const { parseRules } = await import('../src/lib/rules.mjs');
  const tests = (lines) => parseRules('docs/domain/pay.md', lines.map((t, i) => `### R-PAY-${i + 1} · x\nTest: ${t}\n`).join('')).map((r) => r.test);
  assert.deepEqual(tests([
    'tests/refund.test.ts `rejects a refund after 48 hours`',
    "it('keeps the fee')",
    "doesn't refund when it's late",
    '`tests/x.test.ts` `keeps the fee`',
    "tests/x.test.ts 'keeps the fee'",
  ]), ['rejects a refund after 48 hours', 'keeps the fee', "doesn't refund when it's late", 'keeps the fee', 'keeps the fee']);
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

test('the reader takes item fields only at their own column, like the writer', async () => {
  const { parseFrontmatter } = await import('../src/lib/frontmatter.mjs');
  const { data } = parseFrontmatter('---\nsources:\n  - url: https://a\n    checked: 2020-01-01\n    archive:\n      checked: 2019-01-01\n---\n');
  assert.equal(data.sources[0].checked, '2020-01-01');
});

test('verified of another tool, on a doc without covers, is not Longevo\'s to judge', () => {
  const root = makeRepo({ 'docs/legal.md': '---\nverified:\n  - legal\n---\n# Legal\n' });
  const result = livingDocs(scope(root), listed(root), new Set());
  assert.deepEqual(result.invalid, []);
  assert.deepEqual(result.candidates.map((c) => c.path), ['docs/legal.md']);
});

test('covers without a verified date is a finding, so the doc gets checked once', async () => {
  const { docFindings } = await import('../src/lib/docs.mjs');
  const root = makeRepo({ 'docs/pay.md': '---\ncovers: ["src/pay/**"]\n---\n# Pay\n', 'src/pay/a.ts': '1' });
  const findings = docFindings(livingDocs(scope(root), listed(root), new Set()));
  assert.deepEqual(findings.map((f) => f.id), ['doc-not-verified']);
});

test('instruction files: a dangling link is reported; a fenced @AGENTS.md is not an import', async () => {
  const { scan } = await import('../src/scan.mjs');
  const { symlinkSync } = await import('node:fs');
  const root = makeRepo({ 'AGENTS.md': '# Rules\n- `npm test`\n' });
  symlinkSync('docs/gone.md', join(root, 'CLAUDE.md'));
  gitIn(root, 'add', 'CLAUDE.md');
  const dangling = scan(root, { home: root }).findings.find((f) => f.id === 'instruction-unreadable');
  assert.match(dangling.message, /link to a file that does not exist/);
  const fenced = makeRepo({ 'AGENTS.md': '# Rules\n', 'CLAUDE.md': '# C\n~~~\n@AGENTS.md\n~~~\n' });
  assert.ok(scan(fenced, { home: fenced }).findings.some((f) => f.id === 'claude-sees-only-claude-md'));
});

test('context gives how often each path changes, not only for the busiest ten files', async () => {
  const { contextReport } = await import('../src/context.mjs');
  const root = makeRepo(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`src/f${i}.ts`, '0'])));
  for (let round = 1; round <= 3; round += 1) commit(root, Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`src/f${i}.ts`, String(round)])), `round ${round}`);
  commit(root, { 'src/f11.ts': '1' }, 'quiet file');
  assert.deepEqual(contextReport(root, { paths: ['src/f11.ts'] }).hotspots.map((h) => h.file), ['src/f11.ts']);
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

test('a block before an unclosed fence is still updated in place', () => {
  const text = '<!-- longevo:start -->\n## Longevo\n- old\n<!-- longevo:end -->\n\n## Examples\n```sh\nnpm test\n';
  const root = makeRepo({ 'AGENTS.md': text });
  assert.equal(apply('block', root, { commands: [] }).status, 'written');
  assert.equal(read(root, 'AGENTS.md'), text.replace('- old', '- Start each session with the `longevo-init` skill.'));
});

test('a backticked name with a dot is a name, and stray backticks never stay in it', async () => {
  const { parseRules } = await import('../src/lib/rules.mjs');
  const [first, second] = parseRules('docs/domain/pay.md', '### R-PAY-1 · x\nTest: `refunds.test` expires\n### R-PAY-2 · y\nTest: `src/pay.test.ts`\n');
  assert.equal(first.test, 'refunds.test');
  assert.equal(second.test, 'src/pay.test.ts');
});

test('a dangling instruction link says to fix the link', async () => {
  const { scan } = await import('../src/scan.mjs');
  const { symlinkSync } = await import('node:fs');
  const root = makeRepo({ 'AGENTS.md': '# Rules\n' });
  symlinkSync('docs/gone.md', join(root, 'CLAUDE.md'));
  const finding = scan(root, { home: root }).findings.find((f) => f.id === 'instruction-unreadable');
  assert.match(finding.message, /fix or remove the link\.$/);
});

test('review gives each doc to update the newest commit under its covers, the same commit sync keys on', () => {
  const root = makeRepo({ 'docs/pay.md': DOC, 'src/pay/a.ts': '1', 'README.md': '# R\n' });
  gitIn(root, 'branch', '-M', 'main');
  gitIn(root, 'checkout', '-q', '-b', 'change');
  commit(root, { 'src/pay/a.ts': '2' }, 'change pay');
  commit(root, { 'README.md': '# R2\n' }, 'unrelated');
  const [entry] = reviewReport(root).docsToUpdate;
  const [doc] = syncReport(root, { home: root }).docs;
  assert.equal(entry.newest, doc.commits[0].hash);
  writeFiles(root, { 'src/pay/a.ts': '3' });
  assert.equal(reviewReport(root).docsToUpdate[0].newest, doc.commits[0].hash);
});

test('an explicit empty block input is refused; empty lists are a deliberate choice', () => {
  const root = makeRepo({ 'AGENTS.md': '# A\n\n<!-- longevo:start -->\n## Longevo\n- Run all tests: `npm test`\n<!-- longevo:end -->\n' });
  const before = read(root, 'AGENTS.md');
  assert.throws(() => apply('block', root, {}), /no commands, triggers, testingDoc or coverageDoc/);
  assert.equal(read(root, 'AGENTS.md'), before);
  assert.equal(apply('block', root, { commands: [] }).status, 'written');
});
