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
