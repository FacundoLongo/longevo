# Testing guidelines

What a good test looks like, for any stack. Mechanics for each stack are in `stacks/`. Adapted from Primo's guidelines (see ../NOTICE.md).

## Test types

Write tests. Not too many. Mostly integration. The goal is to catch regressions that matter, not to reach a coverage number.

- **Integration tests** cover most behavior. They use the real storage and the real modules of the project, and mock only external systems at the outermost boundary.
- **Unit tests with real storage** cover well-contained behavior inside one module. They still use the real storage.
- **Unit tests with mocks or without dependencies** are for pure functions and hard-to-reach cases. Mocking a module the project owns should be rare and justified.

## Golden tests

The repo lists one exemplary test per kind in `docs/testing.md`. Existing tests are not a reference by default: check them against these guidelines and the golden list. If they disagree, the guidelines win. Never copy a test the repo marks as anti-golden.

## Where to draw the boundary

- Use the real storage and the real modules of the project.
- Use a working fake for infrastructure when one exists (file storage, a clock).
- Mock only systems the project does not control, and mock the whole client the project wrote for them, not the HTTP layer under it.
- Never mock the project's own modules, even when they are dependencies of the code under test.
- Never mock storage. If the code only needs data, make it a pure function that takes that data. The one exception: simulating a storage failure the real store cannot produce on demand. Even then, assert the reaction, not the calls.

## Anti-patterns

- Creating a new test file when an existing suite fits.
- Change-detector tests: asserting which internal methods were called. Assert observable behavior instead: return values, stored data, emitted events, responses.
- Test-only methods in production code.
- Sleeping to wait for something. Use the stack's tools to wait for a condition.
- Waiting on production timers. Make the duration injectable and set it near zero in tests.

## Conventions

- Keep each test short: 30 to 45 lines.
- DAMP over DRY: a reader understands a test without jumping to helpers.
- Use table-driven tests only when the body is the same and only input and output change.
- Seed data through the same entry point production uses, when it is practical.
- Assert over data, not over calls.

## References

- Google Testing on the Toilet: [change-detector tests](https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html), [tests too DRY](https://testing.googleblog.com/2019/12/testing-on-toilet-tests-too-dry-make.html)
- Kent C. Dodds: [write tests](https://kentcdodds.com/blog/write-tests)
- Primo: [the article behind this skill](https://www.primo.la/blog/como-evitamos-que-el-ai-slop-arruine-nuestros-tests) (Spanish)
