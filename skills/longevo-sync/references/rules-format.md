# Rules format

Business rules live in `docs/domain/<area>.md`. Each rule is short, points to its code and test, and has WHEN/THEN scenarios that `longevo-testing` uses as equivalence classes.

```markdown
---
covers: ["src/payments/**"]
verified: 2026-10-11
sources:
  - url: https://www.notion.so/billing-policy
    title: Billing policy
    checked: 2026-10-11
---

# Payments rules

### R-PAY-003 · A duplicate event never charges twice
Source: Billing policy (Notion)
Code: src/payments/webhook.ts:41-77
Test: "ignores a webhook with an event_id already processed"
Status: implemented and tested

- WHEN a webhook arrives with an event_id already processed
- THEN it answers 200 and does not create another charge
```

## Fields

| Field | What it holds |
| --- | --- |
| Heading | `### R-<AREA>-<NNN> · <the rule in plain words>`. Ids never change and are never reused; a new rule takes the next free number in its area |
| `Source` | Where the rule comes from: a source in the frontmatter, a decision, a person, or the brief's path (`docs/work/<date>-<slug>/brief.md`) for a rule taken from a finished brief. Without one, the status is `no source` |
| `Code` | `path:line` or `path:start-end`, comma separated (`path#L3-L5` also works) |
| `Test` | The test name, exactly as it appears in the test file. If the line has more text, put the name in quotes or backticks |
| `Status` | `implemented and tested`, `implemented without test`, `missing`, `contradicts` or `no source` |

## Rules from a source

Take only rules that the code can confirm or break: limits, states, permissions, amounts, time windows. Do not copy the page. Write one line of rule and keep the link in `sources`.
