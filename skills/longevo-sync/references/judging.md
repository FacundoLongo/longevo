# Judging a stale doc

A doc is stale when code in its `covers` changed after its `verified` date. Stale does not mean wrong. Decide which of these it is, with evidence.

## Steps

1. Read the doc. List each claim it makes about the code: values, limits, names, flows, commands.
2. Read `diff` and `commits` from the sync report. If `truncated` is true, open the changed files it lists.
3. For each claim, find the code line that confirms or breaks it. Write it down as `file:line`.
4. Pick one outcome:

| Outcome | When | What you propose |
| --- | --- | --- |
| Still true | Every claim still holds; the change was a refactor, a rename or something the doc does not mention | Only `verify` |
| Partly wrong | Some claims changed and the code makes clear which is right | The smallest text diff, plus `verify` |
| Disagree | The code and the doc say different things, and nothing in the code or the commit says which is intended | A question: "Which one is right? [The code / The doc]" |
| Code is wrong | A rule with a source, a test or a decision says the code should not do this | No doc change. Say so, and suggest `/longevo-brief` |

## Examples

- `docs/domain/refunds.md` says "a refund expires after 48 hours". The diff changes `REFUND_HOURS = 48` to `72`, and the commit says "Extend the refund window to 72 hours". The code settles it: propose "72 hours" and `verify`.
- The diff renames a local variable and keeps the value. The doc is still true: propose only `verify`.
- The doc says "admins can delete invoices", and the diff removes the delete route with the message "Remove unused route". The intent is unclear: ask.

## Do not

- Rewrite a doc that is still true, or change its style.
- Add claims the doc did not make, like a new overview.
- Change code to match the doc.
