# Decisions

The choices that shape Longevo, grouped by area. Read the index first. Open an area file only when you need the reasons.

| ID | Decision | Area | Status |
| --- | --- | --- | --- |
| D1 | Use the Agent Skills format | [packaging](packaging.md) | Accepted |
| D2 | Prefix every skill with `longevo-` | [packaging](packaging.md) | Accepted |
| D3 | Keep links to external sources only in the repo | [docs](docs.md) | Accepted |
| D4 | Anchor drift checks to the commit that changed `verified` | [docs](docs.md) | Superseded by D11 |
| D5 | Base the testing skill on Primo's skill | [testing](testing.md) | Accepted |
| D6 | Keep a generated coverage record in the repo | [docs](docs.md) | Superseded by D8 |
| D7 | Pick changes from a numbered list; a script writes the structured ones | [commands](commands.md) | Accepted |
| D8 | Store dates, not stale status, in the coverage record | [docs](docs.md) | Accepted |
| D9 | Keep Longevo's docs in `docs/` and its state in `.git` | [docs](docs.md) | Accepted |
| D10 | Give each skill its own copy of the shared scripts | [packaging](packaging.md) | Accepted |
| D11 | Anchor drift on the frontmatter `verified` value, with a time for a second check in one day | [docs](docs.md) | Accepted |
| D12 | Count big commits in drift checks | [docs](docs.md) | Accepted |
| D13 | Keep the plugin namespace and document both names | [packaging](packaging.md) | Accepted |
| D14 | Run the deterministic checks with our own engine | [commands](commands.md) | Accepted |

## When to write a decision

Write one when you choose between real options, the choice changes how Longevo works or is built, and someone could ask "why?" later. Small choices go in the pull request description.

## Rules

- **Add it to the area file it belongs to.** Create a new area file only when no area fits, and add it to this index.
- **Use the next free ID.** IDs never change and are never reused.
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
