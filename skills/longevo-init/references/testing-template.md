# Testing template

Use it to propose `docs/testing.md`. Fill it from the scan, the repo and the user's answers, in the language of the repo's docs. Leave out a section with nothing true to say, and keep the file under 60 lines. Write the file without frontmatter; `apply frontmatter` adds it afterwards (see [apply.md](apply.md)).

```markdown
# Testing

How tests work in this repo. `longevo-testing` follows this file over its own guide.

## Commands

- All tests: `<command>`
- One test: `<command, with a real file or test name>`
- Real storage for tests: `<how to start it, or "not needed">`

## Test type per layer

| Layer | Folder | Test type | Storage |
| --- | --- | --- | --- |
| <HTTP handlers> | `<src/api/>` | <Integration> | <Real database> |

## Golden tests

Copy these when you write a new test:

- `<path>`: <why it is a good example>

## Do not copy

- `<path>`: <reason, for example "mocks the repository">

## Rules

- <Rules about tests that already exist in this repo. Link to them; do not copy them.>
```

Golden and "do not copy" tests need the user's OK, because the code cannot tell which tests the team wants copied: propose them from the test inventory and the anti-golden candidates you confirmed, and ask before you list them.
