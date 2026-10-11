<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.svg">
    <img alt="Longevo: a machine checks each doc on a conveyor belt. Docs in, verified docs out." src=".github/assets/banner-light.svg" width="100%">
  </picture>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-111111?style=flat-square"></a>
  <img alt="Status: preview 0.1" src="https://img.shields.io/badge/status-preview%200.1-111111?style=flat-square">
  <a href="https://agentskills.io/specification"><img alt="Format: Agent Skills" src="https://img.shields.io/badge/format-Agent%20Skills-111111?style=flat-square"></a>
</p>

<p align="center">
  <a href="docs/design/overview.md">Overview</a> ·
  <a href="docs/design/commands.md">Commands</a> ·
  <a href="docs/roadmap.md">Roadmap</a> ·
  <a href="docs/decisions/README.md">Decisions</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

Longevo is a small set of agent skills. It helps coding agents write tests that catch real bugs, and it keeps your docs true to the code.

> [!NOTE]
> Longevo is a preview. `longevo-init` and `longevo-testing` work today; `sync`, `brief` and `review` are being built for 0.2. See the [roadmap](docs/roadmap.md).

## Why

Coding agents write code fast, but they often:

- write tests full of mocks that do not catch real bugs,
- miss business rules that live in Notion, Confluence, Jira or Linear,
- trust docs that the code stopped following a long time ago.

Longevo does not replace your agent or your workflow. It improves what the agent reads and checks what it produces.

## Commands

| Command | What it does | In 0.1 |
| --- | --- | --- |
| `/longevo-init` | The first time: reviews the repo and its AGENTS.md, and applies the changes you pick so every agent sees the same rules. Every session after that: a short update. | Yes |
| `longevo-testing` | Runs by itself when the agent writes tests. Based on [Primo's testing skill](https://github.com/primo-devs/public-skills). | Yes |
| `/longevo-sync` | Compares docs with the code and with external sources, and proposes small fixes. | Step 3 |
| `/longevo-brief` | Collects the rules, code, docs and tests for one task, as input for spec-driven development. | Step 4 |
| `/longevo-review` | Reviews a diff against the repo rules and the testing guide. | Step 4 |

Every command works the same way:

1. **Scan** the repo first.
2. **Ask** only what the code cannot answer, one question at a time.
3. **Propose** changes as diffs.
4. **You pick** which changes to apply. Longevo writes only those, never commits, and keeps its own state inside `.git`.

## Install

One command for every agent (needs Node 18 or newer):

```bash
npx skills add FacundoLongo/longevo -g
```

It puts the skills in `~/.agents/skills`, which Codex, Cursor, Gemini CLI and Copilot read, and links them for Claude Code. Update with `npx skills update -g`.

Native installers:

| Agent | Command |
| --- | --- |
| Claude Code | `/plugin install longevo --marketplace FacundoLongo/longevo` |
| Gemini CLI | `gemini extensions install https://github.com/FacundoLongo/longevo` (not tested yet) |
| Copilot CLI | `copilot plugin marketplace add FacundoLongo/longevo`, then `copilot plugin install longevo@longevo` (not tested yet) |
| Manual | `git clone https://github.com/FacundoLongo/longevo && longevo/scripts/install.sh` |

Then open your agent in a repo and run `/longevo-init` (`$longevo-init` in Codex).

## Works with

Longevo uses the [Agent Skills](https://agentskills.io/specification) format, so the same skills work in **Claude Code**, **Codex**, **Cursor**, **Gemini CLI** and **GitHub Copilot**. See [agents](docs/design/agents.md).

## Roadmap

| Step | What you get |
| --- | --- |
| 1 | Read-only `init` and the testing skill |
| 2 | `init` sets up AGENTS.md, a testing guide and doc frontmatter |
| 3 | Living docs: `sync`, drift checks and external sources |
| 4 | `brief` and `review` |

Each step must work on two real repos before the next one starts. Details in the [roadmap](docs/roadmap.md).

## Contributing

Questions and ideas are welcome as issues. Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request.

## Credits

The testing skill builds on [Primo's public testing skill](https://github.com/primo-devs/public-skills) (MIT). Other ideas come from [Superpowers](https://github.com/obra/superpowers), [OpenSpec](https://github.com/Fission-AI/OpenSpec), [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) and the [harness engineering](https://martinfowler.com/articles/harness-engineering.html) model by Birgitta Böckeler.

## License

[MIT](LICENSE)
