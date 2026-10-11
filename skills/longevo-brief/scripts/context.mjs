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
export function goldenTests(root) {
  const text = readText(join(root, 'docs', 'testing.md')) ?? '';
  const section = text.split(/^## /m).find((part) => /^Golden tests\b/i.test(part)) ?? '';
  return [...section.matchAll(/`([^`\s]+)`/g)].map((match) => match[1]);
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
  const near = files.filter((file) => isTestFile(file) && (stems.has(stem(file)) || dirs.has(dirOf(file)))).slice(0, MAX_NEAR);
  const areas = [...new Set(targets.map((file) => areaOf(file, packages)))];
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
    golden: goldenTests(sc.root),
    coverage,
    hotspots: hotspots(sc, files, packages, { generated }).files.filter((hot) => touches(hot.file)),
    briefs: briefs(sc, files).filter((brief) => brief.status !== 'done' && targets.some((file) => matchesAny(file, brief.covers))).map(({ path, status, task }) => ({ path, status, task })),
  });
}
