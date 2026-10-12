<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.svg">
    <img alt="Longevo: a machine checks each doc on a conveyor belt. Docs in, verified docs out." src=".github/assets/banner-light.svg" width="100%">
  </picture>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-111111?style=flat-square"></a>
  <img alt="Status: preview 0.2" src="https://img.shields.io/badge/status-preview%200.2-111111?style=flat-square">
  <a href="https://agentskills.io/specification"><img alt="Format: Agent Skills" src="https://img.shields.io/badge/format-Agent%20Skills-111111?style=flat-square"></a>
</p>

<p align="center">
  <a href="docs/guides/getting-started.md">Getting started</a> ·
  <a href="docs/guides/how-it-works.md">How it works</a> ·
  <a href="docs/design/overview.md">Overview</a> ·
  <a href="docs/design/commands.md">Commands</a> ·
  <a href="docs/roadmap.md">Roadmap</a> ·
  <a href="docs/decisions/README.md">Decisions</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

Longevo is a small set of agent skills. It helps coding agents write tests that catch real bugs, and it keeps your docs true to the code.

> [!NOTE]
> Longevo 0.2 is a preview: all five skills work, and each one passed its eval gate. 1.0 comes after use on real repos and in all five agents. See the [roadmap](docs/roadmap.md).

## Why

Coding agents write code fast, but they often:

- write tests full of mocks that do not catch real bugs,
- miss business rules that live in Notion, Confluence, Jira or Linear,
- trust docs that the code stopped following a long time ago.

Longevo does not replace your agent or your workflow. It improves what the agent reads and checks what it produces.

## Commands

| Command | What it does |
| --- | --- |
| `/longevo-init` | The first time: reviews the repo and its AGENTS.md, and applies the changes you pick so every agent sees the same rules. Every session after that: a short update. |
| `longevo-testing` | Runs by itself when the agent writes tests: a test plan first, then tests that check results instead of mocks. Based on [Primo's testing skill](https://github.com/primo-devs/public-skills). |
| `/longevo-sync` | Compares docs with the code and with external sources, and applies the small fixes you pick. |
| `/longevo-brief` | Collects the rules, code, docs and tests for one task into a brief in `docs/work/`, as input for spec-driven development. |
| `/longevo-review` | Reviews your changes against the rules, the testing guide, the docs and the brief, with a reviewer that did not write them. |

Each of the four commands scans the repo first, asks only what the code cannot answer, and proposes changes as diffs. Longevo writes only the changes you pick, never stages or commits, and keeps its own state inside `.git`. It reads Notion, Confluence, Jira or Linear through your agent's MCP servers, keeps only the links in the repo and never writes to those tools. Its reports name secrets by file and line, never by value. See [how it works](docs/guides/how-it-works.md).

## Install

One command for every agent (needs Node 18 or newer; stale-doc checks and `review` also need a git repo):

```bash
npx skills add FacundoLongo/longevo -g
```

Then open your agent in a repo and run `/longevo-init`: `$longevo-init` in Codex, `/longevo:longevo-init` after the Claude Code plugin install, and pick it from `/skills` in Gemini CLI.

The plugin installers for Claude Code, Gemini CLI and Copilot CLI, the first run and a working day are in [getting started](docs/guides/getting-started.md).

## Works with

Longevo uses the [Agent Skills](https://agentskills.io/specification) format, so the same skills work in **Claude Code**, **Codex**, **Cursor**, **Gemini CLI** and **GitHub Copilot CLI**. See [agents](docs/design/agents.md).

## Roadmap

| Step | What you get |
| --- | --- |
| 1 | Read-only `init` and the testing skill |
| 2 | `init` sets up AGENTS.md, a testing guide and doc frontmatter |
| 3 | Living docs: `sync`, drift checks and external sources |
| 4 | `brief` and `review` |

Details in the [roadmap](docs/roadmap.md).

## Contributing

Questions and ideas are welcome as issues. Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request.

## Credits

The testing skill builds on [Primo's public testing skill](https://github.com/primo-devs/public-skills) (MIT). Other ideas come from [Superpowers](https://github.com/obra/superpowers), [OpenSpec](https://github.com/Fission-AI/OpenSpec), [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) and the [harness engineering](https://martinfowler.com/articles/harness-engineering.html) model by Birgitta Böckeler.

## License

[MIT](LICENSE)
