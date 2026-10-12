// What a diff touches, for longevo-review: the changed files against the merge base with the default branch,
// the docs and rules that cover them, the new tests and their warning signs, the open brief, and secrets
// in added lines (file and line only). Generated files, vendored files and lockfiles are listed but skipped.
import { join } from 'node:path';
import { generatedFiles, LOCKFILE, VENDOR_DIR } from './lib/attributes.mjs';
import { CODE_FILE } from './lib/coverage.mjs';
import { livingDocs } from './lib/docs.mjs';
import { matchesAny } from './lib/glob.mjs';
import { git, gitCommand, gitInput, listFiles, scope } from './lib/repo.mjs';
import { findRules } from './lib/rules.mjs';
import { isSecretKind, lineFindings, redactDeep, securityFindings } from './lib/security.mjs';
import { declined } from './lib/state.mjs';
import { analyzeTests, isTestFile } from './lib/tests.mjs';
import { readText } from './lib/text.mjs';
import { briefs } from './lib/work.mjs';
import { workspaces } from './lib/workspaces.mjs';
import { VERSION } from './scan.mjs';

// The user's git config must not change what the engine reads: no external diff tool, no colors, fixed prefixes.
const DIFF = ['-c', 'core.quotePath=false', 'diff', '--no-ext-diff', '--no-color', '--src-prefix=a/', '--dst-prefix=b/'];
const lines = (out) => (out ?? '').split('\n').filter(Boolean);
const commitOf = (sc, ref) => git(sc.root, ['rev-parse', '--verify', '-q', `${ref}^{commit}`])?.trim() || null;
const mergeBase = (sc, ref) => git(sc.root, ['merge-base', 'HEAD', ref])?.trim() || null;

function defaultBranches(sc) {
  const origin = git(sc.root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])?.trim();
  const configured = git(sc.root, ['config', '--get', 'init.defaultBranch'])?.trim();
  return [...new Set([origin, configured, 'main', 'master', 'develop', 'trunk'].filter(Boolean))];
}

function resolveBase(sc, base) {
  if (!sc.isGit) return { ref: null, commit: null, fallback: 'no-git' };
  const head = commitOf(sc, 'HEAD');
  if (!head && base) throw new Error(`${base} is not a commit.`);
  if (!head) {
    // No commits yet: everything added to git or left untracked is new, so compare with the empty tree.
    const empty = gitInput(sc.root, ['hash-object', '-t', 'tree', '--stdin'], '')?.trim();
    return empty ? { ref: '(no commits)', commit: empty, fallback: 'no-commits' } : null;
  }
  if (base) {
    if (!commitOf(sc, base)) throw new Error(`${base} is not a commit.`);
    const commit = mergeBase(sc, base);
    return commit ? { ref: base, commit } : { ref: base, commit: commitOf(sc, base), fallback: 'no-merge-base' };
  }
  const branch = git(sc.root, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim();
  let unrelated = false;
  let onDefault = false;
  for (const ref of defaultBranches(sc)) {
    if (ref === branch || ref === `origin/${branch}`) {
      onDefault = true;
      continue;
    }
    if (!commitOf(sc, ref)) continue;
    const commit = mergeBase(sc, ref);
    if (commit) return { ref, commit };
    unrelated = true;
  }
  // No usable base: review the working tree against HEAD, and say why, so "nothing to review" is never a guess.
  return { ref: 'HEAD', commit: head, fallback: unrelated ? 'no-merge-base' : onDefault ? 'on-default-branch' : 'no-default-branch' };
}

// The added lines (with their new numbers) and the removed lines (with their old numbers) of each file in a
// unified diff with no context. A "+++ " line is a file header only right after a "--- " line; inside a hunk it
// is an added line that starts with "++". A deleted file is listed under its old path.
function changedLines(diff) {
  const byFile = new Map();
  let entry = null;
  let oldLine = 0;
  let newLine = 0;
  let previous = '';
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ ') && previous.startsWith('--- ')) {
      const file = text === '+++ /dev/null' ? previous.replace(/^--- a\//, '') : text.replace(/^\+\+\+ b\//, '');
      entry = { added: [], removed: [] };
      byFile.set(file, entry);
    } else if (text.startsWith('@@')) {
      const [, from, to] = text.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/) ?? [];
      oldLine = Number(from ?? 0);
      newLine = Number(to ?? 0);
    } else if (entry && text.startsWith('+')) {
      entry.added.push({ line: newLine, text: text.slice(1) });
      newLine += 1;
    } else if (entry && text.startsWith('-') && !text.startsWith('--- ')) {
      entry.removed.push({ line: oldLine, text: text.slice(1) });
      oldLine += 1;
    }
    previous = text;
  }
  return byFile;
}

function skippedAs(path, generated) {
  if (LOCKFILE.test(path)) return 'lockfile';
  if (VENDOR_DIR.test(path)) return 'vendored';
  if (generated.has(path)) return 'generated';
  return null;
}

const slugOf = (path) => path.split('/')[2]?.replace(/^\d{4}-\d{2}-\d{2}-/, '') ?? '';

export function reviewReport(cwd, { base = null } = {}) {
  const sc = scope(cwd);
  const resolved = resolveBase(sc, base);
  // HEAD names the state reviewed, so a declined change comes back after new commits (keys end with it).
  const head = sc.isGit ? commitOf(sc, 'HEAD')?.slice(0, 12) ?? null : null;
  const empty = { version: VERSION, scope: sc, base: resolved, head, declined: declined(sc), changed: [], diffCommand: null, diffLines: { added: 0, removed: 0 }, docsToUpdate: [], rules: [], tests: [], code: [], brief: null, security: [], nothing: true };
  if (!resolved?.commit) return redactDeep(empty);

  const tracked = lines(git(sc.root, [...DIFF, '--name-status', resolved.commit])).map((row) => {
    const [status, ...paths] = row.split('\t');
    const entry = { path: paths[paths.length - 1], status: { A: 'added', D: 'deleted', M: 'modified', R: 'renamed', C: 'copied' }[status[0]] ?? 'modified' };
    return status[0] === 'R' ? { ...entry, from: paths[0] } : entry;
  });
  const untracked = lines(git(sc.root, ['-c', 'core.quotePath=false', 'ls-files', '--others', '--exclude-standard'])).map((path) => ({ path, status: 'untracked' }));
  const all = [...tracked, ...untracked].sort((a, b) => a.path.localeCompare(b.path));
  const generated = generatedFiles(sc, all.map((c) => c.path));
  const changed = all.map((c) => {
    const skipped = skippedAs(c.path, generated);
    return skipped ? { ...c, skipped } : c;
  });
  const reviewed = changed.filter((c) => !c.skipped);
  if (reviewed.length === 0) return redactDeep({ ...empty, changed });

  const { files } = listFiles(sc);
  const { packages } = workspaces(sc.root, files);
  // A renamed file counts under its old path too, so docs and rules of moved code are found.
  const touched = [...new Set(reviewed.flatMap((c) => (c.from ? [c.path, c.from] : [c.path])))];
  const present = reviewed.filter((c) => c.status !== 'deleted').map((c) => c.path);
  const skippedPaths = new Set(changed.filter((c) => c.skipped).map((c) => c.path));

  const numstat = lines(git(sc.root, [...DIFF, '--numstat', resolved.commit])).map((row) => row.split('\t'));
  const untrackedText = untracked.filter((u) => !skippedPaths.has(u.path)).map((u) => ({ path: u.path, text: readText(join(sc.root, u.path)) ?? '' }));
  const countLines = (text) => (text === '' ? 0 : text.replace(/\n$/, '').split('\n').length);
  const diffLines = {
    added: numstat.filter(([, , path]) => !skippedPaths.has(path)).reduce((sum, [added]) => sum + (Number(added) || 0), 0) + untrackedText.reduce((sum, u) => sum + countLines(u.text), 0),
    removed: numstat.filter(([, , path]) => !skippedPaths.has(path)).reduce((sum, [, removed]) => sum + (Number(removed) || 0), 0),
  };

  const living = livingDocs(sc, files, generatedFiles(sc, files), { drift: false }).living;
  const docsToUpdate = living
    .filter((doc) => !touched.includes(doc.path))
    .map((doc) => ({ doc: doc.path, files: touched.filter((path) => matchesAny(path, doc.covers)) }))
    .filter((entry) => entry.files.length > 0);
  const coveringDocs = new Set(living.filter((doc) => touched.some((path) => matchesAny(path, doc.covers))).map((doc) => doc.path));
  const rules = findRules(sc, files).filter((rule) => coveringDocs.has(rule.doc) || rule.code.some((ref) => touched.includes(ref.path)));

  const security = [];
  for (const [file, { added, removed }] of changedLines(git(sc.root, [...DIFF, '-U0', resolved.commit]) ?? '')) {
    if (skippedPaths.has(file)) continue;
    security.push(...lineFindings(file, added));
    // A secret on a removed line is still in the diff the reviewer reads.
    security.push(...lineFindings(file, removed).filter((f) => isSecretKind(f.kind)).map((f) => ({ ...f, removed: true })));
  }
  for (const { path, text } of untrackedText) security.push(...securityFindings(path, text));

  // The brief named after the branch wins; otherwise the open brief that covers the changed code.
  const branch = git(sc.root, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim() ?? '';
  const branchSlug = branch.split('/').pop();
  const open = briefs(sc, files).filter((b) => b.status !== 'done');
  const covering = open.filter((b) => touched.some((path) => matchesAny(path, b.covers)));
  const named = (list) => list.find((b) => branchSlug && slugOf(b.path) === branchSlug);
  const isDefault = defaultBranches(sc).includes(branch);
  const brief = named(covering) ?? covering[0] ?? (isDefault ? null : named(open)) ?? null;

  // Paths are from the repo root (:(top)), so the command gives the same diff from any folder.
  const exclude = changed.filter((c) => c.skipped && !generated.has(c.path)).map((c) => `:(top,exclude,literal)${c.path}`);
  const diffCommand = [gitCommand(), '-C', sc.root, 'diff', '--no-ext-diff', '--no-color', resolved.commit, '--', ':(top)',
    ':(top,exclude,attr:linguist-generated)', ':(top,exclude,attr:linguist-generated=true)',
    ':(top,exclude,attr:linguist-vendored)', ':(top,exclude,attr:linguist-vendored=true)', ...exclude];

  return redactDeep({
    ...empty,
    changed,
    diffCommand,
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
