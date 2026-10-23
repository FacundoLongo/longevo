# Changelog

All notable changes to this project are listed in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.1] - 2026-10-23

### Changed

- `apply frontmatter` takes `verified: false` for a doc that is not true yet. It writes only `covers`, and `longevo-sync` checks the doc and gives it its first date.
- `init` reads each doc against its code before it proposes frontmatter, and proposes one rule move per section of a long file.
- `sync` judges every claim in a stale doc, also the ones older than its last check, and never installs dependencies or runs the tests to check a claim.

### Fixed

- `init` proposes frontmatter for docs outside `docs/`, like `context/*.md` or a package README.
- `bun test` and `bun build` are Bun commands, not missing package.json scripts.
- Lines left in a CLAUDE.md that imports AGENTS.md are reported as Claude Code rules, at low severity, so they do not come back in every session update.
- The CLAUDE.md size check counts the AGENTS.md it imports, because Claude Code loads both.
- `init` lists `docs/coverage.md` in the block's `creating` when the same run creates it. Before, the block failed.
- The `init` report ends with the list of changes and its question; "Not checked" comes before them.

## [0.2.0] - 2026-10-12

### Added

- `longevo-sync` skill: checks stale docs, business rules and external sources against the code, and applies the small fixes you pick. It never changes code and never writes to external tools.
- `longevo-brief` skill: reads the task from text, GitHub, Linear, Jira or Notion and saves a brief with the rules, affected code, golden tests, what must not change and WHEN/THEN acceptance criteria to `docs/work/`. It never writes to the tracker.
- `longevo-review` skill: reviews the branch and the working tree against the rules, the testing guide, the docs and the brief with a fresh reviewer, and never changes code.
- Living docs: a doc with `covers` and `verified` in its frontmatter goes stale when a later commit changes the code it covers. A second check on the same day adds the time (`2026-10-11T18:35:12`), and big commits like squash merges count ([D11, D12](docs/decisions/docs.md)). Briefs and decisions are records and never go stale.
- Business rules in `docs/domain/`, with their code, test, status and WHEN/THEN scenarios.
- `docs/coverage.md` (tests, docs and rules by area) and `docs/sources.md`, both generated.
- Changes you decline are remembered inside `.git`, so `init`, `sync` and `review` do not propose them again. Say "show declined" to list them.
- The scan finds workspaces, git hotspots, pre-commit hooks, MCP server names, installed skills, rules or skills that some agents do not load, stale docs, and the file that defines each cited command.
- `apply` writes only inside the repo and never into `.git`. It reads its input from stdin, or from a file with `--input <file>` for shells without heredocs.
- Guides: [getting started](docs/guides/getting-started.md) and [how it works](docs/guides/how-it-works.md).

### Changed

- `longevo-init` applies the changes you pick from a numbered list: the Longevo block in AGENTS.md, `@AGENTS.md` in CLAUDE.md, the Gemini CLI setting that makes it read AGENTS.md, doc frontmatter, `docs/testing.md`, rule moves between instruction files and `docs/coverage.md`. It never commits. In 0.1.0 it only reported.
- The engine is `scripts/longevo.mjs` in each command skill, with the `scan`, `sync`, `context`, `review`, `apply` and `coverage` commands. The scan report is version 2.
- Secret checks know more shapes (Stripe, Slack, Google, JWT, passwords in URLs, quoted values, private keys over several lines) and leave ordinary code and placeholders alone. Error messages never print a secret.

### Fixed

- The scan reads UTF-16 instruction files and reports the ones it cannot read.
- `pnpm vitest` and other binaries of the repo's dependencies are not reported as missing scripts.
- Call assertions inside string fixtures do not mark a test file as an anti-golden candidate.
- The scan gives a clear error for a folder that does not exist or an option without a value.
- The scan finds a working git when the macOS git shim fails inside a sandbox.

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

[Unreleased]: https://github.com/FacundoLongo/longevo/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/FacundoLongo/longevo/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/FacundoLongo/longevo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/FacundoLongo/longevo/releases/tag/v0.1.0
