// Living docs (with `covers` in their frontmatter), their drift anchored on the `verified` line (D11),
// and the docs that could become living docs.
import { join } from 'node:path';
import { isNoise } from './attributes.mjs';
import { parseFrontmatter } from './frontmatter.mjs';
import { matches, matchesAny } from './glob.mjs';
import { realDate } from './dates.mjs';
import { commitsSince } from './hotspots.mjs';
import { isInstructionFile } from './instructions.mjs';
import { dirOf } from './paths.mjs';
import { git } from './repo.mjs';
import { readText } from './text.mjs';

const MARKDOWN = /\.mdx?$/;
const RECORD = /(^|\/)(decisions|adr|adrs|work|rfc|rfcs)\//i;
const GENERATED_DOC = /(^|\/)docs\/(coverage|sources)\.md$/;
const LONGEVO_KEY = /^(covers|verified)\s*[:=]/m;
// Markdown that is never a doc to cover: dot folders, vendored code, test fixtures, the front page README
// (GitHub would show its frontmatter), community files by their exact name, templates and changelogs.
const NOT_A_DOC = /(^|\/)(?:\.[^/]+|node_modules|vendor|third_party)\/|^README\.mdx?$|(^|\/)SKILL\.md$|(^|\/)(?:HISTORY|LICEN[CS]E|COPYING|CODE_OF_CONDUCT|SECURITY|CONTRIBUTING|SUPPORT)(?:\.[^/]*)?$/;
const NOT_A_DOC_ANY_CASE = /(^|\/)(?:changelog|pull_request_template|issue_template)(?:\.[^/]*)?$|(^|\/)issue_template\//i;
// Test folders hold fixtures, except inside docs/, where a test plan is a doc.
const TEST_DIR = /(^|\/)(?:tests?|__tests__|fixtures|__fixtures__|testdata|__snapshots__)\//;
const countLines = (text) => text.replace(/\n$/, '').split('\n').length;
const globs = (value) => (typeof value === 'string' && value ? [value] : Array.isArray(value) && value.length && value.every((v) => typeof v === 'string') ? value : null);

function verifiedAt(sc, rev, doc) {
  const text = git(sc.root, ['show', `${rev}:${doc}`]);
  return text === null ? null : parseFrontmatter(text).data.verified ?? null;
}

// The last commit that changed the `verified` value in the frontmatter. `-G` finds candidates; a `verified:`
// line in the body, like an example in a code block, does not count. `--follow` keeps the anchor when the doc
// moves: each commit is read at the path the doc had then, and its parent at the path before a rename.
function anchorOf(sc, doc) {
  if (!sc.isGit) return null;
  const out = git(sc.root, ['-c', 'core.quotePath=false', 'log', '--follow', '--format=%x00%H', '--name-status', '-G^verified:', '--', doc]) ?? '';
  for (const chunk of out.split('\0').filter((c) => c.trim())) {
    const [hash, row = ''] = chunk.split('\n').filter(Boolean);
    const [status = '', ...paths] = row.split('\t');
    const path = paths[paths.length - 1] ?? doc;
    const before = status.startsWith('R') ? paths[0] : path;
    if (verifiedAt(sc, hash, path) !== verifiedAt(sc, `${hash}^`, before)) return hash;
  }
  return null;
}

// Files matching `covers` in commits after the anchor, without noise, that still differ from the anchor: a change
// that was reverted later does not count. Big commits count too, so a squash merge of a large change is not missed
// (D12). With `since`, only commits dated after it count. Docs verified in the same commit share one walk.
function changedSince(sc, anchor, covers, generated, walks = new Map(), { since = null } = {}) {
  const key = `${anchor} ${since ?? ''}`;
  if (!walks.has(key)) {
    const after = since ? new Date(since.length === 10 ? `${since}T23:59:59` : since).getTime() / 1000 : -Infinity;
    const commits = commitsSince(sc, { range: `${anchor}..HEAD` })
      .filter((commit) => commit.time > after)
      .map((commit) => commit.files.filter((file) => !isNoise(file, generated)));
    const net = new Set((git(sc.root, ['-c', 'core.quotePath=false', 'diff', '--name-only', '--no-renames', '--no-ext-diff', anchor, 'HEAD']) ?? '').split('\n').filter(Boolean));
    walks.set(key, { commits, net });
  }
  const { commits, net } = walks.get(key);
  const changed = new Set();
  for (const files of commits) for (const file of files) if (net.has(file) && matchesAny(file, covers)) changed.add(file);
  return [...changed].sort();
}

export function livingDocs(sc, files, generated, { drift = true } = {}) {
  const walks = new Map();
  const living = [];
  const invalid = [];
  const candidates = [];
  // A skill's folder (the one with SKILL.md) holds instructions for agents, not docs.
  const skillDirs = files.filter((file) => /(^|\/)SKILL\.md$/.test(file)).map(dirOf);
  // A repo that is one skill keeps its docs; only the skill's own folders are left out.
  const inSkill = (path) => skillDirs.some((dir) => (dir ? path.startsWith(`${dir}/`) : /^(?:references|scripts|assets)\//.test(path)));
  const fixture = (path) => TEST_DIR.test(path) && !/(^|\/)docs\//.test(path);
  for (const path of files.filter((file) => MARKDOWN.test(file) && !/(^|\/)node_modules\//.test(file)).sort()) {
    const text = readText(join(sc.root, path));
    if (text === null) continue;
    const { data, error } = parseFrontmatter(text);
    if (error) {
      // Other tools' frontmatter is not ours to judge; only report it when it has Longevo keys.
      if (LONGEVO_KEY.test(text)) invalid.push({ path, error });
      continue;
    }
    const covers = globs(data.covers);
    const bad = data.covers && !covers ? 'covers must be a glob or a list of globs.' : covers && data.verified && typeof data.verified !== 'string' ? 'verified must be a date.' : null;
    if (bad) {
      invalid.push({ path, error: bad });
      continue;
    }
    if (covers && !RECORD.test(path)) {
      // A later, real verified date in the working tree, not committed yet, is a check made on that date:
      // only commits after it count. A date without a time covers the whole day.
      const committed = drift && data.verified && sc.isGit ? verifiedAt(sc, 'HEAD', path) : null;
      const fresh = committed !== null && realDate(data.verified) && (!realDate(committed) || data.verified > committed);
      const anchor = drift && data.verified ? anchorOf(sc, path) : null;
      const changed = anchor ? changedSince(sc, anchor, covers, generated, walks, { since: fresh ? data.verified : null }) : [];
      const unmatched = covers.filter((pattern) => !files.some((file) => matches(file, pattern)));
      living.push({ path, covers, verified: data.verified ?? null, anchor, stale: changed.length > 0, changed, unmatched });
    } else if (!RECORD.test(path) && !GENERATED_DOC.test(path) && !NOT_A_DOC.test(path) && !NOT_A_DOC_ANY_CASE.test(path) && !fixture(path) && !isInstructionFile(path) && !inSkill(path)) {
      candidates.push({ path, lines: countLines(text) });
    }
  }
  // Docs in a docs/ folder first, so a repo with many READMEs still lists them.
  const inDocs = (candidate) => (/(^|\/)docs\//.test(candidate.path) ? 0 : 1);
  return { living, invalid, candidates: candidates.sort((a, b) => inDocs(a) - inDocs(b)).slice(0, 50) };
}

export function docFindings(docs) {
  const findings = [];
  for (const doc of docs.living) {
    if (doc.stale) {
      const shown = doc.changed.slice(0, 3).join(', ');
      const more = doc.changed.length > 3 ? ` and ${doc.changed.length - 3} more` : '';
      findings.push({ id: 'doc-stale', severity: 'medium', evidence: [doc.path], message: `${doc.path} covers code that changed after it was verified (${doc.verified}): ${shown}${more}.` });
    }
    if (!doc.verified) {
      findings.push({ id: 'doc-not-verified', severity: 'low', evidence: [doc.path], message: `${doc.path} has covers but no verified date, so Longevo cannot tell whether it is stale.` });
    }
    if (doc.unmatched.length) {
      findings.push({ id: 'covers-match-nothing', severity: 'medium', evidence: [doc.path], message: `In ${doc.path}, covers ${doc.unmatched.join(', ')} match no file.` });
    }
  }
  for (const doc of docs.invalid) findings.push({ id: 'frontmatter-invalid', severity: 'low', evidence: [doc.path], message: `${doc.path}: ${doc.error}` });
  return findings;
}
