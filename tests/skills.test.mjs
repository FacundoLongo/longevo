import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateAll } from '../scripts/validate-skills.mjs';

const skillsRoot = fileURLToPath(new URL('../skills', import.meta.url));

test('every skill in the repo is valid', () => {
  assert.deepEqual(validateAll(skillsRoot), []);
});

test('the testing skill keeps the notice of the project it is based on', () => {
  const notice = readFileSync(`${skillsRoot}/longevo-testing/NOTICE.md`, 'utf8');
  assert.match(notice, /Copyright \(c\) 2026 Primo/);
  assert.match(notice, /8db7808b428e9af6733cca2e984e331eb71dc008/);
});

test('the testing skill says that repo rules win', () => {
  const skill = readFileSync(`${skillsRoot}/longevo-testing/SKILL.md`, 'utf8');
  assert.match(skill, /docs\/testing\.md/);
  assert.match(skill, /win over this skill/);
});

test('the testing skill links every stack reference', () => {
  const skill = readFileSync(`${skillsRoot}/longevo-testing/SKILL.md`, 'utf8');
  const stacks = readdirSync(`${skillsRoot}/longevo-testing/references/stacks`);
  for (const file of stacks) assert.ok(skill.includes(`(references/stacks/${file})`), `SKILL.md does not link ${file}`);
});
