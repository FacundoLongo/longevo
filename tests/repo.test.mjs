import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gitBinary } from '../src/lib/repo.mjs';

test('skips a git that does not run and uses the next one', () => {
  assert.equal(gitBinary(['/nonexistent/git', 'git']), 'git');
});

test('returns null when no git runs', () => {
  assert.equal(gitBinary(['/nonexistent/git']), null);
});
