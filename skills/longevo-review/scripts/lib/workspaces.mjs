// Finds workspace packages for npm, yarn, pnpm, lerna, nx, turbo, Go, Cargo, uv, Gradle, Maven, .NET and Mix.
import { join } from 'node:path';
import { matches } from './glob.mjs';
import { dirOf } from './paths.mjs';
import { readText } from './text.mjs';

const MANIFEST = /(^|\/)(package\.json|go\.mod|Cargo\.toml|pyproject\.toml|build\.gradle(\.kts)?|pom\.xml|[^/]+\.(?:cs|fs|vb)proj|mix\.exs|project\.json)$/;
const normalize = (path) => path.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
const quoted = (text) => [...text.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);

function tomlArray(text, section, key) {
  const start = text.search(new RegExp(`^\\[${section.replace(/\./g, '\\.')}\\]\\s*$`, 'm'));
  if (start === -1) return [];
  const rest = text.slice(start).split('\n').slice(1).join('\n');
  const body = rest.split(/^\[/m)[0];
  const match = body.match(new RegExp(`^${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm'));
  return match ? quoted(match[1]) : [];
}

function detect(root, files) {
  const has = (file) => files.includes(file);
  const read = (file) => readText(join(root, file)) ?? '';
  const found = [];
  if (has('package.json')) {
    try {
      const pkg = JSON.parse(read('package.json'));
      const list = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages;
      if (list?.length) found.push({ tool: 'npm', patterns: list });
    } catch {
      // A broken package.json is reported by its own tools.
    }
  }
  if (has('pnpm-workspace.yaml')) {
    const block = read('pnpm-workspace.yaml').split(/^packages:\s*$/m)[1] ?? '';
    const patterns = [];
    for (const line of block.split('\n').slice(1)) {
      if (/^\S/.test(line)) break;
      const item = line.match(/^\s*-\s*["']?([^"'#]+?)["']?\s*(?:#.*)?$/);
      if (item) patterns.push(item[1]);
    }
    found.push({ tool: 'pnpm', patterns });
  }
  if (has('lerna.json')) {
    try {
      found.push({ tool: 'lerna', patterns: JSON.parse(read('lerna.json')).packages ?? ['packages/*'] });
    } catch {
      found.push({ tool: 'lerna', patterns: ['packages/*'] });
    }
  }
  if (has('nx.json')) found.push({ tool: 'nx', dirs: files.filter((file) => /(^|\/)project\.json$/.test(file)).map(dirOf).filter(Boolean) });
  if (has('turbo.json')) found.push({ tool: 'turbo', patterns: [] });
  if (has('go.work')) {
    const text = read('go.work');
    const patterns = [...text.matchAll(/^use\s+(?!\()(\S+)/gm)].map((match) => match[1]);
    for (const block of text.matchAll(/^use\s*\(([\s\S]*?)\)/gm)) patterns.push(...block[1].split('\n').map((line) => line.replace(/\/\/.*$/, '').trim()).filter(Boolean));
    found.push({ tool: 'go', patterns });
  }
  if (has('Cargo.toml') && /^\[workspace\]/m.test(read('Cargo.toml'))) found.push({ tool: 'cargo', patterns: tomlArray(read('Cargo.toml'), 'workspace', 'members') });
  if (has('pyproject.toml') && /^\[tool\.uv\.workspace\]/m.test(read('pyproject.toml'))) {
    found.push({ tool: 'uv', patterns: tomlArray(read('pyproject.toml'), 'tool.uv.workspace', 'members') });
  }
  for (const file of ['settings.gradle', 'settings.gradle.kts'].filter(has)) {
    const patterns = read(file).split('\n').filter((line) => /^\s*include\b/.test(line)).flatMap(quoted).map((name) => name.replace(/^:/, '').replace(/:/g, '/'));
    found.push({ tool: 'gradle', patterns });
  }
  if (has('pom.xml')) {
    const modules = [...read('pom.xml').matchAll(/<module>\s*([^<]+?)\s*<\/module>/g)].map((match) => match[1]);
    if (modules.length) found.push({ tool: 'maven', patterns: modules });
  }
  for (const file of files.filter((f) => /^[^/]+\.sln$/.test(f))) {
    const projects = [...read(file).matchAll(/^Project\([^)]*\)\s*=\s*"[^"]*",\s*"([^"]+\.(?:cs|fs|vb)proj)"/gm)].map((match) => dirOf(normalize(match[1])));
    found.push({ tool: 'dotnet', patterns: projects });
  }
  if (has('mix.exs')) {
    const apps = read('mix.exs').match(/apps_path:\s*"([^"]+)"/);
    if (apps) found.push({ tool: 'mix', patterns: [`${apps[1]}/*`] });
  }
  return found;
}

export function workspaces(root, files) {
  const candidates = [...new Set(files.filter((file) => MANIFEST.test(file) && !/(^|\/)node_modules\//.test(file)).map(dirOf))].filter(Boolean);
  const packages = new Set();
  const tools = new Set();
  for (const { tool, patterns = [], dirs = [] } of detect(root, files)) {
    tools.add(tool);
    dirs.forEach((dir) => packages.add(dir));
    const include = patterns.filter((p) => !p.startsWith('!')).map(normalize);
    const exclude = patterns.filter((p) => p.startsWith('!')).map((p) => normalize(p.slice(1)));
    const hit = (dir, p) => (/[*?]/.test(p) ? matches(dir, p) : dir === p);
    for (const dir of candidates) {
      if (include.some((p) => hit(dir, p)) && !exclude.some((p) => hit(dir, p))) packages.add(dir);
    }
  }
  return { tools: [...tools].sort(), packages: [...packages].sort() };
}
