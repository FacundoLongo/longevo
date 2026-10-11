# Java and Kotlin

Mechanics for JVM repos. Read `../guidelines.md` first.

## Runner

JUnit 5. Gradle: `./gradlew test --tests 'com.acme.OrderServiceTest.createsOrder'`. Maven: `mvn -Dtest=OrderServiceTest#createsOrder test`.

## Real storage

- **Testcontainers:** `org.testcontainers:postgresql`, with `@Testcontainers` and `@Container` from `org.testcontainers:junit-jupiter`. With Spring Boot 3.1 or newer, `@ServiceConnection` wires the container into the app.
- **Spring:** `@SpringBootTest` for full integration tests. For repository behavior, `@DataJpaTest` with `@AutoConfigureTestDatabase(replace = NONE)` so it uses the container, not an embedded database.
- Isolate tests with `@Transactional` rollback, or clean the tables between tests.

## External services

WireMock or OkHttp `MockWebServer` for HTTP. Use Mockito (Java) or MockK (Kotlin) only for clients of external systems; never `@MockBean` a repository or a service the project owns.

## Time

Inject `java.time.Clock` and use `Clock.fixed(...)` in tests. Never `Thread.sleep` to wait; use Awaitility to wait for a condition.

## Files

`src/test/java` or `src/test/kotlin`, classes named `*Test`. Name slow integration tests `*IT` if the build runs them separately (Maven Failsafe).
