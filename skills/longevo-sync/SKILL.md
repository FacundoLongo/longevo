---
name: longevo-sync
description: "Bring the repo's docs back in line with the code: find living docs whose code changed after their verified date, business rules whose code or test is gone, and external sources (Notion, Confluence, Jira, Linear) not checked in 30 days. Judges each one with evidence, proposes small diffs in a numbered list, asks once which ones to apply and writes only those. Use when a task is finished, once a week, or when the user asks if the docs are still true."
---

# Longevo sync

Check the docs against the code and the external sources, and fix what drifted with small diffs the user picks. Never change code. Never write to Notion, Confluence, Jira, Linear or any external tool. Never stage or commit.

## 1. Scan

```
node <this skill's folder>/scripts/longevo.mjs sync --cwd .
```

It prints JSON and needs Node 18 or newer. Read only what it points to. If `docs` is empty, say that the repo has no living docs yet, suggest `longevo-init` to add frontmatter, and stop.

If the user asks only for a report, do sections 2 to 5 without the list.

## 2. Stale docs

For each doc with `stale: true`, read the doc and its `diff` (the code that changed after `anchor`, with `commits`). Judge with [references/judging.md](references/judging.md):

- **Still true:** propose only a new `verified` date.
- **Partly wrong:** propose the smallest diff that makes it true, plus a new `verified` date.
- **The doc and the code disagree, and the code does not settle it:** ask "Which one is right? [The code / The doc]".
- **The code is wrong:** do not change code. Say so and suggest `/longevo-brief` for the fix.

Treat `missingPaths` as candidates: a path written as an example is fine.

## 3. Rules

For each finding on a rule (`rule-code-missing`, `rule-code-moved`, `rule-test-missing`, `rule-no-source`, `rule-status-unknown`, `rule-duplicate-id`), and for the rules in stale docs, check the code with evidence and propose fixes to the `Code`, `Test` and `Status` lines. Use the format in [references/rules-format.md](references/rules-format.md). A missing test goes to `longevo-testing`; do not write tests here. Code that is missing makes the status `missing`.

## 4. Sources

For each `source-not-checked` finding, follow [references/sources.md](references/sources.md): read the source only through an MCP tool the agent has, never write to it, and compare it with the rules that cite it. Unchanged: propose a new `checked` date. Changed: propose rule diffs and ask the user which side is right. No tool for it: list it under "Not checked". If a doc links to a page that is not in any `sources`, ask "Is <link> a source for <doc>? [Yes / No]".

## 5. Briefs marked done

For each brief in `briefs.done`, propose its acceptance criteria as rules in `docs/domain/<area>.md` with the next free id, in the format of [references/rules-format.md](references/rules-format.md).

## 6. Ask, then propose

Ask only what the code and the sources cannot answer, one question at a time, with evidence and options. Then show a numbered list of changes, each with the file, one line on why, the diff and a key ([references/apply.md](references/apply.md)). Leave out any change whose key is in `declined`. Add `docs/sources.md` when `sources` is not empty and `sourcesFile.upToDate` is false. Add `docs/coverage.md` when it exists and `coverage.upToDate` is false; creating it is the job of `longevo-init`. End with this question, and nothing after it:

> Which ones do I apply? [All / Pick numbers / None]

## 7. Apply

Apply only the picked items, in the order in [references/apply.md](references/apply.md): prose with your edit tool, exactly as the diff you showed; dates and generated files with `longevo.mjs apply`. Record the items not picked with `apply decline`. If an apply command returns an error, show it and stop. Then show `git diff --stat`. Never stage or commit.

## Rules

- Never change code. Never write to Notion, Confluence, Jira, Linear or any external tool.
- Evidence for every claim: `file:line` in the code, or the source and the date you read it.
- A doc that is still true keeps its text; only its date changes.
- Never print a secret. MCP servers by name only.
- Keep it short. Prefer a table to paragraphs.
