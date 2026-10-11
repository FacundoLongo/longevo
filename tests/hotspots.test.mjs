import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hotspots } from '../src/lib/hotspots.mjs';
import { scope } from '../src/lib/repo.mjs';
import { gitIn, makeRepo, writeFiles } from './helpers/fixture.mjs';

const commit = (root, files, message) => {
  writeFiles(root, files);
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', message);
};
const listed = (root) => gitIn(root, 'ls-files').split('\n').filter(Boolean);

test('ranks files by commits and skips lockfiles', () => {
  const root = makeRepo({ 'src/a.ts': '1', 'src/b.ts': '1', 'package-lock.json': '{}' });
  for (let i = 2; i < 5; i += 1) commit(root, { 'src/a.ts': String(i), 'package-lock.json': `{"v":${i}}` }, `a${i}`);
  commit(root, { 'src/b.ts': '2' }, 'b2');
  const result = hotspots(scope(root), listed(root), []);
  assert.deepEqual(result.files.slice(0, 2), [{ file: 'src/a.ts', commits: 4 }, { file: 'src/b.ts', commits: 2 }]);
  assert.ok(!result.files.some((f) => f.file === 'package-lock.json'));
  assert.deepEqual(result.areas[0], { area: 'src', commits: 6 });
});

test('skips commits that touch more than 100 files', () => {
  const many = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`gen/f${i}.ts`, 'x']));
  const root = makeRepo({ 'src/a.ts': '1' });
  commit(root, many, 'reformat');
  const result = hotspots(scope(root), listed(root), []);
  assert.ok(!result.files.some((f) => f.file.startsWith('gen/')));
});

test('skips files marked generated in .gitattributes', () => {
  const root = makeRepo({ '.gitattributes': 'api/*.pb.go linguist-generated=true\n', 'api/x.pb.go': '1', 'api/x.go': '1' });
  commit(root, { 'api/x.pb.go': '2', 'api/x.go': '2' }, 'two');
  const result = hotspots(scope(root), listed(root), []);
  assert.ok(!result.files.some((f) => f.file === 'api/x.pb.go'));
  assert.ok(result.files.some((f) => f.file === 'api/x.go'));
});

test('skips files that no longer exist', () => {
  const root = makeRepo({ 'old.ts': '1', 'new.ts': '1' });
  gitIn(root, 'rm', '-q', 'old.ts');
  gitIn(root, 'commit', '-q', '-m', 'rm');
  assert.ok(!hotspots(scope(root), listed(root), []).files.some((f) => f.file === 'old.ts'));
});

test('hotspots are empty outside git', () => {
  const root = makeRepo({ 'a.ts': '1' }, { git: false });
  assert.deepEqual(hotspots(scope(root), ['a.ts'], []), { files: [], areas: [] });
});
