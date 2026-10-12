#!/usr/bin/env bash
# A refunds doc verified at 48 hours; a later commit only rewrites the time check, so the doc is still true.
set -euo pipefail
mkdir -p docs/domain src/refunds
cat > docs/domain/refunds.md <<'MD'
---
covers: ["src/refunds/**"]
verified: 2026-01-15
---

# Refunds rules

### R-REF-001 · A refund expires after 48 hours
Source: Support handbook
Code: src/refunds/policy.ts:1-5
Test: "rejects a refund after 48 hours"
Status: implemented and tested

- WHEN a customer asks for a refund 49 hours after the payment
- THEN the refund is rejected
MD
cat > src/refunds/policy.ts <<'TS'
export const REFUND_HOURS = 48;

export function canRefund(paidAt: Date, now: Date): boolean {
  return now.getTime() - paidAt.getTime() <= REFUND_HOURS * 60 * 60 * 1000;
}
TS
cat > src/refunds/policy.test.ts <<'TS'
import { expect, test } from 'vitest';
import { canRefund } from './policy';

test('rejects a refund after 48 hours', () => {
  const paidAt = new Date('2026-01-01T00:00:00Z');
  expect(canRefund(paidAt, new Date('2026-01-03T01:00:00Z'))).toBe(false);
});
TS
git init -q && git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm "Add refunds"
sed -i.bak 's/now.getTime() - paidAt.getTime()/now.valueOf() - paidAt.valueOf()/' src/refunds/policy.ts && rm src/refunds/policy.ts.bak
git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm "Use valueOf in the refund check"
