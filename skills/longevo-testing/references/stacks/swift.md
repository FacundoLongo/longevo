# Swift

Mechanics for Swift repos. Read `../guidelines.md` first.

## Runner

Swift Testing (`@Test`) or XCTest. SwiftPM: `swift test --filter OrderTests/createsOrder`. Xcode: `xcodebuild test -scheme App -only-testing:AppTests/OrderTests/testCreatesOrder`.

## Real storage

- **SwiftData:** a real `ModelContainer` with `ModelConfiguration(isStoredInMemoryOnly: true)`.
- **Core Data:** the real model with an in-memory store (`NSInMemoryStoreType`, or a store URL at `/dev/null`).
- **GRDB:** an in-memory `DatabaseQueue` with the real migrations.

## External services

Stub the network with a custom `URLProtocol` registered on a test `URLSession`. Use protocol-based fakes only for clients of external systems; never fake the project's own stores.

## Time

Inject a clock or a `now` closure. Wait with `confirmation` (Swift Testing) or expectations (XCTest); never `sleep`.

## Files

A test target per module (`AppTests`), files named `*Tests.swift`.
