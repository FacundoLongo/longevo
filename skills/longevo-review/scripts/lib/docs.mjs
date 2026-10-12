// Living docs (with `covers` in their frontmatter), their drift anchored on the `verified` line (D11),
// and the docs that could become living docs.
import { join } from 'node:path';
import { isNoise } from './attributes.mjs';
import { parseFrontmatter } from './frontmatter.mjs';
import { matches, matchesAny } from './glob.mjs';
import { realDate } from './dates.mjs';
import { commitsSince, MAX_COMMIT_FILES } from './hotspots.mjs';
import { git } from './repo.mjs';
import { readText } from './text.mjs';

const MARKDOWN = /\.mdx?$/;
const RECORD = /(^|\/)(decisions|adr|adrs|work|rfc|rfcs)\//i;
const GENERATED_DOC = /(^|\/)docs\/(coverage|sources)\.md$/;
const LONGEVO_KEY = /^(covers|verified)\s*[:=]/m;
const countLines = (text) => text.replace(/\n$/, '').split('\n').length;
const globs = (value) => (typeof value === 'string' && value ? [value] : Array.isArray(value) && value.length && value.every((v) => typeof v === 'string') ? value : null);

function verifiedAt(sc, rev, doc) {
  const text = git(sc.root, ['show', `${rev}:${doc}`]);
  return text === null ? null : parseFrontmatter(text).data.verified ?? null;
}

// The last commit that changed the `verified` value in the frontmatter. `-G` finds candidates; a `verified:`
// line in the body, like an example in a code block, does not count.
function anchorOf(sc, doc) {
  if (!sc.isGit) return null;
  const candidates = (git(sc.root, ['log', '--format=%H', '-G^verified:', '--', doc]) ?? '').split('\n').filter(Boolean);
  return candidates.find((hash) => verifiedAt(sc, hash, doc) !== verifiedAt(sc, `${hash}^`, doc)) ?? null;
}

// Files matching `covers` in commits after the anchor, without noise and big reformat commits, that still differ
// from the anchor: a change that was reverted later does not count. Docs verified in the same commit share one
// walk of the history after it.
export function changedSince(sc, anchor, covers, generated, walks = new Map(), { since = null } = {}) {
  const key = `${anchor} ${since ?? ''}`;
  if (!walks.has(key)) {
    const commits = commitsSince(sc, { range: `${anchor}..HEAD`, since: since && (since.length === 10 ? `${since}T23:59:59` : since) })
      .map((commit) => commit.files.filter((file) => !isNoise(file, generated)))
      .filter((files) => files.length <= MAX_COMMIT_FILES);
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
    const bad = data.covers && !covers ? 'covers must be a glob or a list of globs.' : data.verified && typeof data.verified !== 'string' ? 'verified must be a date.' : null;
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
    } else if (/(^|\/)docs\//.test(path) && !RECORD.test(path) && !GENERATED_DOC.test(path) && !/(^|\/)CHANGELOG/i.test(path)) {
      candidates.push({ path, lines: countLines(text) });
    }
  }
  return { living, invalid, candidates: candidates.slice(0, 50) };
}

export function docFindings(docs) {
  const findings = [];
  for (const doc of docs.living) {
    if (doc.stale) {
      const shown = doc.changed.slice(0, 3).join(', ');
      const more = doc.changed.length > 3 ? ` and ${doc.changed.length - 3} more` : '';
      findings.push({ id: 'doc-stale', severity: 'medium', evidence: [doc.path], message: `${doc.path} covers code that changed after ${doc.verified}: ${shown}${more}.` });
    }
    if (doc.unmatched.length) {
      findings.push({ id: 'covers-match-nothing', severity: 'medium', evidence: [doc.path], message: `In ${doc.path}, covers ${doc.unmatched.join(', ')} match no file.` });
    }
  }
  for (const doc of docs.invalid) findings.push({ id: 'frontmatter-invalid', severity: 'low', evidence: [doc.path], message: `${doc.path}: ${doc.error}` });
  return findings;
}
