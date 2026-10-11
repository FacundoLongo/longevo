#!/usr/bin/env node
// Collects facts about the folder for longevo-init and prints them as JSON. Read-only, except the session marker in .git.
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chain, listFiles, scope } from './lib/repo.mjs';
import { codeSpans, readText } from './lib/text.mjs';
import { findInstructionFiles, instructionFindings, inventory, whoLoads } from './lib/instructions.mjs';
import { citedCommands, commandFindings, realCommands } from './lib/commands.mjs';
import { citedPaths, missingPaths } from './lib/paths.mjs';
import { testInventory } from './lib/tests.mjs';
import { redactDeep, securityFindings } from './lib/security.mjs';
import { session } from './lib/session.mjs';

export const VERSION = 1;

export function scan(cwd, { markSession = false } = {}) {
  const sc = scope(cwd);
  const { files, notScanned } = listFiles(sc);
  const dirs = chain(sc);
  const scopeDir = dirs[dirs.length - 1];
  const dirOf = (file) => (file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '');
  // Commands and tests come only from the scope folder, its subfolders, its parents and the repo CI.
  const scoped = scopeDir === ''
    ? files
    : files.filter((file) => {
      const dir = dirOf(file);
      return dirs.includes(dir) || dir === scopeDir || dir.startsWith(`${scopeDir}/`) || file.startsWith('.github/workflows/');
    });
  const instructionFiles = findInstructionFiles(files, dirs);
  const texts = Object.fromEntries(instructionFiles.map((file) => [file, readText(join(sc.root, file)) ?? '']));
  const files_ = inventory(sc, instructionFiles, texts);
  const loads = whoLoads(dirs, instructionFiles, texts);
  const real = realCommands(sc.root, scoped);
  const cited = instructionFiles.flatMap((file) => citedCommands(file, codeSpans(texts[file])));
  return redactDeep({
    version: VERSION,
    scope: sc,
    instructions: { files: files_, loads },
    commands: { real, cited },
    findings: [...instructionFindings(files_, loads), ...commandFindings(cited, real)],
    missingPaths: instructionFiles.flatMap((file) => missingPaths(sc.root, file, citedPaths(codeSpans(texts[file])), files)),
    tests: testInventory(sc.root, scoped),
    security: instructionFiles.flatMap((file) => securityFindings(file, texts[file])),
    session: session(sc, markSession),
    notScanned,
  });
}

function parseArgs(argv) {
  const args = { cwd: process.cwd(), markSession: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--cwd') args.cwd = argv[(i += 1)];
    else if (argv[i] === '--session') args.markSession = true;
    else throw new Error(`Unknown option: ${argv[i]}`);
  }
  return args;
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { cwd, markSession } = parseArgs(process.argv.slice(2));
    console.log(JSON.stringify(scan(cwd, { markSession }), null, 2));
  } catch (error) {
    console.log(JSON.stringify({ version: VERSION, error: error.message }));
    process.exit(1);
  }
}
