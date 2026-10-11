#!/usr/bin/env bash
# main has the refund rule (48 hours). The branch shortens the window to 24 hours and adds a test that mocks
# the store and checks calls. The rules doc was not updated.
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
Status: implemented without test

- WHEN a customer asks for a refund 49 hours after the payment
- THEN the refund is rejected
MD
cat > docs/testing.md <<'MD'
# Testing

- Never mock the store. Use `createTestStore()` from `src/refunds/store.ts`, which keeps data in memory.
- Assert on results, not on calls.
MD
cat > src/refunds/store.ts <<'TS'
export type Refund = { paymentId: string; amount: number };

export function createTestStore() {
  const rows: Refund[] = [];
  return { save: (refund: Refund) => { rows.push(refund); }, all: () => [...rows] };
}
TS
cat > src/refunds/policy.ts <<'TS'
export const REFUND_HOURS = 48;

export function canRefund(paidAt: Date, now: Date): boolean {
  return now.getTime() - paidAt.getTime() <= REFUND_HOURS * 60 * 60 * 1000;
}
TS
git init -q -b main && git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm "Add refunds"
git checkout -q -b shorter-window
sed -i.bak 's/REFUND_HOURS = 48/REFUND_HOURS = 24/' src/refunds/policy.ts && rm src/refunds/policy.ts.bak
cat > src/refunds/policy.test.ts <<'TS'
import { expect, test, vi } from 'vitest';
import * as store from './store';
import { canRefund } from './policy';

vi.mock('./store');

test('canRefund works', () => {
  const save = vi.fn();
  vi.mocked(store.createTestStore).mockReturnValue({ save, all: vi.fn() });
  canRefund(new Date(), new Date());
  expect(store.createTestStore).toHaveBeenCalledTimes(0);
  expect(save).not.toHaveBeenCalled();
  expect(vi.mocked(store.createTestStore)).not.toHaveBeenCalledWith(1);
});
TS
git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm "Shorten the refund window"
