import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspaces } from '../src/lib/workspaces.mjs';
import { areaOf } from '../src/lib/tests.mjs';
import { gitIn, makeRepo } from './helpers/fixture.mjs';

const ws = (files) => {
  const root = makeRepo(files);
  return workspaces(root, gitIn(root, 'ls-files').split('\n').filter(Boolean));
};

test('reads npm workspaces and keeps only folders with a manifest', () => {
  const result = ws({
    'package.json': JSON.stringify({ workspaces: ['packages/*'] }),
    'packages/api/package.json': '{}',
    'packages/notes/README.md': '# no manifest\n',
  });
  assert.deepEqual(result, { tools: ['npm'], packages: ['packages/api'] });
});

test('reads yarn workspaces written as an object', () => {
  assert.deepEqual(ws({ 'package.json': JSON.stringify({ workspaces: { packages: ['libs/*'] } }), 'libs/a/package.json': '{}' }).packages, ['libs/a']);
});

test('reads pnpm-workspace.yaml with exclusions and turbo', () => {
  const result = ws({
    'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - \"packages/*\"\n  - '!packages/old'\n",
    'turbo.json': '{}',
    'apps/web/package.json': '{}',
    'packages/ui/package.json': '{}',
    'packages/old/package.json': '{}',
  });
  assert.deepEqual(result, { tools: ['pnpm', 'turbo'], packages: ['apps/web', 'packages/ui'] });
});

test('reads lerna packages', () => {
  assert.deepEqual(ws({ 'lerna.json': JSON.stringify({ packages: ['modules/*'] }), 'modules/x/package.json': '{}' }), { tools: ['lerna'], packages: ['modules/x'] });
});

test('reads go.work, Cargo and uv workspaces', () => {
  assert.deepEqual(ws({ 'go.work': 'go 1.22\n\nuse (\n\t./api\n\t./worker\n)\n', 'api/go.mod': 'module a\n', 'worker/go.mod': 'module w\n' }).packages, ['api', 'worker']);
  assert.deepEqual(ws({ 'go.work': 'go 1.22\nuse ./svc\n', 'svc/go.mod': 'module s\n' }).packages, ['svc']);
  assert.deepEqual(ws({ 'Cargo.toml': '[workspace]\nmembers = [\n  "crates/*",\n]\n', 'crates/core/Cargo.toml': '[package]\n' }).packages, ['crates/core']);
  assert.deepEqual(ws({ 'pyproject.toml': '[tool.uv.workspace]\nmembers = ["libs/*"]\n', 'libs/db/pyproject.toml': '[project]\n' }).packages, ['libs/db']);
});

test('reads Gradle, Maven and .sln projects', () => {
  assert.deepEqual(ws({ 'settings.gradle.kts': 'include(":app", ":core:data")\n', 'app/build.gradle.kts': '', 'core/data/build.gradle.kts': '' }).packages, ['app', 'core/data']);
  assert.deepEqual(ws({ 'settings.gradle': "include 'web'\n", 'web/build.gradle': '' }).packages, ['web']);
  assert.deepEqual(ws({ 'pom.xml': '<project><modules><module>api</module></modules></project>', 'api/pom.xml': '<project/>' }).packages, ['api']);
  assert.deepEqual(ws({ 'App.sln': 'Project("{X}") = "Api", "src\\Api\\Api.csproj", "{Y}"\nEndProject\n', 'src/Api/Api.csproj': '<Project/>' }).packages, ['src/Api']);
});

test('reads nx projects and Elixir umbrella apps', () => {
  assert.deepEqual(ws({ 'nx.json': '{}', 'libs/auth/project.json': '{}' }), { tools: ['nx'], packages: ['libs/auth'] });
  assert.deepEqual(ws({ 'mix.exs': 'apps_path: "apps",\n', 'apps/core/mix.exs': '' }).packages, ['apps/core']);
});

test('a repo without workspaces has no packages', () => {
  assert.deepEqual(ws({ 'package.json': '{}' }), { tools: [], packages: [] });
});

test('areas follow packages first', () => {
  assert.equal(areaOf('packages/api/src/a.ts', ['packages/api']), 'packages/api');
  assert.equal(areaOf('apps/web/x/y/a.ts', ['apps/web', 'apps/web/x']), 'apps/web/x');
  assert.equal(areaOf('services/billing/x/a.go', []), 'services/billing');
  assert.equal(areaOf('README.md', []), '.');
});
