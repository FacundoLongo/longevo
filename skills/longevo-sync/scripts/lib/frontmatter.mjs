// Reads and writes the YAML frontmatter Longevo uses: scalars, lists and lists of maps. Nested maps and block text
// of other tools are read loosely and kept as they are. Other lines stay as they are.
const KEY_VALUE = /^([\w.-]+):(?:\s+(.*))?$/;
const NOT_CLOSED = 'The frontmatter block is not closed with ---.';
const TOML = 'TOML frontmatter (+++) is not supported. Longevo reads YAML frontmatter between --- lines.';
const BLOCK_TEXT = /^[|>][+-]?\d*$/;
const clean = (line) => line.replace(/\r$/, '');

function scalar(value = '') {
  const v = value.trim();
  // A quoted value ends at its closing quote; a comment after it is not part of the value.
  const double = v.match(/^"((?:[^"\\]|\\.)*)"/);
  if (double) {
    try {
      return JSON.parse(`"${double[1]}"`);
    } catch {
      return double[1];
    }
  }
  const single = v.match(/^'((?:[^']|'')*)'/);
  if (single) return single[1].replace(/''/g, "'");
  return v.replace(/\s+#.*$/, '');
}

function splitList(inner) {
  const items = [];
  let current = '';
  let quote = null;
  for (const char of inner) {
    if (quote) {
      if (char === quote) quote = null;
      current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === ',') {
      items.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) items.push(current);
  return items.map(scalar);
}

function value(raw = '') {
  const v = raw.trim();
  if (v.startsWith('[') && v.replace(/\s+#.*$/, '').endsWith(']')) return splitList(v.replace(/\s+#.*$/, '').slice(1, -1));
  return v === '' ? null : scalar(v);
}

// Block text (| or >) without its common indent. Only other tools use it, so folding is kept simple.
function blockText({ style, lines }) {
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
  const body = lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0));
  const text = style === '>' ? body.map((l) => l.trim()).join(' ').replace(/ {2,}/g, '\n') : body.join('\n');
  return text.replace(/\s+$/, '');
}

function parseBlock(lines) {
  // Errors name the line by its number in the file, never by its text: it could hold a secret.
  const unreadable = (index) => new Error(`Cannot read line ${index + 2} of the frontmatter.`);
  const data = {};
  let key = null;
  let item = null;
  let itemIndent = 0;
  let itemFields = 0;
  let map = null;
  let mapIndent = 0;
  let text = null;
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    const indent = raw.length - raw.trimStart().length;
    if (text) {
      if (!line || indent > 0) {
        text.lines.push(raw);
        continue;
      }
      data[key] = blockText(text);
      text = null;
    }
    if (!line || line.startsWith('#')) continue;
    const pair = line.match(KEY_VALUE);
    if (indent === 0 && !line.startsWith('- ')) {
      if (!pair) throw unreadable(index);
      [, key] = pair;
      item = null;
      map = null;
      const head = (pair[2] ?? '').replace(/\s+#.*$/, '').trim();
      if (BLOCK_TEXT.test(head)) text = { style: head[0], lines: [] };
      data[key] = text ? '' : value(pair[2]);
    } else if (map && indent > mapIndent) {
      // Deeper levels of another tool's nested map are kept in the file and not read.
      continue;
    } else if (map && indent === mapIndent && pair && !line.startsWith('- ')) {
      map[pair[1]] = value(pair[2]);
    } else if (item && indent > itemFields) {
      // Deeper lines of an item are another tool's nested map or list: kept in the file, not read.
      continue;
    } else if (key !== null && !map && (line.startsWith('- ') || line === '-')) {
      const rest = line.slice(1).trim();
      const inner = rest.match(KEY_VALUE);
      if (!Array.isArray(data[key])) data[key] = [];
      if (inner && !/^["']/.test(rest)) {
        item = { [inner[1]]: scalar(inner[2]) };
        itemIndent = indent;
        // Fields of the item sit at the column of its first key.
        itemFields = indent + 1 + raw.trimStart().match(/^-(\s*)/)[1].length;
        data[key].push(item);
      } else {
        item = null;
        data[key].push(scalar(rest));
      }
    } else if (item && pair && indent > itemIndent) {
      item[pair[1]] = scalar(pair[2]);
    } else if (key !== null && data[key] === null && pair) {
      map = { [pair[1]]: value(pair[2]) };
      mapIndent = indent;
      data[key] = map;
    } else {
      throw unreadable(index);
    }
  }
  if (text) data[key] = blockText(text);
  return data;
}

function closingLine(lines) {
  return lines.findIndex((line, index) => index > 0 && clean(line) === '---');
}

export function parseFrontmatter(text) {
  // A byte order mark before the first --- is not part of it.
  if (text.startsWith('\uFEFF')) return parseFrontmatter(text.slice(1));
  const lines = text.split('\n');
  if (clean(lines[0]) === '+++') return { data: {}, body: text, hasFrontmatter: true, error: TOML };
  if (clean(lines[0]) !== '---') return { data: {}, body: text, hasFrontmatter: false, error: null };
  const end = closingLine(lines);
  if (end === -1) return { data: {}, body: text, hasFrontmatter: true, error: NOT_CLOSED };
  const body = lines.slice(end + 1).join('\n');
  try {
    return { data: parseBlock(lines.slice(1, end).map(clean)), body, hasFrontmatter: true, error: null };
  } catch (error) {
    return { data: {}, body, hasFrontmatter: true, error: error.message };
  }
}

function renderScalar(v) {
  const s = String(v);
  return /^[\s[{"'#&*!|>%@`]|: |\s#|:$/.test(s) ? JSON.stringify(s) : s;
}

// One top-level key. A list of maps, like sources, becomes a block with one "- key: value" item per map.
function renderEntry(key, v, eol) {
  if (Array.isArray(v) && v.some((item) => item && typeof item === 'object')) {
    const items = v.flatMap((item) => Object.entries(item).map(([k, value], index) => `${index === 0 ? '  - ' : '    '}${k}: ${renderScalar(value)}`));
    return [`${key}:`, ...items].map((line) => `${line}${eol}`).join('\n');
  }
  const value = Array.isArray(v) ? `[${v.map((item) => JSON.stringify(String(item))).join(', ')}]` : renderScalar(v);
  return `${key}: ${value}${eol}`;
}

// Sets top-level keys. Lines of other keys and the body are kept byte for byte.
export function setFrontmatter(text, updates) {
  if (text.startsWith('\uFEFF')) return `\uFEFF${setFrontmatter(text.slice(1), updates)}`;
  const parsed = parseFrontmatter(text);
  if (parsed.error) throw new Error(parsed.error);
  const lines = text.split('\n');
  // Written lines follow the file: CRLF frontmatter, or a CRLF body when there is no frontmatter yet.
  const crlf = parsed.hasFrontmatter ? lines[0].endsWith('\r') : text.includes('\r\n');
  const eol = crlf ? '\r' : '';
  // A null value removes the key.
  const rendered = Object.entries(updates).map(([key, v]) => [key, v === null ? null : renderEntry(key, v, eol)]);
  if (!parsed.hasFrontmatter) return `---${eol}\n${rendered.filter(([, line]) => line !== null).map(([, line]) => line).join('\n')}\n---${eol}\n${eol}\n${text}`;
  const end = closingLine(lines);
  const block = lines.slice(1, end);
  for (const [key, line] of rendered) {
    const start = block.findIndex((l) => clean(l).startsWith(`${key}:`) && KEY_VALUE.test(clean(l)) && clean(l).match(KEY_VALUE)[1] === key);
    if (start === -1) {
      if (line !== null) block.push(line);
      continue;
    }
    block.splice(start, keyEnd(block, start) - start, ...(line === null ? [] : [line]));
  }
  return [lines[0], ...block, ...lines.slice(end)].join('\n');
}

// The line after a key's block: its indented lines and list items, and blank lines followed by more of them.
function keyEnd(lines, start, limit = lines.length) {
  const more = (line) => /^(\s|-(\s|$))/.test(line) && clean(line).trim() !== '';
  let stop = start + 1;
  while (stop < limit) {
    if (more(lines[stop])) {
      stop += 1;
      continue;
    }
    let next = stop;
    while (next < limit && clean(lines[next]).trim() === '') next += 1;
    if (next === stop || next === limit || !more(lines[next])) break;
    stop = next;
  }
  return stop;
}

// Sets the checked date of one source and leaves every other line of the list as it is, comments included.
// A source written as a bare URL becomes a map with its url and checked date. An inline list is rewritten.
export function setSourceChecked(text, url, date) {
  if (text.startsWith('\uFEFF')) return `\uFEFF${setSourceChecked(text.slice(1), url, date)}`;
  const parsed = parseFrontmatter(text);
  if (parsed.error) throw new Error(parsed.error);
  const lines = text.split('\n');
  const eol = lines[0].endsWith('\r') ? '\r' : '';
  const end = closingLine(lines);
  const start = lines.findIndex((line, index) => index > 0 && index < end && /^sources:/.test(clean(line)));
  if (start === -1 || !/^sources:\s*(#.*)?$/.test(clean(lines[start]))) {
    const list = (Array.isArray(parsed.data.sources) ? parsed.data.sources : []).map((s) => (typeof s === 'string' ? { url: s } : s));
    if (!list.some((s) => s.url === url)) throw new Error(`The sources list does not cite ${url}.`);
    const written = setFrontmatter(text, { sources: list.map((s) => (s.url === url ? { ...s, checked: date } : s)) });
    // A comment after an inline list moves to the sources line.
    const comment = start === -1 ? null : clean(lines[start]).match(/\]\s*(#.*)$/)?.[1];
    return comment ? written.replace(/^sources:(\r?)$/m, `sources: ${comment}$1`) : written;
  }
  const stop = keyEnd(lines, start, end);
  const items = [];
  for (let i = start + 1; i < stop; i += 1) {
    const match = clean(lines[i]).match(/^(\s*)-(\s+)(.*)$/);
    if (match && (items.length === 0 || match[1].length <= items[0].indent)) {
      items.push({ line: i, indent: match[1].length, fields: match[1].length + 1 + match[2].length, rest: match[3] });
    }
  }
  const isMap = (rest) => KEY_VALUE.test(rest) && !/^["']/.test(rest);
  for (const [index, item] of items.entries()) {
    const own = [];
    for (let i = item.line + 1; i < (items[index + 1]?.line ?? stop); i += 1) own.push(i);
    // Fields of the item sit exactly at the column of its first key; deeper lines belong to nested maps.
    const field = (name) => own.find((i) => new RegExp(`^ {${item.fields}}${name}:`).test(clean(lines[i])));
    const first = item.rest.match(KEY_VALUE);
    const itemUrl = !isMap(item.rest) ? scalar(item.rest) : first[1] === 'url' ? scalar(first[2]) : field('url') !== undefined ? scalar(clean(lines[field('url')]).trim().slice(4)) : null;
    if (itemUrl !== url) continue;
    const pad = ' '.repeat(item.fields);
    if (!isMap(item.rest)) {
      const comment = (/^["']/.test(item.rest) ? item.rest.match(/^(["'])(?:(?!\1).)*\1(\s+#.*)$/)?.[2] : item.rest.match(/\s+#.*$/)?.[0]) ?? '';
      const dash = `${' '.repeat(item.indent)}-${' '.repeat(item.fields - item.indent - 1)}`;
      lines.splice(item.line, 1, `${dash}url: ${renderScalar(url)}${comment}${eol}`, `${pad}checked: ${date}${eol}`);
      return lines.join('\n');
    }
    if (first[1] === 'checked') {
      lines[item.line] = `${clean(lines[item.line]).slice(0, item.fields)}checked: ${date}${eol}`;
      return lines.join('\n');
    }
    const checkedLine = field('checked');
    if (checkedLine !== undefined) {
      lines[checkedLine] = `${pad}checked: ${date}${eol}`;
      return lines.join('\n');
    }
    const body = [item.line, ...own].filter((i) => clean(lines[i]).trim() && !clean(lines[i]).trim().startsWith('#'));
    lines.splice(body[body.length - 1] + 1, 0, `${pad}checked: ${date}${eol}`);
    return lines.join('\n');
  }
  throw new Error(`The sources list does not cite ${url}.`);
}
