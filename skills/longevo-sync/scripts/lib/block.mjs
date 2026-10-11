// The Longevo block in AGENTS.md: a few lines between two markers. Text outside the markers is never touched.
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
function markerLines(text) {
  const lines = text.split('\n');
  const starts = lines.flatMap((line, index) => (line.trim() === START ? [index] : []));
  const ends = lines.flatMap((line, index) => (line.trim() === END ? [index] : []));
  return { lines, starts, ends };
}

function findBlock(text) {
  const { lines, starts, ends } = markerLines(text);
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

export function writeBlock(text, lines) {
  const block = [START, ...lines, END];
  if (text === null || text === '') return `${block.join('\n')}\n`;
  const found = findBlock(text);
  if (found.start !== -1) return [...found.lines.slice(0, found.start), ...block, ...found.lines.slice(found.end + 1)].join('\n');
  const gap = text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
  return `${text}${gap}${block.join('\n')}\n`;
}
