import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches, matchesAny } from '../src/lib/glob.mjs';

test('a single star stays inside one folder', () => {
  assert.ok(matches('src/a.ts', 'src/*.ts'));
  assert.ok(!matches('src/x/a.ts', 'src/*.ts'));
});

test('a double star crosses folders', () => {
  assert.ok(matches('src/payments/a/b.ts', 'src/payments/**'));
  assert.ok(matches('src/a.test.ts', '**/*.test.ts'));
  assert.ok(matches('a.test.ts', '**/*.test.ts'));
  assert.ok(!matches('src/paymentsx/a.ts', 'src/payments/**'));
});

test('a plain path matches itself and what is inside it', () => {
  assert.ok(matches('src/payments', 'src/payments'));
  assert.ok(matches('src/payments/a.ts', 'src/payments'));
  assert.ok(!matches('src/payments2/a.ts', 'src/payments'));
});

test('dots and brackets in a pattern are literal', () => {
  assert.ok(matches('a.b/c.ts', 'a.b/*.ts'));
  assert.ok(!matches('axb/c.ts', 'a.b/*.ts'));
  assert.ok(matches('app/[id]/page.tsx', 'app/[id]/*.tsx'));
});

test('a leading ./ in a pattern is ignored', () => {
  assert.ok(matches('src/a.ts', './src/**'));
});

test('matchesAny checks every pattern', () => {
  assert.ok(matchesAny('lib/x.go', ['src/**', 'lib/**']));
  assert.ok(!matchesAny('cmd/x.go', ['src/**', 'lib/**']));
});
