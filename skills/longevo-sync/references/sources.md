# External sources

Business rules often live in Notion, Confluence, Jira or Linear. Longevo reads them and never writes to them (D3). Links live only in the repo: in each doc's `sources` and in `docs/sources.md`.

## Reading a source

| Link | How to read it |
| --- | --- |
| `notion.so`, `notion.site` | A Notion MCP tool that fetches a page |
| `atlassian.net/wiki` | A Confluence MCP tool |
| `atlassian.net/browse`, Jira keys | A Jira MCP tool |
| `linear.app` | A Linear MCP tool that gets an issue or a document |
| `github.com/.../issues/N` | `gh issue view N --repo <owner/repo> --json title,body,comments` |

Use only read tools. If the agent has no tool for a source, do not guess what it says: list it under "Not checked", with the server it would need. The sync report's `mcp` lists the servers set up on this machine, by name.

## Comparing

1. Read the page. List the rules in it that the code can confirm or break.
2. For each rule in the repo that cites this source, compare.
3. All match: propose a new `checked` date for that source in each doc that cites it.
4. Something differs: show the source text, the rule and the code line, and ask which one is right. Then propose the rule diff.
5. A rule on the page that the repo does not have: propose it with status `missing` if no code implements it.

## New sources

When a doc or a brief links to a page that is not in any `sources`, ask: "Is <link> a source for <doc>? [Yes / No]". If yes, propose adding it to that doc's `sources` with today's date.
