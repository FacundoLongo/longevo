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

test('no skill or doc still calls init read-only', () => {
  for (const path of ['skills/longevo-init/SKILL.md', 'README.md', 'docs/design/commands.md', 'AGENTS.md']) {
    const text = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /read-only `?longevo-init|init is read-only|Read-only: it reports|a read-only `?longevo-init/i, path);
  }
});

test('the init skill asks once, uses the engine and never commits', () => {
  const skill = readFileSync(`${skillsRoot}/longevo-init/SKILL.md`, 'utf8');
  assert.match(skill, /Which ones do I apply\? \[All \/ Pick numbers \/ None\]/);
  assert.match(skill, /scripts\/longevo\.mjs scan --cwd \. --session/);
  assert.match(skill, /[Nn]ever stage or commit/);
});

test('the init skill links every reference it has', () => {
  const skill = readFileSync(`${skillsRoot}/longevo-init/SKILL.md`, 'utf8');
  for (const file of readdirSync(`${skillsRoot}/longevo-init/references`)) assert.ok(skill.includes(`(references/${file})`), `SKILL.md does not link ${file}`);
});

test('the sync skill asks once, never writes outside the repo and never commits', () => {
  const skill = readFileSync(`${skillsRoot}/longevo-sync/SKILL.md`, 'utf8');
  assert.match(skill, /Which ones do I apply\? \[All \/ Pick numbers \/ None\]/);
  assert.match(skill, /scripts\/longevo\.mjs sync --cwd \./);
  assert.match(skill, /[Nn]ever stage or commit/);
  assert.match(skill, /[Nn]ever write to (Notion|external)/);
  assert.match(skill, /[Nn]ever change code/);
  for (const file of readdirSync(`${skillsRoot}/longevo-sync/references`)) assert.ok(skill.includes(`(references/${file})`), file);
});

for (const [name, command] of [['longevo-brief', 'context'], ['longevo-review', 'review']]) {
  test(`${name} asks once, never commits and links its references`, () => {
    const skill = readFileSync(`${skillsRoot}/${name}/SKILL.md`, 'utf8');
    assert.match(skill, /Which ones do I apply\? \[All \/ Pick numbers \/ None\]/);
    assert.match(skill, /[Nn]ever stage or commit/);
    assert.match(skill, new RegExp(`scripts/longevo\\.mjs ${command} --cwd \\.`));
    for (const file of readdirSync(`${skillsRoot}/${name}/references`)) assert.ok(skill.includes(`(references/${file})`), file);
  });
}

test('the review skill never changes code and uses a fresh reviewer', () => {
  const skill = readFileSync(`${skillsRoot}/longevo-review/SKILL.md`, 'utf8');
  assert.match(skill, /[Nn]ever change code/);
  assert.match(skill, /subagent/);
});

test('the brief skill never writes to the tracker', () => {
  const skill = readFileSync(`${skillsRoot}/longevo-brief/SKILL.md`, 'utf8');
  assert.match(skill, /[Nn]ever write to the (tracker|issue)/);
});
