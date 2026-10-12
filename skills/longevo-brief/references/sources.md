# Reading the task

Longevo reads trackers and never writes to them: no comments, no status changes, no labels, no links back (D3).

| Input | How to read it |
| --- | --- |
| Plain text | Use it as it is |
| `github.com/<owner>/<repo>/issues/<n>` or `#<n>` | `gh issue view <n> --repo <owner/repo> --json title,body,labels,comments` |
| `linear.app/...` | A Linear MCP tool that gets an issue |
| `atlassian.net/browse/<KEY>` or a Jira key | A Jira MCP tool that gets an issue |
| `atlassian.net/wiki/...` | A Confluence MCP tool that gets a page |
| `notion.so/...`, `notion.site/...` | A Notion MCP tool that fetches a page |

If `gh` is missing or not logged in, or the agent has no tool for that tracker, ask the user to paste the task. Do not guess what an issue says from its title or link.

Read comments too: they often hold the decisions. Note who decided what, with the date, in the Goal or under Rules that apply.

Put the link in the brief's `task` field. If the page holds business rules the repo does not have, suggest running `longevo-sync` afterwards to add it as a source of the matching doc.
