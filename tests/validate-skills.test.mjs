import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateSkill, validateAll } from '../scripts/validate-skills.mjs';

const tempRoot = () => mkdtempSync(join(tmpdir(), 'longevo-skills-'));

function makeSkill(root, folder, frontmatter, body = '# Skill\n') {
  const dir = join(root, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n${body}`);
  return dir;
}

test('a valid skill has no errors', () => {
  const dir = makeSkill(tempRoot(), 'longevo-demo', 'name: longevo-demo\ndescription: "Use when: testing."');
  assert.deepEqual(validateSkill(dir), []);
});

test('the name must match the folder', () => {
  const dir = makeSkill(tempRoot(), 'longevo-demo', 'name: longevo-other\ndescription: x');
  assert.match(validateSkill(dir).join('\n'), /must match the folder/);
});

test('the name must start with longevo-', () => {
  const dir = makeSkill(tempRoot(), 'demo', 'name: demo\ndescription: x');
  assert.match(validateSkill(dir).join('\n'), /must start with "longevo-"/);
});

test('a missing description is an error', () => {
  const dir = makeSkill(tempRoot(), 'longevo-demo', 'name: longevo-demo');
  assert.match(validateSkill(dir).join('\n'), /description is missing/);
});

test('a broken relative link is an error', () => {
  const dir = makeSkill(tempRoot(), 'longevo-demo', 'name: longevo-demo\ndescription: x', 'Read [the guide](references/missing.md).\n');
  assert.match(validateSkill(dir).join('\n'), /broken link to references\/missing\.md/);
});

test('a link to an existing reference passes', () => {
  const root = tempRoot();
  const dir = makeSkill(root, 'longevo-demo', 'name: longevo-demo\ndescription: x', 'Read [the guide](references/guide.md).\n');
  mkdirSync(join(dir, 'references'));
  writeFileSync(join(dir, 'references', 'guide.md'), '# Guide\n');
  assert.deepEqual(validateSkill(dir), []);
});

test('an empty skills folder is an error', () => {
  assert.match(validateAll(tempRoot()).join('\n'), /has no skills/);
});
