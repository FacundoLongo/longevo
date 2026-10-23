import { realpathSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { dirOf } from './paths.mjs';
import { git } from './repo.mjs';
import { fenceKinds, unreadableReason } from './text.mjs';

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

export const isInstructionFile = (file) => PATTERNS.some((pattern) => pattern.test(file));

const base = (file) => file.split('/').pop();

// An @AGENTS.md import in CLAUDE.md, also written as @./AGENTS.md or @../AGENTS.md.
export const IMPORTS_AGENTS = /(^|\s)@(?:\.{1,2}\/)*AGENTS\.md\b/m;

// The repo path of the AGENTS.md that this CLAUDE.md imports, or null.
function importedAgents(path, text = '') {
  const match = prose(text).match(/(?:^|\s)@((?:\.{1,2}\/)*AGENTS\.md)\b/m);
  return match ? posix.normalize(posix.join(dirOf(path) || '.', match[1])) : null;
}

// The folder an instruction file applies to: .cursor/rules, .github and .claude belong to their parent.
function ownerDir(file) {
  return dirOf(file)
    .replace(/(^|\/)\.cursor\/rules(\/.*)?$/, '')
    .replace(/(^|\/)\.github(\/instructions)?$/, '')
    .replace(/(^|\/)\.claude$/, '');
}

// Text outside code, so an example in backticks or in a fence is not read as an import.
export function prose(text) {
  const lines = text.split('\n');
  const kinds = fenceKinds(lines);
  return lines.filter((_, index) => !kinds[index]).join('\n').replace(/`[^`\n]*`/g, '');
}

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
    .filter(isInstructionFile)
    .filter((file) => {
      const owner = ownerDir(file);
      return dirs.includes(owner) || scopeDir === '' || owner === scopeDir || owner.startsWith(`${scopeDir}/`);
    })
    .sort();
}

export function inventory(sc, files, texts) {
  return files.map((path) => ({
    path,
    ...(texts[path] === null ? { unreadable: unreadableReason(join(sc.root, path)) } : {}),
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

export function instructionFindings(inv, loads, texts = {}, aliases = new Map()) {
  const findings = [];
  const claude = loads['claude-code'];
  const claudeFiles = claude.filter((file) => base(file).startsWith('CLAUDE'));
  const hasAgents = loads.codex.length > 0;
  for (const file of inv.filter((f) => f.unreadable)) {
    const fix = file.unreadable.includes('link') ? 'fix or remove the link' : 'save it as UTF-8 text';
    findings.push({ id: 'instruction-unreadable', severity: 'medium', evidence: [file.path], message: `Longevo could not read ${file.path}: ${file.unreadable}. Its rules were not checked; ${fix}.` });
  }
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
    // Claude Code loads the AGENTS.md this CLAUDE.md imports together with it, so both count. A CLAUDE.md
    // that is the same file as AGENTS.md on disk counts once.
    const linked = (aliases.get(file.path) ?? []).length > 1;
    const target = base(file.path) === 'CLAUDE.md' && !linked ? importedAgents(file.path, texts[file.path]) : null;
    const imported = target ? inv.find((f) => f.path === target) : null;
    const agentsPath = imported?.path;
    const loaded = file.lines + (imported?.lines ?? 0);
    if (base(file.path) === 'CLAUDE.md' && loaded > 200) {
      const message = imported
        ? `${file.path} and the ${agentsPath} it imports have ${loaded} lines. Claude Code loads both and recommends fewer than 200.`
        : `${file.path} has ${file.lines} lines. Claude Code recommends fewer than 200.`;
      findings.push({ id: 'claude-md-too-long', severity: 'medium', evidence: imported ? [file.path, agentsPath] : [file.path], message });
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

// The lines of a file that are rules of its own, not a title or an import.
function ruleLines(text = '') {
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
  return body.split('\n').filter((line) => line.trim() && !/^\s*#/.test(line) && !/^\s*@\S+\s*$/.test(line));
}

const hasOwnRules = (text) => ruleLines(text).length > 0;

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
      // A few lines left in a CLAUDE.md that imports an AGENTS.md with the rules are meant for Claude Code alone.
      const target = base(path) === 'CLAUDE.md' ? importedAgents(path, texts[path]) : null;
      const claudeOnly = target !== null && hasOwnRules(texts[target]) && ruleLines(texts[path]).length <= 10;
      findings.push({
        id: 'rules-not-shared',
        severity: claudeOnly ? 'low' : 'high',
        evidence: [path],
        agents: missing,
        message: claudeOnly
          ? `${path} has lines besides @AGENTS.md that only Claude Code loads. Keep only rules about Claude Code there.`
          : `${path} has rules that ${missing.join(', ')} ${missing.length === 1 ? 'does' : 'do'} not load.`,
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
