# PHP

Mechanics for PHP repos. Read `../guidelines.md` first.

## Runner

PHPUnit or Pest. One test: `vendor/bin/phpunit --filter testCreatesOrder`, `php artisan test --filter=CreatesOrder` (Laravel) or `vendor/bin/pest --filter "creates an order"`.

## Real storage

- **Laravel:** feature tests with `RefreshDatabase` against a real test database, on the same engine as production (SQLite in memory only if production uses it).
- **Symfony:** `KernelTestCase` or `WebTestCase` with a test database. Reset it between tests, for example with DAMADoctrineTestBundle, which wraps each test in a transaction.

## External services

Laravel `Http::fake()`, Symfony `MockHttpClient` or Guzzle `MockHandler`. Use `createMock` only for clients of external systems; never for the project's repositories, entity manager or services.

## Time

`Carbon::setTestNow()` or `$this->travelTo()` in Laravel, an injected `ClockInterface` in Symfony. Never `sleep` to wait.

## Files

`tests/Feature` and `tests/Unit`, classes named `*Test`.
