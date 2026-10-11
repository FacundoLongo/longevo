#!/usr/bin/env bash
# A shop with refund rules in docs, code, a golden test and an issue that asks for partial refunds.
set -euo pipefail
mkdir -p docs/domain src/refunds
cat > docs/domain/refunds.md <<'MD'
---
covers: ["src/refunds/**"]
verified: 2026-10-01
---

# Refunds rules

### R-REF-001 · A refund expires after 48 hours
Source: Support handbook
Code: src/refunds/policy.ts:1-5
Test: "rejects a refund after 48 hours"
Status: implemented and tested

- WHEN a customer asks for a refund 49 hours after the payment
- THEN the refund is rejected

### R-REF-002 · A refund never exceeds the amount paid
Source: Finance policy
Code: src/refunds/refund.ts:3-8
Status: implemented without test

- WHEN a refund asks for more than the amount paid
- THEN it is rejected and nothing is refunded
MD
cat > docs/testing.md <<'MD'
# Testing

## Commands

- All tests: `npx vitest run`
- One test: `npx vitest run src/refunds/policy.test.ts`

## Golden tests

- `src/refunds/policy.test.ts`: one behavior per test, real dates, no mocks.
MD
cat > src/refunds/policy.ts <<'TS'
export const REFUND_HOURS = 48;

export function canRefund(paidAt: Date, now: Date): boolean {
  return now.getTime() - paidAt.getTime() <= REFUND_HOURS * 60 * 60 * 1000;
}
TS
cat > src/refunds/refund.ts <<'TS'
export type Payment = { id: string; amount: number; paidAt: Date };

export function refund(payment: Payment, amount: number): number {
  if (amount !== payment.amount) {
    throw new Error('Only full refunds are supported');
  }
  return amount;
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
cat > issue.md <<'MD'
# Partial refunds (#42)

Support wants to refund part of an order instead of the whole amount, for example when one item arrived broken.
The 48-hour window still applies.
MD
git init -q && git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm "Add refunds"
