import { join } from 'node:path';
import { readText } from './text.mjs';

const NPM = /^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([\w:.-]+)/;
const MAKE = /^(?:make|just)\s+([\w.-]+)/;
const TOOL = /^(?:npx|pnpx|bunx|go|pytest|python3?|uv|poetry|tox|cargo|node|deno|vitest|jest|swift|xcodebuild|dotnet|mvn|\.\/mvnw|gradle|\.\/gradlew|rspec|bundle|rails|bin\/rails|rake|mix|php|composer|vendor\/bin\/(?:phpunit|pest)|flutter|dart|turbo|nx)\b/;
const BUILTIN = new Set(['install', 'i', 'ci', 'add', 'remove', 'rm', 'exec', 'dlx', 'x', 'init', 'create', 'publish', 'update', 'upgrade', 'up', 'link', 'outdated', 'audit', 'why', 'run', 'login', 'version', 'help', 'dedupe', 'prune']);
const SINGLE_TEST = /\s-t\s|--testNamePattern|\s-run\s|\s-k\s|::|--grep\s|--tests\s|-Dtest=|--filter[\s=]|-only-testing:|\S+\.(?:test|spec)\.[cm]?[jt]sx?\b|\S+_test\.go\b|\S*test_\S+\.py\b|\S+_spec\.rb\b|\S+_test\.(?:rb|exs|dart)\b|\bcargo test\s+[\w:]+/;

export function realCommands(root, files) {
  const scripts = new Set();
  const targets = new Set();
  const ci = [];
  for (const file of files) {
    if (/(^|\/)node_modules\//.test(file)) continue;
    if (/(^|\/)package\.json$/.test(file)) {
      try {
        const pkg = JSON.parse(readText(join(root, file)) ?? '{}');
        for (const name of Object.keys(pkg.scripts ?? {})) scripts.add(name);
      } catch {
        // A broken package.json is reported by its own tools, not here.
      }
    } else if (/(^|\/)(?:GNUmakefile|[Mm]akefile|justfile)$/.test(file)) {
      for (const match of (readText(join(root, file)) ?? '').matchAll(/^([\w.-]+)\s*:(?!=)/gm)) targets.add(match[1]);
    } else if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(file)) {
      for (const match of (readText(join(root, file)) ?? '').matchAll(/^\s*(?:-\s*)?run:\s*([^|>\s].*)$/gm)) ci.push(match[1].trim());
    }
  }
  return { scripts: [...scripts].sort(), targets: [...targets].sort(), ci };
}

export function citedCommands(file, spans) {
  const cited = [];
  for (const span of spans) {
    const npm = span.text.match(NPM);
    const make = span.text.match(MAKE);
    if (npm) cited.push({ file, line: span.line, text: span.text, kind: 'script', name: npm[1] });
    else if (make) cited.push({ file, line: span.line, text: span.text, kind: 'target', name: make[1] });
    else if (TOOL.test(span.text)) cited.push({ file, line: span.line, text: span.text, kind: 'tool', name: span.text.split(/\s+/)[0] });
  }
  return cited;
}

export function commandFindings(cited, real) {
  const findings = [];
  const scripts = new Set(real.scripts);
  const targets = new Set(real.targets);
  for (const command of cited) {
    const missingScript = command.kind === 'script' && !BUILTIN.has(command.name) && !scripts.has(command.name);
    const missingTarget = command.kind === 'target' && !targets.has(command.name);
    if (missingScript || missingTarget) {
      const where = missingScript ? `package.json has a "${command.name}" script` : `Makefile or justfile has a "${command.name}" target`;
      findings.push({
        id: 'missing-command',
        severity: 'high',
        name: command.name,
        evidence: [`${command.file}:${command.line}`],
        message: `"${command.text}" is in ${command.file}, but no ${where}.`,
      });
    }
  }
  if (cited.length === 0) {
    findings.push({ id: 'no-commands', severity: 'medium', message: 'The instructions do not list any command to build, test or lint.' });
  } else if (!cited.some((command) => SINGLE_TEST.test(` ${command.text} `))) {
    findings.push({ id: 'no-single-test-command', severity: 'medium', message: 'The instructions do not say how to run a single test.' });
  }
  return findings;
}
