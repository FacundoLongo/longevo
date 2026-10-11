import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, setFrontmatter } from '../src/lib/frontmatter.mjs';

test('reads scalars, inline lists, block lists and lists of maps', () => {
  const text = [
    '---',
    'title: "Payments"',
    'covers: ["src/payments/**", \'src/refunds/**\']',
    'tags:',
    '  - billing',
    'sources:',
    '  - url: https://linear.app/x/1',
    '    checked: 2026-10-01',
    'verified: 2026-10-11',
    '---',
    '# Payments',
  ].join('\n');
  const { data, body, error } = parseFrontmatter(text);
  assert.equal(error, null);
  assert.equal(data.title, 'Payments');
  assert.deepEqual(data.covers, ['src/payments/**', 'src/refunds/**']);
  assert.deepEqual(data.tags, ['billing']);
  assert.deepEqual(data.sources, [{ url: 'https://linear.app/x/1', checked: '2026-10-01' }]);
  assert.equal(data.verified, '2026-10-11');
  assert.equal(body, '# Payments');
});

test('a doc without frontmatter has empty data', () => {
  const { data, hasFrontmatter, body, error } = parseFrontmatter('# Title\n');
  assert.deepEqual(data, {});
  assert.equal(hasFrontmatter, false);
  assert.equal(body, '# Title\n');
  assert.equal(error, null);
});

test('reads CRLF frontmatter', () => {
  assert.deepEqual(parseFrontmatter('---\r\ncovers: [a/**]\r\n---\r\nx').data, { covers: ['a/**'] });
});

test('an unclosed block is an error', () => {
  assert.match(parseFrontmatter('---\ncovers: [a]\n# Title\n').error, /not closed/);
});

test('adds frontmatter to a doc that has none', () => {
  const out = setFrontmatter('# API\n', { covers: ['src/api/**'], verified: '2026-10-11' });
  assert.equal(out, '---\ncovers: ["src/api/**"]\nverified: 2026-10-11\n---\n\n# API\n');
});

test('keeps other keys and the body byte for byte', () => {
  const text = '---\ntitle: API   # keep me\nverified: 2026-01-01\n---\nBody\r\nline\n';
  const out = setFrontmatter(text, { verified: '2026-10-11', covers: ['src/api/**'] });
  assert.equal(out, '---\ntitle: API   # keep me\nverified: 2026-10-11\ncovers: ["src/api/**"]\n---\nBody\r\nline\n');
});

test('replaces a block list value with the new list', () => {
  const text = '---\ncovers:\n  - old/**\n  - older/**\ntitle: x\n---\n';
  assert.equal(setFrontmatter(text, { covers: ['new/**'] }), '---\ncovers: ["new/**"]\ntitle: x\n---\n');
});

test('refuses to write into broken frontmatter', () => {
  assert.throws(() => setFrontmatter('---\ntitle: x\n', { verified: '2026-10-11' }), /not closed/);
});
