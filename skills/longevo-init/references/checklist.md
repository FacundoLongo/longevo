# Checklist

What init reviews. The script covers the first group; you check the second group by reading the instruction files.

## From the script (`findings` in the JSON)

| Finding | What it means |
| --- | --- |
| `no-entry-file` | No AGENTS.md or CLAUDE.md in this folder or its parents |
| `claude-sees-only-claude-md` | CLAUDE.md does not import `@AGENTS.md`, so each agent sees half of the rules |
| `only-claude-md` | Codex, Cursor and Copilot do not see the rules |
| `claude-md-too-long` | CLAUDE.md is over 200 lines |
| `codex-limit` | AGENTS.md files add up to more than 32 KiB, so Codex cuts them |
| `claude-local-hides-agents` | CLAUDE.local.md makes Claude Code ignore AGENTS.md on this machine |
| `never-reviewed` | The file has one commit |
| `missing-command` | A cited script or target does not exist |
| `no-commands`, `no-single-test-command` | The agent cannot learn how to build or test |
| `missingPaths` | Cited paths that do not exist |
| `security` | Secrets, personal paths or "install from the internet" lines |

## For you to judge

| Check | Why it matters |
| --- | --- |
| Overviews, folder trees and dependency lists | The agent reads those from the repo; they raise the cost and do not help |
| Rules a linter or formatter already enforces | Move them to the tool |
| Steps that apply to a single task | Move them to a skill or a doc with a trigger |
| Contradictions between files (npm against pnpm, Jest against Vitest) | Each agent follows a different rule |
| Pointers without a trigger ("see docs/") | Use "If you change `src/x/**`, read `docs/x.md`" |
| The line test: "if I delete this line, does the agent behave differently?" | If not, propose to remove it |
| Anti-golden candidates in `tests` | Confirm by reading the test; the script only guesses |
