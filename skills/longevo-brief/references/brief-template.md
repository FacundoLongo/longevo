# Brief template

The engine creates the file with this frontmatter and these headings (`apply brief`). Fill each section; leave a section with "None" when there is nothing true to say. Keep the brief under 80 lines.

```markdown
---
status: open
task: "https://github.com/acme/shop/issues/42"
covers: ["src/refunds/**"]
---

# Partial refunds

## Goal

Support can refund part of an order, so customers do not wait for a full refund and a new charge.
From: #42 (Linear, GitHub or the user's words).

## Rules that apply

- R-REF-001 · A refund expires after 48 hours: implemented and tested (`src/refunds/policy.ts:1-5`, test "rejects a refund after 48 hours").
- R-REF-002 · A refund never exceeds the amount paid: implemented without test (`src/refunds/refund.ts:22`).
- New: a partial refund keeps the order open. No source yet; confirmed by the user.

## Affected code and docs

- `src/refunds/refund.ts`, `src/refunds/policy.ts`, `src/api/refunds.ts`
- `docs/domain/refunds.md` (verified 2026-10-01)

## Golden tests

- `src/refunds/policy.test.ts`: real database, one behavior per test.

## What must not change

- A refund never exceeds the amount paid, also over several partial refunds. Regression test: two partial refunds that add up to more than the payment are rejected.
- Refunds after 48 hours are still rejected. Regression test: a partial refund after 49 hours is rejected.

## Open questions

- Can a partial refund be undone? (Asked; the user will check with support.)

## Acceptance criteria

- WHEN support refunds 30 of a 100 payment within 48 hours
- THEN the customer gets 30 back and the order stays open with 70 paid
- WHEN a partial refund would take the total refunded above the payment
- THEN it is rejected and nothing is refunded

## Tests

(Filled by `longevo-testing` when the tests are planned: tests to write and tests to skip, with reasons.)
```

## Notes

- **Statuses:** `implemented and tested`, `implemented without test`, `missing`, `contradicts` or `no source`, as in the rules docs.
- **What must not change:** take it from rules and tests near the code, not from imagination. Each item asks for a regression test.
- **Acceptance criteria:** behavior someone can check, not tasks.
