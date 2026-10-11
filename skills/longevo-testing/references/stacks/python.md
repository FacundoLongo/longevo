# Python

Mechanics for Python repos. Read `../guidelines.md` first.

## Runner

pytest is the default: `pytest path/to/test_orders.py::test_creates_order`, or `pytest -k "creates_order"`. Plain unittest: `python -m unittest path.to.TestCase.test_name`. Django: `python manage.py test app.tests.OrderTests.test_creates_order`.

## Real storage

- **Postgres:** `testcontainers` (`from testcontainers.postgres import PostgresContainer`) or `pytest-postgresql`. Create the schema once per session in a fixture, and run each test in a transaction that rolls back.
- **SQLAlchemy:** bind the session to a connection with an open transaction per test, and roll it back after the test.
- **Django:** `TestCase` already runs each test in a transaction on a real test database. Use `TransactionTestCase` only when the code under test needs real commits.
- **SQLite:** an in-memory database with the real migrations, only if production also uses SQLite.

## External services

Mock HTTP at the transport: `responses` for `requests`, `respx` or `pytest-httpx` for `httpx`. Use `unittest.mock.patch` only for clients of external systems, never for the project's repositories, sessions or services.

## Time

Use `time-machine` or `freezegun`, or inject a clock. Never `time.sleep` to wait.

## Files

`tests/` mirroring the package, files named `test_*.py`. Shared fixtures go in `conftest.py`.
