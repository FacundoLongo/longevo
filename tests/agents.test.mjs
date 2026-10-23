import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentsInUse, geminiFiles, installedSkills, mcpServers } from '../src/lib/agents.mjs';
import { scope } from '../src/lib/repo.mjs';
import { scan } from '../src/scan.mjs';
import { gitIn, makeRepo, writeFiles } from './helpers/fixture.mjs';

const newHome = (files = {}) => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'longevo-home-')));
  writeFiles(home, files);
  return home;
};
const listed = (root) => gitIn(root, 'ls-files').split('\n').filter(Boolean);
const ids = (report) => report.findings.map((f) => f.id);

test('finds the agents in use from home folders and repo files', () => {
  const root = makeRepo({ '.cursor/rules/a.mdc': '---\n---\nx\n', 'AGENTS.md': '# R\n' });
  const home = newHome({ '.claude/settings.json': '{}' });
  assert.deepEqual(agentsInUse(scope(root), listed(root), home), ['claude-code', 'cursor']);
});

test('lists MCP server names from every agent config, repo and home', () => {
  const root = makeRepo({
    '.mcp.json': JSON.stringify({ mcpServers: { linear: { command: 'x', env: { LINEAR_TOKEN: 'lin_api_SECRET' } } } }),
    '.vscode/mcp.json': JSON.stringify({ servers: { github: { url: 'https://api.example.com?token=SECRET' } } }),
  });
  const home = newHome({
    '.claude.json': JSON.stringify({ mcpServers: { notion: {} }, projects: { [root]: { mcpServers: { jira: {} } } } }),
    '.codex/config.toml': '[mcp_servers.confluence]\ncommand = "x"\n[mcp_servers.confluence.env]\nT = "y"\n[mcp_servers."my server"]\n',
    '.gemini/settings.json': JSON.stringify({ mcpServers: { drive: {} } }),
    '.copilot/mcp-config.json': JSON.stringify({ sentry: { type: 'http', url: 'https://x' } }),
  });
  const { servers, read } = mcpServers(scope(root), home);
  const byFile = Object.fromEntries(servers.map((s) => [s.file, s.names]));
  assert.deepEqual(byFile['.mcp.json'], ['linear']);
  assert.deepEqual(byFile['.vscode/mcp.json'], ['github']);
  assert.deepEqual(byFile['~/.claude.json'], ['jira', 'notion']);
  assert.deepEqual(byFile['~/.codex/config.toml'], ['confluence', 'my server']);
  assert.deepEqual(byFile['~/.gemini/settings.json'], ['drive']);
  assert.deepEqual(byFile['~/.copilot/mcp-config.json'], ['sentry']);
  assert.ok(read.includes('~/.claude.json'));
});

test('never prints MCP env or URLs, and never the real home path', () => {
  const root = makeRepo({ 'AGENTS.md': '# R\n', '.mcp.json': JSON.stringify({ mcpServers: { linear: { env: { T: 'lin_api_SECRET1' }, args: ['--key', 'SECRET2'] } } }) });
  const home = newHome({ '.cursor/mcp.json': JSON.stringify({ mcpServers: { x: { url: 'https://h?token=SECRET3' } } }) });
  const json = JSON.stringify(scan(root, { home }));
  for (const secret of ['SECRET1', 'SECRET2', 'SECRET3', home]) assert.ok(!json.includes(secret), secret);
});

test('reads the Gemini context setting, repo over home', () => {
  const root = makeRepo({ '.gemini/settings.json': JSON.stringify({ context: { fileName: ['AGENTS.md', 'GEMINI.md'] } }) });
  assert.deepEqual(geminiFiles(scope(root), newHome()), ['AGENTS.md', 'GEMINI.md']);
  const plain = makeRepo({ 'a.txt': 'a' });
  assert.deepEqual(geminiFiles(scope(plain), newHome({ '.gemini/settings.json': JSON.stringify({ context: { fileName: 'AGENTS.md' } }) })), ['AGENTS.md']);
  assert.deepEqual(geminiFiles(scope(plain), newHome()), ['GEMINI.md']);
});

test('says which agents load each repo skill', () => {
  const root = makeRepo({
    '.claude/skills/deploy/SKILL.md': '---\nname: deploy\ndescription: Deploy.\n---\n',
    '.agents/skills/lint/SKILL.md': '---\nname: lint\ndescription: Lint.\n---\n',
  });
  const { repo } = installedSkills(scope(root), listed(root), newHome());
  assert.deepEqual(repo.find((s) => s.name === 'deploy').agents, ['claude-code', 'copilot', 'cursor']);
  assert.deepEqual(repo.find((s) => s.name === 'lint').agents, ['codex', 'copilot', 'cursor', 'gemini']);
});

test('lists home skills with the agents that load them', () => {
  const home = newHome({ '.agents/skills/a/SKILL.md': '---\nname: a\ndescription: A.\n---\n', '.claude/skills/a/SKILL.md': '---\nname: a\ndescription: A.\n---\n' });
  const { home: skills } = installedSkills(scope(makeRepo({ 'x.txt': 'x' })), ['x.txt'], home);
  assert.deepEqual(skills.map((s) => [s.name, s.agents]), [['a', ['claude-code', 'codex', 'copilot', 'cursor', 'gemini']]]);
});

test('flags a repo skill that some agents in use do not load', () => {
  const root = makeRepo({ 'AGENTS.md': '# R\n', '.claude/skills/deploy/SKILL.md': '---\nname: deploy\ndescription: Deploy.\n---\n' });
  const report = scan(root, { home: newHome({ '.claude/x': '', '.codex/x': '' }) });
  assert.deepEqual(report.findings.find((f) => f.id === 'skill-not-shared').agents, ['codex']);
});

test('flags another installed testing skill', () => {
  const home = newHome({ '.claude/skills/testing/SKILL.md': '---\nname: testing\ndescription: TDD and testing for iOS apps.\n---\n' });
  const report = scan(makeRepo({ 'AGENTS.md': '# R\n' }), { home });
  assert.ok(report.findings.some((f) => f.id === 'overlapping-skill' && f.evidence.includes('testing')));
});

test('does not flag a skill that only lists testing among other topics', () => {
  const home = newHome({ '.claude/skills/product/SKILL.md': '---\nname: product\ndescription: End-to-end product development. Covers research, specs, testing, and release.\n---\n' });
  const report = scan(makeRepo({ 'AGENTS.md': '# R\n' }), { home });
  assert.ok(!report.findings.some((f) => f.id === 'overlapping-skill'));
});

test('flags rules that an agent in use does not load', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n- Use pnpm\n', '.cursor/rules/style.mdc': '---\nalwaysApply: true\n---\n- Named exports only\n' });
  const report = scan(root, { home: newHome({ '.claude/x': '', '.cursor/x': '' }) });
  const finding = report.findings.find((f) => f.id === 'rules-not-shared' && f.evidence[0] === '.cursor/rules/style.mdc');
  assert.deepEqual(finding.agents, ['claude-code']);
  assert.ok(!report.findings.some((f) => f.id === 'rules-not-shared' && f.evidence[0] === 'AGENTS.md'));
});

test('ignores a CLAUDE.md that only imports AGENTS.md', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n- Use pnpm\n', 'CLAUDE.md': '@AGENTS.md\n' });
  const report = scan(root, { home: newHome({ '.claude/x': '', '.codex/x': '' }) });
  assert.ok(!report.findings.some((f) => f.id === 'rules-not-shared'));
});

test('lines left in a CLAUDE.md that imports AGENTS.md are Claude Code rules, low severity', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n- Use pnpm\n', 'CLAUDE.md': '@AGENTS.md\n\n- Add a Co-Authored-By trailer for Claude.\n' });
  const report = scan(root, { home: newHome({ '.claude/x': '', '.codex/x': '' }) });
  const finding = report.findings.find((f) => f.id === 'rules-not-shared');
  assert.equal(finding.severity, 'low');
  assert.match(finding.message, /only Claude Code loads/);
});

test('CLAUDE.md is too long when it and the AGENTS.md it imports pass 200 lines', () => {
  const rules = Array.from({ length: 190 }, (_, i) => `- Rule ${i}`).join('\n');
  const root = makeRepo({ 'AGENTS.md': `# Rules\n${rules}\n`, 'CLAUDE.md': '@AGENTS.md\n\n- Claude only\n- Another\n- And one more\n- Four\n- Five\n- Six\n- Seven\n- Eight\n- Nine\n- Ten\n' });
  const report = scan(root, { home: newHome({ '.claude/x': '' }) });
  const finding = report.findings.find((f) => f.id === 'claude-md-too-long');
  assert.ok(finding, JSON.stringify(ids(report)));
  assert.deepEqual(finding.evidence, ['CLAUDE.md', 'AGENTS.md']);
});

test('does not count nested instruction files as unshared when run from the root', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n- a\n', 'packages/a/AGENTS.md': '# A\n- b\n' });
  const report = scan(root, { home: newHome({ '.claude/x': '' }) });
  assert.ok(!report.findings.some((f) => f.id === 'rules-not-shared'));
});

test('accepts @../AGENTS.md from .claude/CLAUDE.md', () => {
  const root = makeRepo({ 'AGENTS.md': '# Rules\n', '.claude/CLAUDE.md': '@../AGENTS.md\n' });
  assert.ok(!ids(scan(root, { home: newHome() })).includes('claude-sees-only-claude-md'));
});

test('Copilot loads CLAUDE.md, and Gemini loads AGENTS.md when its setting says so', () => {
  const root = makeRepo({ 'AGENTS.md': '# R\n', 'CLAUDE.md': '# C\n', '.gemini/settings.json': JSON.stringify({ context: { fileName: ['AGENTS.md'] } }) });
  const { loads } = scan(root, { home: newHome() }).instructions;
  assert.deepEqual(loads.copilot, ['AGENTS.md', 'CLAUDE.md']);
  assert.deepEqual(loads.gemini, ['AGENTS.md']);
});
