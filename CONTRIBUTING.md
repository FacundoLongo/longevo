# Contributing

Longevo 0.1 is a preview. Questions and ideas are welcome as issues. Read the [docs](docs/README.md) first.

## Working on the code

- You need Node 18 or newer. There are no dependencies to install.
- Run `npm test` and `npm run validate` before you open a pull request.
- A new skill goes in `skills/longevo-<name>/`, with a short `SKILL.md` and the details in `references/`. The validator checks the name, the size and the links.
- Keep the version in `package.json` and in every manifest the same. A test checks it.

## Evals

Each skill has eval cases in `evals/`. A case gives an agent a small repo, a task and graders, and runs it with and without Longevo, so the report shows what the skill adds. They are the gate of each roadmap step.

```bash
claude plugin eval . --scaffold --allow-tools Bash Write Edit --runs 1 --no-publish
```

They run real agents on your account, so they cost tokens; add `--max-cost-usd 5` to set a limit. Results go to `evals/results/`, which git ignores. Change a skill only if its evals still pass, and add a case when you add a behavior.

## Commit messages

- Write in plain English.
- Start with a verb in the imperative: Add, Fix, Remove, Update, Rename, Move.
- Use 15 words or fewer.
- Do not use prefixes like `feat:` or `fix(scope):`.
- Do not add co-author trailers for tools or AI assistants.

Examples:

```
Add drift check for docs with missing covers
Fix init when AGENTS.md has no Longevo block
Remove unused option from the scan script
```

Pull requests are squash merged, so the PR title becomes the commit message. PR titles follow the same rules.

## Changelog

When a change is visible to people who use Longevo, add one line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md).

- One line per change.
- Say what changed in concrete words: "Add `--full` flag to init", not "Improve the init experience".
- No marketing words: robust, seamless, powerful, comprehensive, enhance, leverage.
- No emojis.
- Skip internal refactors that nobody notices when using Longevo.

## Docs and design changes

- Large changes start as an issue.
- An accepted design decision goes into its area file in [docs/decisions/](docs/decisions/README.md). Accepted decisions are not edited: a new decision replaces the old one.
- Before you add a new doc, read [docs/README.md](docs/README.md). It says where each kind of doc goes and how long it can be.
