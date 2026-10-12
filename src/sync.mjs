// Collects what longevo-sync needs: stale living docs with the commits and the diff since their anchor,
// business rules and their checks, external sources and their age, briefs, and the generated files.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mcpServers } from './lib/agents.mjs';
import { localDate } from './lib/apply.mjs';
import { generatedFiles } from './lib/attributes.mjs';
import { coverageFor, coverageState } from './lib/coverage.mjs';
import { docFindings, livingDocs } from './lib/docs.mjs';
import { citedPaths, missingPaths } from './lib/paths.mjs';
import { git, listFiles, scope } from './lib/repo.mjs';
import { findRules, ruleFindings } from './lib/rules.mjs';
import { redactDeep } from './lib/security.mjs';
import { declined } from './lib/state.mjs';
import { collectSources, renderSources, SOURCES_FILE, sourceFindings } from './lib/sources.mjs';
import { isTestFile } from './lib/tests.mjs';
import { codeSpans, readText } from './lib/text.mjs';
import { briefs } from './lib/work.mjs';
import { VERSION } from './scan.mjs';

const MAX_COMMITS = 20;
const MAX_DIFF_LINES = 300;
const MAX_TOTAL_DIFF_LINES = 1500;

// Paths go to git in chunks, so a doc with thousands of changed files stays under the argument limit.
const CHUNK = 500;
const inChunks = (files, size) => Array.from({ length: Math.ceil(files.length / size) }, (_, i) => files.slice(i * size, (i + 1) * size));

export function commitsTouching(sc, anchor, files, { chunk = CHUNK } = {}) {
  const parts = inChunks(files, chunk);
  const seen = new Map();
  for (const part of parts) {
    const out = git(sc.root, ['log', '--no-merges', `--max-count=${MAX_COMMITS}`, '--format=%H%x09%s', `${anchor}..HEAD`, '--', ...part]) ?? '';
    for (const line of out.split('\n').filter(Boolean)) {
      const [hash, ...subject] = line.split('\t');
      seen.set(hash, { hash, subject: subject.join('\t') });
    }
  }
  let commits = [...seen.values()];
  if (parts.length > 1) {
    // Several chunks: put the commits back in git log order, newest first.
    const rank = new Map((git(sc.root, ['rev-list', '--no-merges', `${anchor}..HEAD`]) ?? '').split('\n').map((hash, index) => [hash, index]));
    commits = commits.sort((a, b) => (rank.get(a.hash) ?? 0) - (rank.get(b.hash) ?? 0));
  }
  return commits.slice(0, MAX_COMMITS).map(({ hash, subject }) => ({ hash: hash.slice(0, 12), subject }));
}

export function diffSince(sc, anchor, files, budget, { chunk = CHUNK } = {}) {
  const lines = inChunks(files, chunk)
    .map((part) => (git(sc.root, ['diff', '--no-ext-diff', '--no-color', '--src-prefix=a/', '--dst-prefix=b/', `${anchor}..HEAD`, '--', ...part]) ?? '').replace(/\n$/, ''))
    .filter(Boolean)
    .join('\n')
    .split('\n');
  const keep = Math.max(0, Math.min(MAX_DIFF_LINES, budget.left));
  budget.left -= keep;
  return { diff: lines.slice(0, keep).join('\n'), truncated: lines.length > keep };
}

export function syncReport(cwd, { home = homedir(), today = localDate() } = {}) {
  const sc = scope(cwd);
  const { files } = listFiles(sc);
  const generated = generatedFiles(sc, files);
  const living = livingDocs(sc, files, generated);
  const rules = findRules(sc, files);
  const sources = collectSources(sc, files);
  const work = briefs(sc, files);
  // Diffs share one budget, so a few large changes cannot push the findings out of the agent's view.
  const budget = { left: MAX_TOTAL_DIFF_LINES };
  const docs = living.living.map((doc) => {
    const text = readText(join(sc.root, doc.path)) ?? '';
    const history = doc.stale ? { commits: commitsTouching(sc, doc.anchor, doc.changed), ...diffSince(sc, doc.anchor, doc.changed, budget) } : { commits: [], diff: '', truncated: false };
    const missing = [...new Set(missingPaths(sc.root, doc.path, citedPaths(codeSpans(text)), files).map((m) => m.path))];
    return { ...doc, ...history, missingPaths: missing };
  });
  const current = readText(join(sc.root, SOURCES_FILE));
  // A finished brief whose folder a rule cites as its Source has already become rules.
  const ruled = (brief) => rules.some((rule) => rule.source?.includes(brief.path.split('/')[2]));
  // What the skill needs to decide comes first; the long diffs come last.
  return redactDeep({
    version: VERSION,
    scope: sc,
    findings: [...docFindings(living), ...ruleFindings(sc, files, rules, files.filter(isTestFile)), ...sourceFindings(sources, today)],
    notChecked: sc.isGit ? [] : ['drift: this folder is not a git repo, so no doc can be stale'],
    declined: declined(sc),
    coverage: coverageState(sc.root, coverageFor(sc, files, generated, { docs: living.living, rules })),
    sourcesFile: { file: SOURCES_FILE, exists: current !== null, upToDate: current === renderSources(sources) },
    briefs: { done: work.filter((b) => b.status === 'done' && !ruled(b)), open: work.filter((b) => b.status !== 'done') },
    rules,
    sources,
    mcp: mcpServers(sc, home),
    docs,
  });
}
