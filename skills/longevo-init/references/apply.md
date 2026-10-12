# Apply

How to build the list of changes and write the ones the user picked. Structured changes go through the engine, so every agent writes them the same way. You write prose changes with your edit tool, exactly as the diff you showed.

## The engine

Pass the input as JSON on stdin with a heredoc, from the folder you scanned:

```bash
node <this skill's folder>/scripts/longevo.mjs apply block --cwd . <<'JSON'
{"commands": [{"label": "Run all tests", "command": "pnpm test"}], "testingDoc": true, "creating": ["docs/testing.md"]}
JSON
```

| Operation | Input | What it writes |
| --- | --- | --- |
| `block` | `commands` [{`label`, `command`}], `triggers` [{`glob`, `doc`}], `testingDoc`, `coverageDoc`, `creating` | The block in this folder's AGENTS.md. It creates AGENTS.md if there is none |
| `import` | `file` (optional) | `@AGENTS.md` as the first line of CLAUDE.md, or `@../AGENTS.md` in `.claude/CLAUDE.md` |
| `gemini` | none | Adds AGENTS.md to `context.fileName` in `.gemini/settings.json` |
| `frontmatter` | `doc`, `covers`, `verified` (optional, today by default) | `covers` and `verified` in the doc's frontmatter |
| `coverage` | none | `docs/coverage.md` |
| `decline` | `keys` | The keys of changes the user did not pick, inside `.git` |
| `undecline` | `keys`, or `all: true` | Forgets declined changes, so they can be proposed again |

Each one prints `{"op", "file", "status"}` with `written` or `unchanged`, or `{"error"}` and then writes nothing. `block` also prints `lines` (`before` and `after`). `decline` and `undecline` print `declined`, the full list; outside git they print `stored: false` and a note, because there is no `.git` to keep it in. Paths and globs are relative to the repo root, except `import.file`, which is relative to the folder you scanned.

## Keys

| Change | Key |
| --- | --- |
| The block | `block` |
| `@AGENTS.md` | `import:<file>` |
| Gemini setting | `gemini` |
| `docs/testing.md` | `testing-doc` |
| Frontmatter | `frontmatter:<doc>` |
| Coverage record | `coverage` |
| Rule move | `move:<source file>:<first 40 characters of the rule>` |

## The block

- Lines, in this order: commands, the testing doc, one trigger per living doc, the coverage record, the session line. The engine adds the heading and the session line. It writes them like this:

```markdown
<!-- longevo:start -->
## Longevo
- Run all tests: `pnpm test`
- Run one test: `pnpm vitest run src/cart.test.ts`
- If you write or change tests, read `docs/testing.md`.
- If you change `src/payments/**`, read `docs/payments.md`.
- What is tested and documented: `docs/coverage.md`.
- Start each session with the `longevo-init` skill.
<!-- longevo:end -->
```

- Commands: "Run all tests" and "Run one test", with a real path in the example. Add build or lint only when no instruction file says how.
- Triggers: one per doc with `covers`, using the glob that best names the code, for example `src/payments/**` → `docs/payments.md`.
- At most 12 lines. If the triggers do not fit, ask which ones to keep; `docs/coverage.md` still lists every doc.
- Never make it longer on your own. A new line comes only from a change the user picked.

## Rule moves

- Move a rule only when AGENTS.md does not say it already. Keep the wording.
- When two files disagree (npm against pnpm), keep the one the repo shows (here, the lockfile) and say why in the item. Ask before the list only when nothing in the repo settles it.
- Remove the moved lines from the source file in the same change. If the source file has no rules left, the change deletes it.
- Leave rules that only make sense for one agent, like a Claude Code tool setting, and say why.

## Order

1. Prose: rule moves, then `docs/testing.md`.
2. `frontmatter`, one call per doc. For `docs/testing.md`, `covers` points at the test setup (config and helpers), not at the tests; show that frontmatter in the `testing-doc` item's diff, because it is part of that change.
3. `block`. List the docs created in this run in `creating`.
4. `import`, then `gemini`.
5. `coverage`, last, so it sees the new docs.
6. `decline`, with the keys of every item the user did not pick.

Then run `git diff --stat` and show it.
