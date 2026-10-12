# Roadmap

Longevo is built in four steps. Each step is useful on its own and has its own gate. Step 1 shipped in 0.1.0; steps 2 to 4 ship together in 0.2.0.

| Step | What is built | Gate |
| --- | --- | --- |
| 1. Review and tests | Read-only `init` and `longevo-testing` | Regenerated test suites are better than the originals, in one Go repo and one TypeScript repo |
| 2. Setup | `init` applies the changes you pick (AGENTS.md block, `@AGENTS.md`, rule moves, `docs/testing.md`, doc frontmatter) and generates `docs/coverage.md`; the scan adds workspaces, git hotspots, pre-commit hooks, MCP servers, installed skills and stale docs | No rule that one agent sees and another does not, and every stale-doc warning matches a real change |
| 3. Living docs | `sync` proposes fixes for stale docs, `docs/sources.md` and external sources through MCP | Every fix that `sync` proposes matches the code or the source |
| 4. Brief and review | `brief` and `review` | One real task from an issue tracker runs from start to end with fewer corrections |

If a gate fails, we fix that step and repeat it.

## Versions

The gate of each step runs as eval cases (`claude plugin eval`) in `evals/`. The eval sandbox has no MCP servers and no GitHub login, so the cases for steps 3 and 4 use local files for issues and source pages. Reading through MCP is checked by hand. The step 4 gate, fewer corrections on a real task, is measured in real use, like step 1.

| Version | Ships when |
| --- | --- |
| 0.1.0 | Step 1 passes its gate and the install works from GitHub |
| 0.2.0 | Steps 2, 3 and 4 pass their eval gates |
| 1.0.0 | All four gates pass on real repos, the install is verified in the five agents, `docs/guides/` covers all five agents and every skill has eval cases |

## How we measure step 1

We use Primo's method:

1. Pick one test suite of each kind: integration, unit with storage and pure unit.
2. Delete it and ask the agent to write it again with `longevo-testing`.
3. Compare with the original: test type, mocks, length and cases covered.
4. Fix the skill and repeat until the result is better than the original.
5. Then track real work for 2 to 4 weeks: integration tests, tests with mocks, tests with mocked storage (goal: 0) and tests you had to fix.

## Open decisions

| Decision | Options | We lean to |
| --- | --- | --- |
| Deterministic checks | Our own script, or an existing linter (ctxlint, agnix) | Our own small script. No linter checks `covers`, rules or sources |
| `owner` field in frontmatter | Required, optional or removed | Optional. Teams need it, solo users do not |
| Session-start hook | On by default, or optional | Optional, until the 10-line summary proves useful |

To discuss any of them, open an issue.
