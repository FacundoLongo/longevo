import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { git } from './repo.mjs';

export function session(sc, mark) {
  if (!sc.isGit) return null;
  const common = (git(sc.root, ['rev-parse', '--git-common-dir']) ?? '').trim();
  if (!common) return null;
  const dir = resolve(sc.root, common, 'longevo');
  const file = join(dir, 'last-session');
  let last = null;
  try {
    last = readFileSync(file, 'utf8').trim() || null;
  } catch {
    last = null;
  }
  const args = ['log', '--format=%h %s'];
  if (last) args.push(`--since=${last}`);
  else args.push('-n', '10');
  const commits = (git(sc.root, args) ?? '').split('\n').filter(Boolean).slice(0, 50);
  if (mark) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, `${new Date().toISOString()}\n`);
  }
  return { last, commits };
}
