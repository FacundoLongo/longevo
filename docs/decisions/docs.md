# Docs decisions

How Longevo links docs to code and to external sources.

## D3. Keep links to external sources only in the repo

Status: Accepted · 2026-10-11

**Context.** Business rules live in Notion, Confluence, Jira and Linear. Longevo links them to docs and code. The link could also be written back to the external tool, for example as a comment on a Linear issue.

**Options.** Links only in the repo · Links in both places, with approval each time · Links in both places, written automatically

**Decision.** Links live only in the repo: in the `sources` field of each doc and in `docs/sources.md`. Longevo never writes to Notion, Confluence, Jira or Linear.

**Consequences.**
- No risk of posting in tools that other people read.
- People who only use the external tool do not see the link to the code.
- Longevo needs read access to MCP servers, never write access.

## D4. Anchor drift checks to the commit that changed `verified`

Status: Accepted · 2026-10-11

**Context.** A living doc lists the code it covers in `covers`, and Longevo must know if that code changed after the last check. A stored commit SHA fails twice: a commit cannot contain its own SHA, and squash merges remove SHAs.

**Options.** Store the SHA of the last check · Use the last commit that changed the doc file · Store a date in `verified` and use the last commit that changed that line

**Decision.** Store `verified: YYYY-MM-DD`. The anchor is `git log -1 -G'^verified:' -- <doc>`, and the changed files are `git diff --name-only <anchor>..HEAD -- ':(glob)<pattern>'` for each pattern in `covers`.

**Consequences.**
- It works after squash and rebase merges, and a typo fix in the doc does not reset the check.
- If the doc and the code change in the same commit, the doc is not marked as stale.
- We tested these cases in a test repo, and all of them worked.

## D6. Keep a generated coverage record in the repo

Status: Superseded by D8

**Context.** People want to know what is tested and where, and which code has a doc. The gap report is generated on demand and is not kept.

**Options.** Only on-demand reports · A generated file in the repo · A file outside the repo

**Decision.** `init` and `sync` generate `docs/coverage.md` with three short tables by area: rules and their tests, tests by type, and code with or without a current doc. Nobody edits it by hand. Each brief also keeps the testing skill's tables, so the history of what was tested stays with the change.

**Consequences.**
- Any agent can read the current state without running anything.
- The file changes on every sync, so its diffs must stay small.
- It is built in step 2.

## D8. Store dates, not stale status, in the coverage record

Status: Accepted · 2026-10-11

**Context.** D6 asked `docs/coverage.md` to show code with or without a current doc. Whether a doc is current changes with every commit to its `covers`, so storing it would change the file all the time. Stale detection also moves from step 3 to step 2.

**Options.** Store the stale status · Store the `verified` date and show stale docs on each run

**Decision.** `init`, and `sync` from step 3, generate `docs/coverage.md` with three tables by area: tests by kind, docs with their `verified` date, and rules when there are any. It has no timestamps. The scan finds stale docs on each run, and `init` shows them in the session update. Each brief still keeps the testing skill's tables.

**Consequences.**
- The file changes only when tests or docs change, so its diffs stay small.
- To know which docs are stale, you run `init`.

## D9. Keep Longevo's docs in `docs/` and its state in `.git`

Status: Accepted · 2026-10-11

**Context.** Longevo writes docs, a coverage record and some state, like the date of the last session and the changes you declined. They could live in the repo's `docs/`, in a `.longevo/` folder, or with a `.longevo.json` config file.

**Options.** `docs/` and `.git/longevo/` · A `.longevo/` folder · `docs/` plus a `.longevo.json` config

**Decision.** Docs go in `docs/`, where people and agents look first. State for each machine goes in `.git/longevo/`, so it is never committed. Generated and vendored code is read from `linguist-generated` and `linguist-vendored` in `.gitattributes`. No config file until a real setting needs one.

**Consequences.**
- No hidden folder and no extra files in pull requests.
- A new clone asks again about changes you declined in another clone.
