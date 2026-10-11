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

export function readBlock(text) {
  if (text === null) return { exists: false, lines: null };
  const all = text.split('\n');
  const start = all.findIndex((line) => line.trim() === START);
  const end = all.findIndex((line, index) => index > start && line.trim() === END);
  if (start === -1 || end === -1) return { exists: false, lines: null };
  return { exists: true, lines: end - start - 1 };
}

export function writeBlock(text, lines) {
  const block = [START, ...lines, END].join('\n');
  if (text === null || text === '') return `${block}\n`;
  const start = text.indexOf(START);
  const end = text.indexOf(END, start);
  if (start !== -1 && end !== -1) return text.slice(0, start) + block + text.slice(end + END.length);
  const gap = text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
  return `${text}${gap}${block}\n`;
}
