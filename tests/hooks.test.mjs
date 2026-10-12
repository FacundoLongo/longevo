import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hooks } from '../src/lib/hooks.mjs';
import { scope } from '../src/lib/repo.mjs';
import { gitIn, makeRepo } from './helpers/fixture.mjs';

const listed = (root) => gitIn(root, 'ls-files').split('\n').filter(Boolean);

test('reads pre-commit, husky, lefthook and lint-staged', () => {
  const root = makeRepo({
    '.pre-commit-config.yaml': 'repos:\n  - repo: local\n    hooks:\n      - id: ruff\n        entry: ruff check\n',
    '.husky/pre-commit': '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\nnpx lint-staged\n',
    '.husky/_/husky.sh': 'echo internal\n',
    'lefthook.yml': 'pre-commit:\n  commands:\n    lint:\n      run: pnpm lint\n',
    'package.json': JSON.stringify({ 'lint-staged': { '*.ts': ['eslint --fix', 'prettier --write'] } }),
  });
  const result = hooks(scope(root), listed(root));
  assert.deepEqual(result.map((h) => [h.tool, h.commands]), [
    ['husky', ['npx lint-staged']],
    ['lefthook', ['pnpm lint']],
    ['lint-staged', ['eslint --fix', 'prettier --write']],
    ['pre-commit', ['ruff', 'ruff check']],
  ]);
});

test('reads a local git hook but not the samples', () => {
  const root = makeRepo({ 'a.txt': 'a' });
  writeFileSync(join(root, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\n# lint first\nmake lint\n');
  assert.deepEqual(hooks(scope(root), listed(root)), [{ tool: 'git', file: '.git/hooks/pre-commit', commands: ['make lint'] }]);
});

test('a repo without hooks has none', () => {
  assert.deepEqual(hooks(scope(makeRepo({ 'a.txt': 'a' })), ['a.txt']), []);
});
