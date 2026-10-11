---
name: longevo-init
description: "Review the repo or folder you are in: which agent instruction files exist, which agent loads each one, broken commands and paths, and how the tests look. Use at the start of a session, the first time you work in a repo, or when the user asks to review AGENTS.md, CLAUDE.md or the agent setup. Read-only: it reports and asks, and it never edits files."
---

# Longevo init

Review the folder you are in and tell the user where it stands, what it has and what to change. In this version init is read-only: never edit, create or delete repo files, and never commit.

## 1. Scan

Run the scan script from this skill's folder:

```
node <this skill's folder>/scripts/scan.mjs --cwd . --session
```

It prints JSON and needs Node 18 or newer. If Node is missing, say so and stop. `--session` stores the time of this session inside the git folder, not in the repo files. Read only what the JSON points to; do not read the whole repo.

## 2. Pick the mode

- **Session update:** `session.last` has a date and the user did not ask for a review. Go to section 5.
- **Full review:** `session.last` is null, the user asks for a review or an audit, or the user passes `--full`. Go to sections 3 and 4.

## 3. Check what the script cannot

Read only the files in `instructions.files`, and check the judgment items in [references/checklist.md](references/checklist.md). Open at most 3 files from `tests.antiGoldenCandidates` to confirm or drop each candidate.

## 4. Full report

Follow [references/report.md](references/report.md). Every finding has evidence (`file:line`) and, when there is a fix, a proposed diff in a code block. Do not apply it.

## 5. Session update

At most 10 lines: the commits in `session.commits`, the current high-severity findings, and broken commands or paths. The scan does not remember earlier findings, so never call a finding new. If there are no commits and no high-severity findings, say so in one line.

## Questions

Ask only what the code cannot answer, one question at a time, with the evidence and with options when you can. For example:

- "CI runs `turbo run test`, but AGENTS.md does not say how to run a single test. What is the command?"
- "CLAUDE.md and AGENTS.md have different rules, and each agent loads only one. Should the rules move to AGENTS.md, with `@AGENTS.md` in CLAUDE.md? [Yes / Report only]"

Never ask what you can read in the repo. Never ask "should I continue?". No small talk.

## Rules

- Read-only. If the user asks you to apply a change, show the diff and say that this version of Longevo does not write files yet.
- Never print a secret. Report `security` findings by file and line only.
- Do not run install, migrate, build or deploy commands. Run only `--help`-style commands, and only with the user's OK.
- Keep it short. Prefer a table to paragraphs.
