// Git pathspec globs, as used in `covers`: `*` and `?` stay inside one folder, `**` crosses folders.
const SPECIAL = /[.+^${}()|[\]\\]/;

export function globToRegExp(pattern) {
  const p = pattern.replace(/^\.\//, '');
  let out = '';
  for (let i = 0; i < p.length;) {
    if (p.startsWith('**/', i)) {
      out += '(?:.*/)?';
      i += 3;
    } else if (p.startsWith('/**', i) && i + 3 === p.length) {
      out += '(?:/.*)?';
      i += 3;
    } else if (p.startsWith('**', i)) {
      out += '.*';
      i += 2;
    } else if (p[i] === '*') {
      out += '[^/]*';
      i += 1;
    } else if (p[i] === '?') {
      out += '[^/]';
      i += 1;
    } else {
      out += SPECIAL.test(p[i]) ? `\\${p[i]}` : p[i];
      i += 1;
    }
  }
  return new RegExp(`^${out}$`);
}

const compiled = new Map();

export function matches(file, pattern) {
  const p = pattern.replace(/^\.\//, '').replace(/\/$/, '');
  if (!/[*?]/.test(p)) return file === p || file.startsWith(`${p}/`);
  if (!compiled.has(p)) compiled.set(p, globToRegExp(p));
  return compiled.get(p).test(file);
}

export function matchesAny(file, patterns) {
  return patterns.some((pattern) => matches(file, pattern));
}
