# Testing decisions

How Longevo helps agents write tests.

## D5. Base the testing skill on Primo's skill

Status: Accepted · 2026-10-11

**Context.** Agents write many tests with mocks that do not catch bugs. Primo published a testing skill under the MIT license. In about two months it cut tests with mocks by 70% and "this test is wrong" review comments by 54%. It was written for a Go and Postgres monolith.

**Options.** Write a testing skill from zero · Fork Primo's skill and make it work for more stacks · Point to Primo's skill and not ship one

**Decision.** Fork Primo's skill. Keep the workflow and the guidelines, move the Go details to a reference file and add one reference per stack. Each repo keeps its golden list and test command in `docs/testing.md`.

**Consequences.**
- We start from a skill with measured results.
- We keep Primo's copyright notice next to the skill.
- Each new stack needs its own reference and its own validation.
