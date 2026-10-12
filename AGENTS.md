# Longevo

Agent skills for better tests and docs that stay true to the code.

## Where things are

- `skills/`: one folder per skill (`longevo-<name>/` with `SKILL.md` and `references/`).
- `src/`: the engine (`longevo.mjs` with `scan`, `sync`, `context`, `review`, `apply` and `coverage`). Each command skill carries a copy in its `scripts/` folder. Never edit the copies; edit `src/` and run `npm run engine`.
- `scripts/`: repo tools: the skill validator, the engine copier and the manual installer.
- `tests/`: `node:test` tests for the engine, the validator, the manifests and the installer.
- `evals/`: eval cases that run each skill with and without Longevo (`claude plugin eval`). Run them when you change a skill; see CONTRIBUTING.md.
- `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/` and `gemini-extension.json`: they package the same `skills/` folder for each agent.
- `docs/README.md`: the map of all docs and the rules for adding one. Read it before you create or change a doc.
- `docs/guides/`: how to install and use Longevo, for the people who use it. Update them when a skill's steps change.
- `docs/design/`: how Longevo works. Read the matching file before you propose a change.
- `docs/roadmap.md`: the four steps and the open decisions. Do not build anything that belongs to a later step.
- `docs/decisions/`: decisions grouped by area, with an index in its README. Add a new decision to its area file. Never edit an accepted decision; add a new one that supersedes it.

## Rules

- Run `npm run engine`, `npm test` and `npm run validate` before you commit. Run one test file with `node --test tests/scan.test.mjs`.
- No dependencies: code uses only Node 18 built-ins.
- Keep the version in `package.json` and in every manifest the same.
- Write every repo file in plain English.
- Commit messages: start with an imperative verb, 15 words or fewer, no prefix like `feat:`, no co-author trailers.
- Group related changes in one commit. Avoid many small commits.
- Add one line to `CHANGELOG.md` under Unreleased for each change that people who use Longevo will notice. No marketing words, no emojis.
- Keep docs short: under 100 lines when possible, and never over 150.

<!-- longevo:start -->
## Longevo
- If you write or change tests, read `docs/testing.md`.
- If you change `skills/*/SKILL.md`, read `docs/design/commands.md`.
- If you change `skills/longevo-testing/**`, read `docs/design/testing.md`.
- If you change `src/lib/**`, read `docs/design/checks.md`.
- If you change `src/lib/agents.mjs`, read `docs/design/agents.md`.
- If you change `src/lib/docs.mjs`, read `docs/design/docs-model.md`.
- What is tested and documented: `docs/coverage.md`.
- Start each session with the `longevo-init` skill.
<!-- longevo:end -->
