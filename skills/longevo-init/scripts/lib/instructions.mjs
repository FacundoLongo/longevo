import { statSync } from 'node:fs';
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

// The folder an instruction file applies to: .cursor/rules, .github and .claude belong to their parent.
function ownerDir(file) {
  return dirOf(file)
    .replace(/(^|\/)\.cursor\/rules(\/.*)?$/, '')
    .replace(/(^|\/)\.github(\/instructions)?$/, '')
    .replace(/(^|\/)\.claude$/, '');
}

// Text outside code, so an example in backticks is not read as an import.
const prose = (text) => text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');

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

export function whoLoads(dirs, files, texts) {
  const inChain = (name) => files.filter((file) => base(file) === name && dirs.includes(ownerDir(file)));
  const claudeFiles = [...inChain('CLAUDE.md'), ...inChain('CLAUDE.local.md')];
  const agentsFiles = inChain('AGENTS.md');
  const importsAgents = claudeFiles.some((file) => /(^|\s)@(\.\/)?AGENTS\.md\b/m.test(prose(texts[file] ?? '')));
  const claude = claudeFiles.length ? [...claudeFiles, ...(importsAgents ? agentsFiles : [])] : agentsFiles;
  const codex = dirs.flatMap((dir) => {
    const prefix = dir ? `${dir}/` : '';
    const override = files.find((file) => file === `${prefix}AGENTS.override.md`);
    const agents = files.find((file) => file === `${prefix}AGENTS.md`);
    return override ? [override] : agents ? [agents] : [];
  });
  const cursor = [...agentsFiles, ...files.filter((file) => /(^|\/)\.cursor\/rules\/.+\.mdc$/.test(file) || base(file) === '.cursorrules')];
  const gemini = inChain('GEMINI.md');
  const copilot = [
    ...files.filter((file) => /(^|\/)\.github\/(copilot-instructions\.md|instructions\/.+\.instructions\.md)$/.test(file)),
    ...agentsFiles.slice(-1),
  ];
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
    findings.push({ id: 'only-claude-md', severity: 'medium', evidence: claudeFiles, message: 'The rules live only in CLAUDE.md. Codex, Cursor and Copilot do not load it.' });
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
