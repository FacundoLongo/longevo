# Longevo

Agent skills for better tests and docs that stay true to the code. The repo is in the design phase: there is no code yet.

## Where things are

- `docs/README.md`: the map of all docs and the rules for adding one. Read it before you create or change a doc.
- `docs/design/`: how Longevo works. Read the matching file before you propose a change.
- `docs/roadmap.md`: the four steps and the open decisions. Do not build anything that belongs to a later step.
- `docs/decisions/`: decisions grouped by area, with an index in its README. Add a new decision to its area file. Never edit an accepted decision; add a new one that supersedes it.

## Rules

- Write every repo file in plain English.
- Commit messages: start with an imperative verb, 15 words or fewer, no prefix like `feat:`, no co-author trailers.
- Group related changes in one commit. Avoid many small commits.
- Add one line to `CHANGELOG.md` under Unreleased for each change that people who use Longevo will notice. No marketing words, no emojis.
- Keep docs short: under 100 lines when possible, and never over 150.
