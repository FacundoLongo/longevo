# Testing

`longevo-testing` runs by itself when the agent writes or plans tests. It starts from Primo's testing skill (MIT) and makes it work for more stacks ([D5](../decisions/testing.md)).

## What we keep

- **The workflow:** read the code, split the inputs into equivalence classes, justify each test with "which code edit would break it", write, run, then break the code by hand to see the test fail.
- **Two lists before writing:** tests to write, with type and reason, and tests to skip, with reason.
- **The guidelines:** integration by default, never mock storage, 30 to 45 lines per test, DAMP over DRY, no change-detector tests, table-driven tests only when the body is the same.

## What we change

| Part | In Primo | In Longevo |
| --- | --- | --- |
| Stack | Go and Postgres | One reference per stack: Go, TypeScript, Python, Java and Kotlin, .NET, Ruby, PHP, Rust, Swift, Elixir and Convex. Other stacks use the generic guidelines |
| Real storage | A cloned Postgres database | The most real option of each stack, validated one by one |
| Golden list and test command | In AGENTS.md | In `docs/testing.md`, proposed by `init` |

## Rules

- **The repo wins.** Rules in `docs/testing.md` or AGENTS.md win over the generic guide. If a repo requires TDD, the skill works red-green.
- **No copying bad tests.** `init` marks tests that mock storage or check internal calls, so the agent does not copy them. Existing code works as a prompt.
- **Superpowers sets the cycle.** Its `test-driven-development` skill decides when to write tests. `longevo-testing` decides which tests and how they look.

## The bar

After about two months, Primo reported +25% integration tests, −70% tests with mocks, 0 tests with mocked storage and −54% review comments like "this test is wrong". We measure our version with the same numbers.

## Sources

- [Primo: how we stopped AI slop from ruining our tests](https://www.primo.la/blog/como-evitamos-que-el-ai-slop-arruine-nuestros-tests) (Spanish)
- [primo-devs/public-skills](https://github.com/primo-devs/public-skills)
- [Change-detector tests considered harmful](https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html)
