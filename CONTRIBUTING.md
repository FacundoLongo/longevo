# Contributing

Longevo is in the design phase. The best way to help now is to read the [docs](docs/README.md) and open an issue with questions or ideas.

## Commit messages

- Write in plain English.
- Start with a verb in the imperative: Add, Fix, Remove, Update, Rename, Move.
- Use 15 words or fewer.
- Do not use prefixes like `feat:` or `fix(scope):`.
- Do not add co-author trailers for tools or AI assistants.

Examples:

```
Add drift check for docs with missing covers
Fix init when AGENTS.md has no Longevo block
Remove unused option from the scan script
```

Pull requests are squash merged, so the PR title becomes the commit message. PR titles follow the same rules.

## Changelog

When a change is visible to people who use Longevo, add one line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md).

- One line per change.
- Say what changed in concrete words: "Add `--full` flag to init", not "Improve the init experience".
- No marketing words: robust, seamless, powerful, comprehensive, enhance, leverage.
- No emojis.
- Skip internal refactors that nobody notices when using Longevo.

## Docs and design changes

- Large changes start as an issue.
- An accepted design decision goes into its area file in [docs/decisions/](docs/decisions/README.md). Accepted decisions are not edited: a new decision replaces the old one.
- Before you add a new doc, read [docs/README.md](docs/README.md). It says where each kind of doc goes and how long it can be.
