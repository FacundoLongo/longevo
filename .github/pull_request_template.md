<!--
The PR title becomes the commit message (we squash merge).
Plain English, starts with a verb, 15 words or fewer, no prefix.
Example: Add drift check for docs with missing covers
-->

## What and why

<!-- One or two sentences: what changes for people who use Longevo, and the problem it solves. Link the issue if there is one: Closes #123 -->

## Changes

<!-- The specific changes, one per line. -->

-

## Type of change

- [ ] Skill (new or changed behavior)
- [ ] Fix
- [ ] Script
- [ ] Docs or design
- [ ] Packaging or install
- [ ] Repo setup (CI, templates)

## How to check it

<!--
Steps a reviewer can follow. For example:
1. Run /longevo-init in a repo that has both AGENTS.md and CLAUDE.md.
2. Check that the report flags the missing @AGENTS.md line.
Then say what you already ran yourself.
-->

1.

## Output

<!-- Optional. For skill changes, paste the report, or the generated tests before and after. Delete this section if it does not apply. -->

## Checklist

- [ ] The title follows the commit rules in [CONTRIBUTING.md](https://github.com/FacundoLongo/longevo/blob/main/CONTRIBUTING.md).
- [ ] I reviewed my own diff.
- [ ] Skill changes were tried on a real repo, and evals pass where they exist.
- [ ] Skills still ask before they write anything.
- [ ] `CHANGELOG.md` has a line under Unreleased, if people who use Longevo will notice the change.
- [ ] Docs are updated, and a design change has a decision in `docs/decisions/`.
- [ ] No secrets, tokens or personal paths.
