import { execFileSync } from 'node:child_process';
import { readdirSync, realpathSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// On macOS, /usr/bin/git is a shim that runs xcrun, and xcrun fails inside sandboxes because it cannot
// write its cache. The real binaries still run, so try them in order.
const GIT_CANDIDATES = [
  process.env.LONGEVO_GIT,
  'git',
  '/Applications/Xcode.app/Contents/Developer/usr/bin/git',
  '/Library/Developer/CommandLineTools/usr/bin/git',
].filter(Boolean);

export function gitBinary(candidates = GIT_CANDIDATES) {
  for (const binary of candidates) {
    try {
      execFileSync(binary, ['--version'], { stdio: 'ignore' });
      return binary;
    } catch {
      // Try the next one.
    }
  }
  return null;
}

let resolved;
const binary = () => {
  if (resolved === undefined) resolved = gitBinary();
  return resolved;
};

export function git(cwd, args) {
  return gitInput(cwd, args, null);
}

// Runs git, with text on stdin when given. Returns null when git fails or is missing.
export function gitInput(cwd, args, input) {
  if (!binary()) return null;
  try {
    return execFileSync(binary(), args, {
      cwd,
      input: input ?? undefined,
      encoding: 'utf8',
      stdio: [input === null ? 'ignore' : 'pipe', 'pipe', 'ignore'],
      maxBuffer: 1024 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

export function scope(cwd) {
  let dir = resolve(cwd);
  try {
    dir = realpathSync(dir);
  } catch {
    // A missing folder fails later with a clear git or fs error.
  }
  const top = git(dir, ['rev-parse', '--show-toplevel']);
  if (top === null) return { isGit: false, root: dir, cwd: dir, shallow: false };
  const shallow = (git(dir, ['rev-parse', '--is-shallow-repository']) ?? '').trim() === 'true';
  return { isGit: true, root: top.trim(), cwd: dir, shallow };
}

const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', '.next', 'target']);

// Returns the files to scan, and the folders that could not be read.
export function listFiles(sc, limit = 200000) {
  if (sc.isGit) {
    const out = git(sc.root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']) ?? '';
    return { files: out.split('\0').filter(Boolean).slice(0, limit), notScanned: [] };
  }
  const files = [];
  const notScanned = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      notScanned.push(relative(sc.root, dir).split(sep).join('/') || '.');
      return;
    }
    for (const entry of entries) {
      if (files.length >= limit) return;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path);
      } else if (entry.isFile()) {
        files.push(relative(sc.root, path).split(sep).join('/'));
      }
    }
  };
  walk(sc.root);
  return { files, notScanned };
}

// Folders from the root down to the scope folder, relative to the root ('' is the root).
export function chain(sc) {
  const rel = relative(sc.root, sc.cwd).split(sep).join('/');
  const parts = rel ? rel.split('/') : [];
  const dirs = [''];
  for (let i = 1; i <= parts.length; i += 1) dirs.push(parts.slice(0, i).join('/'));
  return dirs;
}
