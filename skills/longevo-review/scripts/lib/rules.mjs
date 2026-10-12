// Business rules in docs: a heading "### R-<AREA>-<NNN> · title" with Source, Code, Test and Status lines,
// and WHEN/THEN scenarios. The script checks what git and files can answer; the model judges the rest.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './repo.mjs';
import { isTestFile } from './tests.mjs';
import { readText } from './text.mjs';

export const RULE_STATUSES = ['implemented and tested', 'implemented without test', 'missing', 'contradicts', 'no source'];

const HEADING = /^(#{2,4})\s+(R-[A-Z0-9]+-\d+)(?:\s*(?:·|—|–|-|:)\s*(.*?))?\s*$/;
const FIELD = /^(Source|Code|Test|Status):\s*(.*)$/i;
const RULE_DOC = (file) => /\.mdx?$/.test(file) && /(^|\/)docs\//.test(file) && !/(^|\/)docs\/work\//.test(file);

// `path:line`, `path:start-end`, or GitHub anchors like `path#L3-L5`, with or without a leading ./
function parseCode(value) {
  return value.split(',').map((ref) => ref.trim().replace(/^`|`$/g, '').replace(/^\.\//, '')).filter(Boolean).map((ref) => {
    const [, path, start, end] = ref.match(/^(.+?)(?:(?::|#L)(\d+)(?:-L?(\d+))?)?$/);
    return { path, start: start ? Number(start) : null, end: end ? Number(end) : start ? Number(start) : null };
  });
}

// The test name: the first quoted or backticked part, so a line like `name` in tests/x.test.ts still works.
function parseTest(value) {
  const quoted = value.match(/`([^`]+)`|"([^"]+)"|'([^']+)'/);
  return quoted ? (quoted[1] ?? quoted[2] ?? quoted[3]).trim() : value.trim();
}

export function parseRules(doc, text) {
  const rules = [];
  let rule = null;
  let inFence = false;
  text.split('\n').forEach((line, index) => {
    // A rule written inside a code block is an example of the format, not a rule.
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const heading = line.match(HEADING);
    const level = line.match(/^(#{1,6})\s/)?.[1].length;
    if (heading) {
      rule = { id: heading[2], title: heading[3] ?? '', doc, line: index + 1, source: null, code: [], test: null, status: null, scenarios: 0 };
      Object.defineProperty(rule, 'level', { value: heading[1].length, enumerable: false });
      rules.push(rule);
    } else if (level && (!rule || level <= rule.level)) {
      rule = null;
    } else if (level) {
      // A deeper subheading, like "#### Scenarios", is part of the rule.
    } else if (rule) {
      const field = line.match(FIELD);
      if (field) {
        const key = field[1].toLowerCase();
        const value = field[2].trim();
        if (key === 'code') rule.code = parseCode(value);
        else if (key === 'test') rule.test = parseTest(value);
        else rule[key] = value;
      } else if (/^\s*-\s*WHEN\b/i.test(line)) {
        rule.scenarios += 1;
      }
    }
  });
  return rules;
}

export function findRules(sc, files) {
  return files.filter(RULE_DOC).sort().flatMap((doc) => parseRules(doc, readText(join(sc.root, doc)) ?? ''));
}

export function ruleFindings(sc, files, rules, testFiles, { maxTestFiles = 5000 } = {}) {
  let testTexts = null;
  // In a git repo, git grep searches every tracked file, so a large repo is never cut short. Docs do not count.
  const testFound = (name) => {
    if (sc.isGit) {
      const hits = git(sc.root, ['grep', '-F', '-l', '--untracked', '-e', name, '--', '.', ':(exclude)*.md', ':(exclude)*.mdx']) ?? '';
      return hits.split('\n').some((file) => file && isTestFile(file));
    }
    testTexts ??= testFiles.slice(0, maxTestFiles).map((file) => readText(join(sc.root, file)) ?? '');
    return testTexts.some((text) => text.includes(name));
  };
  const exists = (path) => existsSync(join(sc.root, path));
  const lineCount = (path) => (readText(join(sc.root, path)) ?? '').replace(/\n$/, '').split('\n').length;
  const findings = [];
  const seen = new Map();
  const add = (rule, id, severity, message) => findings.push({ id, severity, rule: rule.id, evidence: [`${rule.doc}:${rule.line}`], message: `${rule.id}: ${message}` });
  for (const rule of rules) {
    if (seen.has(rule.id)) add(rule, 'rule-duplicate-id', 'medium', `the same id is also used at ${seen.get(rule.id)}.`);
    else seen.set(rule.id, `${rule.doc}:${rule.line}`);
    const status = (rule.status ?? '').toLowerCase();
    // A rule marked missing points at code that does not exist yet; only claimed code is checked.
    if (status !== 'missing') {
      const gone = rule.code.filter((ref) => !exists(ref.path));
      const moved = rule.code.filter((ref) => exists(ref.path) && ref.end && lineCount(ref.path) < ref.end);
      if (gone.length) add(rule, 'rule-code-missing', 'high', `${gone.map((ref) => ref.path).join(', ')} does not exist.`);
      else if (rule.code.length === 0 && status.startsWith('implemented')) add(rule, 'rule-code-missing', 'high', 'it says implemented but has no Code line.');
      if (moved.length) add(rule, 'rule-code-moved', 'medium', `${moved.map((ref) => `${ref.path}:${ref.start}-${ref.end}`).join(', ')} is past the end of the file.`);
    }
    if (rule.test && !testFound(rule.test)) add(rule, 'rule-test-missing', 'medium', `no test file contains "${rule.test}".`);
    else if (!rule.test && status === 'implemented and tested') add(rule, 'rule-test-missing', 'medium', 'it says tested but has no Test line.');
    if (!rule.source && status !== 'no source') add(rule, 'rule-no-source', 'low', 'it has no Source line.');
    if (!RULE_STATUSES.includes(status)) add(rule, 'rule-status-unknown', 'low', rule.status ? `"${rule.status}" is not a known status.` : 'it has no Status line.');
  }
  return findings;
}
