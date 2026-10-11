import { lstatSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './repo.mjs';

const PATTERNS = [
  /(^|\/)AGENTS\.md$/,
  /(^|\/)AGENTS\.override\.md$/,
  /(^|\/)CLAUDE\.md$/,
  /(^|\/)CLAUDE\.local\.md$/,
  /(^|\/)GEMINI\.md$/,
  /(^|\/)\.cursorrules$/,
  /(^|\/)\.cursor\/rules\/.+\.mdc$/,
  /(^|\/)\.github\/copilot-instructions\.md$/,
  /(^|\/)\.github\/instructions\/.+\.instructions\.md$/,
];

const base = (file) => file.split('/').pop();
const dirOf = (file) => (file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '');

// An @AGENTS.md import in CLAUDE.md, also written as @./AGENTS.md or @../AGENTS.md.
export const IMPORTS_AGENTS = /(^|\s)@(?:\.{1,2}\/)*AGENTS\.md\b/m;

// The folder an instruction file applies to: .cursor/rules, .github and .claude belong to their parent.
export function ownerDir(file) {
  return dirOf(file)
    .replace(/(^|\/)\.cursor\/rules(\/.*)?$/, '')
    .replace(/(^|\/)\.github(\/instructions)?$/, '')
    .replace(/(^|\/)\.claude$/, '');
}

// Text outside code, so an example in backticks is not read as an import.
export const prose = (text) => text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');

function rawSize(root, path, text) {
  try {
    return statSync(join(root, path)).size;
  } catch {
    return Buffer.byteLength(text ?? '');
  }
}

export function findInstructionFiles(files, dirs) {
  const scopeDir = dirs[dirs.length - 1];
  return files
    .filter((file) => PATTERNS.some((pattern) => pattern.test(file)))
    .filter((file) => {
      const owner = ownerDir(file);
      return dirs.includes(owner) || scopeDir === '' || owner === scopeDir || owner.startsWith(`${scopeDir}/`);
    })
    .sort();
}

export function inventory(sc, files, texts) {
  return files.map((path) => ({
    path,
    lines: texts[path] ? texts[path].replace(/\n$/, '').split('\n').length : 0,
    bytes: rawSize(sc.root, path, texts[path]),
    commits: sc.isGit && !sc.shallow ? Number((git(sc.root, ['rev-list', '--count', 'HEAD', '--', path]) ?? '0').trim()) : null,
  }));
}

export function whoLoads(dirs, files, texts, { geminiFiles = ['GEMINI.md'], aliases = new Map() } = {}) {
  const inChain = (name) => files.filter((file) => base(file) === name && dirs.includes(ownerDir(file)));
  const claudeFiles = [...inChain('CLAUDE.md'), ...inChain('CLAUDE.local.md')];
  const agentsFiles = inChain('AGENTS.md');
  const sameAsAgents = (file) => (aliases.get(file) ?? []).some((member) => base(member) === 'AGENTS.md');
  const importsAgents = claudeFiles.some((file) => sameAsAgents(file) || IMPORTS_AGENTS.test(prose(texts[file] ?? '')));
  const claude = claudeFiles.length ? [...claudeFiles, ...(importsAgents ? agentsFiles : [])] : agentsFiles;
  const codex = dirs.flatMap((dir) => {
    const prefix = dir ? `${dir}/` : '';
    const override = files.find((file) => file === `${prefix}AGENTS.override.md`);
    const agents = files.find((file) => file === `${prefix}AGENTS.md`);
    return override ? [override] : agents ? [agents] : [];
  });
  const cursor = [...agentsFiles, ...files.filter((file) => /(^|\/)\.cursor\/rules\/.+\.mdc$/.test(file) || base(file) === '.cursorrules')];
  const gemini = [...new Set(geminiFiles.flatMap(inChain))];
  const copilot = [...new Set([
    ...files.filter((file) => /(^|\/)\.github\/(copilot-instructions\.md|instructions\/.+\.instructions\.md)$/.test(file)),
    ...agentsFiles,
    ...inChain('CLAUDE.md'),
    ...inChain('GEMINI.md'),
  ])].sort();
  return { 'claude-code': claude, codex, cursor, gemini, copilot };
}

export function instructionFindings(inv, loads) {
  const findings = [];
  const claude = loads['claude-code'];
  const claudeFiles = claude.filter((file) => base(file).startsWith('CLAUDE'));
  const hasAgents = loads.codex.length > 0;
  if (!claude.length && !hasAgents) {
    findings.push({ id: 'no-entry-file', severity: 'high', message: 'There is no AGENTS.md or CLAUDE.md in this folder or its parents.' });
  }
  if (claudeFiles.length && hasAgents && !claude.some((file) => base(file) === 'AGENTS.md')) {
    findings.push({
      id: 'claude-sees-only-claude-md',
      severity: 'high',
      evidence: claudeFiles,
      message: 'CLAUDE.md and AGENTS.md both exist, and CLAUDE.md does not import @AGENTS.md. Claude Code loads only CLAUDE.md, and the other agents load only AGENTS.md.',
    });
  }
  if (claudeFiles.length && !hasAgents) {
    findings.push({ id: 'only-claude-md', severity: 'medium', evidence: claudeFiles, message: 'The rules live only in CLAUDE.md. Codex, Cursor and Gemini CLI do not load it.' });
  }
  for (const file of inv) {
    if (base(file.path) === 'CLAUDE.md' && file.lines > 200) {
      findings.push({ id: 'claude-md-too-long', severity: 'medium', evidence: [file.path], message: `${file.path} has ${file.lines} lines. Claude Code recommends fewer than 200.` });
    }
    if (file.commits === 1) {
      findings.push({ id: 'never-reviewed', severity: 'low', evidence: [file.path], message: `${file.path} has a single commit, so nobody changed it after it was written.` });
    }
  }
  const codexBytes = inv.filter((file) => loads.codex.includes(file.path)).reduce((sum, file) => sum + file.bytes, 0);
  if (codexBytes > 32768) {
    findings.push({ id: 'codex-limit', severity: 'medium', message: `Codex loads ${codexBytes} bytes of AGENTS.md here, and it stops at 32 KiB.` });
  }
  if (inv.some((file) => base(file.path) === 'CLAUDE.local.md') && hasAgents) {
    findings.push({ id: 'claude-local-hides-agents', severity: 'low', message: 'CLAUDE.local.md exists, so Claude Code ignores AGENTS.md on this machine.' });
  }
  return findings;
}

// True when a file has rules of its own, not only a title and an import.
function hasOwnRules(text = '') {
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
  return body.split('\n').some((line) => line.trim() && !/^\s*#/.test(line) && !/^\s*@\S+\s*$/.test(line));
}

// Instruction files in the chain that some agent in use does not load.
export function unsharedRules(dirs, inv, texts, loads, inUse, aliases = new Map()) {
  const findings = [];
  const reported = new Set();
  for (const { path } of inv) {
    if (base(path) === 'CLAUDE.local.md' || reported.has(path) || !dirs.includes(ownerDir(path)) || !hasOwnRules(texts[path])) continue;
    // Files that are the same file on disk count once: an agent that loads any of them sees the rules.
    const members = aliases.get(path) ?? [path];
    members.forEach((member) => reported.add(member));
    const missing = inUse.filter((agent) => !members.some((member) => loads[agent].includes(member)));
    if (missing.length) {
      findings.push({
        id: 'rules-not-shared',
        severity: 'high',
        evidence: [path],
        agents: missing,
        message: `${path} has rules that ${missing.join(', ')} ${missing.length === 1 ? 'does' : 'do'} not load.`,
      });
    }
  }
  return findings;
}

// Instruction files that are the same file on disk (CLAUDE.md -> AGENTS.md, or the other way): one text for
// every agent. Returns each such file with the files it shares its real path with.
export function linkedFiles(root, files) {
  const real = (file) => {
    try {
      return realpathSync(join(root, file));
    } catch {
      return null;
    }
  };
  const byReal = new Map();
  for (const file of files) {
    const target = real(file);
    if (target) byReal.set(target, [...(byReal.get(target) ?? []), file]);
  }
  const groups = new Map();
  for (const members of byReal.values()) if (members.length > 1) for (const file of members) groups.set(file, members);
  return groups;
}
