// The Longevo block in AGENTS.md: a few lines between two markers. Text outside the markers is never touched.
import { fenceKinds } from './text.mjs';

export const START = '<!-- longevo:start -->';
export const END = '<!-- longevo:end -->';
export const MAX_BLOCK_LINES = 12;

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function renderBlock({ commands = [], triggers = [], testingDoc = false, coverageDoc = false } = {}) {
  const lines = ['## Longevo'];
  for (const { label, command } of commands) lines.push(`- ${label}: \`${command}\``);
  if (testingDoc) lines.push('- If you write or change tests, read `docs/testing.md`.');
  for (const { glob, doc } of [...triggers].sort((a, b) => byText(a.glob, b.glob) || byText(a.doc, b.doc))) {
    lines.push(`- If you change \`${glob}\`, read \`${doc}\`.`);
  }
  if (coverageDoc) lines.push('- What is tested and documented: `docs/coverage.md`.');
  lines.push('- Start each session with the `longevo-init` skill.');
  return lines;
}

// Markers count only as whole lines. One marker without the other, or two blocks, stop the write.
// Markers inside a code fence are an example of the block, not the block.
function markerLines(text) {
  const lines = text.split('\n');
  const kinds = fenceKinds(lines);
  const kept = lines.map((line, index) => (kinds[index] ? null : line.trim()));
  const starts = kept.flatMap((line, index) => (line === START ? [index] : []));
  const ends = kept.flatMap((line, index) => (line === END ? [index] : []));
  return { lines, starts, ends, unclosed: kinds.unclosed };
}

function findBlock(text) {
  const { lines, starts, ends, unclosed } = markerLines(text);
  // A new block written after an open fence would land inside it; a block found before the fence is replaced in place.
  if (unclosed && starts.length === 0 && ends.length === 0) throw new Error('AGENTS.md ends inside a code fence. Close the fence by hand and run init again.');
  if (starts.length === 0 && ends.length === 0) return { lines, start: -1, end: -1 };
  if (starts.length > 1 || ends.length > 1) throw new Error('AGENTS.md has more than one Longevo block. Keep one and run init again.');
  if (starts.length !== ends.length || ends[0] < starts[0]) throw new Error('AGENTS.md has a Longevo marker without its pair. Fix the markers by hand and run init again.');
  return { lines, start: starts[0], end: ends[0] };
}

export function readBlock(text) {
  if (text === null) return { exists: false, lines: null };
  try {
    const { start, end } = findBlock(text);
    return start === -1 ? { exists: false, lines: null } : { exists: true, lines: end - start - 1 };
  } catch (error) {
    return { exists: false, lines: null, error: error.message };
  }
}

// A file with CRLF line endings keeps them.
export function writeBlock(text, lines) {
  const block = [START, ...lines, END];
  if (text === null || text === '') return `${block.join('\n')}\n`;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const found = findBlock(text);
  if (found.start !== -1) {
    const cr = eol === '\r\n' ? '\r' : '';
    // The end marker gets a carriage return only when a line follows it.
    const last = found.end === found.lines.length - 1;
    const written = block.map((line, index) => (index === block.length - 1 && last ? line : `${line}${cr}`));
    return [...found.lines.slice(0, found.start), ...written, ...found.lines.slice(found.end + 1)].join('\n');
  }
  const gap = text.endsWith(`${eol}${eol}`) ? '' : text.endsWith(eol) ? eol : `${eol}${eol}`;
  return `${text}${gap}${block.join(eol)}${eol}`;
}
