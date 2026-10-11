# TypeScript and JavaScript

Mechanics for TypeScript and JavaScript repos. Read `../guidelines.md` first.

## Runner

Use the runner the repo already has. Focused runs:

- Vitest: `npx vitest run path/to/file.test.ts -t "name"`
- Jest: `npx jest path/to/file.test.ts -t "name"`
- Node: `node --test path/to/file.test.mjs`
- Bun: `bun test path/to/file.test.ts`

## Real storage

- **Postgres:** start it with Testcontainers (`@testcontainers/postgresql`) or use a test database the repo already provides. Create the schema once per run (global setup), and isolate each test with a transaction that rolls back or with a truncate.
- **SQLite:** use an in-memory database with the real schema and migrations.
- **ORMs** (Prisma, Drizzle, Kysely, TypeORM): point the client at the test database. Never mock the client.

## External services

Mock at the network boundary with MSW or nock, or mock the whole client module the project wrote around the SDK. Never mock internals of the project's own modules.

## UI

- Use Testing Library. Query by role and visible text, and assert what the user sees.
- Avoid snapshots of whole components.
- Test a hook through a component that uses it, unless the hook is a library on its own.

## Mocks and time

- `vi.mock` and `jest.mock` are for external clients only, never for the project's database, repositories or services.
- `toHaveBeenCalledWith` on the project's own modules is a change-detector smell.
- Use fake timers (`vi.useFakeTimers()`, `jest.useFakeTimers()`) or an injected clock. Never wait with `setTimeout`.

## Files

Follow the repo's layout. If there is none, put `name.test.ts` next to the code it tests.
