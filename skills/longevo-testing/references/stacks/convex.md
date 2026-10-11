# Convex

Mechanics for Convex backends. Read `../guidelines.md` and `typescript.md` first.

## Runner

Vitest with `convex-test`: `npx vitest run convex/orders.test.ts -t "creates an order"`. Use the `edge-runtime` test environment, as the convex-test docs say.

## Real storage

`convexTest(schema, modules)` runs the project's real queries, mutations and actions against an in-memory backend that enforces the real schema. For these tests it is the real storage: call functions with `t.query`, `t.mutation` and `t.action`, and seed or inspect data with `t.run`.

## External services

In actions, stub `fetch` (for example with `vi.stubGlobal`) or the client module the project wrote. Never mock `ctx.db`.

## Time

Use `vi.useFakeTimers()`, and run scheduled functions with `t.finishAllScheduledFunctions(vi.runAllTimers)`.

## Files

Next to the functions in `convex/`, named `*.test.ts`.
