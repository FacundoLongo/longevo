import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readlinkSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const script = join(repo, 'scripts', 'install.sh');
const skills = readdirSync(join(repo, 'skills')).filter((name) => name.startsWith('longevo-'));
const targets = ['.agents/skills', '.claude/skills'];

function run(home, ...args) {
  return spawnSync('bash', [script, ...args], { env: { ...process.env, HOME: home }, encoding: 'utf8' });
}
const newHome = () => realpathSync(mkdtempSync(join(tmpdir(), 'longevo-home-')));

test('links every skill into both folders', () => {
  const home = newHome();
  const result = run(home);
  assert.equal(result.status, 0, result.stderr);
  for (const target of targets) {
    for (const skill of skills) {
      const link = join(home, target, skill);
      assert.ok(lstatSync(link).isSymbolicLink());
      assert.equal(realpathSync(readlinkSync(link)), realpathSync(join(repo, 'skills', skill)));
    }
  }
});

test('is idempotent', () => {
  const home = newHome();
  assert.equal(run(home).status, 0);
  const second = run(home);
  assert.equal(second.status, 0, second.stderr);
});

test('never replaces a real folder', () => {
  const home = newHome();
  const mine = join(home, '.claude/skills', skills[0]);
  mkdirSync(mine, { recursive: true });
  writeFileSync(join(mine, 'SKILL.md'), 'mine');
  const result = run(home);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /skipped/);
  assert.ok(lstatSync(mine).isDirectory());
  assert.ok(existsSync(join(mine, 'SKILL.md')));
});

test('--uninstall removes only the links', () => {
  const home = newHome();
  const mine = join(home, '.claude/skills', skills[0]);
  mkdirSync(mine, { recursive: true });
  run(home);
  assert.equal(run(home, '--uninstall').status, 0);
  assert.ok(!existsSync(join(home, '.agents/skills', skills[0])));
  assert.ok(existsSync(mine));
});

test('rejects an unknown option', () => {
  const result = run(newHome(), '--nope');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage: scripts\/install\.sh/);
});

test('leaves links it did not create', () => {
  const home = newHome();
  const other = realpathSync(mkdtempSync(join(tmpdir(), 'longevo-other-')));
  mkdirSync(join(home, '.claude/skills'), { recursive: true });
  const link = join(home, '.claude/skills', skills[0]);
  symlinkSync(other, link);
  const result = run(home);
  assert.match(result.stderr, /skipped/);
  assert.equal(readlinkSync(link), other);
  run(home, '--uninstall');
  assert.equal(readlinkSync(link), other);
});
