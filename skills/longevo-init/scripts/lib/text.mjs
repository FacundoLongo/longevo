import { readFileSync, statSync } from 'node:fs';

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
    return `it cannot be opened (${error.code ?? 'error'})`;
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
