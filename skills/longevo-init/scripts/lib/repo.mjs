import { execFileSync } from 'node:child_process';
import { readdirSync, realpathSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

// Runs git with text on stdin. Returns null when git fails.
export function gitInput(cwd, args, input) {
  try {
    return execFileSync('git', args, { cwd, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
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
