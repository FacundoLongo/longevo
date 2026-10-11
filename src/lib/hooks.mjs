// Pre-commit hooks and the commands they run: pre-commit, husky, lefthook, lint-staged and a local git hook.
import { realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { git } from './repo.mjs';
import { readText } from './text.mjs';

const unquote = (text) => text.trim().replace(/^(["'])(.*)\1$/, '$2');
const shellLines = (text) => text.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && !/husky\.sh/.test(line));

function lintStaged(text) {
  try {
    const config = JSON.parse(text);
    return Object.values(config['lint-staged'] ?? config).flat().filter((command) => typeof command === 'string');
  } catch {
    return [];
  }
}

function insideRepo(sc, path) {
  try {
    const real = realpathSync(path);
    const common = resolve(sc.root, (git(sc.root, ['rev-parse', '--git-common-dir']) ?? '.git').trim());
    return [realpathSync(sc.root), realpathSync(common)].some((dir) => real === dir || real.startsWith(`${dir}${sep}`));
  } catch {
    return false;
  }
}

export function hooks(sc, files) {
  const read = (file) => readText(join(sc.root, file)) ?? '';
  const found = [];
  for (const file of files.filter((f) => /^\.husky\/[^/_][^/]*$/.test(f))) found.push({ tool: 'husky', file, commands: shellLines(read(file)) });
  for (const file of files.filter((f) => /^\.?lefthook\.ya?ml$/.test(f))) {
    found.push({ tool: 'lefthook', file, commands: [...read(file).matchAll(/^\s*run:\s*(.+)$/gm)].map((m) => unquote(m[1])) });
  }
  if (files.includes('package.json')) {
    const text = read('package.json');
    if (/"lint-staged"/.test(text)) found.push({ tool: 'lint-staged', file: 'package.json', commands: lintStaged(text) });
  }
  for (const file of files.filter((f) => /^\.lintstagedrc(\.json)?$/.test(f))) found.push({ tool: 'lint-staged', file, commands: lintStaged(read(file)) });
  if (files.includes('.pre-commit-config.yaml')) {
    const commands = [...read('.pre-commit-config.yaml').matchAll(/^\s*(?:-\s*)?(?:id|entry):\s*(.+)$/gm)].map((m) => unquote(m[1]));
    found.push({ tool: 'pre-commit', file: '.pre-commit-config.yaml', commands });
  }
  if (sc.isGit) {
    const path = (git(sc.root, ['rev-parse', '--git-path', 'hooks/pre-commit']) ?? '').trim();
    const full = path && (isAbsolute(path) ? path : join(sc.root, path));
    // A hooks folder outside the repo (a global core.hooksPath) is personal setup: never read it.
    const text = full && insideRepo(sc, full) ? readText(full) : null;
    if (text !== null) found.push({ tool: 'git', file: relative(sc.root, full).split(sep).join('/'), commands: shellLines(text) });
  }
  return found.sort((a, b) => a.tool.localeCompare(b.tool) || a.file.localeCompare(b.file));
}
