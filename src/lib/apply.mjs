// Writes the structured changes the user picked (D7). Every input is checked before anything is written.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { generatedFiles } from './attributes.mjs';
import { MAX_BLOCK_LINES, readBlock, renderBlock, writeBlock } from './block.mjs';
import { coverageFor, COVERAGE_FILE } from './coverage.mjs';
import { parseFrontmatter, setFrontmatter } from './frontmatter.mjs';
import { matches } from './glob.mjs';
import { IMPORTS_AGENTS, prose } from './instructions.mjs';
import { listFiles, scope } from './repo.mjs';
import { collectSources, renderSources, SOURCES_FILE } from './sources.mjs';
import { addDeclined, removeDeclined } from './state.mjs';

const pad = (n) => String(n).padStart(2, '0');
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The new `verified` value. A second check on the same day adds the time, so the line still changes and its
// commit becomes the new drift anchor (D11).
export function nextVerified(current, date, now = new Date()) {
  if (current === undefined || current === null || String(current).slice(0, 10) !== date) return date;
  return `${date}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

const readOrNull = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};
const rel = (sc, path) => relative(sc.root, path).split(sep).join('/');
const DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/;

// Every path in an input must stay inside the repo, out of .git, and (once links are followed) under the root.
function inside(sc, path, { base = sc.root, markdown = false } = {}) {
  if (typeof path !== 'string' || !path.trim() || isAbsolute(path) || path.split(/[\\/]/).includes('..')) {
    throw new Error(`${path} must be a path inside the repo.`);
  }
  const clean = path.replace(/\\/g, '/').replace(/^\.\//, '');
  if (/(^|\/)\.git(\/|$)/.test(clean)) throw new Error(`${path} is inside .git; Longevo never writes there.`);
  if (markdown && !/\.mdx?$/.test(clean)) throw new Error(`${path} is not a Markdown file.`);
  const full = join(base, clean);
  if (existsSync(full)) {
    const root = realpathSync(sc.root);
    const real = realpathSync(full);
    if (real !== root && !real.startsWith(`${root}${sep}`)) throw new Error(`${path} points outside the repo.`);
  }
  return full;
}

function checkDate(value) {
  if (value !== undefined && !(typeof value === 'string' && DATE.test(value))) throw new Error(`verified must be a date like YYYY-MM-DD, not ${JSON.stringify(value)}.`);
}

const plain = (text) => typeof text === 'string' && !/[`\n]/.test(text);

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
  if (!Array.isArray(creating)) throw new Error('creating must be a list of paths.');
  creating.forEach((path) => inside(sc, path));
  const exists = (doc) => existsSync(inside(sc, doc, { markdown: true })) || creating.includes(doc);
  for (const { label, command } of commands) {
    if (typeof label !== 'string' || typeof command !== 'string' || !label.trim() || !command.trim()) throw new Error('Each command needs a label and a command.');
    if (/[`\n]/.test(label + command)) throw new Error('Commands and labels cannot contain backticks or new lines.');
  }
  const { files } = listFiles(sc);
  for (const { glob, doc } of triggers) {
    if (!plain(glob) || !plain(doc)) throw new Error('Trigger globs and docs cannot contain backticks or new lines.');
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
  const candidates = (file !== undefined ? [file] : ['CLAUDE.md', '.claude/CLAUDE.md']).map((f) => inside(sc, f, { base: sc.cwd }));
  if (file !== undefined && !/(^|\/)CLAUDE\.md$/.test(String(file))) throw new Error(`${file} is not a CLAUDE.md file.`);
  const path = candidates.find((p) => existsSync(p));
  if (!path) throw new Error('There is no CLAUDE.md here, so there is nothing to import into. Longevo does not create one.');
  if (lstatSync(path).isSymbolicLink()) {
    throw new Error(`${rel(sc, path)} is a link to ${relative(dirname(path), realpathSync(path))}, so Claude Code already reads that file. Nothing to import.`);
  }
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
  const byHand = 'Add "AGENTS.md" to context.fileName in .gemini/settings.json by hand.';
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error(`.gemini/settings.json is not a JSON object. ${byHand}`);
  if (settings.context !== undefined && (!settings.context || typeof settings.context !== 'object' || Array.isArray(settings.context))) {
    throw new Error(`context in .gemini/settings.json is not an object. ${byHand}`);
  }
  const current = settings.context?.fileName;
  const has = current === 'AGENTS.md' || (Array.isArray(current) && current.includes('AGENTS.md'));
  if (has) return write(sc, 'gemini', path, before, before);
  const next = current === undefined ? ['AGENTS.md', 'GEMINI.md'] : [...(Array.isArray(current) ? current : [current]), 'AGENTS.md'];
  const after = `${JSON.stringify({ ...settings, context: { ...(settings.context ?? {}), fileName: next } }, null, 2)}\n`;
  return write(sc, 'gemini', path, before, after);
}

function frontmatter(sc, { doc, covers, verified }, { today }) {
  checkDate(verified);
  if (!existsSync(inside(sc, doc, { markdown: true }))) throw new Error(`${doc} does not exist.`);
  if (!Array.isArray(covers) || covers.length === 0) throw new Error('covers needs at least one glob.');
  const { files } = listFiles(sc);
  covers.forEach((glob) => checkGlob(files, glob));
  const path = join(sc.root, doc);
  const before = readFileSync(path, 'utf8');
  return write(sc, 'frontmatter', path, before, setFrontmatter(before, { covers, verified: verified ?? today }));
}

function readDoc(sc, doc) {
  const path = inside(sc, doc, { markdown: true });
  if (!existsSync(path)) throw new Error(`${doc} does not exist.`);
  const before = readFileSync(path, 'utf8');
  const parsed = parseFrontmatter(before);
  if (parsed.error) throw new Error(`${doc}: ${parsed.error}`);
  return { path, before, data: parsed.data };
}

// The doc is still true: only its verified date changes.
function verify(sc, { doc, verified }, { today, now }) {
  checkDate(verified);
  const { path, before, data } = readDoc(sc, doc);
  if (!data.covers) throw new Error(`${doc} has no covers, so it is not a living doc.`);
  return write(sc, 'verify', path, before, setFrontmatter(before, { verified: nextVerified(data.verified, verified ?? today, now) }));
}

// A source was read and the doc still matches it: only that source's checked date changes.
function checked(sc, { doc, url, checked: date }, { today }) {
  checkDate(date);
  const { path, before, data } = readDoc(sc, doc);
  const sources = (Array.isArray(data.sources) ? data.sources : []).map((s) => (typeof s === 'string' ? { url: s } : s));
  if (!sources.some((s) => s.url === url)) throw new Error(`${doc} does not cite ${url}.`);
  const next = sources.map((s) => (s.url === url ? { ...s, checked: date ?? today } : s));
  return write(sc, 'checked', path, before, setFrontmatter(before, { sources: next }));
}

function sources(sc) {
  const { files } = listFiles(sc);
  const path = join(sc.root, SOURCES_FILE);
  return write(sc, 'sources', path, readOrNull(path), renderSources(collectSources(sc, files)));
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

function undecline(sc, { keys = [], all = false }) {
  if (!all && (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string'))) throw new Error('undecline needs a list of keys, or all: true.');
  return { op: 'undecline', declined: removeDeclined(sc, keys, all) };
}

const OPS = { block, import: importAgents, gemini, frontmatter, verify, checked, sources, coverage, decline, undecline };

export function apply(op, cwd, input = {}, { today = localDate(), now = new Date() } = {}) {
  if (!Object.hasOwn(OPS, op)) throw new Error(`Unknown apply operation: ${op}. Use ${Object.keys(OPS).join(', ')}.`);
  return OPS[op](scope(cwd), input ?? {}, { today, now });
}
