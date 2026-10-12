---
name: longevo-review
description: "Review the current changes before a commit or a pull request: the branch and working tree against the default branch, checked against the business rules, the testing guide, the docs and the brief, by a reviewer that did not see how the code was written. Reports findings with file and line, hands missing tests to longevo-testing, and proposes doc fixes in a numbered list. Never changes code. Use before committing, before opening a pull request, or when the user asks for a review."
---

# Longevo review

Give the change a second look from a reviewer that did not write it. Report what breaks a rule, a test that protects nothing, and docs that no longer match. Never change code. Never stage or commit.

## 1. Scan

```
node <this skill's folder>/scripts/longevo.mjs review --cwd .
```

Add `--base <branch or commit>` when the user names one; the review starts where the branch split from it. If `base.fallback` is set, say why before anything else: `no-merge-base` means a shallow clone or unrelated history (suggest `git fetch --unshallow` or `--base`), `no-default-branch` means the user should pass `--base`, and `no-commits` means every file is new. If `nothing` is true, say there is nothing to review and stop.

## 2. Build the packet

The reviewer gets only:

- the diff: run `diffCommand` (it leaves out generated files, vendored files and lockfiles), and the content of each untracked file in `changed` that is not `skipped`;
- the rules in `rules`;
- `docs/testing.md`;
- the brief in `brief` (its acceptance criteria and "What must not change");
- the docs in `docsToUpdate`.

Before you send it, replace every line listed in `security` with `[redacted]`. Nothing else from this conversation, and nothing about how the code was written. If `diffLines.added` is over 3000, do not paste the diff: give the reviewer `diffCommand` and the list of files, and ask it to read them one at a time.

## 3. Send it to a fresh reviewer

Use a subagent with the prompt in [references/reviewer.md](references/reviewer.md) and the packet. If the agent has no subagent tool, do the review in this context with the same prompt, and say so in the report: "Reviewed in the same context; a fresh reviewer would be stronger."

## 4. Check the findings

For each finding, open the code at its `file:line` and confirm it. Drop the ones that are wrong, and say how many you dropped. Add the script's facts the reviewer may have missed: `tests` with `mocksStorage` or 3 or more `callAsserts`, `security` (file and line only), and `docsToUpdate`.

## 5. Report

Follow [references/findings.md](references/findings.md): findings ranked by severity, each with `file:line`, the evidence and what to do. A missing test goes to `longevo-testing`, with the behavior it must cover. A change that breaks a rule asks the user which one is right; the code is not changed here.

## 6. Propose

Only doc changes go in the numbered list:

- small diffs to docs in `docsToUpdate`;
- `verify` for a doc that is still true;
- `done` for the brief, when every acceptance criterion has a test.

Each item has the file, one line on why, the diff and a key (`diff:<doc>:<first 40 characters>`, `verify:<doc>`, `done:<brief>`). Leave out any item whose key is in `declined`, and if any were left out, say so in one line: "N changes are hidden because you declined them. Say 'show declined' to see them again." When the user says that, run `apply undecline` with `{"all": true}` and build the list again. If the list is empty, end with the report. Otherwise end with:

> Which ones do I apply? [All / Pick numbers / None]

Apply only the picked items: prose with your edit tool, `verify` and `done` with `longevo.mjs apply` and the doc as JSON on stdin:

```bash
node <this skill's folder>/scripts/longevo.mjs apply verify --cwd . <<'JSON'
{"doc": "docs/domain/refunds.md"}
JSON
```

`done` takes `{"doc": "<the brief's path>"}`. Run `apply decline` with `{"keys": [...]}` for the rest. Then show `git diff --stat`. Never stage or commit.

## Rules

- Never change code, tests or config. Findings say what to change; the user or their agent does it.
- Every finding has evidence. No style opinions that a linter or formatter already covers.
- Never print a secret. Report `security` by file and line only.
- Keep it short. Prefer a table to paragraphs.
