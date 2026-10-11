# Command decisions

How Longevo commands ask before they write, and who writes each change.

## D7. Pick changes from a numbered list; a script writes the structured ones

Status: Accepted · 2026-10-11

**Context.** From step 2, `init` writes files. One question per change is slow when a repo needs six changes. An agent that edits files by hand can duplicate the block, edit outside it or break frontmatter, and each agent does it in its own way.

**Options.** One question per change · A numbered list and one question · The model writes everything · A script writes everything · A script for structured changes and the model for prose

**Decision.** Each run ends with a numbered list of changes with their diffs and one question: which ones do I apply. The engine (`longevo.mjs apply`) writes the structured changes (the block, `@AGENTS.md`, the Gemini setting, frontmatter, `docs/coverage.md`). The model applies only the prose diffs it showed, like moving a rule between files.

**Consequences.**
- The same input gives the same files in every agent, and unit tests cover repeated runs and the block size limit.
- One question instead of many, and you still see every diff before it is written.
- More code to maintain in the skill's `scripts/`.
