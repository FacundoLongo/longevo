# Checklist

What init reviews. The engine covers the first group; you check the second group by reading the instruction files.

## From the engine (`findings` in the JSON)

| Finding | What it means |
| --- | --- |
| `no-entry-file` | No AGENTS.md or CLAUDE.md in this folder or its parents |
| `claude-sees-only-claude-md` | CLAUDE.md does not import `@AGENTS.md`, so Claude Code does not see AGENTS.md |
| `only-claude-md` | Codex, Cursor and Gemini CLI do not see the rules |
| `rules-not-shared` | An instruction file with rules that some agents in use (`agents`) do not load |
| `skill-not-shared` | A repo skill that some agents in use do not load. A copy in `.agents/skills` and `.claude/skills` reaches all five |
| `overlapping-skill` | Another installed skill about tests, which the agent may follow instead of `longevo-testing` |
| `claude-md-too-long` | CLAUDE.md is over 200 lines |
| `codex-limit` | AGENTS.md files add up to more than 32 KiB, so Codex cuts them |
| `claude-local-hides-agents` | CLAUDE.local.md makes Claude Code ignore AGENTS.md on this machine |
| `never-reviewed` | The file has one commit |
| `missing-command` | A cited script or target does not exist |
| `no-commands`, `no-single-test-command` | The agent cannot learn how to build or test |
| `doc-stale` | Code in a doc's `covers` changed after its `verified` date |
| `covers-match-nothing` | A `covers` glob matches no file |
| `frontmatter-invalid` | A doc with Longevo keys has frontmatter the engine cannot read |
| `doc-not-verified` | A doc has `covers` but no `verified` date, so it can never go stale |
| `instruction-unreadable` | An instruction file over 1 MB, with NUL bytes, or a link to nothing: its rules were not checked |
| `missingPaths` | Cited paths that do not exist |
| `security` | Secrets, personal paths or "install from the internet" lines |

## For you to judge

| Check | Why it matters |
| --- | --- |
| Overviews, folder trees and dependency lists | The agent reads those from the repo; they raise the cost and do not help |
| Rules a linter or formatter already enforces | Move them to the tool |
| Steps that apply to a single task | Move them to a skill or a doc with a trigger |
| Contradictions between files (npm against pnpm, Jest against Vitest) | Each agent follows a different rule. Ask which one is right |
| Pointers without a trigger ("see docs/") | Use "If you change `src/x/**`, read `docs/x.md`" |
| The line test: "if I delete this line, does the agent behave differently?" | If not, propose to remove it |
| Anti-golden candidates in `tests` | Confirm by reading the test; the engine only guesses |
| A stale doc (`doc-stale`) | Say it in the report; fixing the text is the job of `longevo-sync` |
