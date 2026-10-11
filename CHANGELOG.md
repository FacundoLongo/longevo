# Changelog

All notable changes to this project are listed in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
