---
covers: ["skills/*/SKILL.md", "src/lib/apply.mjs", "src/lib/docs.mjs", "src/lib/rules.mjs"]
verified: 2026-10-12T01:07:31
---

# How Longevo works

What happens when you run a Longevo skill, what it keeps in your repo and what it never does. For the full design, see the [overview](../design/overview.md).

## Three parts

| Part | What it does |
| --- | --- |
| Skills | Plain-text instructions your agent follows: when to run, what to ask, how to judge |
| The engine | A Node script inside each command skill (`scripts/longevo.mjs` in init, sync, brief and review). It reads git and files and prints facts as JSON. Besides its own state in `.git/longevo`, it writes only through `apply`, and only what you picked |
| You | Answer what the code cannot answer, and pick the changes |

The engine gives the same facts in every agent. The agent's model judges what they mean, for example whether a doc is still true.

## One run, step by step

1. **Scan.** The engine reads the repo, and only the MCP server and skill names in your agents' home settings, and prints a report. Secrets are never printed.
2. **Judge.** The model reads only the files the report points to.
3. **Ask.** One question at a time, with options, only when the repo cannot answer it.
4. **Propose.** A numbered list of changes, each with its diff.
5. **Apply.** The engine writes the structured changes (the block, frontmatter, dates and generated files). The model writes prose exactly as it showed it. Nothing is staged or committed.

## What lives in your repo

| File | Written by | What it is |
| --- | --- | --- |
| The block in AGENTS.md | The engine | A few lines between `<!-- longevo:start -->` and `<!-- longevo:end -->`: commands, the testing guide, the docs to read before changing some code, the coverage record and the session line. Text outside it is yours |
| `docs/testing.md` | The model, from a template | How tests work in this repo, and the golden tests to copy |
| Living docs | You or `init` (frontmatter), then `sync` | Any doc with `covers` and `verified` in its frontmatter |
| `docs/domain/<area>.md` | `sync`, from sources and finished briefs | Business rules with their code, test, status and WHEN/THEN scenarios |
| `docs/work/<date>-<slug>/brief.md` | `brief` | One brief per task |
| `docs/coverage.md`, `docs/sources.md` | The engine | Generated records. Never edit them by hand |

Longevo's own state (the last session and the changes you declined) lives in `.git/longevo`, so it is never committed.

## How a doc goes stale

A living doc says which code it explains and when someone last checked it:

```yaml
---
covers: ["src/payments/**"]
verified: 2026-10-11
---
```

The anchor is the commit that last changed `verified`. When a later commit changes a file in `covers`, the doc is stale. `sync` reads the doc and the code diff. If the doc is still true, it proposes only a new date; if not, the smallest diff that makes it true. A change that was reverted later does not count, and lockfiles and generated files are ignored. See [D11 and D12](../decisions/docs.md).

## Business rules

A rule is a heading with an id and a few fixed lines:

```markdown
### R-PAY-003 · A duplicate event never charges twice
Source: Billing policy (Notion)
Code: src/payments/webhook.ts:41-77
Test: "ignores a webhook with an event_id already processed"
Status: implemented and tested
```

The engine checks that the code and the test still exist. The model checks that the code still does what the rule says. Rules from Notion, Confluence, Jira or Linear are read through your agent's MCP servers; Longevo keeps only the link in the repo.

## What Longevo never does

- Commit, stage or push.
- Change code in `sync`, `brief` or `review`. They report; you or your agent change the code.
- Write to Notion, Confluence, Jira, Linear or any tracker.
- Write outside the repo, or into `.git` except its own state in `.git/longevo`.
- Print a secret.

More detail: [commands](../design/commands.md), [docs model](../design/docs-model.md), [checks](../design/checks.md) and [agents](../design/agents.md).
