---
covers: ["skills/*/SKILL.md", "scripts/install.sh"]
verified: 2026-10-23T20:35:15
---

# Getting started

Install Longevo, set up a repo, and use the five skills in a normal working day.

## Before you start

- Node 18 or newer. The skills run a small script with no dependencies.
- A git repo. Longevo also works in a plain folder, but then it cannot tell which docs went stale, cannot remember the changes you declined, and `review` has nothing to compare.
- One of these agents: Claude Code, Codex, Cursor, Gemini CLI or GitHub Copilot CLI.

## Install

| Way | Command | Then run |
| --- | --- | --- |
| Every agent at once | `npx skills add FacundoLongo/longevo -g` | `/longevo-init` (`$longevo-init` in Codex; in Gemini CLI, pick it from `/skills`) |
| Claude Code plugin | `/plugin install longevo --marketplace FacundoLongo/longevo` | `/longevo:longevo-init` |
| Gemini CLI extension | `gemini extensions install https://github.com/FacundoLongo/longevo` | `/skills`, then pick it |
| Copilot CLI plugin | `copilot plugin marketplace add FacundoLongo/longevo`, then `copilot plugin install longevo@longevo` | `/longevo-init` |
| From a clone | `git clone https://github.com/FacundoLongo/longevo && longevo/scripts/install.sh` | `/longevo-init` |

- `npx skills` puts the skills in `~/.agents/skills`, which Codex, Cursor, Gemini CLI and Copilot read, and links them for Claude Code. Update with `npx skills update -g`.
- The Claude Code plugin puts its name before the skill name: `/longevo:longevo-init` ([D13](../decisions/packaging.md)).
- Copilot CLI is tested with the skills in `~/.agents/skills`. It asks before it reads a skill's own files there: approve it, or start Copilot with `--add-dir ~/.agents/skills`. After a clone install those skills are links into the clone, so also add `--add-dir <clone>/skills`.
- The Copilot CLI plugin and the Gemini CLI installs are not tested yet.
- To remove a clone install, run `scripts/install.sh --uninstall`.

## Set up a repo

Open your agent in the repo and run `/longevo-init`. It:

1. **Scans** the instruction files, commands, tests, docs and agent setup. Nothing is written yet.
2. **Reports** what it found, with evidence (`file:line`) for each finding.
3. **Asks** only what the repo cannot answer, one question at a time, with options.
4. **Proposes** a numbered list of changes, each with its diff, and asks: "Which ones do I apply? [All / Pick numbers / None]".

The first changes are usually the Longevo block in AGENTS.md, `@AGENTS.md` in CLAUDE.md, a testing guide in `docs/testing.md`, frontmatter for a few docs and `docs/coverage.md`. Longevo writes only what you pick, then shows `git status --short` and `git diff --stat`. It never stages or commits: read the diff and commit it yourself.

To get only the report, say "audit, do not change anything".

## A working day

| When | Run | What you get |
| --- | --- | --- |
| Start of a session | `/longevo-init` | A short update: new commits, stale docs, broken commands |
| Before a task of some size | `/longevo-brief <issue link or text>` | A brief in `docs/work/` with the rules, code, golden tests and acceptance criteria |
| While the agent writes tests | Nothing: `longevo-testing` loads by itself | A test plan first, then tests that check results instead of mocks |
| Before a commit or a pull request | `/longevo-review` | Findings with `file:line` from a reviewer that did not write the code |
| After a task, or once a week | `/longevo-sync` | Stale docs and rules fixed with small diffs you pick |

Give the brief to your planning tool (Superpowers, OpenSpec, Spec Kit or plan mode). Longevo prepares the input; it does not replace that tool.

## Changes you said no to

Longevo remembers the changes you did not pick, inside `.git`, so it does not ask about them again. A declined check of a doc comes back when the code under that doc changes. Say "show declined" to see all of them again.

## When something goes wrong

| You see | Do this |
| --- | --- |
| The skill says Node is missing | Install Node 18 or newer |
| "drift: this folder is not a git repo" | Run it in a git repo to get stale-doc checks |
| `apply` fails in PowerShell | Write the JSON to a file and add `--input <file>` |
| `/longevo-init` is not found after the plugin install | Run `/longevo:longevo-init` |
| A change you did not want | `git restore <file>` (or delete a new file); nothing was committed |

Next: [how Longevo works](how-it-works.md).
