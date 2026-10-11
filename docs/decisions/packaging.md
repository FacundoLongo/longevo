# Packaging decisions

How Longevo is packaged and named for each agent.

## D1. Use the Agent Skills format

Status: Accepted · 2026-10-11

**Context.** Longevo must work in Claude Code, Codex, Cursor, Gemini CLI and GitHub Copilot. Each agent loads instructions in its own way, but all of them read skills in the Agent Skills format: a folder with a `SKILL.md` and optional `references/` and `scripts/`.

**Options.** Agent Skills, one copy for every agent · A plugin or extension per agent · An MCP server

**Decision.** Use the Agent Skills format. Each skill has a short `SKILL.md` and keeps the details in `references/`. Plugin manifests and hooks only package the same skills.

**Consequences.**
- One source for every agent.
- MCP servers stay optional. Longevo reads external sources through them, but does not need one to run.
- Hooks work differently in each agent, so nothing important depends on them.

## D2. Prefix every skill with `longevo-`

Status: Accepted · 2026-10-11

**Context.** Codex, Cursor and Gemini CLI keep all skills in one namespace. Claude Code already has `/init` and `/review`, so short names would collide.

**Options.** `longevo-`, for example `/longevo-init` · `longo-`, shorter · No prefix

**Decision.** Use `longevo-`. It is the project name, so there is no second name to explain.

**Consequences.**
- Commands take longer to type.
- In a Claude Code plugin, the plugin name adds a second prefix, like `/longevo:longevo-init`. We must solve this when we package the plugin.

## D10. Give each skill its own copy of the shared scripts

Status: Accepted · 2026-10-11

**Context.** `init`, `sync`, `brief` and `review` share code to read git, files and frontmatter. `npx skills add -s` can install a single skill, and a skill cannot count on another skill's folder being next to it.

**Options.** Import from `../longevo-init` · One source in the repo, copied into each skill · A separate npm package

**Decision.** The shared code has one source in the repo, and a script copies it into each skill's `scripts/lib/`. A test fails if a copy differs from the source.

**Consequences.**
- Each skill works on its own, with no install step and no dependencies.
- The same files appear in several skills. Contributors run the copy script after they change the source.
