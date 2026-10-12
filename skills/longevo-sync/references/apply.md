# Apply

How to write the changes the user picked. Dates and generated files go through the engine; prose you write with your edit tool, exactly as the diff you showed.

## The engine

Pass the input as JSON on stdin with a heredoc. Where heredocs do not work (PowerShell), write the JSON to a file and add `--input <file>`:

```bash
node <this skill's folder>/scripts/longevo.mjs apply verify --cwd . <<'JSON'
{"doc": "docs/domain/refunds.md"}
JSON
```

| Operation | Input | What it writes |
| --- | --- | --- |
| `verify` | `doc`, `verified` (optional, today) | A new `verified` date. The doc needs `covers` |
| `checked` | `doc`, `url`, `checked` (optional, today) | A new `checked` date on that source |
| `frontmatter` | `doc`, `covers`, `verified` (optional) | `covers` and `verified`, for a new rules doc |
| `sources` | none | `docs/sources.md` |
| `coverage` | none | `docs/coverage.md` |
| `decline` | `keys` | The keys of changes the user did not pick, inside `.git` |
| `undecline` | `keys`, or `all: true` | Forgets declined changes, so they can be proposed again |

Each one prints `{"op", "file", "status"}` with `written` or `unchanged`, or `{"error"}` and then writes nothing. `decline` and `undecline` print `declined`, the full list; outside git they print `stored: false` and a note.

## Keys

| Change | Key |
| --- | --- |
| New verified date | `verify:<doc>:<first 12 characters of the newest commit in its commits>`, or `verify:<doc>:none` for a first date (`doc-not-verified`) |
| Text diff in a doc | `diff:<doc>:<first 40 characters of the changed line>` |
| Rule change or new rule | `rule:<id>:<first 12 characters of the newest commit in its doc's commits, or none>` |
| New checked date | `checked:<doc>:<url>:<this month, YYYY-MM>` |
| New source in a doc's frontmatter | `source:<doc>:<url>` |
| Sources file | `sources:<sourcesFile.hash>` |
| Coverage record | `coverage:<coverage.hash>` |

Keys name the newest change under the doc, the month for checked dates, or the content of a generated file, so a decline lasts only until that changes.

## Order

1. Prose: doc diffs, rule changes, new rules (a new rules doc gets `frontmatter` right after you create it).
2. `verify` for each doc you confirmed or fixed, and `checked` for each source you read.
3. `sources`, then `coverage`, so both see the new docs and rules.
4. `decline`, with the keys of every item the user did not pick.

Then run `git status --short` and `git diff --stat` and show both, so new files show too. Never stage or commit.
