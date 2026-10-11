# Longevo

Agent skills for better tests and docs that stay true to the code. Version 0.1 ships `longevo-testing` and a read-only `longevo-init`.

## Where things are

- `skills/`: one folder per skill (`longevo-<name>/` with `SKILL.md`, `references/` and, if needed, `scripts/`).
- `scripts/`: repo tools: the skill validator and the manual installer.
- `tests/`: `node:test` tests for the scan script, the validator, the manifests and the installer.
- `evals/`: eval cases that run each skill with and without Longevo (`claude plugin eval`). Run them when you change a skill; see CONTRIBUTING.md.
- `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/` and `gemini-extension.json`: they package the same `skills/` folder for each agent.
- `docs/README.md`: the map of all docs and the rules for adding one. Read it before you create or change a doc.
- `docs/design/`: how Longevo works. Read the matching file before you propose a change.
- `docs/roadmap.md`: the four steps and the open decisions. Do not build anything that belongs to a later step.
- `docs/decisions/`: decisions grouped by area, with an index in its README. Add a new decision to its area file. Never edit an accepted decision; add a new one that supersedes it.

## Rules

- Run `npm test` and `npm run validate` before you commit. Run one test file with `node --test tests/scan.test.mjs`.
- No dependencies: code uses only Node 18 built-ins.
- Keep the version in `package.json` and in every manifest the same.
- Write every repo file in plain English.
- Commit messages: start with an imperative verb, 15 words or fewer, no prefix like `feat:`, no co-author trailers.
- Group related changes in one commit. Avoid many small commits.
- Add one line to `CHANGELOG.md` under Unreleased for each change that people who use Longevo will notice. No marketing words, no emojis.
- Keep docs short: under 100 lines when possible, and never over 150.
