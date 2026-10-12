import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRules, parseRules, ruleFindings } from '../src/lib/rules.mjs';
import { scope } from '../src/lib/repo.mjs';
import { gitIn, makeRepo } from './helpers/fixture.mjs';

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
  assert.deepEqual(ruleFindings(scope(root), files, findRules(scope(root), files), ['src/pay/webhook.test.ts']), []);
});

test('reports code that is gone, lines past the end of the file and a missing test', () => {
  const root = makeRepo({ 'docs/domain/pay.md': RULE, 'src/pay/webhook.ts': 'a\n' });
  const files = listed(root);
  const found = ids(ruleFindings(scope(root), files, findRules(scope(root), files), []));
  assert.deepEqual(found.sort(), ['rule-code-missing:docs/domain/pay.md:3', 'rule-code-moved:docs/domain/pay.md:3', 'rule-test-missing:docs/domain/pay.md:3']);
});

test('reports a rule without code or test, an unknown status and duplicate ids', () => {
  const text = '### R-A-001: Bare rule\nStatus: done\n\n### R-A-001 - Same id\nCode: a.ts:1\nSource: x\nStatus: missing\n';
  const root = makeRepo({ 'docs/a.md': text, 'a.ts': '1\n' });
  const files = listed(root);
  const found = ids(ruleFindings(scope(root), files, findRules(scope(root), files), []));
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

test('a deeper subheading stays inside the rule; a heading at its level or above ends it', () => {
  const text = [
    '### R-PAY-003 · Refunds expire',
    '#### Scenarios',
    '- WHEN a refund is 49 hours old',
    '- THEN it is rejected',
    'Status: missing',
    '### Notes',
    'Status: implemented and tested',
    '',
  ].join('\n');
  const [rule] = parseRules('docs/domain/pay.md', text);
  assert.equal(rule.scenarios, 1);
  assert.equal(rule.status, 'missing');
});
