# Elixir

Mechanics for Elixir repos. Read `../guidelines.md` first.

## Runner

ExUnit: `mix test test/orders_test.exs:42`.

## Real storage

Ecto with `Ecto.Adapters.SQL.Sandbox`: each test checks out a connection to the real database inside a transaction that rolls back, so tests can run with `async: true`. Phoenix's `DataCase` and `ConnCase` set this up.

## External services

Bypass for HTTP. Use Mox only for behaviours that wrap external systems; never mock `Repo` or the project's contexts.

## Time

Pass the time as an argument or inject a clock module. Never `Process.sleep` to wait; use `assert_receive` with a timeout.

## Files

`test/` mirroring `lib/`, files named `*_test.exs`.
