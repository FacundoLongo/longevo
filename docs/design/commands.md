# Commands

The four commands, the testing skill, how they ask and what they can write.

| Command | When | What it does | Step |
| --- | --- | --- | --- |
| `/longevo-init` | The first time in a repo, and at the start of each session | Works on the folder where you run it. First time: full review and setup. Each session: a short update. In a folder without Longevo: a read-only audit | 1 and 2 |
| `longevo-testing` | Every time the agent writes or plans tests | Decides which tests are worth it and how they look. See [testing](testing.md) | 1 |
| `/longevo-sync` | When you finish a task, or once a week | Checks docs against the code and external sources, and proposes small diffs | 3 |
| `/longevo-brief <task or link>` | Before a task of some size | Collects the issue, rules, docs, code and golden tests into one brief | 4 |
| `/longevo-review` | Before a commit or a pull request | Reviews the diff against the rules, the testing guide and the docs, with a subagent that did not see the implementation | 4 |

## Every command works the same way

1. **Scan.** A script collects the cheap facts. The model reads only what it needs.
2. **Ask.** Only what the code cannot answer, one question at a time, with evidence and options.
3. **Propose.** A short report with the changes as diffs.
4. **You apply.** Nothing is written without your OK, and Longevo never commits.

Example questions:

- "CI runs `turbo run test`, but AGENTS.md does not say how to run a single test. What is the command?"
- "CLAUDE.md and AGENTS.md have different rules, and each agent loads only one. Should I move everything to AGENTS.md? [Yes / Report only]"
- "`docs/domain/payments.md` says a refund expires after 48 h, but `refund.ts:88` uses 72 h. Which one is right? [The code / The doc]"

It never asks what it can read from the repo, never asks "should I continue?" and adds no small talk.

## `init` always works

| Moment | How it knows | What it shows |
| --- | --- | --- |
| First time | No Longevo block in AGENTS.md | A full review report and a setup proposal |
| New session | There is a Longevo block | 10 lines or less: commits since the last session, stale docs, open work, sources not checked |
| Audit | You ask with `--full`, or the folder is not yours | The full report, without writing anything |

The date of the last session is stored inside `.git`. In Claude Code, Cursor and Copilot CLI, `init` can run by itself at session start with a hook that only reports. In Codex and Gemini CLI you run it yourself.

## What `init` can write

Only what you approve from this list:

- the Longevo block in AGENTS.md, between `<!-- longevo:start -->` and `<!-- longevo:end -->`,
- the `@AGENTS.md` line in CLAUDE.md,
- frontmatter in existing docs,
- `docs/testing.md` and `docs/sources.md`.

Everything outside the block belongs to you. When Longevo audits its block, the block ends the same size or shorter. Other changes, like moving rules between files, are shown as diffs for you to apply.

## `brief`: input for spec-driven development

`/longevo-brief` prepares what your spec tool needs. It does not replace it. The brief goes to `docs/work/<date>-<slug>/brief.md` and has these parts:

- **Goal**, from the issue.
- **Rules that apply**, each with its status (implemented, missing, contradicts).
- **Affected code and docs.**
- **Golden tests** to copy.
- **What must not change.** Each item asks for a regression test.
- **Open questions.**
- **Acceptance criteria** as WHEN/THEN scenarios.

| Tool | How it uses the brief |
| --- | --- |
| Superpowers | `brainstorming` starts from it and skips questions that already have an answer |
| OpenSpec | It is the base of `proposal.md` |
| Spec Kit | It is the input of `/speckit-specify` |
| Plan mode | You give it as context |

When the work is done, `sync` moves the new criteria into the rules in `docs/domain/` and archives the brief. Docs grow with each change.

## Sources

- [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD): the owned block and the "never longer" audit rule
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) · [Spec Kit](https://github.com/github/spec-kit) · [Superpowers](https://github.com/obra/superpowers)
- [Kiro: bugfix specs](https://kiro.dev/docs/specs/bugfix-specs/): current, expected and unchanged behavior
