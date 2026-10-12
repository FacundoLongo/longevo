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
  const data = {};
  let key = null;
  let item = null;
  let itemIndent = 0;
  let map = null;
  let mapIndent = 0;
  let text = null;
  for (const raw of lines) {
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
      if (!pair) throw new Error(`Cannot read the frontmatter line "${line}".`);
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
    } else if (key !== null && !map && (line.startsWith('- ') || line === '-')) {
      const rest = line.slice(1).trim();
      const inner = rest.match(KEY_VALUE);
      if (!Array.isArray(data[key])) data[key] = [];
      if (inner && !/^["']/.test(rest)) {
        item = { [inner[1]]: scalar(inner[2]) };
        itemIndent = indent;
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
      throw new Error(`Cannot read the frontmatter line "${line}".`);
    }
  }
  if (text) data[key] = blockText(text);
  return data;
}

function closingLine(lines) {
  return lines.findIndex((line, index) => index > 0 && clean(line) === '---');
}

export function parseFrontmatter(text) {
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
  const parsed = parseFrontmatter(text);
  if (parsed.error) throw new Error(parsed.error);
  const lines = text.split('\n');
  const eol = parsed.hasFrontmatter && lines[0].endsWith('\r') ? '\r' : '';
  const rendered = Object.entries(updates).map(([key, v]) => [key, renderEntry(key, v, eol)]);
  if (!parsed.hasFrontmatter) return `---\n${rendered.map(([, line]) => line).join('\n')}\n---\n\n${text}`;
  const end = closingLine(lines);
  const block = lines.slice(1, end);
  for (const [key, line] of rendered) {
    const start = block.findIndex((l) => clean(l).startsWith(`${key}:`) && KEY_VALUE.test(clean(l)) && clean(l).match(KEY_VALUE)[1] === key);
    if (start === -1) {
      block.push(line);
      continue;
    }
    let stop = start + 1;
    while (stop < block.length && clean(block[stop]).trim() !== '' && /^(\s|-(\s|$))/.test(block[stop])) stop += 1;
    block.splice(start, stop - start, line);
  }
  return [lines[0], ...block, ...lines.slice(end)].join('\n');
}

// Sets the checked date of one source and leaves every other line of the list as it is, comments included.
// A source written as a bare URL becomes a map with its url and checked date.
export function setSourceChecked(text, url, date) {
  const parsed = parseFrontmatter(text);
  if (parsed.error) throw new Error(parsed.error);
  const lines = text.split('\n');
  const eol = lines[0].endsWith('\r') ? '\r' : '';
  const end = closingLine(lines);
  const start = lines.findIndex((line, index) => index > 0 && index < end && /^sources:\s*$/.test(clean(line)));
  if (start === -1) throw new Error(`The frontmatter has no sources list.`);
  let stop = start + 1;
  while (stop < end && (clean(lines[stop]).trim() === '' || /^(\s|-(\s|$))/.test(lines[stop]))) stop += 1;
  const items = [];
  for (let i = start + 1; i < stop; i += 1) {
    const match = clean(lines[i]).match(/^(\s*)-\s+(.*)$/);
    if (match && (items.length === 0 || match[1].length <= items[0].indent)) items.push({ line: i, indent: match[1].length, rest: match[2] });
  }
  const urlOf = (rest) => {
    const pair = rest.match(KEY_VALUE);
    if (pair && !/^["']/.test(rest)) return pair[1] === 'url' ? scalar(pair[2]) : null;
    return scalar(rest);
  };
  for (const [index, item] of items.entries()) {
    const last = (items[index + 1]?.line ?? stop) - 1;
    const own = [];
    for (let i = item.line + 1; i <= last; i += 1) own.push(i);
    const firstUrl = urlOf(item.rest);
    const fieldUrl = own.map((i) => clean(lines[i]).trim().match(/^url:\s*(.*)$/)).find(Boolean);
    if ((firstUrl ?? (fieldUrl ? scalar(fieldUrl[1]) : null)) !== url) continue;
    const pad = ' '.repeat(item.indent + 2);
    const isMap = KEY_VALUE.test(item.rest) && !/^["']/.test(item.rest);
    if (!isMap) {
      lines.splice(item.line, 1, `${' '.repeat(item.indent)}- url: ${renderScalar(url)}${eol}`, `${pad}checked: ${date}${eol}`);
      return lines.join('\n');
    }
    if (/^checked:/.test(item.rest)) {
      lines[item.line] = `${' '.repeat(item.indent)}- checked: ${date}${eol}`;
      return lines.join('\n');
    }
    const field = own.find((i) => /^\s+checked:/.test(clean(lines[i])));
    if (field !== undefined) {
      lines[field] = `${clean(lines[field]).match(/^\s+/)[0]}checked: ${date}${eol}`;
      return lines.join('\n');
    }
    const body = [item.line, ...own].filter((i) => clean(lines[i]).trim() && !clean(lines[i]).trim().startsWith('#'));
    lines.splice(body[body.length - 1] + 1, 0, `${pad}checked: ${date}${eol}`);
    return lines.join('\n');
  }
  throw new Error(`The sources list does not cite ${url}.`);
}
