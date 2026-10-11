# .NET (C#)

Mechanics for .NET repos. Read `../guidelines.md` first.

## Runner

xUnit, NUnit or MSTest through `dotnet test`. One test: `dotnet test --filter "FullyQualifiedName~OrderServiceTests.CreatesOrder"`.

## Real storage

- **Testcontainers for .NET:** `Testcontainers.PostgreSql` or `Testcontainers.MsSql`.
- **ASP.NET Core:** `WebApplicationFactory<Program>` runs the real app; point its connection string at the container.
- **EF Core:** do not use the InMemory provider for relational behavior, because it skips constraints and transactions. Use the real database engine (SQLite in memory only if production uses SQLite).
- Isolate tests with a transaction per test, or reset tables with Respawn.

## External services

WireMock.Net, or a custom `HttpMessageHandler` for `HttpClient`. Use Moq or NSubstitute only for clients of external systems; never for the project's repositories, `DbContext` or services.

## Time

Inject `TimeProvider` (.NET 8 and newer) and use `FakeTimeProvider` in tests. Never `Thread.Sleep` or `Task.Delay` to wait.

## Files

A `*.Tests` project next to each project, classes named `*Tests`.
