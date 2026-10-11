---
name: longevo-testing
description: "Plan and write tests that catch real bugs. Use when: (1) the user asks to write, add or improve tests; (2) after a non-trivial change, to propose which tests add value before writing them; (3) the user asks for a regression test for a bug fix; (4) the user wants to know which tests a change needs."
---

# Writing tests

This skill decides *what* to test and turns that into a suite. It is based on Primo's testing skill (see [NOTICE.md](NOTICE.md)).

## Before you start

1. **Read the repo rules.** If `docs/testing.md` exists, read it. Its rules, test command, golden tests and anti-golden tests win over this skill. Rules about tests in AGENTS.md or CLAUDE.md also win over this skill.
2. **Read [references/guidelines.md](references/guidelines.md).** It defines what a good test looks like.
3. **Read the stack file** for the repo: [Go](references/stacks/go.md), [TypeScript and JavaScript](references/stacks/typescript.md), [Python](references/stacks/python.md), [Java and Kotlin](references/stacks/jvm.md), [.NET](references/stacks/dotnet.md), [Ruby](references/stacks/ruby.md), [PHP](references/stacks/php.md), [Rust](references/stacks/rust.md), [Swift](references/stacks/swift.md), [Elixir](references/stacks/elixir.md) or [Convex](references/stacks/convex.md). For any other stack, apply the guidelines and follow the repo's golden tests.
4. **TDD.** If the repo requires TDD, write each test first and watch it fail for the right reason before you write the code. Superpowers' `test-driven-development` skill sets that cycle; this skill decides which tests and how they look.

## 1. Read the code

- Read the code under test.
- Read the existing tests. Extend a suite before you create a new one.
- Existing tests are not a reference by default. Check any test you copy against the guidelines and the golden list.

## 2. Plan what to test

Split the inputs and states into classes the code treats the same way (equivalence classes):

- **Happy paths:** which kinds of input are supported? A list of 2 items and a list of 3 items are usually one class: "more than one item".
- **Failures:** scan [references/failure-modes.md](references/failure-modes.md) and pick the input or state that triggers each relevant failure.
- **Business rules:** if a rule in `docs/domain/` has WHEN/THEN scenarios, each scenario is at least one class.

Start from the contract (what should happen for each kind of input), then read the implementation to refine the classes. Use the code to find cases, but assert only observable behavior. If one realistic edit could break input A but not input B, they are different classes.

For each test, write one sentence: **why does it earn its place?** Name the edit that would break it and why that edit is realistic. "Increases coverage" does not count. If you cannot write the sentence, drop the test. Also check that nothing already catches it, and that it tests the project's logic, not a library.

**Choose the kind of test.** Integration by default. A unit test needs a reason. Never mock storage.

**Build two lists before you write:**

| Test | Type | Why it earns its place (the edit that breaks it) |
| --- | --- | --- |
| Discount skips flagged items | Integration | If `applyDiscount()` stops excluding flagged items, this fails |

| Skip | Why |
| --- | --- |
| `isActive()` | One-line getter; callers' tests cover it |

**Red flags that the plan has too many tests:** tests of library behavior, vague reasons ("critical", "must work"), tests of one-liners, several tests for one failure mode, unit tests where an integration test would work.

**Look for reasons not to write each test.** Keep a test only if it protects observable behavior from a plausible regression that no other test catches. For large features, group tests by risk (happy path, validation, duplicates, external failures, authorization) with 1 to 3 tests each. More than about 8 tests means the skip list needs another look.

## 3. Write

- Copy the patterns of the golden tests. Never copy an anti-golden test.
- Test behavior, not implementation: a refactor that keeps behavior must not break the test.
- Follow the stack file for test doubles and mocks.
- Assert observable outcomes: return values, stored data, emitted events, responses.
- Avoid generated IDs in assertions, sleeps and order between tests.
- Write only the tests in your table. A new case goes into the table first, with its reason.

## 4. Run

Use the repo's test command (from `docs/testing.md`, the manifests or CI). Run the new tests first, then the full suite.

## 5. Break the code

For at least one new test, introduce the bug it should catch and confirm that it fails. Then undo the change. A test that always passes is worthless.

## 6. Check before you finish

- Every test you wrote is in the table, and every obvious skipped case has a reason.
- No anti-pattern from the guidelines is present.
- For each critical branch, you can name the test that fails if the branch is deleted.
- Edges are covered or skipped on purpose: empty, null, max, off by one.
- The focused command and the full suite passed.

## 7. Report

Show the two tables and the commands you ran, with their results. If the task has a brief in `docs/work/`, add the two tables to it under "Tests", so the repo keeps a record of what was tested and why.
