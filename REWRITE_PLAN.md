# Recall Quiz — api rewrite v3: capability modules on NestJS

This document is binding for everything under `apps/api/src`. It replaces the v2 plan in
full; the v2 plan and its decision history are preserved in git at
`git show 15c7d5a:REWRITE_PLAN.md` and are no longer instructions. `ARCHITECTURE.md` stays
binding for the three v1-shaped directories (`adapters`, `composition`, `entrypoints`) only
until the phase that removes each of them; after that it describes history.

Nothing outside `apps/api` changes shape. `apps/web`, `apps/bot`, `apps/mcp`, `apps/admin`,
`packages/contracts`, `packages/kit`, the Postgres schema and its migration history all stay
as they are. This is a reorganisation of one app, not a second platform rewrite.

## 0. The request

> Rewrite the current backend into something better. The architecture is wrong. Look at
> `velo_version_2`: how files are named, how they are structured, where Postgres repositories
> live (in modules, not in the adapters layer) while every other adapter lives in `adapters/`.
> Each thing has its own module — not one `content` module, but a module for quizzes, for
> answers, and so on. No two things in one module: you cannot have an auth service and a
> verification-tokens service in the same module. Keep NestJS; the architecture has to change.

The reference project is Elysia on Bun. Only its structure is borrowed: the module shape, the
file naming, the type vocabulary, the rule that a Postgres repository belongs to its module
and every other port implementation is an adapter. Nest is the composition root here, so the
reference's hand-rolled registry maps onto Nest providers and its `defineModule` onto
`@Module`.

## 1. Why: what is wrong with `apps/api/src` today

The style is Ports and Adapters and that is not the problem. The problem is that the code is
organised in horizontal layers with `modules/` holding only Nest glue, so a capability is spread
across the whole tree and the seams that Nest could give never appeared.

- **One feature lives in six places.** A quiz set is `domain/quiz-set/*`,
  `application/ports/repositories/quiz.repository.ts`, `application/use-cases/quiz-sets/*`,
  `persistence/postgres/repositories/quiz.{repository,mapper}.ts`,
  `persistence/memory/quiz.repository.ts`, and its presenters are in `modules/bot/wire.ts`.
- **Two god objects.** `UseCases` in `composition/create-application.ts` has 47 fields;
  `McpUseCases` in `adapters/mcp/server.types.ts` repeats 29 of them. `useCasesFor(owner)` in
  `modules/shared/database/use-cases-for.ts` instantiates all 47 use cases on every request.
  `ApplicationDependencies` hands every use case the whole `RepositoryScope` of seven
  repositories, so no use case declares what it needs.
- **Modules are named after callers, not capabilities.** `modules/bot`, `modules/app`,
  `modules/public`, `modules/integration/{mcp,admin}`. `bot.controller.ts` (597 lines, 33
  routes) and `app-surface.controller.ts` (740 lines) are the same routes behind two guards,
  which is why `CLAUDE.md` has to say "adding a practice route means adding it to both
  controllers". `modules/content` holds two use cases.
- **`modules/auth` is a bag.** The Better Auth instance, `ApiTokenService`,
  `TelegramIdentityService`, mailer selection and the reset-password letter share one module.
  `ApiTokenService.ownerForTelegram` puts identity resolution inside token management.
- **Repositories without ports.** `persistence/postgres/{owner,share,api-tokens,oauth.store}.ts`
  are loose functions over `db`. `PublicController` calls `ownerForShare` and
  `scopeFor(db, owner).attachments`; `UploadsController` calls `scopeFor(db, owner).attachments.save`.
  Controllers reach persistence directly and bypass use cases.
- **Two answers to "who is the owner".** The web path builds use cases per request with
  `useCasesFor(owner)`; the bot path resolves the instance owner lazily through the `Proxy` in
  `persistence/postgres/lazy-scope.ts`.
- **Two DI systems.** Nest DI for Nest things, hand-rolled `createUseCases` for use cases,
  bridged by `use-cases.providers.ts` factory lists.
- **`infrastructure/` is misnamed.** It holds a status report that runs SQL and a URL
  formatter.

## 2. What does not change

These are the properties the current code earned and the rewrite must keep. Each has a test
today; the tests move, they do not go away.

- **Ownership is bound in the repository, never passed as an argument.** No repository method
  takes an owner. `tests/contracts/ownership.contract.ts` runs against both engines.
- **The api decides who the caller is; the caller never names a user.** `BotTokenGuard` still
  rejects a body whose `telegramUserId` is not `ALLOWED_TELEGRAM_USER_ID`, checked on the raw
  parsed body before any schema strips it. Login links are minted only behind the bot token.
  A session may mint its own personal token and nothing else about identity.
- **A failed session read is an outage, not a sign-out.** Unchanged, it lives in `apps/web`.
- **Better Auth mounts on the raw Express instance before the body parser.**
- **The functional domain stays functional.** `createQuizSet`, `moveQuizSetToFolder`,
  branded ids, `restoreFolder`. Files move; nothing is rewritten into classes.
- **Contract suites run against an in-memory double and Postgres.** The in-memory unit of work
  snapshots one shared store and restores it on failure, which is what proves atomic rollback
  across attempts + schedules and vocabulary + quizzes. That property is kept centrally.
- **Every wire shape comes from `packages/contracts`.** Ids as strings, timestamps as ISO,
  `{ error: "<ErrorName>", details }` with a whitelist of detail keys.
- **URLs already in the wild do not change.** `/bot/*` for the bot, `/app/*` for the web,
  `/app/uploads/<id>` inside stored markdown, `/public/pages/<token>`,
  `/public/uploads/<token>/<id>`, `/api/auth/*`, `/mcp`.
- **`apps/api` runs on Node.** No Bun globals anywhere under `apps/api/src`.
- **Every Nest injection point uses an explicit `@Inject(Token)`.** `emitDecoratorMetadata` is
  off on purpose.
- **No code comments.**

## 3. Target layout

```text
apps/api/src/
├─ main.ts                          bootstrap: request context middleware, Better Auth mount,
│                                   MCP mount, body parsers, filter, Swagger, listen
├─ app.module.ts                    imports every module below
│
├─ core/                            domain-free base types; imports nothing from src/
│  ├─ use-case.ts                   abstract UseCase<Options, Result> { execute(options) }
│  ├─ errors.ts                     ModuleError { status, code, details() }
│  ├─ branded-id.ts
│  ├─ owner.ts                      OwnerId brand, toOwnerId
│  ├─ owner-context.ts              abstract OwnerContext { current(): OwnerId }
│  ├─ transaction.ts                abstract Transaction { run<T>(fn): Promise<T> }
│  └─ ports/                        Clock, IdGenerator
│
├─ configs/
│  └─ env.config.ts                 zod schema, loadEnv, getEnv (today's api-env.ts)
│
├─ db/                              Postgres only; knows tables, not the domain
│  ├─ client.ts                     drizzle over postgres-js, connection lifecycle
│  ├─ executor.ts                   AsyncLocalStorage<tx>; getExecutor(); PostgresTransaction
│  ├─ schema/
│  │  ├─ index.ts
│  │  ├─ pages.schema.ts, page-revisions.schema.ts, quiz-attachments.schema.ts
│  │  ├─ page-shares.schema.ts, attachments.schema.ts
│  │  ├─ quizzes.schema.ts, questions.schema.ts, question-options.schema.ts,
│  │  │  question-sources.schema.ts, term-pairs.schema.ts
│  │  ├─ attempts.schema.ts, attempt-questions.schema.ts, responses.schema.ts
│  │  ├─ review-states.schema.ts, study-settings.schema.ts
│  │  └─ auth.schema.ts, auth-events.schema.ts, api-tokens.schema.ts, oauth.schema.ts
│  └─ migrations/                   moved from drizzle/ unchanged; the journal is history
│
├─ infrastructure/                  technology clients only; could be copied to another project
│  ├─ minio/minio.client.ts
│  ├─ mail/smtp.transport.ts        nodemailer transport from SMTP_URL
│  └─ logger/
│
├─ adapters/                        module ports implemented over infrastructure — never db
│  ├─ storage/minio.object-store.ts     implements attachments' ObjectStore
│  └─ mail/smtp.mailer.ts, log.mailer.ts   implement notifications' Mailer
│
├─ shared/                          cross-module runtime pieces, no domain
│  ├─ request-context/              AsyncLocalStorage<{ principal, owner }>, middleware,
│  │                                AlsOwnerContext, runAs(owner, fn)
│  ├─ http/                         ZodBody pipe, ModuleErrorFilter, swagger
│  └─ utils/                        date, duplicates, edit-distance
│
└─ modules/
   ├─ health/
   ├─ auth/                         Better Auth instance, SessionGuard, @CurrentOwner(),
   │                                AuthEvents port + Postgres repository
   ├─ owners/                       telegram id ↔ owner, instance owner, BotTokenGuard
   ├─ telegram-link/                login links, the Better Auth verify plugin
   ├─ api-tokens/                   personal tokens: issue, list, revoke, verify
   ├─ oauth/                        MCP OAuth clients, codes, tokens; provider; consent
   ├─ notifications/                Mailer port, reset-password letter
   ├─ pages/                        tree, summary, revisions, icon, search, ordering, page↔quiz links
   ├─ page-shares/                  share, unshare, read shared page; public routes
   ├─ attachments/                  uploads, ObjectStore port, owner-scoped rows
   ├─ quizzes/                      the quiz set aggregate, questions included
   ├─ vocabulary/                   term pairs and the questions they generate
   ├─ attempts/                     start, answer, finish, pause, resume, abandon, current, rate
   ├─ practice/                     start practice session
   ├─ scheduling/                   review states, due, leeches, ladder and FSRS
   ├─ study-settings/               resolve and update
   ├─ statistics/                   quiz statistics, attempt detail — read side
   ├─ insights/                     analytics read model — read side
   ├─ mcp/                          tools, server factory, http mount, bearer → principal
   └─ admin/
```

Gone: `application/`, `composition/`, `domain/`, `entrypoints/`, `persistence/`,
`modules/shared/`, `modules/{app,bot,content,public,integration}`. `scripts/` under `apps/api`
keeps the ETL and the status report as Bun scripts that import `db/` only.

### 3.1 Import rules, enforced by `biome.json`

```text
core           → nothing in src/
configs        → core
db             → core, configs
infrastructure → configs, shared/utils
adapters       → infrastructure, configs, core, and the one module port file it implements
shared         → core, configs, db
modules/<m>    → core, configs, shared, db/schema, db/executor, other modules' barrels
main.ts, app.module.ts → anything
```

Three rules that need words, not just the table:

- **A module imports another module only through its barrel** (`@/modules/quizzes`). An adapter
  imports the port file directly (`@/modules/attachments/attachments.port`), never the barrel,
  because the barrel exports the module class which imports the adapter — a cycle.
- **A repository may read another module's table, never write it.** `pages` counts rows in
  `quizzes` and joins `quiz_attachments` to `quizzes`; `attempts` joins `questions` for topic
  accuracy; `insights` joins nearly everything. Those are queries, not ownership. A write to a
  table goes through the module that owns the table, inside the caller's transaction.
- **Nothing under `modules/` imports `adapters/` or `infrastructure/`, except a module class
  binding a port to an adapter** in its `providers`. That is the composition root, and it is
  the only place the binding is allowed.

Today's two `noRestrictedImports` overrides (`domain/**`, `application/**`) are joined by one
override per row of the table above, plus one per module for the dependency graph in §5.2 as
each module lands. The rule is what makes the direction real; without it the table is a wish.
The two old overrides stay until phase 6 deletes the directories they guard.

Two limits worth knowing rather than discovering:

- **The rule matches the import string, not the resolved file.** `../../adapters/minio` slips
  past a `@/adapters/**` pattern. Cross-directory imports are written `@/` everywhere in this
  codebase and organiseImports keeps them that way, so the gap is convention-held, not
  enforced. The phase 6 grep checks both spellings.
- **An override that matches a file replaces the rule for it rather than adding to it.** The
  `*.module.ts` override that lets a module class bind an adapter therefore has to repeat every
  other pattern, and it has to repeat the exclusion list of old modules too, or it re-enables
  the rule for the very files the previous override excused.

## 4. Inside a module

```text
modules/quizzes/
├─ index.ts                         the only entrance for other modules
├─ quizzes.module.ts                @Module: port → Postgres repository, use cases, controllers
├─ quizzes.controller.ts            parse body → one use case → model
├─ quizzes.port.ts                  abstract class QuizzesRepository; *Data types beside it
├─ quizzes.errors.ts                each error extends ModuleError with status, code, details()
├─ quiz.entity.ts                   today's domain/quiz-set/quiz-set.ts, moved as is
├─ quiz.entity.types.ts             today's quiz-set.types.ts
├─ quiz.entity.validation.ts        today's quiz-set.validation.ts
├─ question.entity.ts, question.fingerprint.ts, create-question.ts
├─ quiz.model.ts                    QuizSet → wire (the slice of today's wire.ts)
├─ question.model.ts
├─ dto/
│  ├─ create-quiz.dto.ts            re-exports the zod schema from @recall/contracts
│  └─ question-input.ts             today's modules/shared/authoring/question-input.ts
├─ use-cases/
│  ├─ create-quiz.ts                CreateQuizUseCase, exports CreateQuizUseCaseOptions
│  ├─ create-quiz.test.ts
│  └─ …
└─ repositories/
   ├─ quizzes.postgres.repository.ts   PostgresQuizzesRepository extends QuizzesRepository
   └─ quiz.mapper.ts
```

### 4.1 File and naming conventions

| Thing | File | Symbol |
| --- | --- | --- |
| Module | `<module>.module.ts` | `QuizzesModule` |
| Controller | `<module>.controller.ts`, or `<subject>.controller.ts` when a module has several | `QuizzesController` |
| Port | `<module>.port.ts` | `abstract class QuizzesRepository` |
| Postgres repository | `repositories/<module>.postgres.repository.ts` | `PostgresQuizzesRepository` |
| In-memory double | `apps/api/tests/doubles/<module>/<module>.memory.repository.ts` | `MemoryQuizzesRepository` |
| Entity | `<noun>.entity.ts` (+ `.types.ts`, `.validation.ts`, `.constants.ts` beside it) | today's domain names, unchanged |
| Wire mapper | `<noun>.model.ts` | `quizSetToWire`, `questionToWire` |
| Errors | `<module>.errors.ts` | `QuizSetNotFoundError` |
| Use case | `use-cases/<verb-noun>.ts` — the directory names the role, the file does not | `CreateQuizUseCase`, `CreateQuizUseCaseOptions` |
| DTO | `dto/<verb-noun>.dto.ts` | `createQuizCommandSchema` from contracts |
| Guard | `<credential>.guard.ts` | `SessionGuard`, `BotTokenGuard` |

Files are kebab-case, types PascalCase, no `I` prefix, no `*.use-case.ts` suffix. Barrels
(`index.ts`) exist only at the module root; inside a module, import the file.

### 4.2 The type vocabulary

```text
CreateQuizCommand  →  CreateQuizUseCaseOptions  →  CreateQuizData  →  QuizSet  →  QuizSummary/QuizDetail
 (wire in,            (use case input,              (persistence,      (entity,    (wire out,
  packages/contracts)  its own file)                 only when it        domain)     packages/contracts)
                                                     differs)
```

Every use case declares `<Name>UseCaseOptions` in its own file, even when it equals the wire
command today. A wire-only field must not be able to reach persistence by accident, and the
three contracts drift. `*Data` types exist beside the port only where the persistence input
genuinely differs from the entity; do not mint one per entity mechanically.

```ts
export interface CreateQuizUseCaseOptions {
	readonly title: string;
	readonly language: string;
	readonly folderId?: FolderId;
}

type Options = CreateQuizUseCaseOptions;
type Result = { readonly quizSetId: QuizSetId };

@Injectable()
export class CreateQuizUseCase extends UseCase<Options, Result> {
	constructor(
		@Inject(QuizzesRepository) private readonly quizzes: QuizzesRepository,
		@Inject(PagesRepository) private readonly pages: PagesRepository,
		@Inject(Transaction) private readonly transaction: Transaction,
		@Inject(Clock) private readonly clock: Clock,
		@Inject(IdGenerator) private readonly ids: IdGenerator,
	) {
		super();
	}

	execute(options: Options): Promise<Result> {
		return this.transaction.run(async () => { … });
	}
}
```

A use case names exactly the ports it uses. A test constructs it with `new` and the in-memory
doubles; the decorators are inert without Nest.

## 5. The module catalogue

### 5.1 What each module owns

| Module | Tables (writes) | Today's domain | Today's use cases | Today's other code |
| --- | --- | --- | --- | --- |
| `auth` | `user`, `session`, `account`, `verification`, `auth_events` | — | — | `modules/auth/{build-auth,build-auth.constants,session-owner,tokens}.ts`, `modules/app/session.guard.ts`, the `record()` bodies of both services |
| `owners` | — (reads `account`) | — | — | `persistence/postgres/owner.ts`, `modules/shared/database/instance-owner.ts`, `modules/bot/bot-token.guard.ts` |
| `telegram-link` | — (writes through Better Auth's verification store) | — | — | `modules/auth/telegram-identity.service.ts`, `telegram-link.plugin.ts`, the `loginLink` route |
| `api-tokens` | `api_tokens` | — | — | `persistence/postgres/api-tokens.ts`, `modules/auth/api-token.service.ts`, the four token routes, `adapters/mcp/http/bearer.ts` |
| `oauth` | `oauth_clients`, `oauth_codes`, `oauth_tokens` | — | — | `persistence/postgres/oauth.store.ts`, `infrastructure/auth/oauth-store.types.ts`, `adapters/mcp/http/oauth/*` |
| `notifications` | — | — | — | `application/ports/mailer.ts`, `modules/auth/{mailer-for,reset-password.letter}.ts` |
| `pages` | `pages`, `page_revisions`, `quiz_attachments` | `domain/folder/*` | `folders/*` — 15 files: attach-quiz, browse-folder, create-folder, delete-folder, detach-quiz, ensure-folder-path, list-folder-tree, list-revisions, move-folder, rename-folder, reorder-folder, resolve-folder-path, search-pages, set-page-icon, write-summary | `page.repository.ts` (port + Postgres) minus its share methods |
| `page-shares` | `page_shares` | — | `sharing/{share-page,read-shared-page,referenced-uploads}.ts` | `persistence/postgres/share.ts`, `modules/public/*`, `shareOf/saveShare/deleteShare` from the page port |
| `attachments` | `attachments` | — | — (the controller becomes two use cases: `upload-image`, `read-attachment`) | `application/ports/object-store.ts`, `attachment.repository.ts`, `modules/app/uploads.*`, `persistence/objects/minio.object-store.ts` → `adapters/storage` |
| `quizzes` | `quizzes`, `questions`, `question_options`, `question_sources` | `domain/quiz-set/*` | `quiz-sets/*` minus vocabulary — 11 files: add-questions, archive-quiz-set, create-quiz-set, delete-question, get-quiz-set, list-questions, list-quiz-sets, move-quiz-set, publish-quiz-set, update-question, update-quiz-set | `quiz.repository.ts`, `quiz.mapper.ts`, `modules/shared/authoring/question-input.ts` |
| `vocabulary` | `term_pairs` | `domain/vocabulary/*` | `quiz-sets/{add,list,update}-vocabulary.ts` | `term-pair.repository.ts` |
| `attempts` | `attempts`, `attempt_questions`, `responses` | `domain/quiz-attempt/*` | `attempts/*` — 7 files: abandon, answer-question, finish, get-current-question, rate-recall, resume (Pause + Resume), start | `attempt.repository.ts` |
| `practice` | — | `domain/practice/weak-topics.ts` | `practice/start-practice-session.ts` | `topicAccuracy`, `incorrectQuestionIds` stay on the attempts port as read methods |
| `scheduling` | `review_states` | `domain/repetition/*` | `repetition/{list-due-repetitions,list-leeches}.ts`; `scheduleAfter` is called by attempts | `review.repository.ts` minus settings |
| `study-settings` | `study_settings` | `domain/settings/quiz-settings.ts` | `settings/{resolve,update}-quiz-settings.ts` | the settings methods of `review.repository.ts` |
| `statistics` | — | `domain/quiz-attempt/score.ts` is imported, not owned | `statistics/{get-quiz-statistics,get-attempt-detail}.ts` | — |
| `insights` | — | — | `analytics/get-insights.ts` | `analytics.repository.ts` (a read model over responses, attempts, questions, quizzes, review_states) |
| `mcp` | — | — | — | `adapters/mcp/{server,server.types,tools,schemas,presenters,utils}`, `adapters/mcp/http/app.ts`, `modules/integration/mcp` |
| `admin` | — | — | — | `adapters/admin/*`, `modules/integration/admin` |
| `health` | — | — | — | `modules/shared/health` |

Two things that look like they should be modules and are not:

- **`questions` is not a module.** `PostgresQuizRepository.save` writes the quiz row, bumps
  the version, deletes removed questions, parks fingerprints and replaces options in one
  statement sequence. That is one aggregate's invariant. Questions get their own controller
  file inside `quizzes` (`questions.controller.ts`) and their own entity files, nothing more.
- **`content` is not a module.** It was a name for "everything the MCP can edit". The MCP
  module imports the barrels it needs.

### 5.2 Module dependency graph

```text
auth          ← owners ← telegram-link, api-tokens, oauth
auth          ← notifications (reset mail)         [bound in auth's module class]
pages         ← page-shares → attachments
quizzes       → pages                              (requireFolder, moveQuizSetToFolder)
vocabulary    → quizzes                            (replaceQuestions in one transaction)
attempts      → quizzes (read), scheduling, study-settings
practice      → attempts, quizzes, study-settings
scheduling    → quizzes (read), study-settings
statistics    → attempts (read), quizzes (read)
insights      → nothing at module level; its repository reads five tables
mcp, admin    → any module's exported use cases; never db
```

Facts in the code that shaped this graph, so nobody re-derives them:

- `delete-folder.ts` counts child pages and attached quizzes and deletes in one transaction;
  `page.repository.ts` implements the count against `quizzes`. So `pages` reads the `quizzes`
  table and owns the `quiz_attachments` link; `quizzes → pages` is the module direction.
- `finish-quiz-attempt.ts` saves the attempt, resolves repetition settings, reads schedules and
  writes replacement schedules in one transaction. `attempts → scheduling` must be a
  synchronous call inside the transaction, never an after-commit event.
- `update-vocabulary.ts` saves the term pair and calls `quizzes.save(replaceQuestions(…))` in
  one transaction. `vocabulary` never gets its own writer for `questions`.
- `start-practice-session.ts` reads quizzes, the active attempt, attempt history and shuffle
  settings, then saves the attempt. It does not use analytics.
- `auth_events` is written by both `TelegramIdentityService` and `ApiTokenService`. The port
  `AuthEvents` lives in `auth`; both consumers inject it. Making `telegram-link` its owner
  would give token management a dependency on Telegram.
- `build-auth.ts` installs the Telegram verify plugin. `auth` must not import `telegram-link`,
  so `AuthModule` takes the plugin list from a provider that `telegram-link` contributes
  (`AUTH_PLUGINS` multi-provider), and the direction stays `telegram-link → auth`.
- `public.controller.ts` serves an upload only if the shared page's markdown references it. A
  share principal carries `{ owner, pageId }`, not just the owner, and `page-shares →
  attachments` is real.

## 6. Mechanics

### 6.1 Owner: one request context, three producers

```ts
// shared/request-context/request-context.ts
interface RequestContext {
	principal?: Principal;
}

type Principal =
	| { kind: "session"; owner: OwnerId }
	| { kind: "bot"; owner: OwnerId }
	| { kind: "pat"; owner: OwnerId; tokenId: string; scopes: readonly string[] }
	| { kind: "oauth" | "static-mcp"; owner: OwnerId }
	| { kind: "share"; owner: OwnerId; pageId: FolderId };
```

- An Express middleware registered in `main.ts` **before** the MCP sub-app and the Better Auth
  handler runs every request inside `storage.run({}, next)`. A Nest interceptor is too late:
  guards run first and need the store to exist.
- Guards populate the store. `SessionGuard` (cookie → owner), `BotTokenGuard` (bearer + the
  `telegramUserId` body check → the linked instance owner via `owners`), `ShareTokenGuard`
  (token → `{ owner, pageId }` via `page-shares`), the MCP bearer verifier (PAT, OAuth grant or
  static token → owner). MCP verifies outside Nest, so it wraps each tool execution in
  `runAs(principal, fn)` rather than binding an owner to the server instance.
- `AlsOwnerContext implements OwnerContext` reads `principal.owner` and **throws when absent**.
  An owner-scoped repository with no owner fails closed; it never falls back to "everything".
- Owner-scoped repositories inject `OwnerContext` and read `this.owners.current()` per call, not
  in the constructor. Use cases and repositories are therefore singletons. `useCasesFor`,
  `lazyScope`, `USE_CASE_DEPENDENCIES`, `USE_CASES_FOR` and `INSTANCE_OWNER` disappear.
- Identity-resolution repositories (`owners`, `api-tokens` verify, `page-shares` lookup by
  token, `oauth`) run before an owner exists. They do not inject `OwnerContext`; they are the
  four seams that turn a credential into an owner, and they stay the only ones.
- Multer runs after guards. Uploads stay session-only; a bot multipart route would have to
  validate any identity field after parsing, and there is no such route.
- `@Res()` streaming outlives the controller. Finish every database read before `pipe`; the
  context is not guaranteed for callbacks the response emits later.
- Reject a request that presents both a cookie and a bearer token. Never pick one silently.

### 6.2 Transactions

```ts
// db/executor.ts
const storage = new AsyncLocalStorage<Tx>();
export const getExecutor = (): Executor => storage.getStore() ?? getDatabase();
export class PostgresTransaction extends Transaction {
	run<T>(fn: () => Promise<T>): Promise<T> {
		if (storage.getStore()) return fn();
		return getDatabase().transaction((tx) => storage.run(tx, fn));
	}
}
```

- Use cases inject `Transaction` (a `core` port) and call `this.transaction.run(async () => …)`.
  A nested `run` joins the outer transaction; there are no savepoints. A caught inner failure
  that must abort the whole operation has to rethrow.
- Repositories call `getExecutor()` per query. A repository never holds an executor in a field.
- `RepositoryScope` and `UnitOfWork.run(scope => …)` are gone. The measured rule from
  `CLAUDE.md` stands: never leave a promise unawaited inside `run`; an unawaited write commits
  on its own connection when the boundary rolls back.
- The in-memory `MemoryTransaction` snapshots the shared `MemoryStore` and restores it when
  `fn` throws, exactly as `persistence/memory/unit-of-work.ts` does today, so the contract
  suites keep proving rollback.

### 6.3 Errors

```ts
// core/errors.ts
export abstract class ModuleError extends Error {
	abstract readonly status: number;
	abstract readonly code: string;
	details(): Readonly<Record<string, string>> | undefined { return undefined; }
}
```

- Every error in `<module>.errors.ts` extends `ModuleError` and states its own status. The
  name-keyed table in `modules/shared/errors/error-map.ts` is deleted; a module that adds an
  error cannot forget to map it because the status is on the class.
- The wire shape is unchanged: `{ statusCode, error: <ErrorName>, message, details }`. `error`
  stays the class name because `packages/contracts` `ApiErrorName` and the bot's `error-map.ts`
  key on it. `details()` returns only whitelisted keys; today's global `DETAIL_KEYS` becomes
  each class's own choice, so an error can still never leak a field nobody vetted.
- `shared/http/module-error.filter.ts` replaces `domain-exception.filter.ts`: `HttpException`
  passes through, `ModuleError` renders itself, anything else is a 500 with no message.
- Domain entity files import `ModuleError` from `core`. `core` has no dependencies, so the
  domain stays as pure as it is today.

### 6.4 DI and module classes

- Ports are abstract classes and therefore Nest tokens. A module binds
  `{ provide: QuizzesRepository, useClass: PostgresQuizzesRepository }`.
- Use cases are `@Injectable()` providers listed in their module, injected into controllers by
  class. A module `exports` the use cases and ports another module legitimately needs and
  nothing else; the import graph is declared in `*.module.ts`.
- `Clock`, `IdGenerator`, `Transaction`, `OwnerContext` are provided once by a `@Global()`
  `CoreModule` in `shared/`. That module and `DatabaseModule` (connection lifecycle, shutdown
  drain) are the only global modules.
- Adapters are bound in the module class of the port they implement: `AttachmentsModule` binds
  `ObjectStore → MinioObjectStore`, `NotificationsModule` binds `Mailer → SmtpMailer | LogMailer`
  depending on `SMTP_URL`. Nowhere else imports `adapters/`.

### 6.5 Controllers and presenters

- A controller parses with the zod schema from `packages/contracts` through `ZodBody(schema)`
  in `shared/http`, calls one use case, maps the result with the module's `*.model.ts`. No
  drizzle, no branching on business state, no controller-to-controller calls.
- `modules/bot/wire.ts` is split by owner: `quiz.model.ts`, `page.model.ts`, `attempt.model.ts`
  and so on. A model file maps one module's types; when a result spans two modules the
  controller composes two mappers.

## 7. HTTP surfaces

The bot calls `/bot/*` with a bearer token; the web calls `/app/*` with a cookie; both use
`BOT_ROUTES` from `packages/contracts`. Today that is two controllers. It becomes one controller
per module registered under both prefixes:

```ts
@Controller(["bot", "app"])
@UseGuards(PracticePrincipalGuard)
export class AttemptsController { … }
```

`PracticePrincipalGuard` accepts a session cookie or the bot token, sets the principal, and
refuses a request carrying both. It does **not** accept a personal token; PAT access to REST is a
separate decision (§10). Two route groups keep separate controllers because the two credentials
mean different things there:

| Route | Bot (`/bot/…`, bearer) | App (`/app/…`, cookie) | Module |
| --- | --- | --- | --- |
| `auth/login-link` | body names `telegramUserId`; creates the owner on first login | **absent** | `telegram-link` |
| `auth/tokens/{issue,list,revoke}` | body names `telegramUserId`, resolved via `owners` | body omits it; owner from session | `api-tokens` |
| every practice and authoring route | owner = the linked instance owner | owner = session | one controller under `["bot","app"]` |
| `app/uploads`, `app/uploads/:id` | absent | session | `attachments` |
| `public/pages/:token`, `public/uploads/:token/:id` | share token, no other credential | | `page-shares` |
| `quizzes`, `quizzes/:id` (Swagger REST) | | | `quizzes` — the only public REST today; unchanged |
| `/api/auth/*`, `/mcp` | mounted on the raw Express instance in `main.ts` | | `auth`, `mcp` |

`BotTokenGuard` keeps reading `telegramUserId` from the raw parsed body. The first-login path
must keep working: `auth/login-link` is the one route that may create an owner, so its guard
must not require one to exist.

## 8. Tests

- **Unit tests stay beside the code** (`use-cases/create-quiz.test.ts`, `quiz.entity.test.ts`).
- **In-memory doubles** move to `apps/api/tests/doubles/<module>/`, one per port. They are
  test code, not shipped code, and `bun test` runs them as today.
- **Contract suites** move to `apps/api/tests/contracts/<module>.contract.ts` and keep binding
  to both engines. `ownership.contract.ts` and the rollback suite stay cross-module and
  central; they are the proof that the shared `MemoryStore` snapshot and the Postgres
  transaction behave the same.
- **Integration and e2e** stay where they are. `openAppSession` and `app-shapes.ts` in
  `tests/fixtures/` are unchanged.
- **The CI `postgres` job** lists directories explicitly (`integration/postgres`,
  `integration/app`, `integration/auth`, `e2e`). Any phase that adds a directory calling
  `postgresAvailable()` adds it there in the same pull request.
- Phase 1 adds the tests that make the new mechanics safe to build on: two interleaved owners
  through one singleton repository; a rollback across two modules' repositories; a use case
  called with no principal fails closed; an MCP request on the raw mount runs as the token's
  owner; a streamed upload completes with the transaction already closed.

## 9. Migration

Strangler, one capability at a time, `bun run verify` green after every phase and the Postgres
suites green locally with Docker before a phase is called done. A phase that moves a slice
moves the whole transaction path of that slice; nothing may be half on the old scope and half
on the new executor.

**The bridge.** Phase 1 rewires `persistence/postgres/unit-of-work.ts` so `run` becomes
`transaction.run(() => operation(scopeFor(owner)))` with `scopeFor` calling `getExecutor()`
instead of receiving one. Old repositories then read the same ALS executor the new ones do, and
a moved repository can sit inside the old `RepositoryScope` until its consumers move. Old use
cases keep `ApplicationDependencies`; moved use cases take narrow ports. Both live until phase 6.

| Phase | Work | Gate |
| --- | --- | --- |
| 0 | This document. Rewrite the `biome.json` overrides for the layout in §3.1; the module graph rules are added as modules land. | `bun run lint` passes with the new overrides against the current tree, with every planned violation listed in the PR. |
| 1 | `core/`, `configs/`, `db/` (schema split per table, `client.ts`, `executor.ts`), `shared/request-context`, `shared/http`, `infrastructure/`, `adapters/`. The bridge above. The five mechanics tests from §8. | `db:generate` produces no new migration. Old code runs unchanged through the bridge. |
| 2 | Identity: `auth`, `owners`, `telegram-link`, `api-tokens`, `oauth`, `notifications`. Loose Postgres functions become repositories behind ports. `AUTH_PLUGINS` multi-provider. | `tests/integration/auth/*` green. Login link creates an owner on first login. OAuth refresh keeps the grant's owner. |
| 3 | Content: `pages`, `quizzes`, then `vocabulary`, `attachments`, `page-shares`. Presenters split out of `wire.ts`. `UploadsController` becomes two use cases. | `tests/contracts/{page,quiz}*` bound to both engines. Shared page still refuses an upload its markdown does not reference. |
| 4 | Study: `study-settings` and `scheduling` out of the review repository, then `attempts`, `practice`, `statistics`, `insights`. | `finish` writes attempt and schedules in one transaction, pinned by the rollback suite. The four ladder/FSRS behaviour tests from `CLAUDE.md` still pass. |
| 5 | Surfaces: one controller per module under `["bot","app"]`; `telegram-link` and `api-tokens` keep their two controllers. `adapters/mcp` → `modules/mcp`, `adapters/admin` → `modules/admin`. Delete `modules/{app,bot,content,public,integration}`. | `tests/integration/app/*` and `e2e/*` green. No route path changed. |
| 6 | Delete `composition/`, `application/`, `persistence/`, `domain/`, `entrypoints/` (→ `main.ts`, `scripts/`), `modules/shared/`. Remove the bridge. | `grep -r "RepositoryScope\|UnitOfWork\|useCasesFor\|lazyScope" apps/api/src` is empty. |
| 7 | Docs: `CLAUDE.md`, `AGENTS.md`, `ARCHITECTURE.md`, `HANDOFF.md`, `README.md` (§11). | Every path named in those files exists. |

Effort, from the independent review: 15–25 engineer-days for the whole table. Phases 2–4 are
the bulk and can each be several pull requests.

## 10. Decisions

### Settled

- **Capability modules, one per capability.** Named for what they own, never for who calls
  them. Two capabilities in one module is the smell this rewrite removes.
- **Postgres repositories live in their module; every other port implementation is an
  adapter.** Postgres is the system of record, not a swappable backend.
- **Questions stay inside `quizzes`.** One aggregate, one save, one version counter.
- **A repository may read another module's table and may not write it.**
- **Owner and transaction come from AsyncLocalStorage**, established by middleware at the top
  of the Express stack, populated by guards, failing closed when absent. The reviewer preferred
  keeping per-owner factories and adding ALS later; the plan puts ALS in phase 1 because without
  it use cases cannot be Nest singletons and every moved module would need to be touched twice.
  The five tests in §8 are the price of that choice and are not optional.
- **No `nestjs-cls`.** `node:async_hooks` is enough.
- **Use cases carry `@Injectable()` and explicit `@Inject`.** The alternative, one factory
  provider per use case to keep them decorator-free, is 47 entries of boilerplate for a
  framework boundary no test needs.
- **Errors know their status.** `error-map.ts` is deleted; `details()` is per class.
- **URLs and prefixes do not change.** `/bot/*` and `/app/*` stay; they share controllers.
- **No `common`, `helpers`, `utils` dumping grounds** beyond `shared/utils` for layer-free
  primitives and `core` for the six base types listed in §3.
- **Domain names are not renamed in this rewrite.** `QuizSet`, `Folder`, `createQuizSet` and
  friends keep their names while they move. The module is `quizzes` because that is the table
  and the wire vocabulary; a domain rename is a separate change with its own diff.

### Open

- **Personal tokens on REST.** `PracticePrincipalGuard` accepts cookie or bot token only. Letting
  a PAT reach the practice routes is a product decision about what a PAT is for; nothing in this
  plan needs it.
- **`admin` behind the Nest router.** Today `adapters/admin/api.ts` is a fetch-style router
  adapted through `fetch-routes.ts` middleware. Moving it to `modules/admin` can keep that
  adapter or rewrite the 647 lines as controllers; the plan only requires the move.
- **`packages/contracts` shape.** `BOT_ROUTES` is a flat map with `auth/*` and `sets/*` mixed.
  Splitting it per module would help the api and touch four consumers; not in scope here.

## 11. Docs to update in phase 7

- `CLAUDE.md` — the "know which code you are touching" section, the `apps/api` naming rules,
  every path under `apps/api/src` it names (`persistence/postgres/owner.ts`, `error-map.ts`,
  `modules/auth/build-auth.ts`, `adapters/mcp/http/`, …).
- `AGENTS.md` — the architecture boundaries section names `ARCHITECTURE.md` for v1 and this
  file for v2; after phase 6 there is no v1-shaped code left in `apps/api`.
- `ARCHITECTURE.md` — becomes a history document or is rewritten around §3–§6 here.
- `HANDOFF.md`, `README.md` — path references only.
