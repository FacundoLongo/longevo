import { join } from 'node:path';
import { readText } from './text.mjs';

const TEST_FILE = new RegExp([
  '_test\\.go$', '\\.(test|spec)\\.[cm]?[jt]sx?$', '(^|/)test_[^/]+\\.py$', '_test\\.py$', 'Tests?\\.swift$',
  '(Test|Tests|IT)\\.(java|kt)$', 'Tests?\\.cs$', '_(spec|test)\\.rb$', 'Test\\.php$', '(^|/)tests/[^/]+\\.rs$',
  '_test\\.exs$', '_test\\.dart$',
].join('|'));
const STORAGE_MOCK = new RegExp([
  'sqlmock|MockStorage|mockStorage|NewMockStore',
  `(?:jest|vi)\\.mock\\(\\s*['"][^'"]*(?:db|database|prisma|repositor|storage|store)[^'"]*['"]`,
  '(?:\\bmockk?|@MockBean|@Mock)\\b[\\s(<]*\\w*(?:Repository|Repo|Dao|Storage|Store)\\b',
  '(?:new Mock<|Substitute\\.For<)I?\\w*(?:Repository|Repo|DbContext|Store)\\b',
  `\\bpatch(?:\\.object)?\\(\\s*['"][^'"]*(?:db|session|repositor|storage|store)[^'"]*['"]`,
  `(?:instance_double|double|allow)\\(\\s*['"]?\\w*(?:Repository|Repo|Store)`,
  'createMock\\(\\s*\\\\?\\w*(?:Repository|EntityManager)',
  '\\bMock\\w*(?:Repository|Repo|Store|Db)\\b',
  'Mox\\.(?:expect|stub)\\(\\s*\\w*Repo',
].join('|'), 'i');
const CALL_ASSERT = /toHaveBeenCalled(?:With|Times)?\(|\.EXPECT\(\)|\.Times\(|assert_called(?:_once)?(?:_with)?\(|\bverify\(|\.Verify\(|\.Received\(|have_received\(|\.to receive\(|->expects\(/g;
const E2E = /(^|\/)(e2e|cypress|playwright|ui-?tests?)(\/|$)|[._-]e2e[._-]|\.cy\.[cm]?[jt]sx?$/i;
const INTEGRATION = /(^|\/)(integration|integration[-_]tests?|it)\/|[._-]integration[._-]|\.int\.(test|spec)\./i;
const JAVA_IT = /IT\.(java|kt)$/;

export function testKind(file) {
  if (E2E.test(file)) return 'e2e';
  if (INTEGRATION.test(file) || JAVA_IT.test(file)) return 'integration';
  return 'other';
}

const GROUPING = new Set(['packages', 'apps', 'services', 'internal', 'cmd', 'src', 'libs']);

// The area of a file: the deepest workspace package that holds it, or a guess from its first folders.
export function areaOf(file, packages = []) {
  const owner = packages.filter((pkg) => file.startsWith(`${pkg}/`)).sort((a, b) => b.length - a.length)[0];
  if (owner) return owner;
  const parts = file.split('/');
  if (parts.length === 1) return '.';
  if (GROUPING.has(parts[0]) && parts.length > 2) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

// True when the match starts inside a string literal on its line, like a fixture that holds test code as text.
function insideString(line, index) {
  let quote = null;
  for (let i = 0; i < index; i += 1) {
    const char = line[i];
    if (quote) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
    }
  }
  return quote !== null;
}

function mocksStorage(text) {
  return [...text.matchAll(new RegExp(STORAGE_MOCK.source, 'gi'))].some((match) => {
    const lineStart = text.lastIndexOf('\n', match.index - 1) + 1;
    return !insideString(text.slice(lineStart, match.index), match.index - lineStart);
  });
}

export const isTestFile = (file) => TEST_FILE.test(file) && !/(^|\/)(node_modules|vendor)\//.test(file);

// One row per test file: its area, its kind and the signals that make it a bad example.
export function analyzeTests(root, files, packages = [], maxFiles = 5000) {
  return files.filter(isTestFile).map((file, index) => {
    const text = index < maxFiles ? readText(join(root, file)) : null;
    return {
      file,
      area: areaOf(file, packages),
      kind: testKind(file),
      mocksStorage: text !== null && mocksStorage(text),
      callAsserts: text === null ? 0 : text.match(CALL_ASSERT)?.length ?? 0,
    };
  });
}

export function testInventory(root, files, { packages = [] } = {}) {
  const rows = analyzeTests(root, files, packages);
  const byArea = {};
  const byKind = { e2e: 0, integration: 0, other: 0 };
  const antiGoldenCandidates = [];
  for (const row of rows) {
    byArea[row.area] = (byArea[row.area] ?? 0) + 1;
    byKind[row.kind] += 1;
    const reasons = [];
    if (row.mocksStorage) reasons.push('mocks storage');
    if (row.callAsserts >= 3) reasons.push(`${row.callAsserts} assertions on calls`);
    if (reasons.length) antiGoldenCandidates.push({ file: row.file, reasons });
  }
  return { total: rows.length, byArea, byKind, antiGoldenCandidates };
}
