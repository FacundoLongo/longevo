// Writes the structured changes the user picked (D7). Every input is checked before anything is written.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { generatedFiles } from './attributes.mjs';
import { MAX_BLOCK_LINES, readBlock, renderBlock, writeBlock } from './block.mjs';
import { coverageFor, COVERAGE_FILE } from './coverage.mjs';
import { setFrontmatter } from './frontmatter.mjs';
import { matches } from './glob.mjs';
import { IMPORTS_AGENTS, prose } from './instructions.mjs';
import { listFiles, scope } from './repo.mjs';
import { addDeclined } from './state.mjs';

const pad = (n) => String(n).padStart(2, '0');
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const readOrNull = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};
const rel = (sc, path) => relative(sc.root, path).split(sep).join('/');

function write(sc, op, path, before, after, extra = {}) {
  const file = rel(sc, path);
  if (before === after) return { op, file, status: 'unchanged', ...extra };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, after);
  return { op, file, status: 'written', ...extra };
}

function checkGlob(files, glob) {
  if (typeof glob !== 'string' || !files.some((file) => matches(file, glob))) throw new Error(`${glob} matches no file.`);
}

function block(sc, input) {
  const { commands = [], triggers = [], testingDoc = false, coverageDoc = false, creating = [] } = input;
  const exists = (doc) => existsSync(join(sc.root, doc)) || creating.includes(doc);
  for (const { label, command } of commands) {
    if (typeof label !== 'string' || typeof command !== 'string' || !label.trim() || !command.trim()) throw new Error('Each command needs a label and a command.');
    if (/[`\n]/.test(label + command)) throw new Error('Commands and labels cannot contain backticks or new lines.');
  }
  const { files } = listFiles(sc);
  for (const { glob, doc } of triggers) {
    if (!exists(doc)) throw new Error(`${doc} does not exist.`);
    checkGlob(files, glob);
  }
  if (testingDoc && !exists('docs/testing.md')) throw new Error('docs/testing.md does not exist.');
  if (coverageDoc && !exists(COVERAGE_FILE)) throw new Error(`${COVERAGE_FILE} does not exist.`);
  const lines = renderBlock({ commands, triggers, testingDoc, coverageDoc });
  if (lines.length > MAX_BLOCK_LINES) {
    throw new Error(`The block would have ${lines.length} lines, which is more than ${MAX_BLOCK_LINES} lines. Ask which triggers to keep.`);
  }
  const path = join(sc.cwd, 'AGENTS.md');
  const before = readOrNull(path);
  return write(sc, 'block', path, before, writeBlock(before, lines), { lines: { before: readBlock(before).lines, after: lines.length } });
}

function importAgents(sc, { file }) {
  const path = (file ? [file] : ['CLAUDE.md', '.claude/CLAUDE.md']).map((f) => join(sc.cwd, f)).find((p) => existsSync(p));
  if (!path) throw new Error('There is no CLAUDE.md here, so there is nothing to import into. Longevo does not create one.');
  const before = readFileSync(path, 'utf8');
  if (IMPORTS_AGENTS.test(prose(before))) return write(sc, 'import', path, before, before);
  const line = rel(sc, path).endsWith('.claude/CLAUDE.md') ? '@../AGENTS.md' : '@AGENTS.md';
  return write(sc, 'import', path, before, `${line}\n\n${before}`);
}

function gemini(sc) {
  const path = join(sc.root, '.gemini', 'settings.json');
  const before = readOrNull(path);
  let settings = {};
  if (before !== null) {
    try {
      settings = JSON.parse(before);
    } catch {
      throw new Error('.gemini/settings.json is not plain JSON (it may have comments). Add "AGENTS.md" to context.fileName by hand.');
    }
  }
  const current = settings.context?.fileName;
  const has = current === 'AGENTS.md' || (Array.isArray(current) && current.includes('AGENTS.md'));
  if (has) return write(sc, 'gemini', path, before, before);
  const next = current === undefined ? ['AGENTS.md', 'GEMINI.md'] : [...(Array.isArray(current) ? current : [current]), 'AGENTS.md'];
  const after = `${JSON.stringify({ ...settings, context: { ...(settings.context ?? {}), fileName: next } }, null, 2)}\n`;
  return write(sc, 'gemini', path, before, after);
}

function frontmatter(sc, { doc, covers, verified }, { today }) {
  if (typeof doc !== 'string' || !existsSync(join(sc.root, doc))) throw new Error(`${doc} does not exist.`);
  if (!Array.isArray(covers) || covers.length === 0) throw new Error('covers needs at least one glob.');
  const { files } = listFiles(sc);
  covers.forEach((glob) => checkGlob(files, glob));
  const path = join(sc.root, doc);
  const before = readFileSync(path, 'utf8');
  return write(sc, 'frontmatter', path, before, setFrontmatter(before, { covers, verified: verified ?? today }));
}

function coverage(sc) {
  const { files } = listFiles(sc);
  const path = join(sc.root, COVERAGE_FILE);
  return write(sc, 'coverage', path, readOrNull(path), coverageFor(sc, files, generatedFiles(sc, files)));
}

function decline(sc, { keys }) {
  if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string')) throw new Error('decline needs a list of keys.');
  return { op: 'decline', declined: addDeclined(sc, keys) };
}

const OPS = { block, import: importAgents, gemini, frontmatter, coverage, decline };

export function apply(op, cwd, input = {}, { today = localDate() } = {}) {
  if (!Object.hasOwn(OPS, op)) throw new Error(`Unknown apply operation: ${op}. Use ${Object.keys(OPS).join(', ')}.`);
  return OPS[op](scope(cwd), input ?? {}, { today });
}
