# Findings

How to report what the reviewer found, after you checked each finding against the code.

## Report

1. **Summary:** one or two sentences, then the number of findings by severity, and how many you dropped as wrong.
2. **Findings:** one table, most severe first.

| # | Severity | File | Finding | Evidence | What to do |
| --- | --- | --- | --- | --- | --- |
| 1 | high | `src/refunds/policy.ts:1` | The window is now 24 hours | R-REF-001 says 48 hours (`docs/domain/refunds.md:8`) | Ask which is right; if the rule changed, update it with `longevo-sync` |
| 2 | medium | `src/refunds/policy.test.ts:1` | The test mocks the store | `vi.mock('../db')`; the testing guide says to use the real database | Rewrite it with `longevo-testing` |

3. **Tests to write:** for `longevo-testing`, one line per behavior: what must happen, and which code edit the test must catch.
4. **Docs:** the docs in `docsToUpdate` and what changed under them.
5. **Not checked:** what the reviewer could not see, for example a diff that was cut, or files that git could not read.

## Kinds

| Kind | Severity | Comes from |
| --- | --- | --- |
| A rule broken or bent | high | Reviewer, with the rule id |
| An acceptance criterion or "must not change" item without a test | high | Reviewer, with the brief |
| A secret in an added line | high | Script (`security`), file and line only |
| A test that mocks storage or checks internal calls | medium | Script (`tests`) and reviewer |
| A doc that no longer matches the code | medium | Script (`docsToUpdate`) and reviewer |
| A bug at a boundary | medium or high | Reviewer |
| Clarity | low | Reviewer |

## Do not

- Report a finding you did not confirm in the code.
- Fix the code, rewrite the tests or change config.
- Repeat what a linter or the type checker already reports.
