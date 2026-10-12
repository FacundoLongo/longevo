import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan as scanWithHome } from '../src/scan.mjs';
import { gitIn, makeRepo, writeFiles } from './helpers/fixture.mjs';

// Tests never read the real home folder.
const EMPTY_HOME = realpathSync(mkdtempSync(join(tmpdir(), 'longevo-home-')));
const scan = (cwd, options = {}) => scanWithHome(cwd, { home: EMPTY_HOME, ...options });

const ids = (report) => report.findings.map((f) => f.id);

test('flags CLAUDE.md that hides AGENTS.md from Claude Code', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n- Use pnpm\n', 'CLAUDE.md': '# Claude\nRead AGENTS.md for the rules.\n' });
  const report = scan(root);
  assert.ok(ids(report).includes('claude-sees-only-claude-md'));
  assert.deepEqual(report.instructions.loads['claude-code'], ['CLAUDE.md']);
  assert.deepEqual(report.instructions.loads.codex, ['AGENTS.md']);
});

test('accepts CLAUDE.md that imports AGENTS.md', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n', 'CLAUDE.md': '@AGENTS.md\n' });
  const report = scan(root);
  assert.ok(!ids(report).includes('claude-sees-only-claude-md'));
  assert.deepEqual(report.instructions.loads['claude-code'], ['CLAUDE.md', 'AGENTS.md']);
});

test('flags rules that only Claude Code sees', () => {
  assert.ok(ids(scan(makeRepo({ 'CLAUDE.md': '# Rules\n' }))).includes('only-claude-md'));
});

test('flags a repo with no entry file', () => {
  assert.ok(ids(scan(makeRepo({ 'README.md': '# App\n' }))).includes('no-entry-file'));
});

test('flags a cited npm script that does not exist', () => {
  const root = makeRepo({
    'package.json': JSON.stringify({ scripts: { build: 'tsc' } }),
    'AGENTS.md': 'Run `npm run lint` before you commit. Build with `npm run build`.\n',
  });
  const missing = scan(root).findings.filter((f) => f.id === 'missing-command').map((f) => f.name);
  assert.deepEqual(missing, ['lint']);
});

test('flags a missing single-test command', () => {
  const pkg = JSON.stringify({ scripts: { test: 'vitest run' } });
  const without = makeRepo({ 'package.json': pkg, 'AGENTS.md': 'Run `npm test` before you push.\n' });
  assert.ok(ids(scan(without)).includes('no-single-test-command'));
  const withIt = makeRepo({ 'package.json': pkg, 'AGENTS.md': 'Run `npm test`. One test: `npx vitest run src/a.test.ts`.\n' });
  assert.ok(!ids(scan(withIt)).includes('no-single-test-command'));
});

test('flags cited paths that do not exist', () => {
  const root = makeRepo({ 'src/a.ts': 'export {}\n', 'AGENTS.md': 'See `docs/arch.md` and `src/`.\n' });
  assert.deepEqual(scan(root).missingPaths.map((p) => p.path), ['docs/arch.md']);
});

test('ignores MIME types, domains and file names that exist elsewhere', () => {
  const root = makeRepo({
    'apps/web/app.ts': 'export {}\n',
    'AGENTS.md': 'Send `application/json`. Repos live at `github.com/acme/api`. Edit `app.ts`. Read `missing.md`.\n',
  });
  assert.deepEqual(scan(root).missingPaths.map((p) => p.path), ['missing.md']);
});

test('reads CRLF and BOM files', () => {
  const root = makeRepo({ 'package.json': '{"scripts":{}}', 'AGENTS.md': '\uFEFF# Rules\r\nRun `npm run lint`\r\n' });
  const missing = scan(root).findings.filter((f) => f.id === 'missing-command').map((f) => f.name);
  assert.deepEqual(missing, ['lint']);
});

test('never prints a secret', () => {
  const token = `ghp_${'a'.repeat(36)}`;
  const root = makeRepo({
    'AGENTS.md': `# Rules\ntoken: ${token}\nDeploy with \`npm run deploy -- --token ${token}\`.\n`,
    '.github/workflows/ci.yml': `jobs:\n  a:\n    steps:\n      - run: ./push.sh --token ${token}\n`,
  });
  const report = scan(root);
  assert.ok(report.security.some((s) => s.kind === 'github token' && s.line === 2));
  assert.ok(!JSON.stringify(report).includes(token));
});

test('works outside a git repo', () => {
  const report = scan(makeRepo({ 'AGENTS.md': '# Rules\n' }, { git: false }));
  assert.equal(report.scope.isGit, false);
  assert.equal(report.session, null);
  assert.deepEqual(report.instructions.files.map((f) => f.path), ['AGENTS.md']);
});

test('reports a shallow clone', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n' });
  writeFiles(root, { 'b.txt': 'b\n' });
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', 'second');
  const dest = join(realpathSync(mkdtempSync(join(tmpdir(), 'longevo-clone-'))), 'repo');
  gitIn(root, 'clone', '-q', '--depth', '1', `file://${root}`, dest);
  assert.equal(scan(dest).scope.shallow, true);
});

test('scopes to a subfolder and its parents', () => {
  const root = makeRepo({ 'AGENTS.md': '# Root\n', 'packages/a/AGENTS.md': '# A\n', 'packages/b/AGENTS.md': '# B\n' });
  const paths = scan(join(root, 'packages/a')).instructions.files.map((f) => f.path).sort();
  assert.deepEqual(paths, ['AGENTS.md', 'packages/a/AGENTS.md']);
});

test('counts tests by area and flags storage mocks', () => {
  const root = makeRepo({
    'internal/pay/pay_test.go': 'db, mock, _ := sqlmock.New()\n',
    'internal/pay/clean_test.go': 'func TestX(t *testing.T) {}\n',
    'web/src/a.test.ts': "vi.mock('../db')\n",
  });
  const tests = scan(root).tests;
  assert.deepEqual(tests.byArea, { 'internal/pay': 2, web: 1 });
  assert.deepEqual(tests.antiGoldenCandidates.map((c) => c.file).sort(), ['internal/pay/pay_test.go', 'web/src/a.test.ts']);
});

test('skips test files over 1 MB', () => {
  const root = makeRepo({ 'internal/big/big_test.go': `sqlmock\n${'x'.repeat(1_100_000)}` });
  assert.deepEqual(scan(root).tests.antiGoldenCandidates, []);
});

test('marks the session and lists commits since the last one', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n' });
  const first = scan(root, { markSession: true });
  assert.equal(first.session.last, null);
  writeFileSync(join(root, '.git', 'longevo', 'last-session'), '2000-01-01T00:00:00Z\n');
  writeFiles(root, { 'b.txt': 'b\n' });
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', 'second');
  const second = scan(root, { markSession: true });
  assert.equal(second.session.last, '2000-01-01T00:00:00Z');
  assert.ok(second.session.commits.some((c) => c.endsWith('second')));
});

test('the CLI prints JSON when it runs through a symlink', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n' });
  const real = fileURLToPath(new URL('../src/longevo.mjs', import.meta.url));
  const link = join(realpathSync(mkdtempSync(join(tmpdir(), 'longevo-link-'))), 'longevo.mjs');
  symlinkSync(real, link);
  const result = spawnSync(process.execPath, [link, 'scan', '--cwd', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).version, 2);
});

test('never prints a secret from a path, a script name or a commit subject', () => {
  const key = `sk-ant-api03-${'A'.repeat(30)}`;
  const token = `ghp_${'b'.repeat(36)}`;
  const root = makeRepo({ 'AGENTS.md': `Keys live in \`keys/${key}.json\`. Deploy with \`npm run deploy:${token}\`.\n` });
  writeFiles(root, { 'b.txt': 'b\n' });
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', `Set token=${token}`);
  const json = JSON.stringify(scan(root, { markSession: true }));
  assert.ok(!json.includes(key));
  assert.ok(!json.includes(token));
});

test('checks commands and tests only in the scope folder and its parents', () => {
  const root = makeRepo({
    'packages/a/package.json': JSON.stringify({ scripts: { build: 'tsc' } }),
    'packages/b/package.json': JSON.stringify({ scripts: { 'only-in-b': 'x' } }),
    'packages/a/AGENTS.md': 'Run `npm run build` and `npm run only-in-b`.\n',
    'packages/a/src/a.test.ts': 'test("a", () => {})\n',
    'packages/b/src/b.test.ts': "vi.mock('../db')\n",
  });
  const report = scan(join(root, 'packages/a'));
  assert.deepEqual(report.findings.filter((f) => f.id === 'missing-command').map((f) => f.name), ['only-in-b']);
  assert.deepEqual(report.tests.byArea, { 'packages/a': 1 });
  assert.deepEqual(report.tests.antiGoldenCandidates, []);
});

test('skips folders it cannot read and says so', (t) => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n', 'locked/a.md': 'x\n' }, { git: false });
  chmodSync(join(root, 'locked'), 0o000);
  t.after(() => chmodSync(join(root, 'locked'), 0o755));
  const report = scan(root);
  assert.equal(report.error, undefined);
  assert.deepEqual(report.notScanned, ['locked']);
});

test('accepts an @AGENTS.md import inside a sentence', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n', 'CLAUDE.md': 'Follow the rules in @AGENTS.md.\n' });
  const report = scan(root);
  assert.ok(!ids(report).includes('claude-sees-only-claude-md'));
  assert.deepEqual(report.instructions.loads['claude-code'], ['CLAUDE.md', 'AGENTS.md']);
});

test('does not count @AGENTS.md inside inline code as an import', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n', 'CLAUDE.md': 'Imports look like `@AGENTS.md`.\n' });
  assert.ok(ids(scan(root)).includes('claude-sees-only-claude-md'));
});

test('treats .claude/CLAUDE.md like a CLAUDE.md in its parent folder', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n', '.claude/CLAUDE.md': '# Claude rules\n' });
  const report = scan(root);
  assert.deepEqual(report.instructions.loads['claude-code'], ['.claude/CLAUDE.md']);
  assert.ok(ids(report).includes('claude-sees-only-claude-md'));
});

test('counts the raw bytes of a file, before line endings are cleaned', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\r\nOne\r\nTwo\r\n' });
  assert.equal(scan(root).instructions.files[0].bytes, 19);
});

test('does not flag a folder name that exists in the repo', () => {
  const root = makeRepo({ 'skills/x/references/a.md': '# A\n', 'AGENTS.md': 'Details go in `references/`.\n' });
  assert.deepEqual(scan(root).missingPaths, []);
});

test('follows a --cwd path that goes through a symlink', () => {
  const root = makeRepo({ 'AGENTS.md': '# Root\n', 'packages/a/AGENTS.md': '# A\n' });
  const link = join(realpathSync(mkdtempSync(join(tmpdir(), 'longevo-cwdlink-'))), 'repo');
  symlinkSync(root, link);
  const paths = scan(join(link, 'packages/a')).instructions.files.map((f) => f.path).sort();
  assert.deepEqual(paths, ['AGENTS.md', 'packages/a/AGENTS.md']);
});

test('recognizes tests, storage mocks and single-test commands across languages', () => {
  const root = makeRepo({
    'app/src/test/java/UserServiceTest.java': '@MockBean\nUserRepository repo;\n',
    'api/Tests/OrderTests.cs': 'var repo = new Mock<IOrderRepository>();\n',
    'svc/tests/test_orders.py': "with patch('svc.db.session') as session:\n    pass\n",
    'web/spec/models/user_spec.rb': 'allow(UserRepository).to receive(:find)\n',
    'site/tests/Feature/UserTest.php': '$repo = $this->createMock(UserRepository::class);\n',
    'core/tests/orders.rs': 'let mut repo = MockOrderRepo::new();\n',
    'lib/test/orders_test.exs': 'Mox.expect(RepoMock, :get, fn _ -> nil end)\n',
    'AGENTS.md': 'Run one test with `./gradlew test --tests UserServiceTest`.\n',
  });
  const report = scan(root);
  assert.equal(report.tests.total, 7);
  assert.equal(report.tests.antiGoldenCandidates.length, 7);
  assert.ok(!report.findings.some((f) => f.id === 'no-single-test-command'));
});

test('the version 2 report has every new field, also outside git', () => {
  for (const git of [true, false]) {
    const root = makeRepo({ 'AGENTS.md': '# R\n', 'src/a.ts': '1' }, { git });
    const report = scan(root);
    assert.equal(report.version, 2);
    for (const key of ['home', 'workspaces', 'hotspots', 'hooks', 'agents', 'docs', 'block', 'coverage', 'declined']) {
      assert.ok(key in report, `${key} missing (git: ${git})`);
    }
    assert.deepEqual(report.block, { file: 'AGENTS.md', exists: false, lines: null });
    assert.equal(report.coverage.exists, false);
    assert.deepEqual(report.declined, []);
  }
});

test('reports the Longevo block and hook commands', () => {
  const root = makeRepo({ 'AGENTS.md': '# R\n<!-- longevo:start -->\n## Longevo\n- x\n<!-- longevo:end -->\n', 'lefthook.yml': 'pre-commit:\n  commands:\n    lint:\n      run: pnpm lint\n' });
  const report = scan(root);
  assert.deepEqual(report.block, { file: 'AGENTS.md', exists: true, lines: 2 });
  assert.deepEqual(report.commands.real.hooks, ['pnpm lint']);
  assert.deepEqual(report.hooks.map((h) => h.tool), ['lefthook']);
});

test('reads UTF-16 instruction files and reports the ones it cannot read', () => {
  const root = makeRepo({ 'src/a.ts': '1' });
  writeFileSync(join(root, 'AGENTS.md'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('# Rules\n- Run `npm test`\n', 'utf16le')]));
  writeFileSync(join(root, 'CLAUDE.md'), Buffer.from('# Claude\n\0\0binary\n'));
  const report = scan(root);
  assert.equal(report.instructions.files.find((f) => f.path === 'AGENTS.md').lines, 2);
  const unreadable = report.findings.filter((f) => f.id === 'instruction-unreadable');
  assert.deepEqual(unreadable.map((f) => f.evidence), [['CLAUDE.md']]);
  assert.match(unreadable[0].message, /NUL bytes/);
});

test('says which package.json or Makefile defines each cited command', () => {
  const root = makeRepo({
    'AGENTS.md': '# Rules\n- `pnpm test`\n- `pnpm lint`\n- `make build`\n- `pnpm gone`\n',
    'package.json': '{"scripts":{"test":"vitest"}}',
    'web/package.json': '{"scripts":{"lint":"eslint ."}}',
    Makefile: 'build:\n\tgo build ./...\n',
  });
  const where = Object.fromEntries(scan(root).commands.cited.map((c) => [c.text, c.where]));
  assert.deepEqual(where, { 'pnpm test': ['package.json'], 'pnpm lint': ['web/package.json'], 'make build': ['Makefile'], 'pnpm gone': [] });
});

test('call assertions inside a string literal, like a fixture, do not count', () => {
  const fixture = "const code = \"expect(a).toHaveBeenCalled(); expect(b).toHaveBeenCalledWith(1); expect(c).toHaveBeenCalledTimes(2)\";\ntest('x', () => {});\n";
  const root = makeRepo({ 'src/a.test.ts': fixture });
  assert.deepEqual(scan(root).tests.antiGoldenCandidates, []);
});

test('an instruction file deleted but not staged is gone, not unreadable', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n- `npm test`\n', 'CLAUDE.md': '@AGENTS.md\n' });
  gitIn(root, 'rm', '-q', '--cached', 'CLAUDE.md');
  gitIn(root, 'add', 'CLAUDE.md');
  rmSync(join(root, 'CLAUDE.md'));
  const report = scan(root);
  assert.equal(report.findings.some((f) => f.id === 'instruction-unreadable'), false);
  assert.deepEqual(report.instructions.files.map((f) => f.path), ['AGENTS.md']);
});
