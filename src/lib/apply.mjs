// Writes the structured changes the user picked (D7). Every input is checked before anything is written.
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { generatedFiles } from './attributes.mjs';
import { MAX_BLOCK_LINES, readBlock, renderBlock, writeBlock } from './block.mjs';
import { coverageFor, COVERAGE_FILE } from './coverage.mjs';
import { localDate, pad, realDate } from './dates.mjs';
import { parseFrontmatter, setFrontmatter, setSourceChecked } from './frontmatter.mjs';
import { matches } from './glob.mjs';
import { IMPORTS_AGENTS, prose } from './instructions.mjs';
import { git, listFiles, scope } from './repo.mjs';
import { collectSources, renderSources, SOURCES_FILE } from './sources.mjs';
import { addDeclined, removeDeclined, stateDir } from './state.mjs';
import { BRIEF } from './work.mjs';


// The new `verified` value. A second check on the same day adds the time, so the line still changes and its
// commit becomes the new drift anchor (D11).
function nextVerified(current, date, now = new Date()) {
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

// Every path in an input must stay inside the repo, out of .git, and (once links are followed) under the root.
function inside(sc, path, { base = sc.root, markdown = false } = {}) {
  if (typeof path !== 'string' || !path.trim() || isAbsolute(path) || path.split(/[\\/]/).includes('..')) {
    throw new Error(`${path} must be a path inside the repo.`);
  }
  const clean = path.replace(/\\/g, '/').replace(/^\.\//, '');
  // Case-insensitive: on macOS and Windows .GIT is the same folder as .git.
  if (/(^|\/)\.git(\/|$)/i.test(clean)) throw new Error(`${path} is inside .git; apply never writes there.`);
  if (markdown && !/\.mdx?$/.test(clean)) throw new Error(`${path} is not a Markdown file.`);
  const full = join(base, clean);
  if (existsSync(full)) {
    const root = realpathSync(sc.root);
    const real = realpathSync(full);
    if (real !== root && !real.startsWith(`${root}${sep}`)) throw new Error(`${path} points outside the repo.`);
  }
  return full;
}

function checkDate(value, name = 'verified') {
  if (value !== undefined && !realDate(value)) throw new Error(`${name} must be a date like YYYY-MM-DD, not ${JSON.stringify(value)}.`);
}

const plain = (text) => typeof text === 'string' && !/[`\n]/.test(text);

const under = (path, dir) => path === dir || path.startsWith(`${dir}${sep}`);

function gitDirs(sc) {
  if (!sc.isGit) return [];
  return ['--absolute-git-dir', '--git-common-dir']
    .map((flag) => (git(sc.root, ['rev-parse', flag]) ?? '').trim())
    .filter(Boolean)
    .map((dir) => {
      try {
        return realpathSync.native(resolve(sc.root, dir));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// The place a write really lands: links (also dangling ones) and linked folders are followed. It must be inside
// the repo and outside .git, or nothing is written.
function guardTarget(sc, path) {
  const root = realpathSync.native(sc.root);
  for (let dir = dirname(path); dir !== sc.root && under(dir, sc.root); dir = dirname(dir)) {
    let stat = null;
    try {
      stat = lstatSync(dir);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink() && !existsSync(dir)) throw new Error(`${rel(sc, dir)} is a link to a folder that does not exist; nothing was written.`);
  }
  let target = path;
  for (let hops = 0; hops < 40; hops += 1) {
    let stat = null;
    try {
      stat = lstatSync(target);
    } catch {
      break;
    }
    if (!stat.isSymbolicLink()) break;
    target = resolve(dirname(target), readlinkSync(target));
  }
  let probe = target;
  while (!existsSync(probe) && dirname(probe) !== probe) probe = dirname(probe);
  // The native call gives the real spelling of each folder, so .GIT compares equal to .git where the disk ignores case.
  const real = join(realpathSync.native(probe), relative(probe, target));
  if (!under(real, root)) throw new Error(`${rel(sc, path)} points outside the repo; Longevo writes only inside it.`);
  if (gitDirs(sc).some((dir) => under(real, dir))) throw new Error(`${rel(sc, path)} is inside .git; apply never writes there.`);
}

function write(sc, op, path, before, after, extra = {}) {
  const file = rel(sc, path);
  guardTarget(sc, path);
  if (before === after) return { op, file, status: 'unchanged', ...extra };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, after);
  return { op, file, status: 'written', ...extra };
}

function checkGlob(files, glob) {
  if (typeof glob !== 'string' || !files.some((file) => matches(file, glob))) throw new Error(`${glob} matches no file.`);
}

function block(sc, input) {
  // An accidental {} would replace the user's block with an empty one; empty lists are a deliberate choice.
  if (!['commands', 'triggers', 'testingDoc', 'coverageDoc'].some((key) => Object.hasOwn(input, key))) {
    throw new Error('The block input has no commands, triggers, testingDoc or coverageDoc. Pass the lines the block should have.');
  }
  const { commands = [], triggers = [], testingDoc = false, coverageDoc = false, creating = [] } = input;
  for (const [name, list] of Object.entries({ commands, triggers, creating })) {
    if (!Array.isArray(list)) throw new Error(`${name} must be a list.`);
  }
  creating.forEach((path) => inside(sc, path));
  const exists = (doc) => existsSync(inside(sc, doc, { markdown: true })) || creating.includes(doc);
  const missing = (doc) => new Error(`${doc} does not exist. If this run creates it, add it to creating.`);
  for (const entry of commands) {
    const { label, command } = entry ?? {};
    if (typeof label !== 'string' || typeof command !== 'string' || !label.trim() || !command.trim()) throw new Error('Each command needs a label and a command.');
    if (/[`\n]/.test(label + command)) throw new Error('Commands and labels cannot contain backticks or new lines.');
  }
  const { files } = listFiles(sc);
  for (const entry of triggers) {
    const { glob, doc } = entry ?? {};
    if (typeof glob !== 'string' || typeof doc !== 'string') throw new Error('Each trigger needs a glob and a doc.');
    if (!plain(glob) || !plain(doc)) throw new Error('Trigger globs and docs cannot contain backticks or new lines.');
    if (!exists(doc)) throw missing(doc);
    checkGlob(files, glob);
  }
  if (testingDoc && !exists('docs/testing.md')) throw missing('docs/testing.md');
  if (coverageDoc && !exists(COVERAGE_FILE)) throw missing(COVERAGE_FILE);
  const lines = renderBlock({ commands, triggers, testingDoc, coverageDoc });
  if (lines.length > MAX_BLOCK_LINES) {
    throw new Error(`The block would have ${lines.length} lines, which is more than ${MAX_BLOCK_LINES} lines. Ask which triggers to keep.`);
  }
  const path = join(sc.cwd, 'AGENTS.md');
  const before = readOrNull(path);
  return write(sc, 'block', path, before, writeBlock(before, lines), { lines: { before: readBlock(before).lines, after: lines.length } });
}

function importAgents(sc, { file }) {
  if (file !== undefined) inside(sc, file, { base: sc.cwd });
  if (file !== undefined && !/(^|\/)CLAUDE\.md$/.test(String(file))) throw new Error(`${file} is not a CLAUDE.md file.`);
  // Only the file that will be written is checked, so a .claude folder linked outside does not block CLAUDE.md.
  const name = (file !== undefined ? [file] : ['CLAUDE.md', '.claude/CLAUDE.md']).find((f) => existsSync(join(sc.cwd, f)));
  const path = name === undefined ? undefined : inside(sc, name, { base: sc.cwd });
  if (!path) throw new Error('There is no CLAUDE.md here, so there is nothing to import into. Longevo does not create one.');
  if (lstatSync(path).isSymbolicLink()) {
    throw new Error(`${rel(sc, path)} is a link to ${relative(dirname(path), realpathSync(path))}, so Claude Code already reads that file. Nothing to import.`);
  }
  const agents = join(dirname(path).replace(/\/\.claude$/, ''), 'AGENTS.md');
  if (existsSync(agents) && realpathSync(agents) === realpathSync(path)) {
    throw new Error(`${rel(sc, path)} and ${rel(sc, agents)} are the same file, so every agent reads the same rules. Nothing to import.`);
  }
  const before = readFileSync(path, 'utf8');
  if (IMPORTS_AGENTS.test(prose(before))) return write(sc, 'import', path, before, before);
  const line = rel(sc, path).endsWith('.claude/CLAUDE.md') ? '@../AGENTS.md' : '@AGENTS.md';
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  return write(sc, 'import', path, before, `${line}${eol}${eol}${before}`);
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

function frontmatter(sc, { doc, covers, verified }, { today, now }) {
  checkDate(verified);
  if (!existsSync(inside(sc, doc, { markdown: true }))) throw new Error(`${doc} does not exist.`);
  if (!Array.isArray(covers) || covers.length === 0) throw new Error('covers needs at least one glob.');
  const { files } = listFiles(sc);
  covers.forEach((glob) => checkGlob(files, glob));
  const path = join(sc.root, doc);
  const before = readFileSync(path, 'utf8');
  const current = parseFrontmatter(before).data.verified;
  return write(sc, 'frontmatter', path, before, setFrontmatter(before, { covers, verified: verified ?? nextVerified(current, today, now) }));
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
  checkDate(date, 'checked');
  if (typeof url !== 'string' || !url.trim()) throw new Error('checked needs the url of the source.');
  const { path, before, data } = readDoc(sc, doc);
  const sources = (Array.isArray(data.sources) ? data.sources : []).map((s) => (typeof s === 'string' ? { url: s } : s));
  if (!sources.some((s) => s.url === url)) throw new Error(`${doc} does not cite ${url}.`);
  return write(sc, 'checked', path, before, setSourceChecked(before, url, date ?? today));
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

const NOT_STORED = 'This folder is not a git repo, so declined changes are not remembered.';

function decline(sc, { keys }) {
  if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string')) throw new Error('decline needs a list of keys.');
  if (!stateDir(sc)) return { op: 'decline', declined: [], stored: false, note: NOT_STORED };
  return { op: 'decline', declined: addDeclined(sc, keys) };
}

const BRIEF_SECTIONS = ['Goal', 'Rules that apply', 'Affected code and docs', 'Golden tests', 'What must not change', 'Open questions', 'Acceptance criteria', 'Tests'];

// Creates docs/work/<date>-<slug>/brief.md with its frontmatter and section headings; the model fills the sections.
function brief(sc, { slug, task, covers }, { today }) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new Error(`The slug must be kebab case (lowercase letters, numbers and dashes), not ${JSON.stringify(slug)}.`);
  }
  if (typeof task !== 'string' || !task.trim() || /\n/.test(task)) throw new Error('task needs one line: the issue link or a short title.');
  if (!Array.isArray(covers) || covers.length === 0) throw new Error('covers needs at least one glob.');
  // A brief comes before the code, so its globs may name folders that do not exist yet; they must stay in the repo.
  for (const glob of covers) {
    if (!plain(glob) || !glob.trim() || isAbsolute(glob) || glob.split('/').includes('..')) throw new Error(`${glob} must be a glob inside the repo.`);
  }
  const path = inside(sc, `docs/work/${today}-${slug}/brief.md`, { markdown: true });
  const taken = () => {
    try {
      lstatSync(path);
      return true;
    } catch {
      return false;
    }
  };
  if (taken()) throw new Error(`${rel(sc, path)} already exists. Pick another slug.`);
  const title = slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const body = setFrontmatter(`# ${title}\n\n${BRIEF_SECTIONS.map((section) => `## ${section}\n`).join('\n')}`, { status: 'open', task, covers });
  guardTarget(sc, path);
  mkdirSync(dirname(path), { recursive: true });
  try {
    // wx never follows or replaces an existing path, links included. The task is always quoted: issue keys like
    // #12 would start a YAML comment.
    writeFileSync(path, body.replace(/^task: .*$/m, () => `task: ${JSON.stringify(task)}`), { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`${rel(sc, path)} already exists. Pick another slug.`);
    throw error;
  }
  return { op: 'brief', file: rel(sc, path), status: 'written' };
}

function done(sc, { doc }) {
  const { path, before } = readDoc(sc, doc);
  if (!BRIEF.test(rel(sc, path))) throw new Error(`${doc} is not a brief in docs/work/.`);
  return write(sc, 'done', path, before, setFrontmatter(before, { status: 'done' }));
}

function undecline(sc, { keys = [], all = false }) {
  if (!all && (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string'))) throw new Error('undecline needs a list of keys, or all: true.');
  if (!stateDir(sc)) return { op: 'undecline', declined: [], stored: false, note: NOT_STORED };
  return { op: 'undecline', declined: removeDeclined(sc, keys, all) };
}

const OPS = { block, import: importAgents, gemini, frontmatter, verify, checked, sources, coverage, decline, undecline, brief, done };
export const APPLY_OPS = Object.keys(OPS);

export function apply(op, cwd, input = {}, { today = localDate(), now = new Date() } = {}) {
  if (!Object.hasOwn(OPS, op)) throw new Error(`Unknown apply operation: ${op}. Use ${Object.keys(OPS).join(', ')}.`);
  if ((git(cwd, ['rev-parse', '--is-inside-git-dir']) ?? '').trim() === 'true') throw new Error(`${cwd} is inside .git; run Longevo from the repo instead.`);
  return OPS[op](scope(cwd), input ?? {}, { today, now });
}
