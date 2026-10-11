# Rust

Mechanics for Rust repos. Read `../guidelines.md` first.

## Runner

`cargo test`. One test: `cargo test creates_order`. One integration test file: `cargo test --test orders`.

## Real storage

- **sqlx:** `#[sqlx::test]` gives each test its own database with the migrations applied.
- **Otherwise:** `testcontainers` with `testcontainers-modules` for Postgres, and a connection pool per test.
- Tests that cross modules go in `tests/`; they use only the public API, as callers do.

## External services

`wiremock` or `httpmock` for HTTP. Use `mockall` only for traits that wrap external systems; never mock the project's own repositories when a real database is available.

## Time

Pass a clock (a trait or a `now` argument) instead of calling `SystemTime::now()` deep inside the code. With Tokio, `tokio::time::pause()` controls timers. Never `thread::sleep` to wait.

## Files

Unit tests in a `#[cfg(test)] mod tests` next to the code; integration tests in `tests/*.rs`.
