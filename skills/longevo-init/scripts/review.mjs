// What a diff touches, for longevo-review: the changed files against the merge base with the default branch,
// the docs and rules that cover them, the new tests and their warning signs, the open brief, and secrets
// in added lines (file and line only).
import { join } from 'node:path';
import { generatedFiles } from './lib/attributes.mjs';
import { CODE_FILE } from './lib/coverage.mjs';
import { livingDocs } from './lib/docs.mjs';
import { matchesAny } from './lib/glob.mjs';
import { git, listFiles, scope } from './lib/repo.mjs';
import { findRules } from './lib/rules.mjs';
import { redactDeep, securityFindings } from './lib/security.mjs';
import { analyzeTests, isTestFile } from './lib/tests.mjs';
import { readText } from './lib/text.mjs';
import { briefs } from './lib/work.mjs';
import { workspaces } from './lib/workspaces.mjs';
import { VERSION } from './scan.mjs';

const lines = (out) => (out ?? '').split('\n').filter(Boolean);

function resolveBase(sc, base) {
  if (!sc.isGit) return null;
  const head = git(sc.root, ['rev-parse', '--verify', '-q', 'HEAD'])?.trim();
  if (!head) return null;
  if (base) {
    const commit = git(sc.root, ['rev-parse', '--verify', '-q', `${base}^{commit}`])?.trim();
    if (!commit) throw new Error(`${base} is not a commit.`);
    return { ref: base, commit };
  }
  const branch = git(sc.root, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim();
  for (const ref of ['origin/HEAD', 'main', 'master']) {
    if (ref === branch || !git(sc.root, ['rev-parse', '--verify', '-q', `${ref}^{commit}`])) continue;
    const commit = git(sc.root, ['merge-base', 'HEAD', ref])?.trim();
    if (commit) return { ref, commit };
  }
  return { ref: 'HEAD', commit: head };
}

// New line numbers of the added lines in a unified diff with no context.
function addedLines(diff) {
  const byFile = new Map();
  let file = null;
  let line = 0;
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ ')) {
      file = text === '+++ /dev/null' ? null : text.slice(6);
      if (file) byFile.set(file, []);
    } else if (text.startsWith('@@')) {
      line = Number(text.match(/\+(\d+)/)?.[1] ?? 0);
    } else if (file && text.startsWith('+')) {
      byFile.get(file).push({ line, text: text.slice(1) });
      line += 1;
    }
  }
  return byFile;
}

export function reviewReport(cwd, { base = null } = {}) {
  const sc = scope(cwd);
  const resolved = resolveBase(sc, base);
  const empty = { version: VERSION, scope: sc, base: resolved, changed: [], diffLines: { added: 0, removed: 0 }, docsToUpdate: [], rules: [], tests: [], code: [], brief: null, security: [], nothing: true };
  if (!resolved) return redactDeep(empty);

  const tracked = lines(git(sc.root, ['-c', 'core.quotePath=false', 'diff', '--name-status', resolved.commit])).map((row) => {
    const [status, ...paths] = row.split('\t');
    return { path: paths[paths.length - 1], status: { A: 'added', D: 'deleted', M: 'modified', R: 'renamed' }[status[0]] ?? 'modified' };
  });
  const untracked = lines(git(sc.root, ['-c', 'core.quotePath=false', 'ls-files', '--others', '--exclude-standard'])).map((path) => ({ path, status: 'untracked' }));
  const changed = [...tracked, ...untracked].sort((a, b) => a.path.localeCompare(b.path));
  if (changed.length === 0) return redactDeep(empty);

  const { files } = listFiles(sc);
  const { packages } = workspaces(sc.root, files);
  const paths = changed.map((c) => c.path);
  const present = changed.filter((c) => c.status !== 'deleted').map((c) => c.path);

  const numstat = lines(git(sc.root, ['diff', '--numstat', resolved.commit])).map((row) => row.split('\t').map(Number));
  const untrackedText = untracked.map((u) => ({ path: u.path, text: readText(join(sc.root, u.path)) ?? '' }));
  const diffLines = {
    added: numstat.reduce((sum, [added]) => sum + (added || 0), 0) + untrackedText.reduce((sum, u) => sum + u.text.replace(/\n$/, '').split('\n').filter((l, i, all) => l || all.length > 1).length, 0),
    removed: numstat.reduce((sum, [, removed]) => sum + (removed || 0), 0),
  };

  const living = livingDocs(sc, files, generatedFiles(sc, files), { drift: false }).living;
  const docsToUpdate = living
    .filter((doc) => !paths.includes(doc.path))
    .map((doc) => ({ doc: doc.path, files: paths.filter((path) => matchesAny(path, doc.covers)) }))
    .filter((entry) => entry.files.length > 0);
  const coveringDocs = new Set(living.filter((doc) => paths.some((path) => matchesAny(path, doc.covers))).map((doc) => doc.path));
  const rules = findRules(sc, files).filter((rule) => coveringDocs.has(rule.doc) || rule.code.some((ref) => paths.includes(ref.path)));

  const security = [];
  for (const [file, added] of addedLines(git(sc.root, ['-c', 'core.quotePath=false', 'diff', '-U0', resolved.commit]) ?? '')) {
    for (const { line, text } of added) for (const finding of securityFindings(file, text)) security.push({ ...finding, line });
  }
  for (const { path, text } of untrackedText) security.push(...securityFindings(path, text));

  const branch = git(sc.root, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim() ?? '';
  const open = briefs(sc, files).filter((b) => b.status !== 'done');
  const brief = open.find((b) => paths.some((path) => matchesAny(path, b.covers))) ?? open.find((b) => branch && b.path.includes(branch)) ?? null;

  return redactDeep({
    ...empty,
    changed,
    diffLines,
    docsToUpdate,
    rules,
    tests: analyzeTests(sc.root, present.filter(isTestFile), packages).map(({ file, kind, mocksStorage, callAsserts }) => ({ file, kind, mocksStorage, callAsserts })),
    code: present.filter((path) => CODE_FILE.test(path) && !isTestFile(path)),
    brief: brief && { path: brief.path, status: brief.status, task: brief.task },
    security,
    nothing: false,
  });
}
