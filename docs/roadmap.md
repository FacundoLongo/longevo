# Roadmap

Longevo is built in four steps. Each step is useful on its own, and each one must pass its gate on two real repos before the next one starts.

| Step | What is built | Gate |
| --- | --- | --- |
| 1. Review and tests | Read-only `init` and `longevo-testing` | Regenerated test suites are better than the originals, in one Go repo and one TypeScript repo |
| 2. Setup | `init` applies changes (AGENTS.md block, `docs/testing.md`, doc frontmatter) and generates `docs/coverage.md`; the scan adds git hotspots, workspaces, MCP servers, pre-commit hooks and installed skills | No rule that one agent sees and another does not |
| 3. Living docs | `sync`, the drift script and external sources through MCP | Every drift warning matches a real change |
| 4. Brief and review | `brief` and `review` | One real task from an issue tracker runs from start to end with fewer corrections |

If a gate fails, we fix that step and repeat it.

## Versions

Each step ships as a minor version. The gate of each step runs as eval cases (`claude plugin eval`) in `evals/`.

| Version | Ships when |
| --- | --- |
| 0.1.0 | Step 1 passes its gate and the install works from GitHub |
| 0.2.0 | Step 2 passes its gate |
| 0.3.0 | Step 3 passes its gate |
| 0.4.0 | Step 4 passes its gate |
| 1.0.0 | All four gates pass on real repos, the install is verified in the five agents, `docs/guides/` exists and every skill has eval cases |

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
| Where docs live in a user repo | The repo's `docs/` folder, or a `.longevo/` folder | `docs/`, so people and agents find them |
| Deterministic checks | Our own script, or an existing linter (ctxlint, agnix) | Our own small script. No linter checks `covers`, rules or sources |
| `owner` field in frontmatter | Required, optional or removed | Optional. Teams need it, solo users do not |
| Session-start hook | On by default, or optional | Optional, until the 10-line summary proves useful |
| Plugin and skill names | Plugin `longevo` with `longevo-*` skills, or another split | Decide when we package. See [D2](decisions/packaging.md) |

To discuss any of them, open an issue.
