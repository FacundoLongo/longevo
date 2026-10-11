---
covers: ["tests/helpers/**", "package.json"]
verified: 2026-10-11
---

# Testing

How tests work in this repo. `longevo-testing` follows this file over its own guide.

## Commands

- All tests: `npm test`
- One file: `node --test tests/scan.test.mjs`
- One test: `node --test --test-name-pattern="writes the block" tests/apply.test.mjs`
- Real storage for tests: not needed. Tests build real git repos in temp folders.
- Skill behavior: the eval cases in `evals/` (see CONTRIBUTING.md). They cost tokens, so run them when you change a skill.

## Test type per layer

| Layer | Folder | Test type | Storage |
| --- | --- | --- | --- |
| Engine: scan, apply, coverage | `src/` | Integration: a real git repo in a temp folder, then the real function or the CLI | Real files and real git |
| Skills | `skills/` | Content checks in `tests/skills.test.mjs`; behavior in `evals/` | None |
| Packaging and repo tools | manifests, `scripts/` | Integration: run the script on temp folders | Real files |

## Golden tests

Copy these when you write a new test:

- `tests/apply.test.mjs`: builds a repo with `makeRepo`, runs one operation and asserts the whole file the user would see.
- `tests/docs.test.mjs`: builds the git history commit by commit, one behavior per test.

## Rules

- No mocks. Build real repos with `tests/helpers/fixture.mjs` (`makeRepo`, `writeFiles`, `gitIn`).
- Never read the real home folder: pass `home` to `scan`, as `tests/scan.test.mjs` does.
- No dependencies, only Node built-ins (see AGENTS.md).
- After you change `src/`, run `npm run engine`, or `tests/engine.test.mjs` fails.
