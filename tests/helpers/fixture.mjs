import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export function gitIn(root, ...args) {
  return execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf8' });
}

export function writeFiles(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

export function makeRepo(files, { git = true } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'longevo-scan-')));
  writeFiles(root, files);
  if (git) {
    gitIn(root, 'init', '-q');
    gitIn(root, 'add', '-A');
    gitIn(root, 'commit', '-q', '-m', 'init');
  }
  return root;
}
