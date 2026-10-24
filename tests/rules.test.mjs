import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRules, parseRules, ruleFindings } from '../src/lib/rules.mjs';
import { scope } from '../src/lib/repo.mjs';
import { isTestFile } from '../src/lib/tests.mjs';
import { gitIn, makeRepo, writeFiles } from './helpers/fixture.mjs';

const RULE = [
  '# Payments rules',
  '',
  '### R-PAY-003 · A duplicate event never charges twice',
  'Source: Notion · Billing policy (checked 2026-10-11)',
  'Code: src/pay/webhook.ts:2-3, src/pay/store.ts:1',
  'Test: "ignores a repeated event"',
  'Status: implemented and tested',
  '',
  '- WHEN a webhook arrives with an event_id already processed',
  '- THEN it answers 200 and does not create another charge',
  '',
].join('\n');
const listed = (root) => gitIn(root, 'ls-files').split('\n').filter(Boolean);
const ids = (findings) => findings.map((f) => `${f.id}:${f.evidence[0]}`);

test('parses a rule with its fields and scenarios', () => {
  const [rule] = parseRules('docs/domain/pay.md', RULE);
  assert.deepEqual(rule, {
    id: 'R-PAY-003',
    title: 'A duplicate event never charges twice',
    doc: 'docs/domain/pay.md',
    line: 3,
    source: 'Notion · Billing policy (checked 2026-10-11)',
    code: [{ path: 'src/pay/webhook.ts', start: 2, end: 3 }, { path: 'src/pay/store.ts', start: 1, end: 1 }],
    test: 'ignores a repeated event',
    status: 'implemented and tested',
    scenarios: 1,
  });
});

test('a rule whose code and test exist has no findings', () => {
  const root = makeRepo({
    'docs/domain/pay.md': RULE,
    'src/pay/webhook.ts': 'a\nb\nc\n',
    'src/pay/store.ts': 'x\n',
    'src/pay/webhook.test.ts': "test('ignores a repeated event', () => {})\n",
  });
  const files = listed(root);
  assert.deepEqual(ruleFindings(scope(root), findRules(scope(root), files), ['src/pay/webhook.test.ts']), []);
});

test('reports code that is gone, lines past the end of the file and a missing test', () => {
  const root = makeRepo({ 'docs/domain/pay.md': RULE, 'src/pay/webhook.ts': 'a\n' });
  const files = listed(root);
  const found = ids(ruleFindings(scope(root), findRules(scope(root), files), []));
  assert.deepEqual(found.sort(), ['rule-code-missing:docs/domain/pay.md:3', 'rule-code-moved:docs/domain/pay.md:3', 'rule-test-missing:docs/domain/pay.md:3']);
});

test('reports a rule without code or test, an unknown status and duplicate ids', () => {
  const text = '### R-A-001: Bare rule\nStatus: done\n\n### R-A-001 - Same id\nCode: a.ts:1\nSource: x\nStatus: missing\n';
  const root = makeRepo({ 'docs/a.md': text, 'a.ts': '1\n' });
  const files = listed(root);
  const found = ids(ruleFindings(scope(root), findRules(scope(root), files), []));
  assert.ok(found.includes('rule-no-source:docs/a.md:1'), found.join());
  assert.ok(found.includes('rule-status-unknown:docs/a.md:1'), found.join());
  assert.ok(found.includes('rule-duplicate-id:docs/a.md:4'), found.join());
});

test('skips briefs in docs/work', () => {
  const root = makeRepo({ 'docs/work/2026-10-01-x/brief.md': RULE });
  assert.deepEqual(findRules(scope(root), listed(root)), []);
});

test('a rule inside a code block is an example, not a rule', () => {
  assert.deepEqual(parseRules('docs/model.md', `Example:\n\n\`\`\`markdown\n${RULE}\`\`\`\n`), []);
});

test('reads headings without a title or with an en dash, GitHub line anchors and test names inside text', () => {
  const text = [
    '### R-PAY-001',
    'Code: ./src/a.ts, src/b.ts#L3-L5, `src/c.ts#L7`',
    'Test: `refunds after 48 hours` in tests/refunds.test.ts',
    'Status: implemented and tested',
    '',
    '### R-PAY-002 – Partial refunds',
    'Test: "keeps the fee" (unit)',
    '',
  ].join('\n');
  const [first, second] = parseRules('docs/domain/pay.md', text);
  assert.equal(first.title, '');
  assert.deepEqual(first.code, [{ path: 'src/a.ts', start: null, end: null }, { path: 'src/b.ts', start: 3, end: 5 }, { path: 'src/c.ts', start: 7, end: 7 }]);
  assert.equal(first.test, 'refunds after 48 hours');
  assert.equal(second.title, 'Partial refunds');
  assert.equal(second.test, 'keeps the fee');
});

test('a deeper subheading keeps the scenarios in the rule but not its fields; a heading at its level ends it', () => {
  const text = [
    '### R-PAY-003 · Refunds expire',
    'Status: missing',
    '#### Scenarios',
    '- WHEN a refund is 49 hours old',
    '- THEN it is rejected',
    '#### Appendix: test plan',
    'Status: draft',
    'Source: none',
    '##### R-PAY-004 · Nested',
    'Code: b.ts:2',
    '### Notes',
    'Status: implemented and tested',
    '',
  ].join('\n');
  const [rule] = parseRules('docs/domain/pay.md', text);
  assert.equal(rule.scenarios, 1);
  assert.equal(rule.status, 'missing');
  assert.equal(rule.source, null);
  assert.deepEqual(rule.code, []);
});

test('apostrophes in an unquoted test name are part of the name; a quoted name wins over a backticked path', () => {
  const text = [
    '### R-PAY-005 · Late refunds',
    "Test: doesn't refund when it's late",
    '### R-PAY-006 · Fees',
    'Test: `tests/fees.test.ts` "keeps the fee"',
    '',
  ].join('\n');
  const [late, fees] = parseRules('docs/domain/pay.md', text);
  assert.equal(late.test, "doesn't refund when it's late");
  assert.equal(fees.test, 'keeps the fee');
});

test('a rule test written but not added to git yet is found', () => {
  const root = makeRepo({ 'docs/r.md': '### R-A-001 · x\nSource: s\nCode: a.ts:1\nTest: "handles the new case"\nStatus: implemented and tested\n', 'a.ts': '1\n' });
  writeFiles(root, { 'a.test.ts': "test('handles the new case', () => {})\n" });
  const files = [...listed(root), 'a.test.ts'];
  assert.deepEqual(ruleFindings(scope(root), findRules(scope(root), files), ['a.test.ts']), []);
});

test('rules are checked against the disk, not only against the scanned file list', () => {
  const root = makeRepo({ 'docs/r.md': '### R-A-001 · x\nSource: s\nCode: src/a.ts:1\nStatus: implemented without test\n', 'src/a.ts': '1\n' });
  const rules = findRules(scope(root), listed(root));
  assert.deepEqual(ruleFindings(scope(root), rules, []), []);
});

test('rules written by the format get no false findings', () => {
  assert.ok(isTestFile('src/refunds/__tests__/refund.js'));
  const doc = '### R-A-001 · Planned\nSource: s\nCode: src/planned.ts:1\nStatus: missing\n\n### R-A-002 · No source yet\nCode: src/a.ts:1\nStatus: no source\n';
  const root = makeRepo({ 'docs/r.md': doc, 'src/a.ts': '1\n' });
  const files = listed(root);
  assert.deepEqual(ruleFindings(scope(root), findRules(scope(root), files), []), []);
});

test('test names: a backticked or quoted name after a path, but never a path or an apostrophe', async () => {
  const { parseRules } = await import('../src/lib/rules.mjs');
  const tests = (lines) => parseRules('docs/domain/pay.md', lines.map((t, i) => `### R-PAY-${i + 1} · x\nTest: ${t}\n`).join('')).map((r) => r.test);
  assert.deepEqual(tests([
    'tests/refund.test.ts `rejects a refund after 48 hours`',
    "it('keeps the fee')",
    "doesn't refund when it's late",
    '`tests/x.test.ts` `keeps the fee`',
    "tests/x.test.ts 'keeps the fee'",
  ]), ['rejects a refund after 48 hours', 'keeps the fee', "doesn't refund when it's late", 'keeps the fee', 'keeps the fee']);
});

test('a backticked name with a dot is a name, and stray backticks never stay in it', async () => {
  const { parseRules } = await import('../src/lib/rules.mjs');
  const [first, second] = parseRules('docs/domain/pay.md', '### R-PAY-1 · x\nTest: `refunds.test` expires\n### R-PAY-2 · y\nTest: `src/pay.test.ts`\n');
  assert.equal(first.test, 'refunds.test');
  assert.equal(second.test, 'src/pay.test.ts');
});
