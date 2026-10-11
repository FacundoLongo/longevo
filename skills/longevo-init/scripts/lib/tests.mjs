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
const GROUPING = new Set(['packages', 'apps', 'services', 'internal', 'cmd', 'src', 'libs']);

export function areaOf(file) {
  const parts = file.split('/');
  if (parts.length === 1) return '.';
  if (GROUPING.has(parts[0]) && parts.length > 2) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

export function testInventory(root, files, maxFiles = 5000) {
  const testFiles = files.filter((file) => TEST_FILE.test(file) && !/(^|\/)(node_modules|vendor)\//.test(file));
  const byArea = {};
  for (const file of testFiles) byArea[areaOf(file)] = (byArea[areaOf(file)] ?? 0) + 1;
  const antiGoldenCandidates = [];
  for (const file of testFiles.slice(0, maxFiles)) {
    const text = readText(join(root, file));
    if (text === null) continue;
    const reasons = [];
    if (STORAGE_MOCK.test(text)) reasons.push('mocks storage');
    const calls = text.match(CALL_ASSERT)?.length ?? 0;
    if (calls >= 3) reasons.push(`${calls} assertions on calls`);
    if (reasons.length) antiGoldenCandidates.push({ file, reasons });
  }
  return { total: testFiles.length, byArea, antiGoldenCandidates };
}
