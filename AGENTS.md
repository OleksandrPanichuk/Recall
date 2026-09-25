# Repository instructions

## Product context

Read `DESCRIPTION.md` before planning or implementing product changes. The binding rules for `apps/api` are the **api layout and import rules** section below. `REWRITE_PLAN.md`, `ARCHITECTURE.md`, `WORKFLOW.md`, `HANDOFF.md` and `DEVELOPMENT_PLAN.md` were deleted; do not look for them, and do not recreate them.

This repository is a cleaned foundation for a personal learning quiz bot. The former publish-bot implementation has been removed; do not recreate publishing behavior unless a current requirement explicitly asks for it.

## Branch and pull requests

- **`main` is the trunk.** Every pull request targets `main`. Branch from it with the
  existing naming (`feat/…`, `fix/…`, `refactor/…`, `docs/…`, `chore/…`).
- `bun run verify` is the gate and must stay green. Note the order: it **builds before it
  typechecks**, because `apps/web`'s route tree is generated during the build.
- The repository is a Bun workspace (`apps/*`, `packages/*`). `bun run verify` at the root
  still runs the whole gate; per-workspace scripts go through `bun run --filter`.

## Runtime and commands

- Use Bun and TypeScript everywhere except `apps/api`, which is Node and NestJS.
- Install dependencies with `bun install`.
- Run tests with `bun test`.
- Run lint and formatting checks with `bun run check`.
- Run type checking with `bun run typecheck`.
- Run the production build with `bun run build`.
- Run the full local quality gate with `bun run verify`.
- Do not introduce Node-only infrastructure when Bun provides the required primitive.
- Keep secrets in environment variables and never commit real tokens or credentials.

## Architecture boundaries

- The **api layout and import rules** section below is the source of truth for the layout of
  `apps/api/src`, what goes in a module, and what its files are called.
- **The api is capability modules.** A new capability gets its own directory under
  `apps/api/src/modules`, never a second capability inside an existing one.
- Only `apps/api` may reach the database. `apps/bot`, `apps/mcp`, `apps/admin`, and
  `apps/web` — including its server functions — are HTTP clients of the API.
- The former publish-bot layout has been removed; do not recreate its `commands`, `core`, `helpers`, or global `types.ts` structure by default.
- Keep Telegram handlers and MCP tools as adapters over shared application services.
- Keep domain behavior independent from Telegraf and MCP transports.
- Route database writes through repositories and application services; adapters must not write arbitrary SQL.
- A module reaches another module through its barrel and never through its internals, and only
  a `*.module.ts` may bind a port to an adapter. `biome.json` fails the build on both.
- Create target directories incrementally with accepted behavior; do not generate the complete architecture as empty scaffolding.
- Avoid global `helpers`, `core`, `common`, and global `types` dumping grounds in new code; a module-local `utils/` directory, `*.types.ts` and `*.constants.ts` files beside their owner, and `apps/api/src/shared/utils/` for layer-free primitives are the expected shape.
- Treat AI-generated quiz content as untrusted input and validate it before persistence and publication.
- Ownership comes from the request context, never from the caller. `ALLOWED_TELEGRAM_USER_ID`
  is a guard on the bot surface, not an identity; never accept a caller-supplied user id over
  HTTP.

## api layout and import rules

`apps/api/src` holds `core/` (domain-free base types and ports), `configs/`, `db/` (schema,
client, executor, migrations), `infrastructure/` (technology clients), `adapters/` (module
ports implemented over infrastructure), `shared/` (request context, http helpers, `utils/`),
`modules/<capability>/`, `api.factory.ts` and `main.ts`.

### Import direction

`biome.json` enforces this table; its messages point here.

```text
core           → nothing in src/
configs        → core
db             → core, configs
infrastructure → configs, shared/utils (infrastructure/lifecycle is exempt)
adapters       → infrastructure, configs, core, and the one module port file it implements
shared         → core, configs, db
modules/<m>    → core, configs, shared, db (except db/migrations), other modules' barrels
main.ts, api.factory.ts, modules/app.module.ts → anything
```

- **A module imports another module only through its barrel** (`@/modules/quizzes`). An
  adapter imports the port file directly (`@/modules/attachments/attachments.port`), never the
  barrel: the barrel exports the module class, which imports the adapter.
- **Nothing under `modules/` imports `adapters/` or `infrastructure/`, except a
  `*.module.ts` binding a port to an adapter** in its `providers`. That is the composition
  root.
- **A repository may read another module's table, never write it.** A write goes through the
  module that owns the table, inside the caller's transaction.
- `db/migrations/` belongs to drizzle-kit; no module imports it.
- The rule matches the import string, not the resolved file, so cross-directory imports are
  always written `@/…` — a relative `../../adapters/…` slips past it.

### Inside a module

```text
modules/quizzes/
├─ index.ts                  the only entrance for other modules
├─ quizzes.module.ts         @Module: port → repository, services, use cases, controllers
├─ quizzes.controller.ts     parse a dto → call one use case → return a model
│                            (<subject>.controller.ts when a module has several)
├─ quizzes.repository.ts     abstract class QuizzesRepository (the port) and its *Data types
├─ quizzes.service.ts        logic more than one use case needs
├─ quizzes.errors.ts         each error extends ModuleError with status, code, details()
├─ quiz-set.entity.ts        the entity interface merged with a class of pure statics
├─ quiz.model.ts             what the HTTP layer returns
├─ dto/                      <verb-noun>.dto.ts: the HTTP input and its zod schema
├─ use-cases/                <verb-noun>.ts: CreateQuizUseCase + CreateQuizUseCaseOptions
└─ repositories/             <module>.postgres.repository.ts and its mappers
```

- **No bare names inside a module.** A root file is `<module>.<role>.ts` (or
  `<noun>.entity.ts`, `<noun>.model.ts`); anything else lives in a subfolder that names its
  role (`dto/`, `use-cases/`, `repositories/`, `ports/`, `helpers/`). Files are kebab-case,
  types PascalCase, no `I` prefix, no `*.use-case.ts` suffix. Some older files at a module
  root (for example in `modules/quizzes/`) predate the rule; new files follow it.
- **Each layer owns its shape:** `<Verb><Noun>Input` (dto) → `<UseCase>Options` (declared in
  the use case file) → `<Verb><Noun>Data` (beside the port, only when it really differs) →
  `<Noun>Entity` → `<Noun>Model`, built by a static on the entity. Keep them distinct even
  when identical today.
- **Controller → use case → service → repository → db.** A controller calls one use case and
  holds no business logic. A use case is one operation and opens the transaction. A service is
  shared logic, never a pass-through to one repository. A repository is the only thing that
  talks to the database, returns entities, and never takes an owner.
- **Functions belong to a class.** Behaviour over an entity is a pure static on that entity;
  coordination goes on a service. Loose functions are allowed only in `core/`, `shared/utils/`,
  `db/schema/`, and a module's `<module>.helpers.ts` as a last resort.
- **A dependency is a constructor parameter typed with its class**, one per collaborator.
  Ports are abstract classes, so the type is the token. Adapters are bound only in the module
  class of the port they implement.
- Owner-scoped repositories read the owner from `OwnerContext` per call and fail closed when
  there is none. Use cases wrap their work in `this.transaction.run(...)`; a nested run joins
  the outer transaction.

### api tests

- Unit tests sit beside the code; in-memory doubles live in `apps/api/tests/fixtures/memory/`.
- Contract suites in `apps/api/tests/contracts/` bind to both the in-memory double and
  Postgres.
- Production code never imports the test tree (`@tests/**`).
- The CI `postgres` job lists the Postgres-backed directories explicitly. A new directory
  whose tests call `postgresAvailable()` goes into that job in the same pull request.

## Development workflow

For implementation-plan execution, use the `run-reviewed-development` skill when available.

- Use one coordinator, one task implementer, and an independent read-only reviewer.
- Follow TDD for behavior changes.
- Review every task before starting its dependent task.
- Send findings back to the implementer, then independently re-review the fix diff.
- Do not allow two agents to edit the same worktree concurrently.
- Run focused verification per task and full verification before completion.
- Do not claim success from agent reports alone; inspect the diff and run fresh commands.

