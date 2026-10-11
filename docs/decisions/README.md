# Decisions

The choices that shape Longevo, grouped by area. Read the index first. Open an area file only when you need the reasons.

| ID | Decision | Area | Status |
| --- | --- | --- | --- |
| D1 | Use the Agent Skills format | [packaging](packaging.md) | Accepted |
| D2 | Prefix every skill with `longevo-` | [packaging](packaging.md) | Accepted |
| D3 | Keep links to external sources only in the repo | [docs](docs.md) | Accepted |
| D4 | Anchor drift checks to the commit that changed `verified` | [docs](docs.md) | Accepted |
| D5 | Base the testing skill on Primo's skill | [testing](testing.md) | Accepted |

## When to write a decision

Write one when you choose between real options, the choice changes how Longevo works or is built, and someone could ask "why?" later. Small choices go in the pull request description.

## Rules

- **Add it to the area file it belongs to.** Create a new area file only when no area fits, and add it to this index.
- **Use the next free ID** (D6, D7…). IDs never change and are never reused.
- **Keep each decision under 15 lines.**
- **Status:** Proposed, Accepted, Rejected, or Superseded by Dn.
- **Do not edit an accepted decision.** Add a new one and change only the status line of the old one.
- **Update the index** in the same pull request.

## Template

```markdown
## Dn. Title in plain words

Status: Proposed · YYYY-MM-DD

**Context.** The problem, in 2 or 3 sentences.

**Options.** Option A · Option B · Option C

**Decision.** What we chose and the main reason.

**Consequences.**
- What gets better
- What gets worse, or what we must do later
```
