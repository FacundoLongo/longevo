// What the repo already knows about some paths, for longevo-brief: the docs and rules that cover them,
// the tests near them, the golden tests, their coverage rows, how often they change and open briefs.
import { join } from 'node:path';
import { generatedFiles } from './lib/attributes.mjs';
import { COVERAGE_FILE } from './lib/coverage.mjs';
import { livingDocs } from './lib/docs.mjs';
import { matches, matchesAny } from './lib/glob.mjs';
import { hotspots } from './lib/hotspots.mjs';
import { listFiles, scope } from './lib/repo.mjs';
import { findRules } from './lib/rules.mjs';
import { redactDeep } from './lib/security.mjs';
import { analyzeTests, areaOf, isTestFile } from './lib/tests.mjs';
import { readText } from './lib/text.mjs';
import { briefs } from './lib/work.mjs';
import { workspaces } from './lib/workspaces.mjs';
import { VERSION } from './scan.mjs';

const MAX_NEAR = 20;
const dirOf = (file) => (file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '');
const stem = (file) => file.split('/').pop().replace(/\.[^.]+$/, '').replace(/[._-](test|spec)$/i, '').replace(/^test_/i, '').replace(/_test$/i, '').replace(/Tests?$|IT$/, '').toLowerCase();

// Backticked paths in the "Golden tests" section of docs/testing.md.
export function goldenTests(root, files = null) {
  const text = readText(join(root, 'docs', 'testing.md')) ?? '';
  const section = text.split(/^## /m).find((part) => /^Golden tests\b/i.test(part)) ?? '';
  // Only paths: a test name or a helper like `makeRepo` in the same bullet is not a golden test.
  const names = [...section.matchAll(/`([^`\s]+)`/g)].map((match) => match[1]).filter((name) => name.includes('/') || /\.[a-z]{1,5}$/i.test(name));
  return files ? names.filter((name) => files.includes(name) && isTestFile(name)) : names;
}

export function contextReport(cwd, { paths = [] } = {}) {
  const sc = scope(cwd);
  const { files } = listFiles(sc);
  const generated = generatedFiles(sc, files);
  const { packages } = workspaces(sc.root, files);
  const hits = paths.map((pattern) => ({ pattern, list: files.filter((file) => matches(file, pattern)) }));
  const targets = [...new Set(hits.flatMap((hit) => hit.list))];
  const touches = (file) => targets.includes(file);

  const docs = livingDocs(sc, files, generated).living
    .filter((doc) => targets.some((file) => matchesAny(file, doc.covers)))
    .map(({ path, covers, verified, stale }) => ({ path, covers, verified, stale }));
  const docPaths = new Set(docs.map((doc) => doc.path));
  const rules = findRules(sc, files).filter((rule) => docPaths.has(rule.doc) || rule.code.some((ref) => touches(ref.path)));

  const stems = new Set(targets.filter((file) => !isTestFile(file)).map(stem));
  const dirs = new Set(targets.map(dirOf));
  const areas = [...new Set(targets.map((file) => areaOf(file, packages)))];
  // Same folder first, then the same area, then other files with the same name, and only then the limit.
  const rank = (file) => (dirs.has(dirOf(file)) ? 0 : areas.includes(areaOf(file, packages)) ? 1 : 2);
  const near = files
    .filter((file) => isTestFile(file) && (stems.has(stem(file)) || dirs.has(dirOf(file))))
    .map((file, index) => ({ file, index, rank: rank(file) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, MAX_NEAR)
    .map((entry) => entry.file);
  const area = {};
  for (const file of files.filter(isTestFile)) {
    const owner = areaOf(file, packages);
    if (areas.includes(owner)) area[owner] = (area[owner] ?? 0) + 1;
  }
  const coverage = (readText(join(sc.root, COVERAGE_FILE)) ?? '').split('\n').filter((line) => areas.some((a) => line.startsWith(`| ${a} |`)));

  return redactDeep({
    version: VERSION,
    scope: sc,
    paths: hits.map((hit) => ({ pattern: hit.pattern, files: hit.list.length })),
    docs,
    rules,
    tests: { near: analyzeTests(sc.root, near, packages).map(({ file, kind, mocksStorage }) => ({ file, kind, mocksStorage })), area },
    golden: goldenTests(sc.root, files),
    coverage,
    // Every file's count, not only the busiest ten in the repo, then only the paths of this task.
    hotspots: hotspots(sc, files, packages, { generated, limit: Infinity }).files.filter((hot) => touches(hot.file)),
    briefs: briefs(sc, files).filter((brief) => brief.status !== 'done' && targets.some((file) => matchesAny(file, brief.covers))).map(({ path, status, task }) => ({ path, status, task })),
  });
}
