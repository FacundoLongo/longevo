// Longevo's state for this clone, kept inside the git folder so it is never committed (D9):
// the time of the last session and the changes the user declined.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { git } from './repo.mjs';

export function stateDir(sc) {
  if (!sc.isGit) return null;
  const common = (git(sc.root, ['rev-parse', '--git-common-dir']) ?? '').trim();
  return common ? resolve(sc.root, common, 'longevo') : null;
}

function readState(sc, name) {
  const dir = stateDir(sc);
  if (!dir) return null;
  try {
    return readFileSync(join(dir, name), 'utf8');
  } catch {
    return null;
  }
}

export function session(sc, mark) {
  const dir = stateDir(sc);
  if (!dir) return null;
  const last = readState(sc, 'last-session')?.trim() || null;
  const args = ['log', '--format=%h %s'];
  if (last) args.push(`--since=${last}`);
  else args.push('-n', '10');
  const commits = (git(sc.root, args) ?? '').split('\n').filter(Boolean).slice(0, 50);
  if (mark) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'last-session'), `${new Date().toISOString()}\n`);
  }
  return { last, commits };
}

export function declined(sc) {
  try {
    const list = JSON.parse(readState(sc, 'declined.json') ?? '[]');
    return Array.isArray(list) ? list.filter((key) => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

export function addDeclined(sc, keys) {
  const dir = stateDir(sc);
  if (!dir) throw new Error('Declined changes are kept inside .git, and this folder is not a git repo.');
  const list = [...new Set([...declined(sc), ...keys])].sort();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'declined.json'), `${JSON.stringify(list, null, 2)}\n`);
  return list;
}

export function removeDeclined(sc, keys, all = false) {
  const dir = stateDir(sc);
  if (!dir) throw new Error('Declined changes are kept inside .git, and this folder is not a git repo.');
  const list = all ? [] : declined(sc).filter((key) => !keys.includes(key));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'declined.json'), `${JSON.stringify(list, null, 2)}\n`);
  return list;
}
