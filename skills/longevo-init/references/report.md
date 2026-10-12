# Report

Use this structure for a setup or an audit. Skip a section that has nothing to say.

## 1. Summary

Two or three sentences on where the folder stands, then the three actions with the most value.

## 2. Who loads what

| Agent | In use | Files it loads | Notes |
| --- | --- | --- | --- |
| Claude Code | from `agents.inUse` | from `instructions.loads.claude-code` | import of AGENTS.md |
| Codex | | from `instructions.loads.codex` | total bytes against 32 KiB |
| Cursor | | from `instructions.loads.cursor` | |
| Gemini CLI | | from `instructions.loads.gemini` | reads AGENTS.md only with `context.fileName` |
| Copilot | | from `instructions.loads.copilot` | |

## 3. Findings

One row per finding, most severe first: severity, what is wrong, evidence (`file:line`).

## 4. Commands

| Command in the instructions | Exists | Where |
| --- | --- | --- |

`Where` is the `where` list of each command in `commands.cited`: the package.json, Makefile or justfile that defines it.

Add the real test command from `commands.real` (scripts, targets, CI and hooks) when the instructions miss it.

## 5. Tests and docs

Tests by area and kind from `tests`, the anti-golden tests you confirmed with the reason, living docs from `docs.living` with their `verified` date, and the stale ones.

## 6. Agent setup

MCP servers by name and where they are set (`agents.mcp`), repo skills that some agents miss, and overlapping skills. Name the home files you read (`home.read`).

## 7. Changes

The numbered list from SKILL.md section 5, each with its diff, then the question. In an audit, leave this section out.

## 8. Not checked

What the script or you could not check (including the folders in `notScanned`), and the command used, so the user can repeat it.
