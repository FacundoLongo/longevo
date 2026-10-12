import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, statSync } from 'node:fs';

// A short, stable name for a text, used in the decline keys of generated files.
export const contentHash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12);

// UTF-16 with a byte order mark is decoded; files over the limit or with NUL bytes are not text to Longevo.
function decode(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer.subarray(2));
  return buffer.includes(0) ? null : buffer.toString('utf8');
}

export function readText(path, maxBytes = 1_000_000) {
  try {
    if (statSync(path).size > maxBytes) return null;
    const text = decode(readFileSync(path));
    return text === null ? null : text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  } catch {
    return null;
  }
}

// Why readText returned null for a file that exists, or null when it can be read.
export function unreadableReason(path, maxBytes = 1_000_000) {
  try {
    if (statSync(path).size > maxBytes) return 'it is larger than 1 MB';
    return decode(readFileSync(path)) === null ? 'it has NUL bytes, so it may be UTF-16 without a byte order mark or a binary file' : null;
  } catch (error) {
    try {
      if (lstatSync(path).isSymbolicLink()) return 'it is a link to a file that does not exist';
    } catch {
      // Not there at all.
    }
    return `it cannot be opened (${error.code ?? 'error'})`;
  }
}

// For each line: 'fence' for a line that opens or closes a code fence, 'code' inside one, or null. As in
// CommonMark, a fence closes only on the same character, at least as long, with nothing after it.
// The list also says whether the text ends inside an open fence (`unclosed`).
export function fenceKinds(lines) {
  let open = null;
  const kinds = lines.map((line) => {
    const fence = line.replace(/\r$/, '').match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (open) {
      if (fence && fence[1][0] === open[0] && fence[1].length >= open.length && !fence[2].trim()) {
        open = null;
        return 'fence';
      }
      return 'code';
    }
    if (fence && !(fence[1][0] === '`' && fence[2].includes('`'))) {
      open = fence[1];
      return 'fence';
    }
    return null;
  });
  kinds.unclosed = open !== null;
  return kinds;
}

// Inline code spans and the lines of fenced code blocks, with their line numbers.
export function codeSpans(text) {
  const spans = [];
  const lines = text.split('\n');
  const kinds = fenceKinds(lines);
  lines.forEach((line, index) => {
    if (kinds[index] === 'fence') return;
    if (kinds[index] === 'code') {
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
