# Personal Learning Quiz Bot — architecture

## Status and purpose

This document is the binding architecture guide for new implementation work.
Agents must read it before creating an implementation plan, adding production
code, or reviewing architecture-sensitive changes.

The former publish-bot implementation has been removed. The repository retains
only a minimal toolchain entrypoint until the first quiz-bot vertical slice.
Do not recreate or copy the removed prototype structure.

The goal is a small, testable personal application. Patterns are used only when
they protect a real boundary or business rule; this is not a request to build an
enterprise framework.

## Architectural style

Use Ports and Adapters, also known as Hexagonal Architecture:

```text
Telegram handlers ─┐
                   ├──> application use cases ──> domain model
MCP tools ─────────┘               │
                                   v
                            repository ports
                                   │
                                   v
                             SQLite adapters
```

Telegram and MCP are independent input adapters over the same application
layer. SQLite is an output adapter behind repository and transaction ports.

The expected dependency direction is:

```text
entrypoints ───────────┐
                      v
composition ──> adapters ──> application ──> domain
                      │
                      └──────> infrastructure
```

`composition` wires the graph and is the only area expected to know most
concrete implementations.

## Dependency rules

These rules are mandatory:

1. `domain` must not import Telegraf, MCP, SQLite, application, adapters, or
   infrastructure.
2. `application` may import the domain and application-owned port interfaces.
   It must not import Telegraf, MCP, SQLite, or concrete adapters.
3. `adapters` may import application ports, use cases, domain types, and their
   external libraries.
4. Telegram handlers and MCP tools must not execute SQL directly.
5. Telegram and MCP adapters must not call each other.
6. Infrastructure and adapter implementations are passed into application code;
   they are not located through global state or a service locator.
7. `composition` and `entrypoints` may import concrete implementations to build
   and start the application.
8. Transport errors must be mapped at adapter boundaries. Telegraf or MCP error
   types must not leak into the domain.
9. Circular imports and cross-layer barrel exports are not allowed.

## Core patterns

| Pattern | Required application |
| --- | --- |
| Ports and Adapters | Separate domain/application logic from Telegram, MCP, and SQLite |
| Command/Handler | Convert Telegram or MCP requests into a single application operation |
| Application Service / Use Case | Coordinate domain behavior, repositories, and transactions |
| Repository | Hide persistence and row mapping behind application-owned ports |
| Aggregate | Protect the consistency boundaries of `QuizSet` and `QuizAttempt` |
| Explicit State Machine | Enforce valid quiz-set and attempt lifecycle transitions |
| Strategy | Encapsulate answer evaluation, session selection, and review scheduling algorithms |
| Adapter | Translate transport and persistence interfaces into internal contracts |
| Middleware / Chain of Responsibility | Apply authentication, logging, validation, and error handling |
| Manual Dependency Injection | Assemble implementations in a visible composition root |
| Transaction Boundary | Make multi-write operations atomic |
| Idempotency | Make retries and duplicate callbacks safe |

### Command handlers and use cases

Transport handlers must remain thin. Their responsibilities are limited to:

1. parse and validate transport input;
2. call one application use case;
3. translate the result into a Telegram or MCP response.

Example flow:

```text
Telegram callback
  -> answer-question.handler
  -> AnswerQuestion use case
  -> QuizAttempt aggregate and repositories
  -> question.presenter
```

Application operations may be implemented as a focused class with `execute()`
or as a focused function. Do not add a generic command bus, mediator framework,
or base use-case class for the MVP.

The shared structural contracts live in `src/application/use-case.ts`:

- `Command<TPayload>` makes an application input readonly;
- `UseCase<TRequest, TResult>` defines the asynchronous `execute()` boundary.

Concrete command payload types remain beside their use case. The shared
contract does not register, dispatch, queue, or discover commands.

The removed `BaseCommand` hierarchy was a prototype transport abstraction, not
a domain model. New code must not recreate it without a new, concrete need.

### Application services

One use case should represent one user-meaningful operation, for example:

- `CreateQuizSet`;
- `AddQuestions`;
- `PublishQuizSet`;
- `StartQuizAttempt`;
- `AnswerQuestion`;
- `FinishQuizAttempt`;
- `GetQuizStatistics`.

Use cases own orchestration and transaction boundaries. Domain objects own
business invariants and state transitions. Adapters own protocol translation.

### Repositories

Repository interfaces belong to the application layer because they describe
what application code needs. Concrete SQLite repositories belong to the
persistence adapter.

Initial repository ports are expected to include:

- `QuizSetRepository`;
- `QuizAttemptRepository`;
- `ReviewRepository`.

Repositories return domain objects or explicit application read models, not raw
SQLite rows. They must not return Telegraf or MCP types.

Do not create a generic `Repository<TEntity, TId>` CRUD base. Each repository
port must expose the smallest domain-specific operations required by its use
cases. This avoids forcing statistics, review queues, and aggregates into an
artificial shared persistence interface.

### Aggregates, entities, and value objects

The initial aggregate boundaries are:

- `QuizSet`: questions, options, status, and publishing invariants;
- `QuizAttempt`: responses, current progress, score, and completion state.

`QuestionResponse` and `ReviewItem` are entities associated with those flows.
IDs, answers, scores, and review intervals may be represented as branded types
or small validated value objects when doing so prevents invalid state.

Do not create a class for every primitive. Prefer TypeScript discriminated
unions for the initial question types unless polymorphic behavior becomes
substantial.

### State machines

Lifecycle transitions must be explicit:

```text
QuizSet:     draft -> published -> archived
QuizAttempt: active -> paused -> completed
```

Invalid transitions must fail with typed domain or application errors. For the
MVP, use status values plus explicit transition functions. Do not create a
class-per-state hierarchy unless state-specific behavior later justifies it.

### Strategies and policies

Use Strategy-style functions for behavior that genuinely varies:

- answer evaluation by question type;
- full, mistakes-only, or weak-topic session selection;
- rule-based review intervals now and FSRS/SM-2 later;
- possible AI evaluation of open answers in a later phase.

In TypeScript, a typed function or a map of functions is preferred over many
small strategy classes.

### Middleware

The Telegram adapter should use an ordered middleware pipeline:

```text
error mapping
  -> privacy-safe logging
  -> Telegram allowlist
  -> session/context loading
  -> callback validation
  -> handler
```

MCP requires its own protocol and schema-validation boundary. MCP code must not
reuse Telegraf middleware or depend on Telegram context.

### Transactions and idempotency

The application service determines the transaction boundary; the SQLite
adapter performs the transaction. Batch question import and answer recording
must be atomic.

The shared `Transaction.run()` port is synchronous because `bun:sqlite`
transactions are synchronous. Do not start asynchronous work or cross an
`await` boundary inside its callback. The surrounding use case may still be
asynchronous.

Use the shared `Clock` and `IdGenerator` ports instead of reading the system
clock or generating IDs directly in application and domain behavior. Tests can
then provide deterministic implementations.

Idempotency is required for:

- duplicated or stale Telegram callbacks;
- retried MCP batches;
- repeated publish/archive operations;
- process retries after an uncertain response.

Use stable semantic IDs, uniqueness constraints, idempotency keys where needed,
and deterministic application behavior. Do not rely only on an in-memory flag.

### Validation layers

Validation happens at three complementary levels:

1. adapters validate protocol shape, callback payloads, MCP schemas, and size
   limits;
2. domain/application code validates business invariants and lifecycle rules;
3. SQLite constraints protect persisted integrity and uniqueness.

AI-generated content is untrusted even when it passes schema validation.

## Patterns reserved for later

Introduce these only after a concrete need appears:

- Observer or domain events, when one state change must trigger multiple
  independent reactions;
- Factory, when construction of question variants becomes genuinely complex;
- Specification or policy objects, when validation or selection rules need
  reusable composition;
- Facade, only if application use cases no longer provide a sufficiently simple
  boundary.

## Patterns and approaches to avoid in the MVP

- Singleton service locators or mutable global application state;
- CQRS or Event Sourcing;
- a generic command bus or mediator framework;
- microservices;
- class-per-question-type or class-per-state hierarchies;
- Abstract Factory or Builder without concrete construction complexity;
- deep inheritance and decorator chains;
- an event system for operations that are clearer as direct calls.

## Target folder structure

This is the target, not a request to create every directory immediately. Create
a directory when its development phase introduces the corresponding behavior.

```text
src/
├── domain/
│   ├── quiz-set/
│   │   ├── quiz-set.ts
│   │   ├── question.ts
│   │   └── quiz-set.errors.ts
│   ├── quiz-attempt/
│   │   ├── quiz-attempt.ts
│   │   ├── answer.ts
│   │   ├── score.ts
│   │   └── quiz-attempt.errors.ts
│   └── review/
│       ├── review-item.ts
│       └── review-schedule.ts
│
├── application/
│   ├── use-case.ts
│   ├── ports/
│   │   ├── repositories/
│   │   │   ├── quiz-set.repository.ts
│   │   │   ├── quiz-attempt.repository.ts
│   │   │   └── review.repository.ts
│   │   ├── clock.ts
│   │   ├── id-generator.ts
│   │   └── transaction.ts
│   └── use-cases/
│       ├── quiz-sets/
│       │   ├── create-quiz-set.ts
│       │   ├── add-questions.ts
│       │   ├── publish-quiz-set.ts
│       │   └── archive-quiz-set.ts
│       ├── attempts/
│       │   ├── start-quiz-attempt.ts
│       │   ├── resume-quiz-attempt.ts
│       │   ├── answer-question.ts
│       │   └── finish-quiz-attempt.ts
│       ├── statistics/
│       │   └── get-quiz-statistics.ts
│       └── review/
│           ├── get-mistakes-session.ts
│           └── get-weak-topic-session.ts
│
├── adapters/
│   ├── persistence/
│   │   └── sqlite/
│   │       ├── database.ts
│   │       ├── migrations/
│   │       │   ├── migration.ts
│   │       │   └── 001-initial-schema.ts
│   │       ├── repositories/
│   │       │   ├── sqlite-quiz-set.repository.ts
│   │       │   ├── sqlite-quiz-attempt.repository.ts
│   │       │   └── sqlite-review.repository.ts
│   │       └── sqlite-transaction.ts
│   ├── telegram/
│   │   ├── bot.ts
│   │   ├── middleware/
│   │   │   ├── allowlist.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   └── logging.middleware.ts
│   │   ├── handlers/
│   │   │   ├── start.handler.ts
│   │   │   ├── quiz-set-list.handler.ts
│   │   │   ├── start-attempt.handler.ts
│   │   │   ├── answer-question.handler.ts
│   │   │   └── statistics.handler.ts
│   │   ├── callbacks/
│   │   │   └── callback-data.ts
│   │   ├── presenters/
│   │   │   ├── question.presenter.ts
│   │   │   └── result.presenter.ts
│   │   └── utils/
│   │       └── describe-update.ts
│   └── mcp/
│       ├── server.ts
│       ├── schemas/
│       │   ├── quiz-set.schema.ts
│       │   └── question.schema.ts
│       ├── tools/
│       │   ├── create-set.tool.ts
│       │   ├── add-questions.tool.ts
│       │   ├── get-set.tool.ts
│       │   └── publish-set.tool.ts
│       ├── presenters/
│       │   └── tool-result.presenter.ts
│       └── utils/
│           └── tool-logging.ts
│
├── infrastructure/
│   ├── config/
│   │   └── env.ts
│   ├── logging/
│   │   ├── logger.ts
│   │   ├── logger.types.ts
│   │   └── utils/
│   │       ├── format-record.ts
│   │       └── sanitise-fields.ts
│   └── lifecycle/
│       └── shutdown.ts
│
├── composition/
│   ├── create-application.ts
│   ├── create-telegram-bot.ts
│   └── create-mcp-server.ts
│
└── entrypoints/
    ├── telegram.ts
    └── mcp.ts

tests/
├── integration/
│   └── sqlite/
├── e2e/
│   ├── telegram/
│   └── mcp/
└── fixtures/

scripts/
├── migrate.ts
├── backup.ts
└── restore.ts
```

## Folder responsibilities

### `domain`

Pure business behavior: quiz invariants, answer evaluation, scoring, state
transitions, and review policies. Domain tests require no database or transport
mocks.

### `application`

Use cases and the ports they require. Input and output types normally live next
to their use case; do not create a generic `dto` or global `types` folder by
default. Shared abstractions are limited to the structural use-case contract
and infrastructure-facing `Clock`, `IdGenerator`, and `Transaction` ports.

### `adapters`

Technology-specific translation for Telegram, MCP, and SQLite. Presenters map
application results to transport output. Persistence mappers convert rows to
domain objects and back.

### `infrastructure`

Runtime configuration, logging implementation, and process lifecycle behavior.
This folder must not accumulate domain or application behavior.

### `composition`

Manual dependency injection. Construct repositories, use cases, and adapters
here. Do not add a DI framework or global container.

### `entrypoints`

Minimal startup code for two independently runnable processes:

- `telegram.ts` starts Telegram long polling;
- `mcp.ts` starts the local stdio MCP server.

## File and naming conventions

- use `kebab-case` for files and directories;
- use `PascalCase` for classes and types;
- use `camelCase` for functions and variables;
- do not prefix interfaces with `I`;
- name a repository port `QuizSetRepository` and its implementation
  `SqliteQuizSetRepository`;
- use `*.handler.ts`, `*.middleware.ts`, and `*.presenter.ts` in Telegram;
- use `*.tool.ts` and `*.schema.ts` in MCP;
- use numeric migration prefixes such as `001-initial-schema.ts`;
- keep unit tests beside the code as `*.test.ts`;
- keep repository integration and transport end-to-end tests under `tests/`;
- use explicit imports; do not add barrel `index.ts` files until they provide a
  clear boundary without cycles.

Avoid global dumping grounds such as a top-level `helpers`, `utils`, `core`,
`common`, or a global `types.ts`. Put behavior and types beside the feature or
boundary that owns them. A narrowly named shared primitive is acceptable only
after two real consumers demonstrate that ownership is genuinely shared.

Within a single module, two local conventions are expected once a file starts
carrying more than one concern:

- a module-local `utils/` directory holds the pure functions that module owns,
  for example `infrastructure/logging/utils/sanitise-fields.ts`. It is scoped to
  its module and must not become a cross-layer catch-all;
- a `*.types.ts` file beside the implementation holds the contracts that module
  publishes, for example `infrastructure/logging/logger.types.ts`. Importers
  that need only a type import it from there, which keeps a type import from
  pulling in a factory.

## Test structure

Unit tests are colocated with domain and use-case code:

```text
domain/quiz-attempt/
├── quiz-attempt.ts
└── quiz-attempt.test.ts

application/use-cases/attempts/
├── answer-question.ts
└── answer-question.test.ts
```

Broader tests live under `tests/`:

- `tests/integration/sqlite` for migrations, constraints, and repositories;
- `tests/e2e/telegram` for handler routing and callback flows;
- `tests/e2e/mcp` for MCP tool flows;
- `tests/fixtures` for reusable quiz and content fixtures.

## Development-phase mapping

- Phase 1 creates the domain, application repository ports, SQLite migrations,
  and SQLite repository adapters.
- Phase 2 adds application use cases and their unit tests.
- Phase 3 adds the Telegram adapter and Telegram entrypoint.
- Phase 4 adds the MCP adapter and MCP entrypoint.
- Phase 5 adds review-selection and scheduling strategies.
- Phase 6 completes lifecycle, logging, backup, and restore infrastructure.

Do not create the complete tree as empty scaffolding. Each implementation task
should introduce only the directories and files needed for its accepted slice.

## Agent checklist

Before implementing or approving a task, verify:

1. Which layer owns the new behavior?
2. Does every new import follow the dependency direction?
3. Are Telegram, MCP, and SQLite types kept outside domain/application code?
4. Is transport parsing separate from business validation?
5. Does a multi-write operation have an explicit transaction boundary?
6. Are duplicate callbacks or retried MCP operations idempotent where needed?
7. Is the pattern solving current complexity rather than hypothetical growth?
8. Are focused unit or integration tests placed with the correct boundary?
9. Did the task avoid unrelated scaffolding and generic utility folders?
10. Does the reviewer explicitly check these architecture constraints?

If an implementation plan intentionally deviates from this document, it must
state the deviation and rationale before implementation begins. Update this
document when the architectural decision itself changes.
