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

### Fixed

- A change that was reverted later no longer makes a doc stale; moving a file out of `covers`, a squash merge of a large change ([D12](docs/decisions/docs.md)) and moving the doc itself are handled. A new `verified` date that is not committed yet counts as a check made on that date.
- `apply` no longer fails when the terminal leaves an empty pipe on stdin. An operation that needs input and gets none stops with a clear error instead of writing an empty block; `--input <file>` works where heredocs do not.
- Files with CRLF line endings keep them when Longevo writes the block or `@AGENTS.md`, and block markers inside a code fence count as an example.
- Writing a `checked` date keeps comments and the other sources as they are.
- Frontmatter with nested maps, block text or escaped quotes is read. TOML frontmatter (`+++`) gets a clear message instead of a second frontmatter block.
- Rules with no title, an en dash, `path#L3-L5` code refs, or a quoted or backticked test name after a path are read. Under a deeper subheading, like `#### Scenarios`, only WHEN/THEN lines count; put `Code`, `Test` and `Status` right after the rule heading.
- A finished brief whose criteria are already rules is not proposed again.
- `review` works in a repo with no commits yet, says why when it is on the default branch or outside git, and leaves out the changes you declined.
- The scan reads UTF-16 instruction files, reports the ones it cannot read, and shows which package.json or Makefile defines each cited command. `pnpm vitest` and other package binaries are no longer reported as missing scripts.
- Call assertions inside string fixtures no longer mark a test file as a bad example.
- Secrets are redacted on removed diff lines, on `+` and `-` YAML lines in `sync` diffs, across every line of a private key and in error messages. `apply` never writes into `.git` spelled in another case, like `.GIT` on macOS.
- Docs that start with a byte order mark work like any other, and a doc with `covers` but no `verified` date is reported.
- Skills show `git status --short` after they write, so new files show too.
- Clear errors for a missing folder, an option without a value, impossible dates, malformed `apply` input, `covers` that are not globs and links to folders that do not exist. Outside git, `decline` says it cannot remember instead of failing, and `sync` says drift was not checked.

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
