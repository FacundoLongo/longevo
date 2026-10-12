#!/usr/bin/env node
// Copies src/ into the scripts/ folder of each command skill, so every skill works on its own (decision D10).
import { cpSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENGINE_SKILLS = ['longevo-init', 'longevo-sync', 'longevo-brief', 'longevo-review'];

export function copyEngine(repoRoot) {
  for (const skill of ENGINE_SKILLS) {
    const target = join(repoRoot, 'skills', skill, 'scripts');
    rmSync(target, { recursive: true, force: true });
    cpSync(join(repoRoot, 'src'), target, { recursive: true });
  }
  return ENGINE_SKILLS;
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const updated = copyEngine(fileURLToPath(new URL('..', import.meta.url)));
  console.log(`Copied src/ into ${updated.map((skill) => `skills/${skill}/scripts`).join(', ')}`);
}
