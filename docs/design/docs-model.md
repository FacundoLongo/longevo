---
covers: ["src/lib/docs.mjs", "src/lib/coverage.mjs", "src/lib/frontmatter.mjs", "src/lib/rules.mjs", "src/lib/sources.mjs"]
verified: 2026-10-11
---

# Docs model

What Longevo keeps in a repo, how those docs stay alive, and how it works in large repos.

## What goes in docs

Longevo keeps no folder of its own. Its docs live in `docs/`, and its state for each machine (the last session, the changes you declined) lives in `.git/longevo/` ([D9](../decisions/docs.md)).

Only what the code cannot say: business rules, decisions and their reasons, invariants, links to external sources and the list of golden tests. Never folder maps, code tours or dependency lists. The agent reads those from the repo, and they go out of date first.

```
AGENTS.md                     # short map (~100 lines): commands, triggers, hard rules
CLAUDE.md                     # only if needed; it starts with @AGENTS.md
docs/
├── domain/<area>.md          # business rules with WHEN/THEN scenarios
├── decisions/<area>.md       # the reasons, grouped by area; not checked for drift
├── testing.md                # test command, test type per layer, golden tests
├── sources.md                # index of external links
├── coverage.md               # generated: tests and docs by area; never edited by hand
└── work/<date>-<slug>/       # briefs; a finished one gets status: done and stays
```

| Kind | Examples | Checked for drift |
| --- | --- | --- |
| Living | `domain/`, `testing.md` and docs the repo already had | Yes. Fixed with small diffs |
| Record | `decisions/` and the briefs in `work/` | No. An old record is marked as superseded |

## Living docs

```yaml
---
covers: ["src/payments/**"]   # git pathspec globs
sources:                      # links only
  - url: https://linear.app/...
    checked: 2026-10-11
verified: 2026-10-11          # the anchor is the commit that changed this line
---
```

When files in `covers` change after the anchor commit, the doc is stale. A change that was reverted later does not count, and moving a file out of `covers` does. A new `verified` date that is not committed yet counts as a check made on that date when it is later than the committed one; a date without a time covers the whole day. `init` shows stale docs in the session update, and `sync` proposes the fix. See [D11](../decisions/docs.md). Longevo reads YAML frontmatter only; a doc with TOML frontmatter (`+++`) cannot be a living doc.

`init` proposes this frontmatter for at most five existing docs per run, starting with the areas that change most. It leaves decisions, ADRs and changelogs alone.

## Coverage record

A script generates `docs/coverage.md` ([D8](../decisions/docs.md)). Nobody edits it by hand, and `init` proposes an update when its content would change.

| Table | What it shows |
| --- | --- |
| Tests by area | Test files: end to end, integration, other, and how many mock storage |
| Docs by area | The docs that cover each area, with their `verified` date |
| Rules | Each rule with its status, code and test. Only when docs have rules |

An area is a workspace package, or a top-level folder in a repo without workspaces. The test kind comes from the path or the file name (`e2e`, `integration`, `*IT.java`). A test without a marker counts as other. The file has no timestamps and does not store whether a doc is stale, so it changes only when tests or docs change.

## Business rules

```markdown
### R-PAY-003 · A duplicate event never charges twice
Source: Notion · Billing policy (checked 2026-10-11)
Code: src/payments/webhook.ts:41-77
Test: "ignores a webhook with an event_id already processed"
Status: implemented and tested

- WHEN a webhook arrives with an event_id already processed
- THEN it answers 200 and does not create another charge
```

Status can be: implemented and tested, implemented without test, missing, contradicts or no source. The testing skill uses the WHEN/THEN lines as equivalence classes.

## The map in AGENTS.md

Each line has a trigger the agent can observe, so it loads a doc only when it needs it:

```markdown
- If you change `src/payments/**`, read `docs/domain/payments.md`.
- If you write or change tests, read `docs/testing.md`.
```

## External sources

Links to Notion, Confluence, Jira or Linear live only in the repo. Longevo never writes to those tools ([D3](../decisions/docs.md)).

1. You choose which sources belong to the repo. Longevo asks, for example: "I found the Billing policy page in Notion. Is it a source for this repo?"
2. It extracts only rules that can be checked against code. It does not copy the page.
3. It looks for the code and the test of each rule. If it finds nothing, the rule is marked as missing.
4. You confirm each rule before it goes in.

Longevo finds MCP servers in two ways: it reads the config of each agent (names only, never credentials), and it checks which tools the agent has in the session. Agents without MCP servers bring nothing new, but they still use the rules already in the repo.

A script generates `docs/sources.md` from the `sources` in each doc's frontmatter: each source, the docs that cite it and the oldest date one of them checked it. Whether a source changed at the origin is shown when `sync` runs, not stored.

## Large repos

Longevo does not document a large repo all at once. It adopts what exists and leaves a short map. Docs grow with each change: a brief, then a sync.

- It does not create an architecture doc or a system overview.
- It does not move or rename existing docs. It proposes which ones are living and which ones are records.
- It does not document areas that nobody is changing.
- In a monorepo, a package gets its own AGENTS.md only if it has its own rules.
- Claude Code loads subfolder files only when it works there, so "before you change X" rules go in the root map.
- Codex stops at 32 KiB for the whole chain of AGENTS.md files, so the root file stays small.

## Sources

- [OpenSpec](https://github.com/Fission-AI/OpenSpec): specs that grow with each change
- [Kiro: steering](https://kiro.dev/docs/steering/): docs loaded by file pattern
- [OpenAI: harness engineering](https://openai.com/index/harness-engineering/): AGENTS.md as a table of contents
- [Basis: a monorepo for agents](https://www.getbasis.ai/blogs/how-we-made-our-monorepo-ergonomic-for-agents)
- [Claude Code: memory](https://code.claude.com/docs/en/memory.md) · [Codex: AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
