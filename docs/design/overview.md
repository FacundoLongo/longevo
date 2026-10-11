# Overview

What Longevo is, the problem it solves and the rules it follows.

## What it is

Longevo is a small set of agent skills. It improves what a coding agent reads and checks what it produces. The process itself (brainstorm, plan, build) stays with the tools you already use, like Superpowers or the plan mode of your agent.

## The problem

- Agents write tests that protect nothing.
- They do not know the business rules that live in Notion, Confluence, Jira or Linear.
- Repo docs say things the code stopped doing, and nobody knows what is missing or what contradicts what.

## What it does and does not do

| Longevo does | Longevo does not |
| --- | --- |
| Review any repo or folder and propose fixes | Run your process or replace Superpowers |
| Keep docs alive and check them against the code | Add gates. The only hook is optional and only reports |
| Bring business rules from external tools into the repo | Copy external pages. It keeps short rules with a link |
| Make agents write fewer, better tests | Write anything without your OK |
| Prepare a brief for each task | Do spec-driven development itself |

## Principles

1. **Work with what exists.** Never move or rewrite existing docs. Add frontmatter and add them to the map.
2. **Keep it in the repo.** Everything important ends up in files in the repo, so any agent can use it.
3. **Evidence over opinion.** Every rule and claim points to a file and line, or it is marked as having no evidence.
4. **Scripts first.** If git can check it, a script checks it. The model only judges what a script cannot.
5. **Few commands,** with the same names in every agent.
6. **Human in the loop.** Scan first, then ask only what the code cannot answer, one question at a time. Nothing is written without your OK.

## How it works

Longevo has no server and no database. It is skills on your machine, docs in each repo and a script that reads git.

| Piece | Role | Who does it |
| --- | --- | --- |
| AGENTS.md, docs and skills | Guide: steers the agent before it acts | The model reads them |
| `scan` script | Sensor: finds drift, broken paths and broken commands | Deterministic: git and files |
| `sync` and `review` | Sensor: judges if the content is true | The model, with evidence |
| You | Steering: decide what goes in | A human |

This follows the model of guides and sensors by Birgitta Böckeler.

## A working day

1. Open the agent. `/longevo-init` tells you in 10 lines what changed and what is stale.
2. Take a task. If it has some size, `/longevo-brief` collects rules, code and tests, and asks what is missing.
3. Design and plan with your usual tool, with the brief as input.
4. The agent builds. `longevo-testing` starts by itself when it writes tests.
5. Before you commit, `/longevo-review` checks the diff.
6. When you finish, `/longevo-sync` proposes small fixes to the docs. You approve what goes in.

A small change needs only steps 1, 4 and 6.

## Sources

- [Birgitta Böckeler: harness engineering](https://martinfowler.com/articles/harness-engineering.html)
- [OpenAI: harness engineering](https://openai.com/index/harness-engineering/)
- [Superpowers](https://github.com/obra/superpowers)
