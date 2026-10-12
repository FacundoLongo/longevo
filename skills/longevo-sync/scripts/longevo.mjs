#!/usr/bin/env node
// The Longevo engine. Each command skill carries a copy of this folder (see scripts/copy-engine.mjs).
import { readFileSync, realpathSync } from 'node:fs';
import { apply } from './lib/apply.mjs';
import { fileURLToPath } from 'node:url';
import { generatedFiles } from './lib/attributes.mjs';
import { coverageFor } from './lib/coverage.mjs';
import { listFiles, scope } from './lib/repo.mjs';
import { scan, VERSION } from './scan.mjs';
import { syncReport } from './sync.mjs';
import { contextReport } from './context.mjs';
import { reviewReport } from './review.mjs';

export function parseArgs(argv) {
  const args = { command: argv[0], rest: [], cwd: process.cwd(), markSession: false, input: null, paths: null, base: null };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--cwd', '--input', '--paths', '--base'].includes(arg)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${arg} needs a value`);
      args[arg.slice(2)] = argv[(i += 1)];
    } else if (arg === '--session') {
      args.markSession = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      args.rest.push(arg);
    }
  }
  return args;
}

// Operations that take no input never read stdin, so an open empty pipe cannot fail or block them.
const NO_INPUT = new Set(['gemini', 'sources', 'coverage']);
// For these, no input is a normal call.
const OPTIONAL_INPUT = new Set(['import']);

function readStdin(op) {
  try {
    return readFileSync(0, 'utf8');
  } catch (error) {
    // A non-blocking pipe with nothing written yet: no input was given.
    if (error.code !== 'EAGAIN') throw error;
    if (OPTIONAL_INPUT.has(op)) return '';
    throw new Error(`apply ${op} needs its input as JSON on stdin. Pass it with a heredoc.`);
  }
}

export function run(argv) {
  const args = parseArgs(argv);
  if (args.command === 'scan') return scan(args.cwd, { markSession: args.markSession });
  if (args.command === 'sync') return syncReport(args.cwd);
  if (args.command === 'review') return reviewReport(args.cwd, { base: args.base });
  if (args.command === 'context') {
    if (!args.paths) throw new Error('context needs --paths, a comma-separated list of files or globs.');
    return contextReport(args.cwd, { paths: args.paths.split(',').map((p) => p.trim()).filter(Boolean) });
  }
  if (args.command === 'apply') {
    const raw = args.input ? readFileSync(args.input, 'utf8') : process.stdin.isTTY || NO_INPUT.has(args.rest[0]) ? '' : readStdin(args.rest[0]);
    let input = {};
    if (raw.trim()) {
      try {
        input = JSON.parse(raw);
      } catch {
        throw new Error('The apply input is not valid JSON.');
      }
    }
    return apply(args.rest[0], args.cwd, input);
  }
  if (args.command === 'coverage') {
    const sc = scope(args.cwd);
    const { files } = listFiles(sc);
    return coverageFor(sc, files, generatedFiles(sc, files)).replace(/\n$/, '');
  }
  throw new Error(`Unknown command: ${args.command ?? '(none)'}. Use scan, sync, context, review, apply or coverage.`);
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const out = run(process.argv.slice(2));
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ version: VERSION, error: error.message }));
    process.exit(1);
  }
}
