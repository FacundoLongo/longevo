// Agent setup on this machine and in the repo: which agents are in use, their MCP server names and their skills.
// Only names are read. Home paths are shown as ~/..., never with the real home folder.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { readText } from './text.mjs';

export const AGENTS = ['claude-code', 'codex', 'cursor', 'gemini', 'copilot'];

const HOME_DIRS = { 'claude-code': '.claude', codex: '.codex', cursor: '.cursor', gemini: '.gemini', copilot: '.copilot' };
const REPO_MARKERS = {
  'claude-code': /(^|\/)(CLAUDE(\.local)?\.md$|\.claude\/)|^\.mcp\.json$/,
  codex: /(^|\/)(\.codex\/|AGENTS\.override\.md$)/,
  cursor: /(^|\/)(\.cursor\/|\.cursorrules$)/,
  gemini: /(^|\/)(GEMINI\.md$|\.gemini\/)/,
  copilot: /^\.github\/(copilot-instructions\.md$|instructions\/|skills\/|mcp\.json$)/,
};

// Folders each agent reads skills from, checked against the official docs on 2026-10-11.
const REPO_SKILL_DIRS = {
  '.claude/skills': ['claude-code', 'copilot', 'cursor'],
  '.agents/skills': ['codex', 'copilot', 'cursor', 'gemini'],
  '.cursor/skills': ['cursor'],
  '.gemini/skills': ['gemini'],
  '.github/skills': ['copilot'],
  '.codex/skills': ['cursor'],
};
const HOME_SKILL_DIRS = {
  '.claude/skills': ['claude-code', 'cursor'],
  '.agents/skills': ['codex', 'copilot', 'cursor', 'gemini'],
  '.cursor/skills': ['cursor'],
  '.gemini/skills': ['gemini'],
  '.copilot/skills': ['copilot'],
  '.codex/skills': ['cursor'],
};

const REPO_MCP = [
  { file: '.mcp.json', agents: ['claude-code', 'copilot'], key: 'mcpServers' },
  { file: '.github/mcp.json', agents: ['copilot'], key: 'mcpServers' },
  { file: '.cursor/mcp.json', agents: ['cursor'], key: 'mcpServers' },
  { file: '.vscode/mcp.json', agents: ['copilot'], key: 'servers' },
  { file: '.gemini/settings.json', agents: ['gemini'], key: 'mcpServers' },
  { file: '.codex/config.toml', agents: ['codex'], toml: true },
];
const HOME_MCP = [
  { file: '.claude.json', agents: ['claude-code'], key: 'mcpServers', projects: true },
  { file: '.cursor/mcp.json', agents: ['cursor'], key: 'mcpServers' },
  { file: '.codex/config.toml', agents: ['codex'], toml: true },
  { file: '.gemini/settings.json', agents: ['gemini'], key: 'mcpServers' },
  { file: '.copilot/mcp-config.json', agents: ['copilot'], key: 'mcpServers', bare: true },
];

const union = (lists) => [...new Set(lists.flat())].sort();

export function agentsInUse(sc, files, home) {
  return AGENTS.filter((agent) => (home && existsSync(join(home, HOME_DIRS[agent]))) || files.some((file) => REPO_MARKERS[agent].test(file)));
}

function contextFiles(path) {
  const text = readText(path);
  if (text === null) return null;
  try {
    const value = JSON.parse(text)?.context?.fileName;
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.filter((name) => typeof name === 'string');
  } catch {
    // Not plain JSON: Gemini CLI uses its default.
  }
  return null;
}

// The instruction files Gemini CLI reads. The repo setting wins over the home one.
export function geminiFiles(sc, home) {
  return contextFiles(join(sc.root, '.gemini', 'settings.json')) ?? (home ? contextFiles(join(home, '.gemini', 'settings.json')) : null) ?? ['GEMINI.md'];
}

function serverNames(text, spec, root) {
  if (spec.toml) return [...text.matchAll(/^\s*\[mcp_servers\.(?:"([^"]+)"|([^\]."]+))\]\s*$/gm)].map((m) => m[1] ?? m[2]).sort();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  const names = new Set(Object.keys(json?.[spec.key] ?? {}));
  if (spec.projects) Object.keys(json?.projects?.[root]?.mcpServers ?? {}).forEach((name) => names.add(name));
  if (spec.bare && !json?.[spec.key]) {
    for (const [name, value] of Object.entries(json ?? {})) {
      if (value && typeof value === 'object' && ('command' in value || 'url' in value || 'type' in value)) names.add(name);
    }
  }
  return [...names].sort();
}

export function mcpServers(sc, home) {
  const servers = [];
  const read = [];
  for (const spec of REPO_MCP) {
    const text = readText(join(sc.root, spec.file));
    const names = text === null ? [] : serverNames(text, spec, sc.root);
    if (names.length) servers.push({ agents: spec.agents, scope: 'repo', file: spec.file, names });
  }
  for (const spec of home ? HOME_MCP : []) {
    const text = readText(join(home, spec.file), 50_000_000);
    if (text === null) continue;
    read.push(`~/${spec.file}`);
    const names = serverNames(text, spec, sc.root);
    if (names.length) servers.push({ agents: spec.agents, scope: 'home', file: `~/${spec.file}`, names });
  }
  return { servers, read };
}

function description(path) {
  const text = readText(path);
  return text === null ? '' : String(parseFrontmatter(text).data.description ?? '');
}

export function installedSkills(sc, files, home) {
  const repo = new Map();
  for (const file of files) {
    const match = file.match(/^(\.(?:claude|agents|cursor|gemini|github|codex)\/skills)\/([^/]+)\/SKILL\.md$/);
    if (!match) continue;
    const [, dir, name] = match;
    const entry = repo.get(name) ?? { name, dirs: [], agents: [], description: description(join(sc.root, file)) };
    entry.dirs.push(dir);
    entry.agents = union([entry.agents, REPO_SKILL_DIRS[dir]]);
    repo.set(name, entry);
  }
  const homeSkills = new Map();
  const read = [];
  for (const [dir, agents] of Object.entries(home ? HOME_SKILL_DIRS : {})) {
    let names;
    try {
      names = readdirSync(join(home, dir));
    } catch {
      continue;
    }
    read.push(`~/${dir}/`);
    for (const name of names) {
      const path = join(home, dir, name, 'SKILL.md');
      if (!existsSync(path)) continue;
      const entry = homeSkills.get(name) ?? { name, agents: [], description: description(path) };
      entry.agents = union([entry.agents, agents]);
      homeSkills.set(name, entry);
    }
  }
  const sorted = (map) => [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { repo: sorted(repo), home: sorted(homeSkills), read };
}

export function skillFindings(inUse, skills) {
  const used = inUse.length ? inUse : AGENTS;
  const findings = [];
  for (const skill of skills.repo) {
    const missing = used.filter((agent) => !skill.agents.includes(agent));
    if (missing.length) {
      findings.push({
        id: 'skill-not-shared',
        severity: 'medium',
        evidence: skill.dirs.map((dir) => `${dir}/${skill.name}`),
        agents: missing,
        message: `The ${skill.name} skill is not loaded by ${missing.join(', ')}. A copy in both .agents/skills and .claude/skills reaches all five agents.`,
      });
    }
  }
  const seen = new Set();
  for (const skill of [...skills.repo, ...skills.home]) {
    if (seen.has(skill.name) || skill.name.startsWith('longevo-')) continue;
    seen.add(skill.name);
    // The name or the first sentence of the description is about tests, not a list that happens to include them.
    const firstSentence = skill.description.split(/(?<=\.)\s/)[0];
    if (/test|\btdd\b/i.test(skill.name) || /\btest(s|ing)?\b|\btdd\b/i.test(firstSentence)) {
      findings.push({
        id: 'overlapping-skill',
        severity: 'low',
        evidence: [skill.name],
        message: `The ${skill.name} skill also covers tests, so the agent may follow it instead of longevo-testing.`,
      });
    }
  }
  return findings;
}
