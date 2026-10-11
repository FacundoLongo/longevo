# Ruby

Mechanics for Ruby repos. Read `../guidelines.md` first.

## Runner

RSpec: `bundle exec rspec spec/models/order_spec.rb:42`. Minitest in Rails: `bin/rails test test/models/order_test.rb:42`.

## Real storage

- **Rails:** the test database with transactional tests (`use_transactional_fixtures` in RSpec, the default in Minitest). Prefer request specs or integration tests over controller specs.
- Build data with FactoryBot or fixtures, through the same models production uses.
- **Without Rails:** run against a real test database and wrap each example in a transaction (DatabaseCleaner with the transaction strategy).

## External services

WebMock to block and stub HTTP, VCR to record real responses. Use `instance_double` only for clients of external systems; never stub the project's models or repositories with `allow(...).to receive`.

## Time

`travel_to` and `freeze_time` (ActiveSupport::Testing::TimeHelpers) or Timecop. Never `sleep` to wait.

## Files

`spec/` with `*_spec.rb`, or `test/` with `*_test.rb`.
