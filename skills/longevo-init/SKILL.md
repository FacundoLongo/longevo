---
name: longevo-init
description: "Review the repo or folder you are in and set it up so every coding agent sees the same rules: which instruction files each agent loads, rules only some agents see, broken commands and paths, stale docs, tests, MCP servers and installed skills. It proposes a numbered list of changes with diffs, asks once which ones to apply and writes only those. Use at the start of a session, the first time in a repo, or when the user asks to review AGENTS.md, CLAUDE.md or the agent setup."
---

# Longevo init

Review the folder you are in, tell the user where it stands, and set it up so every agent sees the same rules. Write only the changes the user picks. Never stage or commit.

## 1. Scan

Run the engine from this skill's folder:

```
node <this skill's folder>/scripts/longevo.mjs scan --cwd . --session
```

It prints JSON and needs Node 18 or newer. If Node is missing, say so and stop. `--session` stores the time of this session inside `.git`. Read only what the JSON points to; do not read the whole repo.

## 2. Pick the mode

| Mode | When | Go to |
| --- | --- | --- |
| Audit | The user says not to change anything ("audit", "only report", "do not touch anything") or passes `--full` | Sections 3 and 4. No list, no writes |
| Setup | `block.exists` is false, `block` is not in `declined`, and it is not an audit | Sections 3 to 6 |
| Session update | `block.exists` is true or `block` is in `declined`, and it is not an audit | Section 7 |

"Review this repo and tell me what to fix" is a setup, not an audit: it ends with the numbered list and the question.

## 3. Check what the script cannot

Read only the files in `instructions.files` and check the judgment items in [references/checklist.md](references/checklist.md). Open at most 3 files from `tests.antiGoldenCandidates` to confirm or drop each candidate. Read a file from `hotspots.files` only when you need it to answer a question.

## 4. Report

Follow [references/report.md](references/report.md). Every finding has evidence (`file:line`). Say which home files you read (`home.read`), and show MCP servers by name only.

## 5. Ask, then propose

First ask only what the code cannot answer and the list needs, one question at a time, with evidence and options. When the repo answers it (a lockfile, a config file, CI), do not ask: choose, give the evidence in the list item, and let the user leave that item out.

Then show a numbered list of changes. Each item has the file, one line on why, the diff, and a key. Leave out any change whose key is in `declined`, and if any were left out, say so in one line: "N changes are hidden because you declined them. Say 'show declined' to see them again." When the user says that, run `apply undecline` with `{"all": true}` and scan again. Build the list with [references/apply.md](references/apply.md):

- **Rule moves** for each `rules-not-shared` finding: rules that AGENTS.md does not already have.
- **`@AGENTS.md`** in CLAUDE.md for `claude-sees-only-claude-md`.
- **The Gemini setting** when `gemini` is in `agents.inUse` and AGENTS.md is not in `instructions.loads.gemini`.
- **`docs/testing.md`** from [references/testing-template.md](references/testing-template.md) when it does not exist.
- **Frontmatter** for at most 5 docs from `docs.candidates`, starting with the areas in `hotspots.areas`. Propose only `covers` you can justify from the doc and the code.
- **The block** when it is missing or different from what it should say. Show its lines exactly as the engine writes them (see [references/apply.md](references/apply.md)).
- **`docs/coverage.md`** when `coverage.upToDate` is false.

End with this question, and nothing after it:

> Which ones do I apply? [All / Pick numbers / None]

## 6. Apply

Apply only the picked items, in the order in [references/apply.md](references/apply.md): prose changes with your edit tool, exactly as the diff you showed; structured changes with `longevo.mjs apply`. Record the items not picked with `apply decline`. If an apply command returns an error, show it and stop; do not retry with other input without asking.

Then show `git diff --stat`. Never stage or commit.

## 7. Session update

At most 10 lines: the commits in `session.commits`, stale docs (`doc-stale`), the current high-severity findings, and broken commands or paths. When docs are stale, suggest `longevo-sync`. The scan does not remember earlier findings, so never call a finding new. If there are no commits and nothing to report, say so in one line.

If `coverage.upToDate` is false or the block should change, end with the numbered list and the same question as in section 5.

## Questions

Ask only what the code cannot answer, one question at a time, with the evidence and with options when you can. For example:

- "CI runs `turbo run test`, but AGENTS.md does not say how to run a single test. What is the command?"
- "CLAUDE.md says Jest and AGENTS.md says Vitest, and both are installed. Which one do new tests use? [Jest / Vitest]"

Never ask what you can read in the repo. Never ask "should I continue?". No small talk.

## Rules

- Write only what the user picked from the list. Never stage or commit.
- Never print a secret. Report `security` findings by file and line only.
- MCP servers by name only. Never read or show their settings.
- Do not run install, migrate, build or deploy commands. Run only `--help`-style commands, and only with the user's OK.
- Keep it short. Prefer a table to paragraphs.
