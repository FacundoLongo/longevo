import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PATH_LIKE = /^(?:\.{1,2}\/)?[\w.@-]+(?:\/[\w.@-]+)*\/?$/;
const EXTENSION = /\.(md|mdx|json|ya?ml|toml|ts|tsx|js|jsx|mjs|cjs|go|py|rb|rs|swift|kt|java|sql|sh|txt)$/;
const MIME_TYPE = /^(?:application|text|image|audio|video|multipart|font)\/[\w.+-]+$/;
const DOMAIN = /^[\w-]+(?:\.[\w-]+)+\//;
const dirOf = (file) => (file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '');

export function citedPaths(spans) {
  return spans
    .filter((span) => !span.block)
    .map((span) => ({ ...span, text: span.text.replace(/[.,;:]$/, '') }))
    .filter((span) => !/\s|\*|<|>|\{|\}|^@|^https?:|^-|^\d/.test(span.text))
    .filter((span) => !MIME_TYPE.test(span.text) && !DOMAIN.test(span.text))
    .filter((span) => PATH_LIKE.test(span.text) && (span.text.includes('/') || EXTENSION.test(span.text)));
}

// A bare file or folder name counts as present when any path in the repo has that name.
export function missingPaths(root, file, cited, files = []) {
  const names = new Set(files.flatMap((path) => path.split('/')));
  return cited
    .filter((span) => {
      const clean = span.text.replace(/\/$/, '');
      if (!clean.includes('/') && names.has(clean)) return false;
      return !existsSync(join(root, dirOf(file), clean)) && !existsSync(join(root, clean));
    })
    .map((span) => ({ file, line: span.line, path: span.text }));
}
