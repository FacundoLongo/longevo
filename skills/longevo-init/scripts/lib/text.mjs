import { readFileSync, statSync } from 'node:fs';

export function readText(path, maxBytes = 1_000_000) {
  try {
    if (statSync(path).size > maxBytes) return null;
    const buffer = readFileSync(path);
    if (buffer.includes(0)) return null;
    return buffer.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  } catch {
    return null;
  }
}

// Inline code spans and the lines of fenced code blocks, with their line numbers.
export function codeSpans(text) {
  const spans = [];
  let inFence = false;
  text.split('\n').forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      const trimmed = line.trim().replace(/^\$\s+/, '');
      if (trimmed) spans.push({ text: trimmed, line: index + 1, block: true });
      return;
    }
    for (const match of line.matchAll(/`([^`\n]+)`/g)) {
      spans.push({ text: match[1].trim().replace(/^\$\s+/, ''), line: index + 1, block: false });
    }
  });
  return spans;
}
