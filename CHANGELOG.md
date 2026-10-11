# Changelog

All notable changes to this project are listed in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `longevo-init` applies the changes you pick from a numbered list: the Longevo block in AGENTS.md, `@AGENTS.md` in CLAUDE.md, the Gemini CLI setting that makes it read AGENTS.md, doc frontmatter, `docs/testing.md`, rule moves between instruction files and `docs/coverage.md`. It never commits.
- `docs/coverage.md`: tests by area and kind, and docs by area with their `verified` date.
- The scan finds workspaces, git hotspots, pre-commit hooks, MCP server names, installed skills, rules or skills that some agents do not load, and stale docs.
- Changes you decline are remembered inside `.git`, so `init` and `sync` do not propose them again. Say "show declined" to see them again.
- `longevo-sync` skill: checks stale docs, business rules and external sources against the code, and applies the small fixes you pick. It never changes code and never writes to external tools.
- `docs/sources.md`, generated from the `sources` in each doc's frontmatter, and a rules table in `docs/coverage.md`.
- The engine finds a working git when the macOS git shim fails inside a sandbox.
- A doc checked twice on the same day gets the time in `verified` (`2026-10-11T18:35:12`), so the second check counts.
- `longevo-brief` skill: reads the task from text, GitHub, Linear, Jira or Notion and saves a brief with the rules, affected code, golden tests, what must not change and WHEN/THEN acceptance criteria to `docs/work/`. It never writes to the tracker.
- `longevo-review` skill: reviews the branch and the working tree against the rules, the testing guide, the docs and the brief with a fresh reviewer, and never changes code.

### Changed

- The engine moved to `src/longevo.mjs`, with the `scan`, `sync`, `context`, `review`, `apply` and `coverage` commands. Each command skill carries its own copy.
- Secret checks know more secret shapes (Stripe, Slack, Google, JWT, passwords in URLs, quoted values) and leave ordinary code and placeholders alone.
- Briefs and decisions are records: they are never reported as stale, even with `covers`.
- `apply` refuses to write through links that point outside the repo or into `.git`.
- The scan report is version 2.

## [0.1.0] - 2026-10-11

### Added

- `longevo-testing` skill, based on Primo's testing skill, with references for Go, TypeScript, Python, Java and Kotlin, .NET, Ruby, PHP, Rust, Swift, Elixir and Convex.
- Read-only `longevo-init` skill and its `scan.mjs` script: who loads which instruction file, broken commands and paths, test inventory and security flags.
- Eval cases for both skills, run with `claude plugin eval` with and without Longevo.
- Install with `npx skills`, the Claude Code marketplace, a Gemini CLI extension, a Copilot CLI marketplace or `scripts/install.sh`.
- Design docs: overview, commands, docs model, checks, testing and agents.
- Roadmap with four steps, their gates and the open decisions.
- First decisions, grouped by area: Agent Skills format, external links kept in the repo, testing skill based on Primo, drift checks anchored by date, the `longevo-` prefix and a generated coverage record.
- Contributing guide with rules for commit messages and this changelog.
- MIT license.

[Unreleased]: https://github.com/FacundoLongo/longevo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/FacundoLongo/longevo/releases/tag/v0.1.0
