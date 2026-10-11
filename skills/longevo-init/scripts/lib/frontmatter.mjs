// Reads and writes the YAML frontmatter Longevo uses: scalars, lists and lists of maps. Other lines stay as they are.
const KEY_VALUE = /^([\w.-]+):(?:\s+(.*))?$/;
const NOT_CLOSED = 'The frontmatter block is not closed with ---.';
const clean = (line) => line.replace(/\r$/, '');

function scalar(value = '') {
  const v = value.trim();
  if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
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

function parseBlock(lines) {
  const data = {};
  let key = null;
  let item = null;
  let itemIndent = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const pair = line.match(KEY_VALUE);
    if (indent === 0 && !line.startsWith('- ')) {
      if (!pair) throw new Error(`Cannot read the frontmatter line "${line}".`);
      [, key] = pair;
      item = null;
      data[key] = value(pair[2]);
    } else if (key !== null && (line.startsWith('- ') || line === '-')) {
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
    } else {
      throw new Error(`Cannot read the frontmatter line "${line}".`);
    }
  }
  return data;
}

function closingLine(lines) {
  return lines.findIndex((line, index) => index > 0 && clean(line) === '---');
}

export function parseFrontmatter(text) {
  const lines = text.split('\n');
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

function render(v) {
  if (Array.isArray(v)) return `[${v.map((item) => JSON.stringify(String(item))).join(', ')}]`;
  const s = String(v);
  return /^[\s[{"'#&*!|>%@`]|: |\s#|:$/.test(s) ? JSON.stringify(s) : s;
}

// Sets top-level keys. Lines of other keys and the body are kept byte for byte.
export function setFrontmatter(text, updates) {
  const parsed = parseFrontmatter(text);
  if (parsed.error) throw new Error(parsed.error);
  const lines = text.split('\n');
  const eol = parsed.hasFrontmatter && lines[0].endsWith('\r') ? '\r' : '';
  const rendered = Object.entries(updates).map(([key, v]) => [key, `${key}: ${render(v)}${eol}`]);
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
