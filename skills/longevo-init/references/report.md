# Report

Use this structure for a full review. Skip a section that has nothing to say.

## 1. Summary

Two or three sentences on where the folder stands, then the three actions with the most value.

## 2. Who loads what

| Agent | Files it loads | Notes |
| --- | --- | --- |
| Claude Code | from `instructions.loads.claude-code` | size, import of AGENTS.md |
| Codex | from `instructions.loads.codex` | total bytes against 32 KiB |
| Cursor | from `instructions.loads.cursor` | |
| Gemini CLI | from `instructions.loads.gemini` | reads AGENTS.md only if configured |
| Copilot | from `instructions.loads.copilot` | |

## 3. Findings

One row per finding, most severe first: severity, what is wrong, evidence (`file:line`). Under the table, one proposed diff per fix:

```diff
- Read AGENTS.md for the rules.
+ @AGENTS.md
```

## 4. Commands

| Command in the instructions | Exists | Where |
| --- | --- | --- |

Add the real test command from `commands.real` when the instructions miss it.

## 5. Tests

Tests by area from `tests.byArea`, and the anti-golden tests you confirmed, with the reason.

## 6. Questions

Only what the code cannot answer, one at a time.

## 7. Not checked

What the script or you could not check (including the folders in `notScanned`), and the command used, so the user can repeat it.
