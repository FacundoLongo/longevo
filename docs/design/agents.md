# Agents

How each agent loads Longevo. The skills use the Agent Skills format, so the same files work everywhere ([D1](../decisions/packaging.md)).

| Agent | Skills folder | How you run a skill | Reads AGENTS.md |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/skills` | `/longevo-init` | Yes, if there is no CLAUDE.md. If there is, CLAUDE.md needs `@AGENTS.md` |
| Codex | `~/.agents/skills` | `$longevo-init` | Yes, up to 32 KiB in total |
| Cursor | `~/.agents/skills` or `~/.cursor/skills` | `/longevo-init` | Yes |
| Gemini CLI | `~/.gemini/skills` or `~/.agents/skills` | `/skills` | Only if you set it in the config |
| GitHub Copilot | `~/.copilot/skills` or `~/.agents/skills` | `/longevo-init` | Yes |

The Cursor, Gemini CLI and Copilot rows come from search results and secondary sources. We will confirm them with the first release.

## Notes

- **Names start with `longevo-`** because most agents keep all skills in one namespace, and Claude Code already has `/init` and `/review` ([D2](../decisions/packaging.md)).
- **Install:** see the [README](../../README.md#install).
- **MCP is what changes between agents.** External sources work only where MCP servers are set up. What comes in stays in the repo, so every agent can use it.
- **Cloud agents** do not see your home folder. The skills can be copied into the repo, in `.agents/skills` and `.claude/skills`.

## Sources

- [Codex: Agent Skills](https://developers.openai.com/codex/skills) · [Claude Code: skills](https://code.claude.com/docs/en/skills.md) · [Claude Code: memory](https://code.claude.com/docs/en/memory.md)
- [Cursor: skills](https://cursor.com/docs/context/skills) · [Gemini CLI: skills](https://geminicli.com/docs/cli/skills/) · [VS Code: Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills)
- [Agent Skills specification](https://agentskills.io/specification)
