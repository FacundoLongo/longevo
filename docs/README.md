# Docs

This folder explains how Longevo works, what comes next and why we chose it. Every file is short on purpose.

## Map

| Doc | Read it to learn |
| --- | --- |
| [design/overview.md](design/overview.md) | What Longevo is, the problem, the principles and a working day |
| [design/commands.md](design/commands.md) | The commands, how they ask and what they can write |
| [design/docs-model.md](design/docs-model.md) | What Longevo keeps in a repo, external sources and large repos |
| [design/checks.md](design/checks.md) | How Longevo reviews AGENTS.md and compares docs with code |
| [design/testing.md](design/testing.md) | The testing skill and what it takes from Primo |
| [design/agents.md](design/agents.md) | How each agent loads the skills |
| [roadmap.md](roadmap.md) | The four steps, their gates and the open decisions |
| [decisions/](decisions/README.md) | The choices we made, grouped by area |

## Rules for this folder

- **Fixed places.** `design/` explains how Longevo works, `roadmap.md` says what comes next and `decisions/` records why. `guides/` (install and use) arrives with 1.0; until then, install steps live in the README. No other folders.
- **Add a section before you add a file.** A new file needs a topic that does not fit in any doc above. Add it to the map in the same pull request.
- **Keep it short.** Aim for less than 100 lines per doc. Over 150 lines, split it by topic.
- **Start with the point.** The first sentence says what the doc is for.
- **Say it once.** Link to the doc that already says it instead of repeating it.
- **No status files or notes.** Progress lives in issues and pull requests, not in docs.
- **Sources at the end** of each doc, only the ones it uses.
