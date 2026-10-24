---
covers: ["src/lib/agents.mjs", "src/lib/instructions.mjs", ".claude-plugin/**", ".codex-plugin/**", ".cursor-plugin/**", "gemini-extension.json"]
verified: 2026-10-23T21:24:20
---

# Agents

How each agent loads Longevo. The skills use the Agent Skills format, so the same files work everywhere ([D1](../decisions/packaging.md)).

| Agent | Skills folders (home · repo) | How you run a skill | Instruction files it reads |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/skills` · `.claude/skills` | `/longevo-init`, or `/longevo:longevo-init` from the plugin ([D13](../decisions/packaging.md)) | CLAUDE.md. AGENTS.md only when there is no CLAUDE.md; otherwise CLAUDE.md needs `@AGENTS.md`, or the two must be one file (either one a link to the other) |
| Codex | `~/.agents/skills` · `.agents/skills` | `$longevo-init` | AGENTS.md, up to 32 KiB in total |
| Cursor | `~/.cursor/skills`, `~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills` · the same in the repo | `/longevo-init` | AGENTS.md and `.cursor/rules/*.mdc` |
| Gemini CLI | `~/.gemini/skills`, `~/.agents/skills` · the same in the repo | `/skills` | GEMINI.md. AGENTS.md only if `context.fileName` in `.gemini/settings.json` lists it |
| Copilot CLI | `~/.copilot/skills`, `~/.agents/skills` · `.github/skills`, `.agents/skills`, `.claude/skills` | `/longevo-init` | Copilot instructions, AGENTS.md, CLAUDE.md and GEMINI.md |

We checked this table against each agent's official docs on 2026-10-11. `longevo-init` uses the same facts to say which agent misses which rule.

## Notes

- **Names start with `longevo-`** because most agents keep all skills in one namespace, and Claude Code already has `/init` and `/review` ([D2](../decisions/packaging.md)).
- **Install:** see [getting started](../guides/getting-started.md#install).
- **MCP is what changes between agents.** External sources work only where MCP servers are set up. What comes in stays in the repo, so every agent can use it.
- **One folder does not reach all five.** `.agents/skills` reaches Codex, Cursor, Gemini CLI and Copilot, but not Claude Code. A repo skill needs a copy in `.claude/skills` too.
- **Gemini CLI ignores `.gemini/settings.json`** in folders you have not trusted.
- **Cloud agents** do not see your home folder. The skills can be copied into the repo, in `.agents/skills` and `.claude/skills`.

## Sources

- [Codex: Agent Skills](https://developers.openai.com/codex/skills) · [Claude Code: skills](https://code.claude.com/docs/en/skills.md) · [Claude Code: memory](https://code.claude.com/docs/en/memory.md)
- [Cursor: skills](https://cursor.com/docs/context/skills) · [Gemini CLI: skills](https://geminicli.com/docs/cli/skills/) · [VS Code: Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills)
- [Cursor: rules](https://cursor.com/docs/context/rules) · [Gemini CLI: configuration](https://geminicli.com/docs/reference/configuration/) · [Gemini CLI: trusted folders](https://geminicli.com/docs/cli/trusted-folders/)
- [Copilot CLI: custom instructions](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions) · [Copilot CLI: command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)
- [Agent Skills specification](https://agentskills.io/specification)
