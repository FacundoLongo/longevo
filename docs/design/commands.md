---
covers: ["skills/*/SKILL.md", "src/lib/apply.mjs", "src/lib/block.mjs"]
verified: 2026-10-23T20:35:15
---

# Commands

The five skills (four commands and the testing skill), how they ask and what they can write.

| Command | When | What it does | Step |
| --- | --- | --- | --- |
| `/longevo-init` | The first time in a repo, and at the start of each session | Works on the folder where you run it. First time: full review and setup. Each session: a short update. When you ask for an audit: the report only | 1 and 2 |
| `longevo-testing` | Every time the agent writes or plans tests | Decides which tests are worth it and how they look. See [testing](testing.md) | 1 |
| `/longevo-sync` | When you finish a task, or once a week | Checks docs against the code and external sources, and proposes small diffs | 3 |
| `/longevo-brief <task or link>` | Before a task of some size | Collects the issue, rules, docs, code and golden tests into one brief | 4 |
| `/longevo-review` | Before a commit or a pull request | Reviews the diff against the rules, the testing guide and the docs, with a subagent that did not see the implementation | 4 |

## Every command works the same way

1. **Scan.** The engine collects the cheap facts. The model reads only what it needs.
2. **Ask.** Only what the code cannot answer, one question at a time, with evidence and options.
3. **Propose.** A short report, then a numbered list of changes, each with its diff.
4. **You pick.** One question: "Which ones do I apply? [All / Pick numbers / None]". Longevo applies only those, shows `git status --short` and `git diff --stat`, and stops. It never stages or commits ([D7](../decisions/commands.md)).

Example questions:

- "CI runs `turbo run test`, but AGENTS.md does not say how to run a single test. What is the command?"
- "CLAUDE.md and AGENTS.md have different rules, and each agent loads only one. Should I move everything to AGENTS.md? [Yes / Report only]"
- "`docs/domain/payments.md` says a refund expires after 48 h, but `refund.ts:88` uses 72 h. Which one is right? [The code / The doc]"

It never asks what it can read from the repo, never asks "should I continue?" and adds no small talk.

## The three moments of `init`

| Moment | How it knows | What it shows |
| --- | --- | --- |
| First time | No Longevo block in AGENTS.md | A full review report and a numbered list of changes |
| New session | There is a Longevo block | 10 lines or less: commits since the last session, stale docs, high-severity findings, broken commands and paths. A list of changes only if there is one, like an out-of-date `docs/coverage.md` |
| Audit | You say not to change anything, or pass `--full` to the skill | The full report, with no list and no writes |

The date of the last session is stored inside `.git`. You start each session with `init`. Whether a session-start hook that only reports should run it for you is an open decision in the [roadmap](../roadmap.md).

## What `init` can write

Only the changes you pick from the list:

- the Longevo block in AGENTS.md, between `<!-- longevo:start -->` and `<!-- longevo:end -->`,
- the `@AGENTS.md` line at the top of CLAUDE.md,
- `context.fileName` in `.gemini/settings.json`, so Gemini CLI reads AGENTS.md, when the repo or your home folder has a Gemini setup,
- `covers` and `verified` in the frontmatter of existing docs (only `covers` for a doc that is already wrong, so `sync` checks it),
- `docs/testing.md` and `docs/coverage.md`,
- prose diffs it showed you, like moving a rule from CLAUDE.md or `.cursor/rules` to AGENTS.md.

The engine (`longevo.mjs apply`) writes the block, the `@AGENTS.md` line, the Gemini setting, the frontmatter and `docs/coverage.md`, so the same input gives the same file in every agent. The model writes `docs/testing.md` from a template and applies the prose diffs exactly as it showed them. Longevo changes text outside its block only through a diff you picked. `sync` also writes `docs/sources.md`.

### The Longevo block

```markdown
<!-- longevo:start -->
## Longevo
- Run all tests: `pnpm test`
- Run one test: `pnpm vitest run src/cart.test.ts`
- If you write or change tests, read `docs/testing.md`.
- If you change `src/payments/**`, read `docs/payments.md`.
- What is tested and documented: `docs/coverage.md`.
- Start each session with the `longevo-init` skill.
<!-- longevo:end -->
```

- At most 12 lines between the markers. Commands keep the order given and triggers are sorted, so the same input always gives the same block. If the triggers do not fit, `init` asks which ones to keep; `docs/coverage.md` still lists every doc.
- Every doc it cites exists, and every glob matches at least one file. If not, nothing is written.
- If there is no block, it goes at the end of AGENTS.md. If there is no AGENTS.md, `init` creates one with only the block.
- When `init` audits the block, it never makes it longer by itself. A new line comes only from a change you picked.

## `sync`: docs that follow the code

The engine lists living docs whose `covers` changed after the anchor (every commit counts, big ones too, see [D12](../decisions/docs.md)), `covers` that match nothing, broken paths, rules whose code or test is gone, sources not checked in 30 days and briefs marked done. For each stale doc the model reads the code diff and the doc. If the doc is still true, it proposes only a new `verified` date. If not, it proposes a small diff, or asks which one is right when the doc and the code disagree. It reads external sources only through MCP servers the agent has, and says which ones it could not check.

`sync` can write, from the list: `verified` dates, `checked` dates of sources, diffs to docs and rules, rules taken from finished briefs, `docs/sources.md` and `docs/coverage.md`. The engine generates the last two.

## `brief`: input for spec-driven development

`/longevo-brief` prepares what your spec tool needs. It does not replace it. It reads the task from your text, a GitHub issue (`gh issue view`), or a Linear, Jira or Notion link through MCP. Without MCP, it asks you to paste the task. After you say yes, the brief goes to `docs/work/<date>-<slug>/brief.md`, with `status`, `task` and `covers` in its frontmatter, and has these parts:

- **Goal**, from the issue.
- **Rules that apply**, each with its status (one of the five in the rules format).
- **Affected code and docs.**
- **Golden tests** to copy.
- **What must not change.** Each item asks for a regression test.
- **Open questions.**
- **Acceptance criteria** as WHEN/THEN scenarios.
- **Tests**, left empty for `longevo-testing` to fill when the tests are planned.

| Tool | How it uses the brief |
| --- | --- |
| Superpowers | `brainstorming` starts from it and skips questions that already have an answer |
| OpenSpec | It is the base of `proposal.md` |
| Spec Kit | It is the input of `/speckit-specify` |
| Plan mode | You give it as context |

When the work is done, the brief gets `status: done` and stays where it is. `sync` then moves its criteria into the rules in `docs/domain/`, with the brief as each rule's `Source`, and stops proposing that brief.

## `review`: a second look before you commit

It reviews the working tree and the branch commits against the merge base with the default branch. The engine lists the changed files, docs whose `covers` changed but that nobody touched, rules that cite changed code, new tests that mock storage or check internal calls, the open brief and any secret in the diff. A subagent that sees only the diff, the rules, `docs/testing.md`, the brief's criteria and the docs that cover the changed code does the review. Agents without subagents review in the same context and say so.

Findings come with `file:line`: criteria without a test, rules the diff breaks, weak tests and docs to update. Doc fixes go through the list. Missing tests go to `longevo-testing`. `review` never changes code.

## Sources

- [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD): the owned block and the "never longer" audit rule
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) · [Spec Kit](https://github.com/github/spec-kit) · [Superpowers](https://github.com/obra/superpowers)
- [Kiro: bugfix specs](https://kiro.dev/docs/specs/bugfix-specs/): current, expected and unchanged behavior
