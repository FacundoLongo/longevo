---
covers: ["src/scan.mjs", "src/lib/**"]
verified: 2026-10-11
---

# Checks

How `init` reviews a repo and its AGENTS.md, and how Longevo compares docs, code and external sources.

## How `init` scans

From cheap to expensive:

1. **Scope:** the git root, or the folder you run it in and its parents.
2. **Instruction files:** AGENTS.md, CLAUDE.md, GEMINI.md, `.cursor/rules`, Copilot instructions and skills, with their size, and the Gemini CLI setting that makes it read AGENTS.md.
3. **Workspaces:** pnpm, npm and yarn workspaces, turbo, nx, lerna, go.work, Cargo, uv, Gradle, Maven and `.sln`. Each package is an area.
4. **Real commands:** manifests, Makefile, CI and pre-commit hooks.
5. **Cross-check:** commands and paths in the instructions against what exists.
6. **Git history:** the 10 files that changed most in the last year, without lockfiles, generated code or commits that touch more than 100 files.
7. **Agent setup:** MCP server names and installed skills, in the repo and in your home folder. Never credentials, `env`, arguments or URLs. The report names each home file it read.
8. **Living docs:** `covers`, `verified` and the files that changed after the anchor ([D4](../decisions/docs.md)).
9. **Sampling:** README, entry points and one or two tests of the busiest packages. The only expensive step.
10. **Safe execution, only with your OK:** `--help` or dry runs. Never install, migrate or deploy.

Steps 1 to 8 are the script. Step 9 is the model.

## Reviewing AGENTS.md

| Check | Why it matters |
| --- | --- |
| Which file each agent loads, and CLAUDE.md next to AGENTS.md without `@AGENTS.md` | Otherwise each agent sees half of the rules |
| Rules or skills that only one agent loads: `.cursor/rules`, Copilot instructions, GEMINI.md, `.claude/skills` | The other agents never see them. A rule moves to AGENTS.md unless AGENTS.md already says the same |
| Another installed skill that does the same job as a Longevo skill | The agent may follow either one |
| Every command exists, and there is one to run a single test | Agents run what they find |
| Every path exists | 23% of repos point to code that no longer exists |
| No overviews, folder trees or rules a linter already covers | They raise the cost and do not help |
| No contradictions between root, subfolders, Cursor rules and Copilot instructions | It happens in 28% of instruction files |
| Size: CLAUDE.md under 200 lines, the Codex limit of 32 KiB | Anything over the limit is cut |
| Files with a single commit | 24% were never reviewed after they were generated |
| No secrets, personal paths or "install this" instructions | These files are a path for prompt injection |

It also uses the line test from BMAD: "if I delete this line, does the agent behave differently?" If not, it proposes to remove it.

The report has: a summary with the three most useful actions, which agent loads which file, findings with evidence and a diff, documented commands against real ones, questions, and what it could not check.

## Docs against code

Longevo compares three sources of truth in pairs: external sources (what the business wants), docs (what we say the code does) and code with its tests (what it really does).

| Check | Who |
| --- | --- |
| Docs whose `covers` changed since `verified` | Script |
| `covers` that match no file, paths that do not exist | Script |
| Rules whose `file:line` or test no longer exists | Script |
| Rules without source, code or test | Script |
| Sources not checked in 30 days | Script |
| A rule is implemented as it says | Model, with evidence |
| The doc text is still true | Model, with evidence |
| A source changed at the origin | Model, through MCP |

Everything goes into one gap report. Each finding has a proposal: open a brief for a missing rule, ask the testing skill for a missing test, ask you when the doc and the code disagree, or offer a small diff for a stale doc.

To avoid noise, big reformats and lockfiles do not count. A doc that is still true is confirmed again without changes to its text.

## Sources

- [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD): the line test
- [Agent instruction smells (arXiv 2606.15828)](https://arxiv.org/abs/2606.15828): the 28% and 24% figures
- [References to missing code (arXiv 2606.09090)](https://arxiv.org/abs/2606.09090): the 23% figure
- [Context files and task success (arXiv 2602.11988)](https://arxiv.org/abs/2602.11988)
- [Bernstein: docs drift](https://bernstein.readthedocs.io/en/latest/playbooks/docs-drift/): thresholds against noise
- [Claude Code: memory](https://code.claude.com/docs/en/memory.md) · [Codex: AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
