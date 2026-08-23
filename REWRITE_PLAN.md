# Recall Quiz — platform rewrite: brief, investigation, and plan

> Working document. It holds the original request verbatim, then the
> investigation findings and recommendations per numbered item, then the
> sequencing and the open decisions. Everything about this rewrite lives here.
>
> Status: **investigation complete, revised after adversarial review, decisions pending.**
> No code changed yet. Written 2026-08-23 against commit `d17a161`.
>
> **Revision log**
> - r1 — first investigation pass.
>   - r10 — the **ETL exists and verifies itself**. It migrates the real backup into the new
>     schema with every count matching and a `verifyMigration` pass, is idempotent, and is
>     covered by tests. One postgres.js encoding trap cost most of the time: see below.
>   - r11 — the **transaction topology exists and works**: an async `UnitOfWork` that hands
>     repositories to the operation, the first Postgres repository behind it, and a rollback
>     test proving the boundary. No use case has moved yet.
>   - r12 — **"per bounded context" is retracted.** The repositories are welded together by SQL:
>     the attempt repository joins `questions`, and the folder repository reads `quiz_sets`, so
>     no context can sit on a different engine from its neighbour. Phase 5 is a single cutover.
>     Added the enabler that makes that safe: one contract suite, run against both a Postgres
>     and an in-memory implementation of the same async port.
>   - r13 — the **quiz repository is ported, and the delete-and-reinsert pattern is gone**:
>     diffing upsert, `version` for optimistic concurrency, survivors keeping their ids. Two of
>     five repositories now have both implementations behind a shared contract.
>   - r14 — the **attempts repository is ported**, statistics queries included, and the
>     migration is now **lossless**: r9's decision to leave ownership out took the legacy
>     `telegram_user_id` with it, which the domain still requires. Three of five repositories
>     paired.
> - r9 — the **§6 schema exists** as one Postgres migration with the approved names
>   (`pages`, `quizzes`, `term_pairs`, `attempts`, `responses`, `review_states`,
>   `study_settings`, `attempt_questions`, `question_sources`, `quiz_attachments`), applied and
>   its constraints tested. A pre-migration backup of the live database was taken and verified
>   against it. Repositories and the ETL are still not written.
> - r8 — **phase 5 started, not finished.** Postgres 17 in Docker, drizzle over postgres.js,
>   an isolated-schema test harness, and the transaction semantics the whole phase depends on
>   now pinned by tests. One measured finding changes the design: on Postgres an unawaited
>   write **survives a rolled-back transaction**, 8/8 deterministic. Repository and use-case
>   porting has not started. See "Phase 5, first slice".
> - r7 — **phase 4 done**: Nest shell on Express, `GET /quizzes`, `GET /quizzes/:id`,
>   health, Swagger, domain-error filter, and the 35 `*UseCase` renames. Runs on **Bun**, not
>   Node — see the phase-4 note. Explicit `@Inject` everywhere, `emitDecoratorMetadata` off.
>   1382 tests.
> - r6 — **phase 3 deleted as a standalone phase** and folded into phase 5. It is not
>   implementable on its own: transaction boundaries nest, so widening repositories to
>   `Promise` would leave unawaited promises inside a synchronous transaction callback.
>   Codex's finding #2 was right and my r2 "middle path" was wrong — second correction to
>   the same finding, recorded in §9. Phase 4 (Nest shell) is unblocked and next.
> - r5 — **phase 2 done**: Bun workspace, `src/` → `apps/api/src/`, `packages/tooling`, and
>   the dependency direction now enforced by `biome.json` rather than documented. Same 1377
>   tests. One refinement the plan had not stated: `apps/{web,bot,mcp,admin}` are **not**
>   created yet — see the note under phase 2.
> - r4 — phase 1 implemented, and **finding 11 corrected**: the question-delete path was
>   already guarded (`AnsweredQuestionError`, commit `73a414e`), so r2's "history is being
>   destroyed" was overstated. The real defect was option-id re-minting on edit, now fixed
>   in three lines following the convention `UpdateVocabulary` already used.
>   `question_revisions` is downgraded to optional. Telegram **webhook** decided.
> - r3 — owner decisions applied (see "Decisions"): TanStack Start + TanStack Query on Bun,
>   Better Auth, `CLAUDE.md` amended, bot as API client, uuidv7, renames approved,
>   private-v1-then-marketplace, `DEVELOPMENT_PLAN.md` replaced. Also: **Express not
>   Fastify**, `*UseCase` naming, and the package layout collapsed into `apps/api`
>   (§1) — the last one after actually testing the alternative, see Appendix B. §8 also gains
>   the full `apps/api/src/modules/` structure: per-module files, the wiring pattern, the
>   module dependency rules, and where today's 34 use-case files land.
> - r2 — revised after an adversarial architecture review (GPT-5 / Codex, read-only over
>   this repo). Seven of its claims were independently verified against the code and
>   accepted; they changed §2 (sequencing), §5 (auth propagation), §6 (ids, study items),
>   §7 (unique constraints), §8 (events, analytics), the roadmap, and the decision list.
>   Two are **current bugs, not plan gaps** — see baseline findings 11 and 12. Every claim it made that I
>   verified as wrong or overstated is marked as such in §9.

---

## 0. The original request (verbatim)

> Hi, intestigate please on current app and achitecture. what i want; we need to rewrite it i guess, because current architecture looks not very scalable for me.Also, investigate on all this stuff i want to add and reimplement/refactor:
> 1) architecture: curretn app not very scalable, what is written in ARCHITECTURE.md or CLAUDE.md not suites me anymore. would be nice to migrate app into monorepo with apps folder where will be admin/ bot/ api/ mcp/ and so on (if api can hold bot and mcp, would be nice, but guess bot better be implemented as separete app, so let's stick with this). also, packages fodler where shared code will be stored in packages. why: as i told, not scalable, i can't normally extend and develop admin or api.
> 2) migrating from sqlite to postgresql: why - i will later deploy this app and want to use supabase postgres for database, so better to migrate on postgres (but guess after architecture migration)
> 3) multi user support: so, other users can create quizes, sets and so on and practice themselves
> 4) complete web platform (as separate app in apps folder): it will later have all admin functionality but per user, users could practice in it (not in telegram bot). web platform must have advanced statistic and analytics
> 5) advanced auth: before it, guess registration should be via telegram bot, user start bot, it sends link to platform, user goes to platform with this link and endless cookie for auth sets, but later would be nice to add second method: email + password auth, so we can go away from telegram bot
> 6) database refactor (guess should be done with step 2, migrating to postgres + at the same time updating database schema). currently, most things do not make sense, like vocabulary-item, not very descriptive + not general.
> 7) summaries: like notion pages: md pages, where user can write summary of som learning, then tell chatgpt via mcp to generate quiz/quizes for this summary and in web platform, user can see quizes in some section that will be displayed under summary (first summary is displated, user reads it, at the bottom of page quizes are shown with progress if they were completed before (better not like this, but according with name of quiz, when open - all attempts are shown with score and user can go to that attempt and see where he failed, what he selected, what was right and so on). For summaries would be  nice to have also folder structure. like when i read book i can create Programming folder, inside Books, inside BookName and inside summaryies for each chapter, when go inside, quizes will be attached. Quizes can be without summaries, like as right now, under some folder. For quizes: they will be attached to summary + they will have their own placement in quiz folders, like quiz for that book in Programming/Books/[name]/[chapter] can be stored just in Books/[quizname] for example. summaries must be accessible for mcp, so i can just send book to some ai, tell him to write summary for given chapter or subchapter, he will create it and store in our app. what important: folders, like pages in notion. we can have Books/[name]/Chapter1Summary.md and inside of it could be references to each subchapter summary. like in notion: nested pages functionality should apply.
> 8) about architecture: review with skills (guess you have acess to them) which architecture and which pattern to use. Abotu step 1: i wnat api to be writen with NestJs, guess swagger wll also be nice to have.
>
> For no, that's all, create some fill where you will store this exact prompt  + under it after investigation you will write 1) Architecture change: findings and suggestions and so on, then 2)... and so on. so everything is stored in one fil and context is kept

---

## Baseline: what actually exists today

Measured, not assumed.

| Fact | Value |
| --- | --- |
| Production code | ~28 000 lines TS/TSX under `src/` |
| Test suite | **1375 tests, 90 files, all green in 7.7 s** |
| Files per layer | adapters 125, application 74, domain 51, infrastructure 16, shared 12, composition 1, entrypoints 4 |
| Runtime | Bun only; `bun:sqlite` + drizzle-orm (sqlite dialect) |
| Processes | 4 entrypoints: `telegram`, `mcp` (stdio), `mcp-http` (Express, OAuth), `admin` (Bun.serve + react-admin SPA) |
| DB | one SQLite file, 13 hand-written migrations + a custom migrator with table-rebuild support |
| Identity | a single number: `ALLOWED_TELEGRAM_USER_ID`, referenced **252 times** across domain, application, adapters, and schema |
| Admin auth | one shared passphrase → HMAC-signed cookie, 12 h; no user record anywhere |

**The honest verdict: the code is not the problem — the shape of the problem changed.**

What is genuinely good and must be preserved, not rewritten:

- The domain layer is pure, framework-free, and heavily tested (`quiz-set`, `quiz-attempt`, `repetition`, `settings`, `folder`, `practice`, `vocabulary`). ~830 lines of tests for `quiz-set` alone. This is the asset.
- The application layer is already ports-and-adapters done properly: 40 use cases as classes with `constructor(dependencies)` + `execute()`. **That signature maps 1:1 onto NestJS providers** — see §8.
- Adapters are genuinely isolated: Telegram, MCP, admin, and SQLite each translate at their own boundary. Swapping SQLite for Postgres touches one folder plus the port signatures.
- `scripts/up.ts` (283 lines + 4 tested helper modules) is a real multi-process supervisor with port handling and readiness checks. Reuse it for the monorepo.

What is genuinely blocking, with evidence:

1. **Every persistence port is synchronous, by explicit design.** `src/application/ports/transaction.ts` defines `type Synchronous<TResult> = TResult extends PromiseLike<unknown> ? never : TResult` — the type system *forbids* returning a promise from a transaction. Repositories match: `save(quizSet): void`, `findById(id): QuizSet | undefined`. This is correct for `bun:sqlite` and **completely incompatible with Postgres**. 26 `transaction.run` call sites, 5 repositories, ~40 use cases, ~90 test files.
2. **Identity is a Telegram integer threaded through the domain.** `telegramUserId: number` appears in `domain/quiz-attempt/quiz-attempt.types.ts`, `domain/repetition/`, every attempt/statistics/repetition use case, both attempt repositories, and the schema. There is no `users` table.
3. **No ownership on content.** `folders`, `quiz_sets`, `questions`, `vocabulary_items` have no owner column. Attempts and repetition schedules are per-`telegramUserId`; content is global. Multi-user requires touching every content table and every content query.
4. **A singleton settings row.** `repetition_defaults` has `check (id = 1)`. Global defaults for one user, structurally impossible for many.
5. **Whole-aggregate rewrite on every save.** `SqliteQuizSetRepository.save()` deletes all `question_options`, deletes all `questions`, then re-inserts everything. Fine for one author on a local file; it is write amplification plus a lost-update race the moment two clients (web + MCP) edit one quiz. No `version` column, no optimistic concurrency.
6. **Relational data encoded as TEXT.** `tags`, `quiz_attempts.question_ids`, `question_responses.selected_option_ids`, `repetition_settings.intervals_days` are JSON strings. Timestamps are TEXT, booleans are INTEGER. Analytics SQL cannot touch any of it.
7. **A soft link with no foreign key.** `questions.vocabulary_item_id` is a plain `text` column (`drizzle/0005_vocabulary_items.sql`), untyped in the domain (`readonly vocabularyItemId?: string`, not a branded id), with no `references()`. `list-vocabulary` and `update-vocabulary` resolve it by string comparison in application code. This is the "does not make sense" the request names, and it is worse than it looks.
8. **The admin API is 603 hand-written lines** of `Bun.serve` routing that reimplements react-admin's json-server protocol, with ad-hoc `given()` / `trimmed()` coercion instead of a validation layer, no OpenAPI, and `Application` (a 38-field god-object interface) injected wholesale. This is exactly the "I can't normally extend admin or api" pain, and it is the correct thing to delete.
9. **MCP OAuth has no user dimension.** `oauth_clients`, `oauth_codes`, `oauth_tokens` bind to a client id, never to a person. After multi-user, a token must name its owner.
10. **Docs have drifted.** `DEVELOPMENT_PLAN.md` is deleted in the working tree but still referenced by `CLAUDE.md`, `AGENTS.md`, and `DESCRIPTION.md`. `docs/` is gitignored, so all implementation plans are untracked. `README.md` is 60 KB / ~1000 lines of Ukrainian operator manual — valuable, but it will need splitting per app.

11. **One real hole in attempt history — narrower than r2 claimed. Now fixed.**

    > **Correction (r4).** r2 asserted that completed attempt history "is already being
    > destroyed" by two paths. I verified that both code paths *exist* but not that either
    > was *reachable*, which is the wrong bar. One was already guarded. The claim was
    > overstated and is corrected here.

    - **Question deletes: already guarded, no bug.** `question_responses.question_id` does
      cascade (`schema.ts:224-226`), but `DeleteQuestion` refuses to delete any question
      with recorded answers — `AnsweredQuestionError`, *"deleting it would take them with
      it. Edit it instead."* Commit `73a414e` documents the cascade, counts the exposure in
      the author's own database ("145 questions carry answers and 127 carry a schedule"),
      and adds the guard on purpose. This was known and handled before I looked at it.
    - **Option-id re-minting on edit: real, unguarded, and now fixed.**
      `UpdateQuestion.rebuilt()` minted brand-new option ids whenever `options` were
      supplied, so the `selected_option_ids` already stored in `question_responses` pointed
      at ids that no longer existed. `attempt-detail.presenter.ts:40-44` resolves each
      stored id against the question's current options and falls back to `"?"`, so a past
      attempt review literally displayed **"?" instead of what you had chosen.** Reproduced
      end to end (start → answer → finish → edit options → review) before fixing.

      The fix follows a convention this codebase had already established elsewhere:
      `UpdateVocabulary` builds option ids deterministically as `${question.id}-${index}`
      (`update-vocabulary.ts:83`), making position the option's identity. `UpdateQuestion`
      now reuses the existing option id at the same position and mints one only for a
      genuinely new position. Three lines, two regression tests, no new table.

      Caveat worth knowing: position-as-identity means *reordering* options re-points a
      stored selection at whatever now sits in that slot. That is the same trade-off the
      vocabulary path already accepts, and the alternative (identity by text) would re-mint
      on every typo fix, which is the bug we just removed.

    - **Remaining minor hole, not fixed.** `answerCount()` is global, so a question that was
      *presented but never answered* can still be deleted; `GetAttemptDetail` then silently
      `continue`s over it (`get-attempt-detail.ts:84-88`) and a completed attempt quietly
      loses an item, changing its denominator. Narrow, and it needs the revision model or a
      per-attempt presence check to close properly — see §6.

12. **Telegram callback data is hard-capped at 64 bytes** and enforced
    (`callback-data.ts:4`, `CallbackTooLongError`). Ids travel inside composite callback
    payloads, which constrains any id-format change — see §6.

Scale reality check: this is a personal learning tool that may grow to tens or low hundreds of users, each with thousands of questions. **Nothing here needs microservices, event sourcing, sharding, or CQRS-with-separate-stores.** The scalability that is missing is *developer* scalability — clear module seams, a real API contract, a framework doing the boring HTTP work — plus the multi-user data model. Design for that, and refuse the rest.

---

## 1. Architecture change: monorepo + NestJS

### Findings

- The current single-package layout has one composition root, `src/composition/create-application.ts` — a flat `Application` interface with 38 use-case fields. Every entrypoint receives everything. Adding a fifth surface (web) makes this worse; there is no module seam to hang new features on.
- `CLAUDE.md` bans Express and Vite and mandates `Bun.serve` (with one carve-out already granted for MCP's Express-based OAuth router). **NestJS cannot honour that rule** — it is Node-first and runs on Express or Fastify. TanStack Start additionally requires Vite (with Nitro for deployment; a `bun` preset exists). **Amendment confirmed by the owner (r3).**
- Bun *can* run Nest, but it is not the supported path (Nest leans on `reflect-metadata`, decorator emit, and Node APIs). Betting the API on Bun+Nest buys nothing and costs debugging time.

### Express, not Fastify (r3)

r1 said "Nest + Fastify". **The owner asked why, and was right to.** My reason was throughput,
which is the wrong axis for an app whose bottleneck is Postgres and a Telegram round-trip.
Every reason that actually applies here points at Express:

- The MCP SDK's OAuth pieces — `mcpAuthRouter`, `requireBearerAuth` — **are Express
  middleware**. On Express they mount directly; on Fastify they need `@fastify/middie` and
  a compatibility layer, for a subsystem that is already the fiddliest part of the codebase
  (§5).
- Better Auth (decision 2) ships a Node/Express handler and documents that path.
- `@nestjs/platform-express` is Nest's default and best-documented adapter; every Nest
  recipe, guard example, and Swagger integration assumes it.
- The existing `src/adapters/mcp/http/app.ts` is already Express, so it *ports* rather than
  gets rewritten.

Fastify would be the right call if this were a high-throughput JSON service. It is not.
**Decision: `@nestjs/platform-express`.** Revisit only if a measured p99 problem traces to
the HTTP layer, which would be surprising.

### Recommendation

Bun workspaces, no Turborepo yet (add it only when CI time actually hurts — `bun run --filter` covers the rest). Node runtime for `api`; Bun everywhere else.

**Revised in r3: two packages, not six.** r1 put `domain`, `application`, and `db` in
`packages/`. The owner pushed back — "why separate packages, why not keep it all in api?" —
and the pushback is correct. A package boundary earns its keep only when a **second consumer**
exists. Once `bot`, `mcp`, `web`, and `admin` are HTTP clients, the only consumer of
`domain` / `application` / `db` is `api`. See §8 and **Appendix B**, where the three options
are actually built and run rather than argued about.

```text
recall-quiz/
├─ apps/
│  ├─ api/                    NestJS + Express, REST + Swagger. Node. Sole DB owner.
│  │  └─ src/
│  │     ├─ domain/           pure business rules — moves as-is from src/domain
│  │     ├─ application/      use cases + ports — moves as-is, async-ified
│  │     ├─ persistence/      drizzle schema, migrations, Postgres repositories
│  │     └─ modules/          nest modules per bounded context (§8) + composition
│  ├─ web/                    TanStack Start + TanStack Query. Vite + Nitro (bun preset).
│  ├─ bot/                    Telegraf. Bun. Thin API client.
│  ├─ mcp/                    MCP stdio↔HTTP bridge. Bun. Thin API client.
│  └─ admin/                  react-admin operator console (superuser role)
├─ packages/
│  ├─ contracts/              zod schemas + generated OpenAPI client — 4 real consumers
│  └─ tooling/                tsconfig bases, biome config — every workspace
├─ scripts/                   up.ts supervisor, extended to boot api+web+bot+mcp
└─ REWRITE_PLAN.md            this file
```

The layering *inside* `apps/api` is unchanged — same folders, same dependency direction,
same tests. What changes is that it is enforced by **a lint rule instead of a build graph**
(§8, Appendix B), which turns out to give better error messages for less setup.

**Where the MCP server lives.** Split it, do not duplicate it:

- The MCP *tools* become a NestJS module inside `apps/api` served over Streamable HTTP. Nest mounts Express middleware directly, so the MCP SDK's `mcpAuthRouter` / `requireBearerAuth` finally sit in a framework built for them — the existing carve-out in `CLAUDE.md` stops being a wart.
- `apps/mcp` shrinks to a ~150-line stdio↔HTTP bridge for local Claude Desktop / Codex, holding a personal access token. No DB access, no duplicated tool logic.

**Bot: API client, not a second DB writer.** The request already lands on "bot as a separate app". Make it a *thin* one:

- One process owns Postgres (`api`). Authorization, validation, and transactions have exactly one home.
- The bot keeps only Telegraf plumbing: middleware, callback-data encoding, presenters, screens. That is ~2/3 of today's Telegram adapter and it stays.
- Cost: an HTTP hop per callback (single-digit ms same-region) and the bot is down when the API is down. Acceptable — they deploy together anyway.
- Rejected alternative: bot imports the API's application layer and opens its own Postgres pool. Faster, but then two processes enforce ownership rules, and every future authorization rule must be written twice. Not worth it.

**Nothing outside `apps/api/src/persistence` may touch the database.** With the r3 layout
there is no importable `packages/db` at all, which removes the failure mode structurally —
no other workspace *can* import it. The remaining risk is internal: a controller reaching
past the application layer into drizzle. That is the biome rule in §8.

**One TanStack Start–specific guardrail.** Start gives `apps/web` a real server (server
functions, SSR loaders). That makes it *easy* to open a Postgres connection straight from a
server function and bypass the API entirely — convenient, and it would silently recreate the
two-writers architecture this plan rejects. Rule: **web server functions are HTTP clients of
`api`, never database clients.** `apps/web` must not depend on drizzle or `pg`/`postgres` at
all; enforce it with the same restricted-import mechanism, where a missing dependency in
`apps/web/package.json` already makes it a type error (Appendix B, option B — the one place a
package boundary genuinely does the work).

### Effort

Medium-large, but the *move* itself is mechanical: `domain/` and `application/` are lift-and-shift into `apps/api/src` with unchanged tests. The real work is §2 (async) and §5/§8 (Nest wiring). Do Phase 1 as a pure move with zero behaviour change and 1375 tests still green — that is the checkpoint that proves the split is right.

---

## 2. SQLite → Postgres (Supabase)

### Findings

The blocker is not the SQL dialect, it is **synchronicity**. Concretely, what has to change:

| Item | Today | Postgres |
| --- | --- | --- |
| `Transaction.run` | sync, `Synchronous<T>` forbids promises | `run<T>(op: (tx) => Promise<T>): Promise<T>` |
| Repository methods | `save(x): void`, `findById(id): X \| undefined` | all `Promise<…>` |
| Timestamps | `text` ISO strings | `timestamptz` |
| Booleans | `integer` + `check (col in (0,1))` | `boolean` |
| Lists (`tags`, `question_ids`, `selected_option_ids`, `intervals_days`) | JSON in `text` | `jsonb`, or normalized tables (§6) |
| Enums | `check (col in ('a','b'))` via `sql.raw` | keep as `text` + check (cheaper to evolve than a PG `enum`) |
| Ids | 18-char base36 from `crypto.getRandomValues` | **uuidv7** stored as `uuid`, with a compact 22-char form in Telegram callbacks (§6) |
| Migrations | custom migrator with table-rebuild logic | plain `drizzle-kit generate` — delete `migrator.*`, ~4 files |
| WAL / busy-timeout / `immediate` transaction handling | `database.ts`, hard-won | delete; replaced by a connection pool |

Supabase specifics that will bite if ignored:

- **Pooler vs direct.** Supabase's transaction-mode pooler (port 6543) does not support prepared statements. With drizzle + `postgres.js` set `prepare: false`, or connect directly on 5432 for a long-lived server (which `api` is) and keep the pooler for anything serverless. Migrations must run on the direct connection.
- **RLS.** The API connects as a privileged role and enforces ownership in application code. Turn RLS on anyway as defence-in-depth, so a future direct-from-browser query cannot leak. Do not make RLS the *primary* mechanism — debugging authorization inside PG policies from a Nest service is miserable.
- **`ltree` / `pg_trgm` / `pgvector`** are all available and relevant later (§7).

### Recommendation

**Convert the call sites to async while still on SQLite — but not the transaction
callback.** This is the most valuable sequencing decision in the document, and r1 got the
second half of it wrong.

> **Correction (r2).** r1 said: widen the transaction port to take an async callback and
> "wrap the existing `bun:sqlite` adapter in `async` functions — trivially correct". That
> is **unsafe**. `Database.transaction(fn)` commits when `fn` *returns*. An `async` callback
> returns a promise at its first `await`, so the transaction can commit while the remaining
> writes are still pending. The `Synchronous<T>` guard and the `behavior: "immediate"`
> comment in `sqlite-transaction.ts` exist precisely to make that a compile error. An async
> SQLite transaction facade would look atomic and not be — the worst possible failure mode,
> because the tests would still pass.

The safe version, in two steps:

1. **Widen the return type, keep the callback synchronous:**

   ```ts
   run<T>(operation: () => Synchronous<T>): Promise<T>
   ```

   Every repository method becomes `Promise<…>`; all 26 `transaction.run` call sites become
   `await transaction.run(…)`. Atomicity semantics do not change, the compile-time guard
   against awaiting inside a transaction **stays intact**, and the ~200-file mechanical
   churn is absorbed with the tests green on a database you already trust.

2. **Widen the callback only when Postgres arrives**, and do it per bounded context, moving
   each transactional use case together with its Postgres repository. `FinishQuizAttempt`
   depends on the attempt write and the schedule write being atomic
   (`finish-quiz-attempt.ts:66`) — that is exactly the kind of code that must not straddle
   two transaction models.

3. Run one shared repository/use-case contract suite against **both** SQLite and Postgres
   during the transition, so a context that has moved and a context that has not are both
   provably correct.

If instead you swap the DB and the concurrency model in one step, all 1375 tests fail at
once and you have no signal about which change broke what.

Then:

- New drizzle schema in `apps/api/src/persistence` (`dialect: "postgresql"`), single initial migration — this is a fresh schema (§6), not a translation of the 13 SQLite migrations.
- One-shot ETL script `scripts/migrate-sqlite-to-postgres.ts`: read the SQLite file, remap ids to uuidv7, parse the JSON-text columns, assign every row to your new user id, insert in FK order, verify counts. Run it once, keep the SQLite file as the backup.
- Repository integration tests (`tests/integration/sqlite/`, 9 files) move to real Postgres in Docker (testcontainers, or a `docker-compose.test.yml` + a per-run schema). Do not use an in-memory PG emulator — the whole point of these tests is real constraint behaviour.

### Effort

Large, and almost entirely mechanical once the async step is done. Async step: touches ~200 files, ~2 days of disciplined work. Postgres adapter + schema + ETL: comparable.

---

## 3. Multi-user support

### Findings

- `telegramUserId: number` is in the **domain** (`quiz-attempt.types.ts`, `repetition.types.ts`) — a transport identity leaked into business rules. 252 references.
- Content tables have no owner at all. Attempts and repetition schedules are already per-user, which is a real head start: the study side of the model is nearly multi-user already; the content side is not.
- `repetition_defaults` is a hard singleton (`check (id = 1)`).
- No `users` table, no sessions, no roles.

### Recommendation

**Identity as its own bounded context**, and a branded `UserId` that knows nothing about Telegram.

**Revised in r3: use Better Auth's schema, do not invent a parallel one.** Decision 2 picked
Better Auth, and it already ships exactly the tables r1 was about to hand-roll:

| r1 was going to create | Better Auth already has |
| --- | --- |
| `users` | `user` — `id`, `name`, `email`, `email_verified`, `image`, timestamps; extend with `timezone`, `locale`, `role` via `user.additionalFields` |
| `user_identities` | `account` — `provider_id`, `account_id`, `user_id`, `password`, unique `(issuer, account_id)` |
| `sessions` | `session` — `token`, `expires_at`, `ip_address`, `user_agent`, `user_id`, cascade on user delete |
| email verify / reset tokens | `verification` — `identifier`, `value`, `expires_at` |

So Telegram sign-in is an `account` row with `provider_id = 'telegram'`, `account_id =`
the Telegram user id; the later email+password login is an `account` row with
`provider_id = 'credential'` and a hash in `account.password`. **Account linking is then a
feature of the library, not a migration** — which is exactly what decision 2 bought.

```ts
type UserId = BrandedId<"UserId">;   // = better-auth `user.id`, a uuid
```

Two integration notes: point Better Auth's id generator at uuidv7 rather than its default
`gen_random_uuid()` (v4) so decision 5 holds for auth rows too; and generate its Drizzle
schema into `apps/api/src/persistence` so there is still exactly one migration history.

**Ownership.** Add `owner_id uuid not null references users(id)` to every content root: `pages`, `quizzes`, `questions` (denormalized from quiz — worth it for analytics), `term_pairs`, and all settings rows. Then:

- Repository methods take the owner scope **explicitly** as an argument — the codebase already does exactly this with `telegramUserId`, so keep the habit. It beats an ambient request-scoped context because the type checker catches an unscoped query.
- A denormalized `questions.owner_id` can **drift out of agreement with its quiz** unless the database enforces the pair. Either enforce it with a composite foreign key `(quiz_id, owner_id) → quizzes(id, owner_id)`, or drop the redundant column and pay for the join. Do not carry an unenforced duplicate of the ownership fact; that is the kind of thing that leaks one user's question into another user's analytics.
- One `OwnershipPolicy` in the application layer, called by use cases, throwing a typed `ForbiddenError` mapped to 403 at the adapter. Not in the domain: "may this person read this" is not a business invariant of a quiz.
- Postgres RLS as the second layer.

**Sharing: private v1, marketplace later (decision 7, r3).** Build nothing now, but reserve
the column: `visibility text not null default 'private' check (visibility in
('private','unlisted','public'))`. Attempts, responses, and review state are *always*
private — never shared, not even for a published quiz.

Because a **marketplace** is now a stated destination rather than a vague maybe, two cheap
things are worth doing while the schema is being written, since both are expensive to
retrofit:

- **Copy-on-practice, not cross-user reads.** When someone practises a published quiz, fork
  it into their own space (`origin_quiz_id`, `origin_version`) instead of pointing their
  attempts at another user's rows. It keeps every ownership query single-tenant, lets the
  author keep editing without corrupting other people's history, and makes "the author
  deleted it" a non-event. This is the same reasoning as `question_revisions` in §6, one
  level up.
- **Publishing is a distinct lifecycle from `published`.** The existing `QuizSetStatus`
  (`draft → published → archived`) means "visible in *my* bot". A marketplace needs a second
  axis — `visibility`, plus eventually a listing record with a title, description, and
  moderation state. Do not overload the existing status enum; that is a rename you would
  regret. One reserved column now, the listing table when the marketplace is actually built.

Everything else about the marketplace (discovery, ratings, moderation, payments) stays out of
scope and out of the schema until it is real.

**Settings.** Replace `repetition_settings` + `repetition_defaults` with one resolvable table:

```text
study_settings(owner_id, scope_type ('user'|'page'|'quiz'), scope_id nullable, …)
unique (owner_id, scope_type, scope_id)
```

Resolution chain user → page(folder) → quiz, resolved in the application layer. This kills the singleton row *and* delivers folder-level settings, which the current code cannot do at all.

### Effort

Medium-large. Best done as one atomic phase *after* Postgres, because it is largely a schema + signature change and you want a single migration for it.

---

## 4. Web platform

### Findings

- The only existing UI is react-admin over the hand-rolled 603-line admin API. It is operator tooling, not a product surface — a good throwaway.
- `GetAttemptDetail` already returns exactly what the request describes for the attempt-review screen: per-question `answered / isCorrect / skipped / typedAnswer / selectedOptionIds / creditEarned / creditPossible` plus the full `Question`. **The hardest part of the review UI is already built and tested** — it just needs an HTTP endpoint and a React view.
- `GetQuizStatistics` gives attempts, set accuracy, per-topic accuracy, incorrect question ids, and first-vs-last improvement. That is a solid analytics v1, computed per request. "Advanced analytics" (heatmaps, retention curves, forecast of due load) needs real SQL aggregates, not in-memory loops.

### Recommendation

**Two apps, distinct audiences** (as the request already implies): `apps/web` = the product, per user; `apps/admin` = react-admin superuser console over all users, kept deliberately minimal.

**Stack for `apps/web`.** Honest recommendation: **Next.js (App Router) on Node.**

- Not because of SSR — the app is a logged-in dashboard and SEO is irrelevant. Because of the ecosystem you will actually lean on: file-routing, cookie/session handling on the server, middleware for auth redirects, image handling, and the fact that every editor and chart library documents itself against it.
- The alternative that respects `CLAUDE.md` as written is a Bun-served SPA (`Bun.serve` + HTML imports, exactly the pattern `apps/admin` already uses) with TanStack Router + TanStack Query. This is genuinely viable and keeps one runtime. Choose it if you value toolchain purity over ecosystem depth. It is the smaller bet; Next.js is the better product bet.
- Either way: React 19, TanStack Query for server state, Tailwind + shadcn/ui, Recharts (or visx if the charts get bespoke).

**Analytics.** Add read-model tables/views in `apps/api/src/persistence`, refreshed on write or materialized:

- `question_stats(question_id, owner_id, attempts, correct, avg_credit, last_seen_at)`
- `daily_activity(owner_id, day, attempts, questions_answered, correct, minutes)` — powers the streak/heatmap
- `topic_stats(owner_id, topic, …)`, plus due-load forecast straight off review state

This is CQRS-lite: separate read models, one database, no event store. Do not reach past that.

### Effort

Large — it is a new product surface. Ship it in slices: auth → browse tree → practice one quiz → attempt review → dashboards → summary editor.

---

## 5. Advanced auth

### Findings

- Today: one shared passphrase → HMAC cookie, 12 h, no user record, no revocation (`src/adapters/admin/session.ts`).
- MCP HTTP has a static bearer token plus a real OAuth 2.1 authorization server with PKCE (`src/adapters/mcp/http/oauth/`) — genuinely good work, and **none of it names a user**.

### Recommendation

The described flow is the right one. Precisely:

1. User sends `/start` to the bot. Bot calls `POST /auth/telegram/link` on the API with the verified Telegram user id.
2. API upserts `user` + `account(provider_id='telegram', account_id=<telegram id>)`, mints a **single-use, 5-minute** login token (store only its hash — Better Auth's `verification` table fits), returns `https://app.example/auth/callback?token=…`.
3. Bot sends the link. Browser hits the callback; API validates, consumes the token, creates a **session row**, sets the cookie.
4. Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`, 1 year, **rolling** (re-issued on use).

On "endless cookie": make it a long-lived *opaque session id backed by a `sessions` table*, not a long-lived JWT. Same user experience, but you can revoke a device, list active sessions, and force logout. An endless stateless JWT cannot be taken back.

**Phase 2 — email + password.** Because §3 uses Better Auth's `account` table, this is additive: a second `account` row with `provider_id='credential'` and a hash in `account.password`, plus the verification and reset flows the library already ships. Account linking works for free: same `user_id`, two `account` rows. A Telegram-registered user later adds a password and the bot becomes optional — exactly the stated goal.

**Decided (r3): Better Auth.** It covers sessions, email/password, verification, and reset;
the Telegram one-time-link flow becomes a small custom plugin. The unglamorous parts —
verification emails, reset expiry, rate limiting, CSRF, session rotation — are where
hand-rolled auth actually goes wrong, and they are most of the work. (Supabase Auth was not
recommended despite Supabase Postgres: a Telegram-first flow plus a custom Nest API fights
its assumptions.)

**It lives in `apps/api`, mounted on Express at `/api/auth/*` — not in `apps/web`.** This is
the one Better Auth decision with architectural consequences. TanStack Start has a server, so
it *could* host Better Auth itself, and most tutorials do exactly that. Here that would be
wrong: the bot, the MCP bridge, and `admin` all need the same identity, and the API already
must resolve a principal for every request (§5, MCP OAuth). Two auth authorities means two
session stores and a permanent question of which one is right. `apps/web` uses
`better-auth/client` and forwards cookies; the API is the only issuer.

**MCP after multi-user.** Two paths, both needed:

- **Personal access tokens** (`api_tokens`: id, owner_id, name, token_hash, scopes, last_used_at, expires_at) — the simple path for `apps/mcp`, Codex, and any script.
- **The existing OAuth server, extended with a user dimension** — for claude.ai / ChatGPT connectors, which cannot carry a static token. `oauth_codes` and `oauth_tokens` gain `user_id`, and the consent screen requires a logged-in session instead of a passphrase.

**Propagating the principal is the actual work — columns are not enough.** Today
`issue(clientId, scopes)` stores only a client and scopes (`oauth/provider.ts:74-81`);
there is no user anywhere in the grant. Adding a `user_id` column does not make the
authenticated person reach the tool. What is required:

- bind the user at **authorization-code** creation, from the consent screen's session;
- **carry it through refresh-token rotation** (the common place this silently breaks);
- have bearer verification return a **typed principal**, not a boolean;
- make every MCP tool and use case take `UserId` as an argument — the type checker then
  refuses an unscoped tool;
- honour session/account revocation and `resource`/audience validation.

**And the bot must never be trusted to assert who it is acting for.** The bot authenticates
to the API with its own internal credential and sends the *Telegram* id; the **API** maps
that to a `UserId` server-side. There must be no endpoint that accepts a caller-supplied
`userId` or `telegramUserId` — that would be an authorization bypass reachable by anyone
holding a bot token or a leaked internal URL. Worth stating explicitly because the current
code passes `telegramUserId` inward as a plain parameter everywhere, and that habit
becomes a vulnerability the instant the boundary is HTTP.

Also: rate-limit login-link issuance per Telegram id, and add an audit log (`auth_events`) from day one. Cheap now, impossible to backfill.

### Effort

Medium. Phase 1 (telegram link + sessions) is small and unblocks the web app. Phase 2 (password) is small on top of the right schema. Extending MCP OAuth to users is the fiddly part.

---

## 6. Database + domain-model refactor

### Findings — where the current model does not make sense

1. **`vocabulary_item` is the worst offender**, and for a deeper reason than its name. It is a *knowledge atom* (a term ↔ translation pair, with transcription and example) that *generates* questions in two directions (`cardsOf()` in `domain/vocabulary/vocabulary-item.ts`). But the link to the generated question is a bare, untyped, un-foreign-keyed `questions.vocabulary_item_id text`, resolved by string comparison in `list-vocabulary.ts` and `update-vocabulary.ts`. The concept is right; the modelling is a hack.
2. `quiz_sets` — "set" is noise. It is a quiz.
3. `question_repetition_schedules` — long, and locked to a fixed interval ladder (`intervals_days`), so it cannot hold FSRS/SM-2 state (stability, difficulty) later.
4. `repetition_settings` + `repetition_defaults` — two tables, one singleton row, no per-folder scope.
5. `quiz_attempts.question_ids` as JSON text — the *ordering* of a session is data. It should be joinable.
6. `folders` will collide with §7's pages: two hierarchies for one mental model.
7. Missing: `users`, ownership, `version` for optimistic concurrency, soft deletes, `deleted_at`, full-text search.

### Recommendation — the target model and its vocabulary

Rename deliberately, once, in the same migration as the Postgres move. A shared ubiquitous language:

| Today | Target | Why |
| --- | --- | --- |
| `folders` + (new) summaries | **`pages`** | one Notion-like tree; a folder is a page with children (§7) |
| `quiz_sets` | **`quizzes`** | "set" carried no meaning |
| `questions` | `questions` | keep |
| `question_options` | `question_options` | keep |
| `vocabulary_items` | **`term_pairs`** | says what it is; generalizable later without a data migration |
| — | **`question_sources`** | explicit FK: which term pair generated which question |
| — | **`question_revisions`** | immutable snapshot of a question as presented (fixes finding 11) |
| `quiz_attempts` | **`attempts`** | keep the concept, drop the prefix |
| `question_responses` | **`responses`** | ditto |
| — | **`attempt_questions`** | the ordered session, replacing the JSON column |
| `question_repetition_schedules` | **`review_states`** | FSRS-ready |
| `repetition_settings` + `repetition_defaults` | **`study_settings`** | one resolvable table (§3) |
| — | `user`, `session`, `account`, `verification` (Better Auth, §3), plus `api_tokens`, `auth_events` | §3/§5 |

**The `vocabulary_item` fix — descriptive now, general later.**

> **Correction (r2).** r1 proposed `study_items(kind, payload jsonb)` with four kinds
> (`term_pair`, `definition`, `fact`, `cloze`). That invents three concepts whose invariants
> do not exist yet, and it moves known, well-constrained vocabulary columns into untyped
> JSON — trading real database constraints for speculative flexibility. The request asked
> for "descriptive + general"; naming solves the first half now, and the second half can be
> added later **without a data migration.**

```text
term_pairs(
  id, owner_id, quiz_id, page_id?,
  terms text[], translations text[],     -- real arrays, real constraints
  transcription, example, topic,
  created_at, updated_at
)
question_sources(
  question_id  → questions.id,           -- pk: one generating source per question today
  term_pair_id → term_pairs.id,
  direction
)
```

Every existing `VocabularyItem` field survives with its constraints intact; the only real
changes are the name, ownership, and a genuine foreign key replacing the string comparison
in `list-vocabulary.ts:56`. `cardsOf()` stays as-is.

When a second kind actually appears (cloze, definition), add `kind text not null default
'term_pair'` plus a `payload jsonb` for kind-specific extras, and dispatch through a
per-kind Strategy map — the shape `ARCHITECTURE.md` already prescribes for answer
evaluation. Additive, no backfill. If `question_sources` ever needs many sources per
question, widen the primary key then; assuming it now buys nothing.

**Immutable question revisions — optional, and no longer urgent (r4).**

The acute defect finding 11 described is fixed without any of this: option ids are now stable
across edits, so stored responses keep resolving. What revisions would additionally buy is
*textual* fidelity — showing the prompt and option wording **as they were when answered**,
rather than as they read today — plus a clean way to close the deleted-but-unanswered hole.

Whether that is worth a table is a product call, and it cuts both ways: commit `65dba08`
("Correct a word without losing what it taught you") argues that when you fix a wrong
translation you *want* the corrected wording everywhere, including in past reviews. Revisions
would show the old, wrong wording forever. **Recommendation: skip revisions for now**, and
revisit only if the marketplace makes it matter (a quiz you practised being rewritten by
someone else is a different situation from you fixing your own typo). The sketch is kept
below because the schema is cheaper to design now than to retrofit.

```text
question_revisions(
  id, question_id, revision integer,
  prompt, type, difficulty, explanation, source_reference,
  options jsonb,          -- text, is_correct, match_key, position — as presented
  created_at,
  unique (question_id, revision)
)
attempt_questions(
  attempt_id, position, question_id,
  question_revision_id → question_revisions.id,   -- exactly what the user saw
  presented_option_order jsonb                    -- the shuffle actually shown
)
```

Then: `responses` reference the **revision**, not the live question; the `on delete cascade`
from `questions` to answer rows is removed (soft-delete the question instead); editing a
question writes a new revision rather than re-minting option ids in place. A completed
attempt becomes permanently, correctly reviewable — which is what §7 promises the user.

**uuidv7, with a compact callback encoding (decision, r3).**

r2 argued for keeping the base36 ids because uuids would blow the 64-byte Telegram callback
budget. The owner chose uuidv7 anyway, so I measured the budget instead of guessing. **r2 was
mostly wrong** — the constraint is real but far less binding than claimed:

| callback shape | base36 (18) | uuid hyphenated (36) | uuid hex (32) | uuid base64url (22) |
| --- | --- | --- | --- | --- |
| `Answer`, 12 options | 46/64 | **64/64** | 60/64 | 50/64 |
| `Answer`, 6 options | 32/64 | 50/64 | 46/64 | 36/64 |
| `SettingsEdit` | 28/64 | 46/64 | 42/64 | 32/64 |
| `Browse` | 25/64 | 43/64 | 39/64 | 29/64 |
| `AttemptDetail` | 23/64 | 41/64 | 37/64 | 27/64 |

Measured directly against the shapes in `callback-data.ts:31-79`. The hyphenated form lands
**exactly on 64** in the 12-option multi-select worst case — it does not overflow, but zero
headroom is not a design. So:

- **Store** ids as Postgres `uuid`, generated as uuidv7 (time-ordered ⇒ index locality,
  and a standard type every tool understands).
- **Serialize** them in callback data as **22-char base64url** of the 16 raw bytes. Worst
  case drops to 50/64, leaving 14 bytes of headroom. The base64url alphabet
  (`A-Za-z0-9-_`) does not collide with the `:` and `,` separators already in use.
- Add a regression test that encodes every `Callback` variant at its worst case and asserts
  `< CALLBACK_DATA_LIMIT`. The limit is currently enforced only at runtime by
  `CallbackTooLongError`; a compile-or-CI-time assertion is what stops a future field from
  silently eating the margin.
- Optional extra headroom if it is ever needed: encode `optionPositions` as a base36
  bitmask instead of a comma list, which collapses the 25-char worst case to 2-3 chars.

Existing ids are remapped during the ETL (§ cutover), with the old id retained in a
`legacy_id` column for one release so anything that leaked out — a bookmarked callback, a
saved MCP reference — can still be resolved.

**Other concrete changes:**

- `review_states(owner_id, question_id, state, due_at, last_reviewed_at, reps, lapses, stability numeric, difficulty numeric, interval_days)`. Keep the current fixed-ladder scheduler as the default `Strategy`; the columns for FSRS exist from day one so adopting it later is a code change, not a migration.
- `attempt_questions(attempt_id, position, question_id, presented_options jsonb?)` — replaces `question_ids` JSON and *also* records the shuffled option order actually shown, which today is lost.
- `version integer not null default 0` on `quizzes` and `pages`, checked on write. Then replace delete-all-and-reinsert `save()` with a diffing upsert. Both matter the moment the web UI and an MCP-driven AI edit the same quiz.
- `deleted_at timestamptz` on `pages`, `quizzes`, `term_pairs`, and `questions` — an AI overwriting user content must be undoable, and question deletes must stop destroying attempt history (finding 11).
- `tags text[]` (a real PG array), `intervals_days integer[]`.
- FK indexes on every `owner_id` and every parent pointer; the current schema is well-indexed and that discipline should carry over.

### Effort

Large, but it is one migration and one ETL script, executed once, alongside §2. Do not split the rename across releases — there is one user today, so this is the cheapest it will ever be. Every later week makes it more expensive.

---

## 7. Summaries: Notion-like nested pages

This is the largest genuinely *new* bounded context, and the request contains one requirement that determines the whole design.

### The requirement that decides everything

> "quiz for that book in `Programming/Books/[name]/[chapter]` can be stored just in `Books/[quizname]`"

**A quiz's place in the tree and the summary it is shown under are two different relationships.** Model them separately or the design collapses.

### Recommendation

**One tree, not two.** Collapse `folders` into `pages`. A folder is simply a page with children and an empty body — Notion's actual model, and it makes "Programming / Books / BookName / Chapter1" the same mechanism as "a summary page containing links to its subchapter summaries".

```text
pages(
  id, owner_id,
  parent_id → pages.id,          -- adjacency list
  title, slug, icon,
  content_md text,                -- markdown IS the canonical content
  position numeric,               -- fractional indexing for cheap reordering
  visibility, version,
  created_at, updated_at, deleted_at,
  unique (owner_id, parent_id, slug)
)
page_revisions(id, page_id, content_md, title, author_kind ('user'|'mcp'), created_at)
```

Two separate links for quizzes:

```text
quizzes.page_id            -- WHERE the quiz lives in the tree (its "folder")
quiz_attachments(page_id, quiz_id, position, unique (page_id, quiz_id))
                           -- WHICH summaries display it at the bottom
```

A quiz filed under `Books/JS-basics` and attached to `Programming/Books/JS/Chapter1` is then trivially expressible, which is exactly what was asked for.

**Watch the NULLs in every unique constraint.** `unique (owner_id, parent_id, slug)` does
**not** prevent two root pages with the same slug, because Postgres treats `NULL`s as
distinct — the current SQLite schema already needed a separate partial index
(`folders_root_name_unique … where parent_id is null`, `schema.ts:44-48`) for exactly this
reason, and that lesson must carry over. Use `unique nulls not distinct` (PG 15+, so
available on Supabase) or keep the explicit partial index. The same trap applies to
`study_settings`: `unique (owner_id, scope_type, scope_id)` silently permits duplicate
user-level rows while `scope_id` is `NULL`, which would resurrect the settings bug §6 is
trying to kill. Add a cross-owner negative test per repository — "user B cannot read user
A's row" — because that is the assertion nothing else in the suite makes.

**Tree queries.** Adjacency list + recursive CTE. At personal scale that is correct and simple; breadcrumbs, subtree listing, and move-with-cycle-check are all one CTE each (the existing `folder` domain already implements cycle prevention and path resolution — reuse that logic). Add a materialized `path` column or `ltree` **only** if a measured query is slow. `unique (owner_id, parent_id, slug)` is what makes path addressing (`Programming/Books/JS/Chapter1`) unambiguous — the existing `ensure_folder_path` / `resolve_folder_path` use cases generalize directly to pages.

**Content format: markdown, canonical.** Do not adopt a proprietary block-JSON document model.

- MCP is a first-class author here ("send book to some ai, tell him to write summary, he stores it in our app"). An AI writing markdown into a `content_md` column is trivial; an AI emitting a valid block tree is fragile and version-locked.
- Nested-page references live in the markdown as links to child pages (`[[page-slug]]` or a relative link), plus an auto-rendered child-page list at the bottom of every page. That covers "inside Chapter1Summary.md could be references to each subchapter summary".
- Editor: a markdown-native WYSIWYG — **Milkdown** or TipTap with a markdown serializer. Both round-trip to markdown, so the AI-written and human-written paths are the same path.
- Keep `page_revisions` append-only so an AI overwrite is always recoverable.

**Search.** Generated `tsvector` column over `title || content_md` + GIN index; `pg_trgm` for fuzzy title match. `pgvector` for semantic search over summaries is a natural later addition and needs no schema rethink — note it, do not build it.

**The page view the request describes**, end to end:

1. `GET /pages/{id}` → page + rendered markdown + children.
2. Below it, `GET /pages/{id}/quizzes` → attached quizzes (via `quiz_attachments`), each with the user's attempt history.
3. Open a quiz → list every attempt with score and date (not a single progress bar — as the request explicitly prefers).
4. Open an attempt → `GetAttemptDetail`, **which already exists and is tested**: every question, what was selected, what was correct, what was skipped, partial credit.

**New MCP tools** (path-addressed, mirroring the folder tools that already work this way):

`page.upsert_by_path` · `page.get` · `page.list_children` · `page.append` · `page.attach_quiz` · `page.create_child`

`upsert_by_path` is the important one: it lets an AI write `Books/Designing Data-Intensive Applications/Chapter 5/Summary` in a single call, creating missing ancestors, which is exactly the described workflow.

### Effort

Large. Sequence it as: pages + tree + MCP tools (headless, MCP-testable) → web reader → editor → quiz attachment → search.

---

## 8. Architecture and patterns: the review

Reviewed against the installed pattern references (GoF patterns, Clean Code, CLRS, Pragmatic Programmer — note the router's `ddd` and `ddia` sub-skills are advertised but **not installed** on this machine, so those recommendations come from first principles rather than a cited file).

### Keep the style, change the granularity

**Ports and Adapters remains correct.** The problem was never the style; it was that one flat composition root served four adapters with no module seam. Nest supplies the seam. The layering becomes:

```text
apps (nest controllers · telegraf handlers · mcp tools · react)
        │
apps/api/src/application   (use cases + ports)       ← framework-free, stays
        │
apps/api/src/domain        (invariants, pure)        ← zero deps, stays
        ▲
apps/api/src/persistence   (drizzle + pg repos)      ← implements the ports
```

### Modules as bounded contexts

Six Nest modules, each owning its tables and exposing use cases — not a shared "core":

| Module | Owns |
| --- | --- |
| `identity` | users, sessions, accounts, tokens, auth events |
| `content` | pages, quizzes, questions, term pairs, attachments |
| `study` | attempts, responses, scoring, practice selection |
| `scheduling` | review states, due queues, settings resolution |
| `analytics` | read models, dashboards, exports |
| `integration` | MCP tools and the admin console — surfaces that are not the public REST API |

`content` → `identity` for ownership; `study` → `content` read-only; `scheduling` reacts to `study`; `analytics` reads everything and is written by nobody. No cycles.

### `apps/api/src/modules/` in full (r3)

`modules/` is **only the NestJS layer** — HTTP surface, DI wiring, guards, filters. Nothing in
`domain/`, `application/`, or `persistence/` imports `@nestjs/*`, which is what keeps the
1375 existing tests running without a Nest test harness.

```text
apps/api/src/
├─ main.ts                          bootstrap: Express adapter, Swagger, global pipe + filter
├─ domain/                          ← moves as-is (51 files, untouched)
├─ application/                     ← moves as-is (use cases + ports, async-ified)
├─ persistence/                     ← drizzle schema, migrations, repositories, transaction
└─ modules/
   ├─ app.module.ts                 imports the six context modules + shared
   │
   ├─ shared/                       Nest infrastructure only — NOT a domain dumping ground
   │  ├─ config/
   │  │  ├─ env.schema.ts           zod env schema (today's infrastructure/config/env.ts)
   │  │  └─ config.module.ts
   │  ├─ database/
   │  │  ├─ database.module.ts      @Global — pool lifecycle, shutdown drain
   │  │  ├─ drizzle.provider.ts     the client
   │  │  ├─ transaction.provider.ts the async Transaction port implementation
   │  │  ├─ repositories.providers.ts  every repository port → its Postgres impl
   │  │  └─ tokens.ts               QUIZZES, PAGES, ATTEMPTS, REVIEW_STATES, TRANSACTION…
   │  ├─ ports/
   │  │  ├─ clock.provider.ts       systemClock, lifted from today's composition root
   │  │  └─ id-generator.provider.ts  uuidv7
   │  ├─ errors/
   │  │  ├─ domain-exception.filter.ts  catches domain and application errors
   │  │  └─ error-map.ts            typed error → HTTP status + stable error code
   │  ├─ validation/zod-validation.pipe.ts
   │  ├─ health/health.controller.ts    readiness + liveness
   │  └─ swagger/build-document.ts
   │
   ├─ identity/
   │  ├─ identity.module.ts
   │  ├─ auth.provider.ts           the betterAuth() instance
   │  ├─ auth.controller.ts         mounts Better Auth's handler at /api/auth/*
   │  ├─ telegram-link.controller.ts   POST /auth/telegram/link → one-time login URL
   │  ├─ guards/
   │  │  ├─ session.guard.ts        cookie → Principal        (web, admin)
   │  │  ├─ bearer.guard.ts         PAT / OAuth → Principal   (mcp)
   │  │  └─ service.guard.ts        the bot's own credential
   │  ├─ current-user.decorator.ts  @CurrentUser(): Principal
   │  ├─ ownership.policy.ts        the one place "may this principal touch this row" lives
   │  └─ dto/
   │
   ├─ content/
   │  ├─ content.module.ts
   │  ├─ use-cases.providers.ts     factory providers — replaces create-application.ts
   │  ├─ pages.controller.ts
   │  ├─ quizzes.controller.ts
   │  ├─ questions.controller.ts
   │  ├─ term-pairs.controller.ts
   │  ├─ attachments.controller.ts  quiz ↔ page links (§7)
   │  └─ dto/                       createZodDto() over packages/contracts schemas
   │
   ├─ study/
   │  ├─ study.module.ts
   │  ├─ use-cases.providers.ts
   │  ├─ attempts.controller.ts
   │  ├─ practice.controller.ts
   │  └─ dto/
   │
   ├─ scheduling/
   │  ├─ scheduling.module.ts
   │  ├─ use-cases.providers.ts
   │  ├─ reviews.controller.ts
   │  ├─ settings.controller.ts
   │  └─ dto/
   │
   ├─ analytics/                    read side only — never writes
   │  ├─ analytics.module.ts
   │  ├─ use-cases.providers.ts
   │  ├─ statistics.controller.ts
   │  ├─ attempt-review.controller.ts
   │  └─ dto/
   │
   └─ integration/
      ├─ mcp/
      │  ├─ mcp.module.ts
      │  ├─ mcp.controller.ts       Streamable HTTP transport endpoint
      │  ├─ mcp-server.factory.ts   today's adapters/mcp/server.ts
      │  ├─ tools/                  17 *.tool.ts files, move nearly as-is
      │  ├─ presenters/             tool-result, tool-error
      │  └─ oauth/                  provider, consent, bearer — plus the user dimension (§5)
      └─ admin/
         ├─ admin.module.ts         RoleGuard('admin'), no owner scoping
         └─ *.controller.ts         the cross-user views react-admin needs
```

#### What each file type may do

| File | Job | Hard limit |
| --- | --- | --- |
| `*.controller.ts` | parse → call **one** use case → present | no business logic, no drizzle, no controller-to-controller calls |
| `use-cases.providers.ts` | factory-wire use cases to port tokens | the only place `new SomethingUseCase()` appears |
| `dto/*.ts` | `createZodDto(SchemaFromContracts)` | never defines a shape twice — the schema lives in `packages/contracts` |
| `guards/*.ts` | produce a `Principal` | never decides *what* a principal may touch; that is `ownership.policy.ts` |
| `*.module.ts` | imports, providers, exports | no logic |

The controller limit is the same rule the Telegram handlers already follow
(`ARCHITECTURE.md`, "Command handlers and use cases"), applied to a new transport.

#### The wiring pattern

`use-cases.providers.ts` per module is what replaces the 38-field `Application` god object:
the same manual DI in a visible composition root, now partitioned by context.

```ts
export const contentUseCases: Provider[] = [
  { provide: CreateQuizUseCase,
    inject: [QUIZZES, TRANSACTION, CLOCK, IDS],
    useFactory: (quizzes, transaction, clock, ids) =>
      new CreateQuizUseCase({ quizzes, transaction, clock, ids }) },
  // …one entry per use case
];
```

Each module `exports` only the use cases another module legitimately needs, so the import
graph is declared in `*.module.ts` rather than implied by whatever got imported.

#### Module dependency rules

```text
integration ──► content · study · scheduling · analytics · identity
analytics   ──► (reads persistence, writes nothing)
scheduling  ──► study
study       ──► content (read-only)
content     ──► identity
identity    ──► shared
```

Enforced by the same restricted-import rule as Appendix B, one `overrides` entry per module —
`content/**` may not import `study/**` or `integration/**`, and so on.

#### Where today's 34 use-case files land

| Today | Module | Files |
| --- | --- | --- |
| `use-cases/quiz-sets/` | content | 14 |
| `use-cases/folders/` → pages | content | 8 |
| `use-cases/attempts/` | study | 5 |
| `use-cases/practice/` | study | 1 |
| `use-cases/repetition/` | scheduling | 2 |
| `use-cases/settings/` | scheduling | 2 |
| `use-cases/statistics/` | analytics | 2 |

The files themselves **do not move** — they stay under `application/use-cases/`. Only the
wiring is partitioned. (`get-attempt-detail` could equally sit in `study`; it is in
`analytics` because the web review screen calls it beside the statistics endpoints.)

#### Two deliberate absences

- **No `bot/` module.** The bot calls the *same* REST endpoints the web app does. A
  bot-only API surface would mean writing every operation twice — precisely the failure mode
  that made the bot a client in the first place (§1). Its only bot-specific pieces are
  `service.guard.ts` and the Telegram→`UserId` mapping, both in `identity`.
- **`admin/` is not redundant**, though: react-admin needs *cross-user* views and every
  public endpoint is owner-scoped. A different authorization model earns different
  controllers behind a role guard.

#### The open structural choice

This is **horizontal layering**: `domain`, `application`, and `persistence` shared at the
top, `modules/` holding only the Nest layer. It is what the r3 decisions imply, and it makes
phase 2 a pure file move with the suite still green.

The alternative is **vertical slices** (`modules/content/{domain,application,persistence,http}`),
which is more Nest-idiomatic and colocates a feature. Not recommended here: `persistence`
cannot actually be split (one drizzle schema, one migration history), the domain genuinely
crosses contexts (`study` reads `Quiz`), and it turns phase 2 from motion into a
reorganization — which is the one thing phase 2 must not be.

**Switch trigger:** when a context needs its own database or its own deploy cadence, the
slice earns the fragmentation. Not before.

### Pattern decisions

**Adopt:**

- **Repository** — keep, and keep refusing a generic `Repository<T, Id>` base. `ARCHITECTURE.md` is right about this and the existing narrow ports are exemplary.
- **Unit of Work** — the async `Transaction` port from §2, one transaction per use case.
- **Aggregate** — `Quiz`, `Attempt`, `Page`, `StudyItem`. Add the `version` column so aggregate writes are safe under concurrency.
- **Composite** — the page tree (§7). This is the one *new* GoF pattern the rewrite genuinely earns.
- **Strategy** — already used for answer evaluation and session selection; extend it to per-kind study-item card generation and to the scheduler (fixed ladder now, FSRS later).
- **Explicit state machines** — already there for quiz and attempt lifecycles. Keep as status + transition functions; no class-per-state.
- **In-process events, dispatched strictly *after* commit, best-effort only.**

  > **Correction (r2).** r1 said to fire domain events via `EventEmitter2` *inside* the
  > transaction. That is wrong: `EventEmitter2` is not a transaction coordinator. Listener
  > ordering, async listener failure, and after-commit semantics are all easy to get
  > silently wrong, and a notification emitted inside a transaction can fire for work that
  > then rolls back.

  Anything correctness-critical stays an **explicit call inside the use case's
  transaction** — which is exactly what `FinishQuizAttempt` already does
  (`finish-quiz-attempt.ts:66`, attempt write + schedule write in one boundary). Events are
  for genuinely optional reactions (a Telegram nudge, a cache touch), emitted after the
  commit succeeds, and a failed listener must never fail the request. `ARCHITECTURE.md`'s
  original "defer until needed" stance was more right than r1 gave it credit for.
- **Analytics: indexed SQL and views first; aggregate tables only when measured slow.**

  > **Correction (r2).** r1 proposed write-maintained read-model tables up front. At this
  > scale that buys consistency bugs and a rebuild problem before any query has been shown
  > to be slow.

  Start with indexed queries and plain (or materialized) views over the normalized schema.
  Promote a table only where a real dashboard query is measurably too slow, and make every
  such table **rebuildable from source with one command** — an aggregate you cannot
  recompute is a liability.
- **Anti-corruption layer** — Telegram and MCP shapes never reach the domain. Already true; the monorepo makes it structural.

**Decline:**

- `@nestjs/cqrs`' command bus and mediator — `ARCHITECTURE.md` bans a generic command bus and it was right; the 40 existing use cases are already the right abstraction. Register them as providers, do not route them through a bus.
- Event sourcing, microservices, sharding, a message broker, a service locator, class-per-question-type. All still wrong at this scale.
- A `packages/common` or `packages/shared` catch-all. `packages/contracts` and `packages/tooling` are the only shared packages; anything that fits in neither needs a real name (§8, Appendix B).

### Naming: `*UseCase` (decision, r3)

Use cases are renamed to carry their role: `AnswerQuestion` → **`AnswerQuestionUseCase`**,
and likewise for all ~40. Rationale, since it is a convention change and conventions should
have reasons written down:

- Once they are Nest providers, the class name *is* the injection token. `AnswerQuestion`
  reads like a command payload or a DTO at an injection site; `AnswerQuestionUseCase` cannot
  be mistaken for one.
- It disambiguates against the command types living beside them (`AnswerQuestionCommand`)
  and against the eventual HTTP layer (`AnswerQuestionController`, `AnswerQuestionDto`).
- The existing conventions already do this for every other role — `*.handler.ts`,
  `*.presenter.ts`, `*.middleware.ts`, `SqliteQuizSetRepository`. Use cases were the one
  role whose name did not say what it was.

Mechanical: a rename plus the file names (`answer-question.use-case.ts`). Do it in the phase-2
monorepo move, where the diff is already pure motion, and update the naming table in
`ARCHITECTURE.md` in the same commit. Types stay `PascalCase`, files stay `kebab-case`; the
"no `I` prefix" rule is untouched.

### The one migration trick worth knowing

The 40 existing use cases are classes taking a single `dependencies` object with an `execute()` method. In Nest that is a factory provider, one line each:

```ts
{ provide: AnswerQuestionUseCase,
  inject: [QUIZ_SETS, ATTEMPTS, TRANSACTION, CLOCK],
  useFactory: (quizSets, attempts, transaction, clock) =>
    new AnswerQuestionUseCase({ quizSets, attempts, transaction, clock }) }
```

**The entire application layer and its tests survive the move to NestJS unchanged** (modulo async and the rename). That is why this is a re-housing, not a rewrite, and why the 1375 tests are an asset rather than a sunk cost.

### Package boundaries: what they buy, and why two is the right number (r3)

The owner's question — *why separate packages at all, why not keep everything in `api` and
let bot/mcp call the API?* — deserved a tested answer rather than an opinion. **Appendix B
builds and runs all three options.** The result:

| | enforces the dependency rule? | setup cost | error message |
| --- | --- | --- | --- |
| A. one app, folders only | **no** — compiles clean | none | none |
| B. separate packages | yes | workspace + `package.json` + tsconfig per package | `TS2307: Cannot find module '@demo/db'` |
| C. one app + biome rule | yes | ~20 lines of `biome.json` | *"domain must not import outward (ARCHITECTURE.md dependency rule 1)"* |

The real benefit of a package boundary is **the toolchain refusing an import that the
architecture forbids** — a package cannot import what it does not declare as a dependency.
Everything else usually claimed for packages is weaker than it sounds here: independent
versioning (no external consumers), independent deploy (they deploy together), faster CI
(`bun test <dir>` already scopes), and reuse (there is one consumer).

And option C buys that same enforcement for ~20 lines, with an error message that names the
rule instead of complaining about module resolution. **Two packages remain**, and both have
a real second consumer:

- **`packages/contracts`** — zod schemas plus the generated OpenAPI client, imported by
  `web`, `admin`, `bot`, and `mcp`. Four consumers, and a package boundary here genuinely
  prevents drift: a client cannot import a server-only type by accident.
- **`packages/tooling`** — tsconfig and biome bases, consumed by every workspace.

`domain`, `application`, and `persistence` stay as folders inside `apps/api/src`, guarded by
the rule. Worth adding: this repo has already **proved the discipline holds without
enforcement** — across 51 domain files there are **zero** imports of `adapters`,
`application`, `infrastructure`, or `composition`, and the only application→adapters import
in the whole tree is in one *test* file (`resume-quiz-attempt.test.ts:4`). The lint rule
exists to keep that true through a monorepo and more contributors, not to fix a problem that
exists today.

**When to revisit:** extract `domain`/`application` into a package the moment a genuine
second consumer appears — a CLI that imports the scheduler, a worker process, an offline
mobile client doing local scoring. Until then it is a build graph maintained for an audience
of one.

### API contract

REST + `@nestjs/swagger`, with **zod as the single source of truth** (`nestjs-zod`): the same schemas validate MCP tool input, HTTP bodies, and generate OpenAPI. Then `openapi-typescript` + `openapi-fetch` generate the typed client in `packages/contracts` that `web`, `admin`, `bot`, and `mcp` all import. One schema, four consumers, no drift. (tRPC would be nicer to write and gives no Swagger, no MCP reuse, and no non-TS clients — declined, per the stated Swagger requirement.)

### Docs to rewrite when this lands

- `ARCHITECTURE.md` — rewrite: monorepo layout, module boundaries, the async ports, Nest as composition root, the pattern decisions above.
- `CLAUDE.md` — amend: NestJS/Node for `api` (and Next.js for `web`, if chosen) supersede the "no Express, no Vite, `Bun.serve` only" rule for those two apps. Bun stays the default everywhere else. Keep the no-code-comments rule.
- `AGENTS.md` — per-app boundaries; the "restrict to `ALLOWED_TELEGRAM_USER_ID`" rule is retired by §3.
- `DEVELOPMENT_PLAN.md` — currently deleted but still referenced by three docs. Replace it with the roadmap below or restore-and-rewrite it.
- `README.md` (60 KB) — split per app; keep the operator manual with `api`.
- `docs/` is gitignored, so plans are untracked. Consider tracking `docs/adr/` at least — the decisions in this file deserve to be findable in six months.

---

## 9. Second-opinion review (r2) — what changed and what did not

The r1 plan was sent for an adversarial architecture review to GPT-5 (Codex) running
read-only over this repository, with the instruction to stress-test it rather than summarize
it. **Every claim below was independently verified against the code before being accepted** —
agent findings are not taken on trust.

### Accepted, verified, and now folded into the plan

| # | Finding | Verified against | Where it landed |
| --- | --- | --- | --- |
| 1 | Completed attempt history is destroyed by question deletes (FK cascade) and by option-id re-minting on edit. `attempt_questions` alone does not fix it; you need immutable revisions. | `schema.ts:224-226`, `get-attempt-detail.ts:84-88`, `update-question.ts:104-112` | **half right — see below**; finding 11, phase 1 |
| 2 | An async transaction callback on `bun:sqlite` **is not atomic** — the transaction commits when the callback returns, i.e. at its first `await`. r1's "trivially correct async wrap" was wrong. | `transaction.ts:1-7`, `sqlite-transaction.ts:8-15`, `finish-quiz-attempt.ts:66` | §2, rewritten |
| 3 | r1's phase order put Postgres and identity **before** the API that is supposed to be the only database owner, leaving either nothing runnable or three direct database clients. | `src/entrypoints/telegram.ts:45` | roadmap, rewritten |
| 4 | "ETL + keep the SQLite file" is not a migration plan; row counts catch none of the real failure modes, and there was no maintenance mode, deploy order, or rollback deadline. | `scripts/up.ts:246` (migrate-on-every-start) | new cutover section |
| 5 | Unique constraints containing `NULL` do not constrain: duplicate root slugs and duplicate user-level settings rows both slip through. The existing schema already needed a partial index for exactly this. | `schema.ts:44-48` | §7, §3 |
| 6 | Adding `user_id` columns does not make MCP OAuth per-user; the principal must be bound at code creation and carried through refresh rotation, and the bot must never assert its own caller identity. | `oauth/provider.ts:74-81` | §5 |
| 7 | `EventEmitter2` is not a transaction coordinator, and write-maintained analytics tables are premature before a query is measurably slow. | `finish-quiz-attempt.ts:66` | §8 |
| 8 | uuidv7 remapping is a real risk for no gain: ids ride inside Telegram callback payloads under a hard 64-byte cap. | `callback-data.ts:4` | §6, finding 12 |
| 9 | `study_items(kind, payload jsonb)` invents three kinds whose invariants do not exist and trades real constraints for speculative JSON. | — (design judgement) | §6, now `term_pairs` |
| 10 | Webhook-vs-single-poller and connection-pool limits are phase-3-to-5 correctness concerns, not post-launch ops details. | `src/entrypoints/telegram.ts:110` | new deployment section |

#### Correction to finding 1 (r4)

Accepting this one at face value was a mistake on my part, and worth recording as a lesson
rather than quietly editing away.

- **Right about the edit path.** Option-id re-minting was real, unguarded, and produced a
  visible `"?"` in past attempt reviews. Fixed.
- **Wrong about the delete path.** `DeleteQuestion` already refuses to delete a question with
  answers. Commit `73a414e` names the cascade, counts the exposure, and adds the guard
  deliberately. The review inferred a live bug from the schema plus the use case without
  checking whether anything guarded the call.
- **Wrong about the remedy.** It concluded "you need immutable `question_revisions`". The
  actual defect needed three lines and the codebase's own existing convention
  (`UpdateVocabulary`'s deterministic `${question.id}-${index}` option ids). A revisions
  table would have been a large answer to a small question.

My own error was subtler and worse: I reported these as "verified against the code" when what
I had verified was that the *code paths existed*, not that they were *reachable*. A cascade in
a schema is not a bug until something can actually trigger it. The lesson for the rest of this
plan: for any claim of the form "X destroys data", find the caller and check the guard before
believing it — and check `git log` for whether the author already solved it.

### Where I did not simply defer

- On #2 I claimed a safer middle path than the review's: widen the **return type** to
  `Promise<T>` while keeping the **callback** `Synchronous<T>`, absorbing the call-site churn
  on SQLite first. **That was wrong, and r6 retracts it.** Transaction boundaries nest — ten
  use cases wrap repository calls that themselves open a boundary — so widening the
  repositories puts unawaited promises inside a synchronous callback. The review's original
  remedy (convert each transactional use case together with its Postgres repository, per
  context) was correct. See "Why phase 3 was deleted" under Sequencing.

  Worth recording as a pattern: this is the *second* time on this finding that I accepted a
  mechanism as understood without tracing its callers. First I asserted a cascade was live
  without checking the guard; then I proposed an async widening without checking what was
  nested inside the boundary. Both times the code answered in a minute.
- On #9 the request explicitly asked for a model that is "not very descriptive **+ not
  general**". Renaming to `term_pairs` answers "descriptive" and defers "general", so §6 now
  also records *how* generality arrives later (an additive `kind` column with a default —
  no backfill), rather than treating the requirement as dropped.

### Unchanged after review

Both passes agree on: framework-free `domain` and `application` packages; narrow ports and
no generic repository base; Nest factory-provider wiring of the existing 40 use cases; the
API as sole database owner; a thin bot and a thin MCP stdio bridge; one page tree with quiz
*location* separate from quiz *attachment*; canonical markdown; and the rejection of command
buses, microservices, event sourcing, and RLS-as-primary-authorization.

Its overall verdict: the architectural direction is right, the r1 sequencing was not. Effort
to correct the plan, short; effort to execute it safely, **several weeks for one developer**.
Confidence: high, and the code agrees with it on every point I checked.

(A parallel Gemini review was attempted and failed on a local permissions rule in the
Antigravity bridge — no second independent opinion was obtained. Worth re-running before
phase 4 if a tiebreaker is wanted on the `web` stack or the auth build-vs-adopt call.)

---

## Sequencing

Each phase ends with the full suite green. Never two of these in flight at once.

> **Revised in r2.** r1 put Postgres (phase 3) and identity (phase 4) *before* the Nest API
> existed (phase 5). That is incoherent: the plan says exactly one process may own Postgres,
> yet in r1's phases 3-4 the only running processes are the bot, MCP, and admin — each of
> which builds its own application and database today
> (`src/entrypoints/telegram.ts:45`). r1's ordering therefore either leaves nothing runnable
> or temporarily creates the three-direct-database-clients architecture it forbids. The Nest
> shell now comes first, and Postgres moves through it one context at a time.

| # | Phase | Depends on | Size |
| --- | --- | --- | --- |
| 0 | Decisions below; ADRs; freeze feature work | — | S |
| 1 | ~~**Fix attempt history**~~ — **done** (r4). Option ids are now stable across edits; the delete path turned out to be already guarded, and `question_revisions` is deferred as optional (§6). Shipped on `fix/stable-option-ids`. | — | S |
| 2 | ~~Monorepo split~~ — **done** (r5). Bun workspace; `src/`→`apps/api/src/`, `tests/`→`apps/api/tests/`, `drizzle/`→`apps/api/drizzle/`; `packages/tooling` holds the shared tsconfig base; dependency rules enforced in `biome.json`. 1377 tests, unchanged. | 1 | M |
| ~~3~~ | ~~Async call sites~~ — **deleted (r6)**, folded into phase 5. Not implementable standalone: see below. | — | — |
| — | *(the other apps are created in phase 8, not phase 2 — see below)* | | |
| 4 | ~~**Minimal Nest API shell**~~ — **done** (r7). Nest 11 + Express, `apps/api/src/modules/{shared,content}`, factory-provided use cases, `GET /quizzes`, `GET /quizzes/:id`, health, Swagger at `/docs`, domain-error→HTTP filter. Runs on Bun. | 2 | M |
| 5 | Postgres **per bounded context**: each transactional use case moves with its Postgres repository; one contract suite runs against both engines. **Started (r8)**: infrastructure and transaction contract done; repositories not ported. | 4 | L |
| 6 | Rehearsed cutover: ETL + verification + rollback deadline (below) | 5 | M |
| 7 | Identity, ownership, sessions, bot login link (§3, §5) | 6 | L |
| 8 | Bot, MCP, and admin become API clients; MCP OAuth gains its user dimension (§1, §5) | 7 | L |
| 9 | Web MVP: auth, browse, practice, attempt review (§4) | 8 | L |
| 10 | Pages/summaries + MCP page tools + attachments (§7) | 8 | L |
| 11 | Analytics views and dashboards (§4) | 9 | M |
| 12 | Email/password auth, sharing, FSRS (§5, §3, §6) | 9 | M |

Phase 1 was deliberately first and standalone: a real bug, cheap to fix, and fixing it before
the ETL means the migration does not carry the defect forward. It came in far smaller than
estimated — three lines and two tests — because most of the damage r2 predicted was already
guarded against.

Phases 9/10/11 are independently shippable, so the platform can go live practice-only and
gain summaries later.

### Phase 5, seventh slice: attempts, and a lossy migration caught (r14)

**Correction to r9.** "Ownership is deliberately not in this migration" was right about the
`owner_id` foreign key and wrong about the column it took with it. `QuizAttempt` and the
repetition schedule both carry `telegramUserId` as a **required** domain field, so a Postgres
attempts repository could not reconstruct an attempt at all — it would have to invent the
value. Worse, phase 7 needs that number to map existing data onto Better Auth's `account`
row: it *is* the Telegram account id.

Checked before changing anything: all 38 attempts and all 227 schedules carry the same id
(`797736131`), so nothing was lost in practice yet — but the ETL was discarding information the
running app requires and calling it a note. `attempts` and `review_states` now keep a nullable
`telegram_user_id`, the ETL carries it, and `verifyMigration` fails the run if any attempt
arrives without one. Re-run against the real backup: 38 and 227 rows, all with the id intact.

Ownership proper still arrives in phase 7, which turns this column into `owner_id`. The
distinction that matters: **defer the model, never the data.**

**`AttemptRepository`, ported with its read models.** Nine contract tests against both engines,
first time green on Postgres. The interesting ones are the queries that are not aggregate
persistence at all:

- `topicAccuracy` — the `responses → attempts → questions` join that forced the single-cutover
  decision in r12, now running on Postgres;
- `listCompletedForQuiz`, `incorrectQuestionIds` (distinct, once per question), `answerCount`;
- `findActiveFor`, which must not return another user's attempt — asserted in both directions.

One v1 behaviour deliberately preserved: `save` **ignores a copy whose `updatedAt` predates the
stored row**. The SQLite version explains why — responses are append-only, so applying a stale
attempt would rewind `updated_at` past answers already written and leave a row
`restoreQuizAttempt` rejects, making the attempt permanently unreadable. That guard is now in
the contract, so neither implementation can lose it.

Also: `ContentScope` became `RepositoryScope`. With the cutover single, one scope carrying every
repository is the honest shape; a per-context scope would imply an independence that r12 showed
does not exist.

Migration files are no longer named in code. `drizzle-kit` renames the file on every
regeneration (`0000_long_micromax` → `0000_tan_power_man` → `0000_sticky_queen_noir` across
three slices), and each rename broke two hardcoded references. Tests and the ETL CLI now read
the newest `.sql` from the directory.

**Three of five repositories paired:** `pages`, `quizzes`, `attempts`. Remaining: `repetition`
and `term_pairs` — both small, and neither carries a read model.

### Phase 5, sixth slice: the quiz repository, without the old save (r13)

Porting `QuizRepository` was the moment to stop reproducing v1's `save()`, which deletes every
option in the set and re-inserts it (finding 5: write amplification plus a lost-update race the
moment a web UI and an MCP-driven AI edit the same quiz). The Postgres version instead:

- **diffs the questions.** Only ids the aggregate has dropped are deleted; survivors are
  upserted by id, so the answers and review state hanging off them stay attached. That is the
  same property commits `65dba08` and `73a414e` were written to protect, now enforced by the
  repository rather than by the caller's care.
- **carries `version`.** `save(quiz, expectedVersion?)` returns the new version and throws
  `QuizVersionConflictError` when the stored version has moved. Nothing uses it yet; the point
  is that the column and the check exist before two writers do.
- **replaces options per question, not per quiz.** `responses.selected_option_ids` is a
  `uuid[]` with no foreign key, so a question's own options can be replaced without touching
  anything else — which also sidesteps the `unique (question_id, position)` collision that
  makes a naive reorder fail.
- **still parks positions.** `unique (quiz_id, position)` and `unique (quiz_id, fingerprint)`
  are checked per statement in Postgres, so surviving rows are moved outside the unique space
  before the upserts, exactly as the SQLite version does. The trick was already right; only the
  delete-everything part was wrong.

Eight contract tests, both engines. The one that matters most: **"refuses to drop a question
that has answers"** now passes because the database refuses it (`ON DELETE RESTRICT`), not
because a use case remembered to check.

**The shared contract earned its keep immediately.** The fixture built option ids as
`` `${questionId}-0` `` — fine for the in-memory store, rejected by Postgres, where the column
is `uuid`. Six tests failed on Postgres and passed in memory in the same run, which is exactly
the drift a double hides when it has its own tests. The in-memory implementation is more
permissive than the real one; only running the same assertions against both makes that visible.

Also fixed: `restoreInto` in the memory store was missing the three new maps, so the in-memory
rollback silently kept a failed quiz save. Caught by the contract's rollback test — and caused
by running a patch script without asserting the replacement matched, which is the second time
that has bitten.

**Two of five repositories now paired:** `pages`, `quizzes`. Remaining: `attempts` (with the
statistics queries), `repetition`, and `vocabulary`/`term_pairs`. Then the use cases and the
composition root in one switch.

### Phase 5, fifth slice: retracting "per bounded context" (r12)

**The strategy this plan has carried since r2 does not survive the repositories.** I checked
before porting anything, and the contexts are joined at the SQL level:

- `sqlite-quiz-attempt.repository.ts:186` — `topicAccuracy` **inner joins `questions`**. So
  `study` cannot read from Postgres while `content` is still on SQLite, or the join has nothing
  to join to.
- `sqlite-folder.repository.ts:90` — `countSetsIn` reads **`quiz_sets`**. So `folders` cannot
  move without quizzes; `delete-folder` depends on that count.
- The repetition repository *is* self-contained — but `FinishQuizAttemptUseCase` writes an
  attempt and a schedule in **one transaction**, so scheduling cannot straddle engines either.

A cross-engine join is not something a shim papers over; it is a query that cannot run. So the
five repositories and the use cases above them move **together, in one cutover**, not context
by context. The Codex review recommended per-context, I endorsed it twice, and the code says
otherwise. That is the third strategy correction in this plan and the reason for all of them is
the same: the recommendation was reasoned about rather than checked.

The user's decision to land the schema as **one migration** now applies to the code as well,
which at least makes the two halves consistent.

**What makes a single cutover survivable.** A big-bang port is only safe if the use cases can
be tested without the database they are being ported onto. So the async ports now have **two
implementations behind one contract suite**:

```text
tests/contracts/page.repository.contract.ts   9 tests, engine-agnostic
  ├─ tests/unit/memory-page.repository.test.ts        in-memory, 18 ms, always runs
  └─ tests/integration/postgres/page.repository.test.ts  Postgres, skipped without Docker
```

Both bindings pass the same nine tests, including the rollback property: the in-memory unit of
work snapshots the store and restores it when the operation throws, so a double that quietly
committed on failure would fail the contract. That is the difference between a double and a
fake, and it is why the contract is shared rather than duplicated.

The payoff: when the use cases port, their tests bind to the in-memory scope and keep running
in milliseconds with no Docker, while the Postgres adapters stay honest against the same
assertions. Without this, porting 34 use cases would have made a third of the suite
conditional on a container.

**Pattern for the rest of the phase**, one repository at a time: async port → contract suite →
in-memory implementation → Postgres implementation → both bound. Four repositories left
(`quizzes`, `questions` inside the quiz aggregate, `attempts`, `repetition`), then the use cases
and the composition root in a single switch.

### Phase 5, fourth slice: the transaction topology (r11)

This is the piece phase 3 died for, now built and tested.

```ts
// application/ports/unit-of-work.ts
run<TResult>(operation: (scope: TScope) => Promise<TResult>): Promise<TResult>

// application/ports/repositories/page.repository.ts
interface ContentScope { readonly pages: PageRepository }
```

`createPostgresUnitOfWork(db).run(async ({ pages }) => …)` opens one Postgres transaction and
builds the repositories **against that transaction's executor**. A repository therefore cannot
be reached outside a boundary, and cannot end up on a different connection from the boundary it
appears to belong to — which is precisely the failure r8 measured (an unawaited write surviving
a rollback). `readOnlyScope(db)` gives the same repositories bound to the pool for reads.

Also added: `persistence/postgres/client.ts`, which centralises the connection settings the
deployment section calls for — `prepare: false` (Supabase's transaction pooler rejects prepared
statements and the setting is harmless on a direct connection), a bounded pool, statement
timeout, idle timeout, and a maximum connection lifetime.

**First repository: `PageRepository` over the `pages` table.** Eight tests, including the two
that matter:

- **rollback**: an operation that saves two pages and then throws leaves the table empty;
- **slug uniqueness**: two children of one parent named "Chapter One" and "chapter one" collide
  on `pages_parent_slug_unique`, because the repository derives the slug rather than trusting
  the caller.

Deliberate scope choice: the repository returns the **existing `Folder` domain object**, mapping
`title`/`slug` onto `name`. Phase 5 is an engine swap, not a domain change; the richer `Page`
aggregate (content, icon, ordering) belongs to phase 10 when summaries are actually built.
Introducing it here would mean changing the domain and the engine in one step, which is the
mistake r6 was written to avoid.

Small finding: **drizzle wraps driver errors**, so a constraint assertion has to read
`error.cause`, not `error.message` — the message is a "Failed query:" dump with the SQL and
parameters, and the constraint name is on the cause.

**Where this leaves the phase.** Everything a ported use case needs now exists: the schema, the
data, the boundary, and a repository behind it. What has not happened is the port itself — the
eight folder use cases still take the synchronous `FolderRepository` and still run on SQLite. The
next increment is one context's use cases moving to `ContentScope`, with the composition root
choosing per context, and both engines live until the last one moves.

### Phase 5, third slice: the ETL (r10)

`apps/api/src/persistence/postgres/etl.ts` plus `apps/api/scripts/migrate-to-postgres.ts`
(`bun run etl <sqlite> <url>`). Run against the real backup it writes:

| target | rows | from |
| --- | --- | --- |
| pages | 13 | folders |
| quizzes | 9 | quiz_sets |
| term_pairs | 32 | vocabulary_items |
| questions | 306 | questions |
| question_options | 915 | question_options |
| attempts | 38 | quiz_attempts |
| responses | 312 | question_responses |
| review_states | 227 | question_repetition_schedules |
| study_settings | 7 | repetition_settings + defaults |
| question_sources | 64 | 32 pairs × 2 directions |
| attempt_questions | 504 | the `question_ids` JSON, normalised |

`verifyMigration` then checks every mapped count, that all 234 correct answers survive, that no
options or attempt timestamps were orphaned, and that the root-page count matches — and the CLI
exits non-zero if any check fails. It passes on the real data.

Design points worth keeping:

- **Ids are derived, not random.** `uuidFor(kind, legacyId)` is sha256 over
  `recall-v2:kind:legacyId` with the version and variant bits set, so re-running the ETL
  produces the same uuids. That plus `legacy_id` unique constraints and `on conflict do
  nothing` makes it **idempotent** — proven by a test that runs it twice and asserts the
  question count is unchanged.
- **Folders need a topological walk.** `order by parent_id` does not put ancestors first past
  the first level; the real data has 3 roots and 10 nested folders, so a naive order fails on
  a foreign key. The ETL inserts by readiness and reports anything unreachable.
- **`question_sources` reconstructs a direction that was never stored.** v1 inferred it by
  comparing the question prompt to the term; the ETL does the same and records it explicitly,
  which is the point of the table.
- **Not migrated, deliberately:** the `oauth_*` tables (phase 7 replaces them with Better
  Auth) and `telegram_user_id` (ownership arrives in phase 7). Both are reported as notes
  rather than dropped silently.

**The postgres.js trap that cost the most time here.** postgres.js chooses parameter encoders
from the **first execution of a given query string** and reuses them. So an insert whose first
row has `null` in a column and whose second row has a value binds the second row against the
first row's inferred types. Two distinct symptoms, both misleading:

- a `uuid` arriving in `parent_id` as a *different* uuid than the one passed, surfacing as
  `violates foreign key constraint` on a parent that plainly exists;
- `TypeError: The "string" argument must be … Received an instance of Date`, thrown from deep
  inside postgres.js's byte writer.

Casting every placeholder (`${x}::uuid`, `::text`, `::timestamptz`, `::boolean`, `::int`,
`::text[]`) fixes the first. The second needs more: **timestamps are passed as ISO strings, not
`Date` objects**, because a `Date` reaching the text encoder throws regardless of the cast. The
failure is order-dependent, which is why the 13-folder real backup passed while a 2-folder
seeded fixture did not — a difference that looked like a harness bug and was not.

Also fixed while verifying: `verifyMigration` compared `sum(is_correct)` without `coalesce`, so
a source database with no answers reported "expected -1" instead of 0.

**Still not done in phase 5:** every repository, every use case, the transaction-topology
change, and the Node switch. The ETL is the piece that can now be rehearsed against production
data as often as wanted.

### Phase 5, second slice: the schema (r9)

**Backup first, as asked.** `data/quiz.before-postgres-20260823-170412.sqlite`, taken with
`VACUUM INTO` (consistent under load, no `-wal` sidecar) and validated by `assertRestorable`.
Then verified table by table against the live database — **all 13 tables match, 0 orphan
responses** — and the counts written to `data/etl-baseline.json` as the ETL's verification
baseline:

| | rows | | rows |
| --- | --- | --- | --- |
| quiz_sets | 9 | question_repetition_schedules | 227 |
| questions | 306 | vocabulary_items | 32 |
| question_options | 915 | folders | 13 |
| quiz_attempts | 38 | repetition_settings | 6 |
| question_responses | 312 | oauth_* | 12 |

312 answers, 234 correct. That is the corpus the ETL has to reproduce exactly.

**One thing I got wrong on the way.** I reported `applicationTables` (5 entries against 13
real tables) as a latent bug in the restore guard. It is not: there is a test named
*"restores a backup taken before the newer tables existed"* which deliberately strips
`folders`, `vocabulary_items` and the repetition tables from a backup and asserts it still
restores, with a comment saying `applicationTables` is the *signature*, not the live list. The
real gap was in my own manifest, which under-counted the baseline until I enumerated tables
from `sqlite_master` instead. Third time this session I inferred a defect from a mechanism
without checking intent.

**Schema.** `apps/api/src/persistence/postgres/schema.ts`, 12 tables, one migration
(`drizzle-postgres/0000_long_micromax.sql`), applied to the Docker instance. `timestamptz`
throughout, real `boolean`, real `text[]`/`integer[]` instead of JSON-in-TEXT, `uuid` primary
keys with a `legacy_id` column so the old ids stay resolvable for a release after the ETL,
`version` for optimistic concurrency, `deleted_at` on every content table, `visibility`
reserved for the marketplace.

Ownership is deliberately **not** in this migration. `owner_id` arrives in phase 7 with
identity, because `ADD COLUMN` + backfill + `SET NOT NULL` is cheap on Postgres in a way it
never was on SQLite — which is exactly the kind of thing moving engine first buys.

**Constraints proven, not assumed** (`tests/integration/postgres/schema-constraints.test.ts`):

- `pages_parent_slug_unique … NULLS NOT DISTINCT` really does reject two root pages with the
  same slug, while allowing the same slug under different parents. This was the specific trap
  flagged in §7 — Postgres treats NULLs as distinct by default, and the SQLite schema needed a
  separate partial index for it. Verified in both directions.
- `study_settings_scope_unique … NULLS NOT DISTINCT` rejects a second owner-wide row, which is
  what replaces the `check (id = 1)` singleton.
- `questions → responses` is `ON DELETE RESTRICT`, so **the database now refuses to delete a
  question that has answers.** In v1 that was an application guard (`AnsweredQuestionError`).
  It is now structural, and soft deletion via `deleted_at` is the supported path. That closes
  most of what was left of finding 11.
- `responses.selected_option_ids` is a real `uuid[]`; `attempts.started_at` is
  `timestamp with time zone`.

**Two tooling findings worth knowing before writing more Postgres tests.**

1. **drizzle-kit hardcodes `REFERENCES "public"."…"`** — 15 times in this migration. So the
   obvious test-isolation trick, a schema per run, silently leaves every foreign key pointing
   at an empty `public`: parent rows insert fine and children fail with a confusing FK
   violation. Cost me a while. The harness now creates a **database** per run, where `public`
   is the right answer. This also matters for Supabase if a non-`public` schema is ever
   wanted: it is a drizzle-kit output setting, not a runtime choice.
2. **`expect(query).rejects` never settles against a postgres.js query** under `bun test` —
   they are lazy thenables, and the test hangs to timeout rather than failing. Tests use an
   explicit `failureOf(() => …)` helper that forces execution through `catch`. Worth
   remembering; it looks like a database hang and is not one.

**Still not done in phase 5:** every repository, every use case, the transaction-topology
change, the ETL, and the Node switch.

### Phase 5, first slice (r8)

Done: `docker-compose.yml` with Postgres 17, `postgres` (postgres.js) behind
`drizzle-orm/postgres-js`, `bun run db:up` / `db:down` / `db:reset`, a test harness that gives
every run its own Postgres **schema** (`tests/fixtures/postgres.ts`), a CI job with a Postgres
service, and `apps/api/src/application/ports/unit-of-work.ts`.

**The finding that shapes the rest of the phase.** r6 deleted phase 3 because an unawaited
repository call inside a synchronous transaction callback would be a lie the type system told.
On Postgres the failure mode is worse than predicted, and it is now measured rather than
argued: an unawaited write inside a `db.transaction(...)` callback **survives when that
transaction rolls back** — 8 runs out of 8, deterministic. It commits on its own connection
while the boundary it appeared to belong to is discarded.

So the hazard is not "the write is lost". It is "the write outlives the rollback", which is
silent, permanent corruption of exactly the invariant a transaction exists to protect.
`tests/integration/postgres/transaction-semantics.test.ts` pins all five properties: commit,
rollback-on-throw, read-your-writes, savepoint nesting, and this one.

**What that forces on the design.** The `UnitOfWork` port hands repositories *to* the
operation rather than being injected beside them:

```ts
run<TResult>(operation: (scope: TScope) => Promise<TResult>): Promise<TResult>
```

A repository reachable only from inside the boundary cannot be called outside one by accident,
and cannot be called on the wrong connection. That is the enforcement, and it has to be
structural, because the alternatives do not work here:

- **Lint cannot do it.** Biome's `noFloatingPromises` is exactly the right rule and is
  **inert** in this setup — a deliberate floating promise produced no diagnostic, because the
  type-aware nursery domain needs project configuration Biome 2.4 does not do here. The rule
  was added, tested, found silent, and removed rather than left in place looking like
  protection. (Re-test it when Biome's type inference stabilises.)
- **Convention cannot do it.** The current code already nests boundaries fourteen ways; the
  next person will too.

**A complication the plan did not anticipate.** "Per bounded context" is harder than it reads,
because two use cases already cross contexts inside one transaction:
`AddVocabularyUseCase` calls `AddQuestionsUseCase` inside its boundary, and
`FinishQuizAttemptUseCase` writes an attempt and a repetition schedule in one. Neither can move
while half its writes are on the other engine. So the porting order is not free: `content`
must move before `study`, `study` before `scheduling`, and the two cross-context use cases move
with the *later* of their two contexts. Worth settling before the first repository moves.

**Not started:** the schema itself (§6's renames), any repository, any use case, the ETL, and
the Node switch. The runtime stays Bun until `bun:sqlite` is gone.

### What phase 4 established, and one plan assumption it broke (r7)

Built: `apps/api/src/modules/` with `shared/{config,database,errors,health,swagger}` and a
`content` module, exactly the shape §8 describes. The `DatabaseModule` is `@Global()` and owns
the SQLite lifecycle (migrations on boot, `closeDatabase` on `onApplicationShutdown`);
`content/use-cases.providers.ts` factory-wires the existing use-case classes against a single
`USE_CASE_DEPENDENCIES` token, which is the mechanism §8 predicted would let the application
layer survive untouched. It did: no use case, port, or domain file was modified to serve HTTP.

Three findings worth keeping:

1. **The API runs on Bun, not Node — and must, for now.** §1 says `apps/api` is Node. It
   cannot be until Postgres arrives, because persistence is still `bun:sqlite`, which is
   Bun-only. Nest 11 runs fine under Bun once `experimentalDecorators` is on. The Node switch
   belongs to phase 5, alongside the driver change. The plan's "Node runtime for `api`"
   describes the end state, not phase 4.
2. **Bun defaults to TC39 decorators; Nest needs legacy ones.** Without
   `experimentalDecorators: true` every route decorator fails with `TypeError: undefined is
   not an object (evaluating 'descriptor.value')` — an error that says nothing about the real
   cause. One line in `packages/tooling/tsconfig.base.json`.
3. **`emitDecoratorMetadata` is a trap here, and is deliberately off.** With it on, DI works
   through constructor parameter types — until Biome's `useImportType` autofix rewrites a
   class import to `import type`, which erases the metadata. That happened during this phase:
   the suite passed in isolation and failed in the full run with Nest reporting a dependency
   of type `[Function: Object]`. Every injection point now passes an explicit `@Inject(Token)`
   and the flag is off, so a missing token fails loudly at boot instead of silently after a
   formatter run. Recorded in `CLAUDE.md`.

Also needed: `javascript.parser.unsafeParameterDecoratorsEnabled` in `biome.json` (Biome does
not parse parameter decorators otherwise), and `correctness/useHookAtTopLevel` disabled for
the modules tree, where `app.useGlobalFilters(...)` trips a React hooks rule.

Not done in phase 4, on purpose: the four existing entrypoints are untouched and still run the
old composition root, so the bot, MCP, and admin keep working exactly as before. `bun run api`
starts the new one beside them. Deleting `create-application.ts` and `adapters/admin/api.ts`
waits until the API actually serves what those surfaces need — phase 8.

### Why phase 3 was deleted (r6)

r2 proposed: widen every repository port to `Promise<T>` while keeping the transaction
*callback* synchronous, so the ~200-file churn lands on SQLite before Postgres arrives. I
described that as the safe middle path. **It does not work**, and the reason is visible in the
code rather than arguable:

Transaction boundaries **nest**. Ten use cases wrap `this.transaction.run(() => …)` around
repository calls, and fourteen repository methods open their *own* `transaction.run` inside
(`sqlite-quiz-set.repository.ts:63`, `sqlite-quiz-attempt.repository.ts:62`,
`sqlite-repetition.repository.ts:45`, and so on). bun:sqlite tolerates that today through
savepoints. `FinishQuizAttempt` is the clearest case: line 66 wraps `attempts.save(finished)`
plus a repetition write in one boundary, and `attempts.save()` opens another inside it.

Make the repository methods return `Promise` and that inner call becomes an **unawaited promise
inside a synchronous transaction callback.** It would appear to work — an `async` function with
no `await` runs its body synchronously before returning — so every test would pass while the
type system asserted something the semantics forbid. That is worse than not doing it: the
codebase even has a test pinning the contract shut
(`application/ports/ports.test.ts:7-9`, `@ts-expect-error bun:sqlite transactions must not
cross an await boundary`).

The real work hiding under "async-ify the ports" is a **transaction-topology change**: one
owner per boundary, with the transaction handle threaded into repositories instead of injected
into their constructors — because a Postgres transaction is bound to a connection and cannot
be rediscovered from a global. That is not mechanical, and it cannot be validated on SQLite,
whose whole model is the one being replaced.

So it moves into phase 5 and is done **per bounded context**, exactly as the review originally
recommended: each transactional use case converts together with its Postgres repository, with
the shared contract suite running against both engines during the transition.

Phase 4 is unaffected — a Nest shell over synchronous repositories is fine, since controllers
await use cases that are already `async`.

### Why phase 2 created only one app

The r3 layout lists five apps. Phase 2 created **one**, and that was deliberate — the plan had
not spelled this out, so it is recorded here.

Phase 2's contract is *zero behaviour change*. Today the bot, the MCP server, and the admin UI
all import the composition root and run in-process against SQLite. Creating `apps/bot` now
would mean `apps/bot` depending on `apps/api` — an app-to-app dependency that does not exist
in the target, that the lint rules would have to be widened to permit, and that would have to
be unwound in phase 8 anyway when those surfaces become HTTP clients.

So `apps/api` currently holds everything, including `src/adapters/{telegram,mcp,admin}` in
their v1 shape. They move out in **phase 8**, when there is an API for them to call. The
layout the plan describes is the phase-8 end state, not the phase-2 one.

What phase 2 did deliver, beyond the move: the dependency direction is **enforced** for the
first time. `biome.json` fails the build when `domain` imports `adapters`, `application`,
`infrastructure`, `composition`, `modules`, or `persistence`, and when `application` imports
adapters or the composition root (tests excluded — one existing test constructs a real SQLite
repository on purpose). Verified by injecting a violation of each rule and watching both fire
with the rule name in the message. This is Appendix B's option C, now live.

Not yet enforced: `adapters → composition`. Two files legitimately violate it today
(`admin/api.ts` and `mcp/http/app.ts` both take the whole `Application`), and both are slated
for deletion when Nest arrives in phase 4. Adding that rule before then would only mean
suppressions.

### The cutover (phase 6), spelled out

r1 treated "run an ETL, keep the SQLite file" as a migration plan. It is not — row counts
catch none of the failure modes that actually happen. The rehearsed procedure:

1. **Rehearse against a copy** and time it. A cutover first performed in production is not a
   plan, it is a hope.
2. Stop writes (bot + MCP + admin down, maintenance page), back up the SQLite file.
3. Provision schema via a **release job**, on a separate direct `MIGRATION_DATABASE_URL`,
   never from an application replica and never concurrently. Note that `scripts/up.ts:246`
   migrates on every start — a fine dev convenience that must **not** carry to production.
4. Run the ETL, then verify: row counts **plus** FK/orphan checks, JSON-parse success on
   every converted column, timestamp round-trip equality, ownership assignment, and
   semantic checksums (per-quiz question count, per-attempt score recomputed from responses
   and compared to the stored value).
5. Smoke-test through the API, not the database.
6. Switch traffic. Keep SQLite **read-only** as the escape hatch.
7. Write down the **rollback criterion and deadline** in advance ("if X fails within 24 h we
   revert to SQLite"), and what happens to writes made after ETL. An unbounded "we can
   always roll back" is how a two-hour cutover becomes a two-week fork.

### Deployment decisions that cannot be deferred (they affect phases 5-8)

- **Telegram: webhook, or exactly one poller.** Today the bot long-polls with
  `dropPendingUpdates: true` (`src/entrypoints/telegram.ts:110`). Two overlapping replicas
  during a rolling deploy means two pollers fighting over updates. Either move to webhooks
  (with Telegram's secret-token header and `update_id` idempotency) or pin the bot to one
  replica with stop-before-start rollout. Pick before phase 8.
- **Connection pooling.** A long-lived Nest process needs a deliberately small pool with
  statement, acquire, and idle timeouts, a maximum connection lifetime, and graceful drain
  on shutdown. Separate runtime and migration URLs; if runtime uses the pooler on 6543,
  disable prepared statements — and do not assume direct 5432 is reachable from whichever
  host you pick.
- **Readiness and liveness endpoints, graceful shutdown, secret management.** The existing
  `infrastructure/lifecycle/shutdown.ts` is a good starting point and should move into the
  Nest lifecycle hooks rather than being reinvented.

## Decisions

### Settled (r3)

| # | Decision | Choice | Consequences recorded in |
| --- | --- | --- | --- |
| 1 | Web stack | **Bun + TanStack Start + TanStack Query** | §1 (Vite/Nitro, server-function guardrail), §4 |
| 2 | Auth | **Better Auth**, mounted in `apps/api` | §3 (its schema replaces the hand-rolled one), §5 |
| 3 | `CLAUDE.md` amendment | **Confirmed** — Express for `api`, Vite for `web` | §1, §8 |
| 4 | Bot topology | **Thin API client** (my call, as asked) | §1 |
| 5 | Id strategy | **uuidv7**, 22-char base64url in callbacks | §2, §6 |
| 6 | Renames | **Approved** | §6 |
| 7 | Sharing | **Private v1; marketplace later** | §3 (copy-on-practice, `visibility`) |
| 8 | `DEVELOPMENT_PLAN.md` | **Replaced by this document** | below |
| — | HTTP adapter | **Express, not Fastify** | §1 |
| — | Use-case naming | **`AnswerQuestionUseCase`** | §8 |
| — | Package layout | **`domain`/`application`/`persistence` inside `apps/api`**; only `contracts` + `tooling` are packages | §1, §8, Appendix B |
| — | Telegram delivery | **Webhook**, with the secret-token header and `update_id` idempotency | Sequencing → deployment |
| — | Phase 1 | **Shipped** — option ids stable across edits; `question_revisions` deferred | finding 11, §6 |

Settled in r2 and not reopened: the transaction callback stays synchronous until Postgres
(§2); events fire after commit only, and analytics starts as SQL views (§8).

**On decision 8.** `DEVELOPMENT_PLAN.md` is deleted and this document's Sequencing section
replaces it. Three files still reference it by name — `CLAUDE.md`, `AGENTS.md`,
`DESCRIPTION.md` — and must be repointed here in phase 0, or every future agent session
starts by looking for a file that is gone. `WORKFLOW.md` is *also* deleted in the working
tree and is referenced the same way; if that deletion was not deliberate, restore it with
`git checkout -- WORKFLOW.md`.

### Still open

Nothing blocking. The next action is phase 2 — the monorepo split, as a pure file move with
the suite green.

Two things to carry into the phases that need them:

- **Webhook migration (phase 8).** `bot.launch({ dropPendingUpdates: true })` becomes
  `bot.createWebhook(...)` behind the API's public HTTPS endpoint, with Telegram's
  `secret_token` header verified on every request and `update_id` recorded for idempotency.
  Drop `dropPendingUpdates` at the same time: with a webhook there is no replay backlog to
  discard, and the reason it exists (24 h of queued updates acting on stale screens) goes
  away. Keep the polling path behind a config flag for local development, where a public URL
  is a nuisance.
- **The deleted-but-unanswered hole** (finding 11, third bullet) stays open by choice. Closing
  it needs either the deferred revision model or a per-attempt presence check. Revisit when
  §6's revisions question is revisited.

## Appendix A: file-level evidence

| Claim | Where to look |
| --- | --- |
| Sync-only transaction port | `src/application/ports/transaction.ts` (`Synchronous<T>`) |
| Sync repositories | `src/application/ports/repositories/*.repository.ts` |
| Whole-aggregate rewrite on save | `src/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository.ts:58-90` |
| Telegram identity in the domain | `src/domain/quiz-attempt/quiz-attempt.types.ts`, `src/domain/repetition/repetition.types.ts` |
| Singleton settings row | `src/adapters/persistence/sqlite/schema.ts` (`repetition_defaults_single_row`) |
| JSON-in-TEXT columns | `schema.ts`: `tags`, `question_ids`, `selected_option_ids`, `intervals_days` |
| Vocabulary link without an FK | `drizzle/0005_vocabulary_items.sql:15`; `schema.ts:163`; `src/application/use-cases/quiz-sets/list-vocabulary.ts:56` |
| Hand-rolled admin API | `src/adapters/admin/api.ts` (603 lines) |
| Passphrase-only admin session | `src/adapters/admin/session.ts` |
| MCP OAuth without a user | `schema.ts`: `oauth_clients`, `oauth_codes`, `oauth_tokens` |
| God-object composition root | `src/composition/create-application.ts` (38-field `Application`) |
| Attempt review data already exists | `src/application/use-cases/statistics/get-attempt-detail.ts` |
| Statistics already exist | `src/application/use-cases/statistics/get-quiz-statistics.ts` |
| Reusable process supervisor | `scripts/up.ts` + `up.plan.ts` / `up.ports.ts` / `up.supervise.ts` |
| Answer rows cascade-deleted with their question | `schema.ts:224-226` |
| …but that delete is refused when answers exist | `delete-question.ts:11-23` (`AnsweredQuestionError`) |
| Attempt review silently skips missing questions | `get-attempt-detail.ts:84-88` |
| Unresolvable selection renders as `"?"` | `attempt-detail.presenter.ts:40-44` |
| Deterministic option ids, the pattern to follow | `update-vocabulary.ts:83` |
| Telegram callback data capped at 64 bytes | `src/adapters/telegram/callbacks/callback-data.ts:4` |
| Long polling with dropped pending updates | `src/entrypoints/telegram.ts:110` |
| Migrate-on-every-start (dev only) | `scripts/up.ts:246` |
| Atomic attempt + schedule write | `src/application/use-cases/attempts/finish-quiz-attempt.ts:66` |
| Root-name uniqueness needs a partial index | `schema.ts:44-48` |


---

## Appendix B: package boundaries, tested rather than argued

Built and run on 2026-08-23 to answer "why separate packages?". Three variants, one scenario:
**a `domain` file imports an adapter — the thing `ARCHITECTURE.md` dependency rule 1
forbids.** The question is only ever *what stops you*.

### Option A — one app, folders only (the layout you proposed)

```text
single/
├─ tsconfig.json          paths: { "@/*": ["./src/*"] }
└─ src/
   ├─ adapters/db.ts      export const rawRows = () => [{ id: "1", title: "Replication" }]
   └─ domain/quiz.ts      import { rawRows } from "@/adapters/db";
```

```console
$ tsc --noEmit -p tsconfig.json
exit=0
```

**Nothing stops you.** No error, no warning. The rule exists only in a markdown file and in
whoever is reviewing.

### Option B — two packages

```text
pkgs/
├─ package.json                     workspaces: ["packages/*"]
└─ packages/
   ├─ db/       package.json        name: "@demo/db"
   └─ domain/   package.json        name: "@demo/domain", dependencies: {}   ← declares nothing
                src/index.ts        import { rawRows } from "@demo/db";
```

```console
$ tsc --noEmit -p tsconfig.json
src/index.ts(1,25): error TS2307: Cannot find module '@demo/db' or its corresponding type declarations.
src/index.ts(3,44): error TS7006: Parameter 'row' implicitly has an 'any' type.
exit=1
```

**The boundary is real and the toolchain enforces it** — `domain` cannot import what it does
not declare. This is the genuine benefit of packages, and it is not nothing. Note the second
error, though: once resolution fails, inference collapses too, so a boundary violation
arrives as a small pile of confusing errors rather than one clear one. And the message says
*"cannot find module"* — nothing about architecture.

### Option C — one app, plus ~20 lines of `biome.json`

```json
{
  "linter": { "enabled": true },
  "overrides": [
    {
      "includes": ["**/src/domain/**"],
      "linter": { "rules": { "style": { "noRestrictedImports": { "level": "error",
        "options": { "patterns": [ {
          "group": ["@/adapters/**", "@/application/**", "@/infrastructure/**", "@/modules/**"],
          "message": "domain must not import outward (ARCHITECTURE.md dependency rule 1)"
        } ] } } } } }
    }
  ]
}
```

```console
$ biome lint .
src/domain/nested/deep.ts:1:25 lint/style/noRestrictedImports ─────────────────────────

  × domain must not import outward (ARCHITECTURE.md dependency rule 1)

  > 1 │ import { rawRows } from "@/adapters/persistence/sqlite/database";
      │                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

src/domain/nested/deep.ts:2:27 lint/style/noRestrictedImports ─────────────────────────

  × domain must not import outward (ARCHITECTURE.md dependency rule 1)

Checked 6 files in 2ms. Found 3 errors.
```

Verified: glob patterns work, nested directories are caught, and the message names the rule
that was broken. Biome 2.4.11 is **already a dependency of this repo**, so the marginal cost
is the config block and nothing else.

### Conclusion

Option C gives option B's enforcement with option A's simplicity, and a better error message
than either. The r3 layout in §1 is therefore: `domain` / `application` / `persistence` as
folders inside `apps/api/src` guarded by this rule, with `packages/` reserved for
`contracts` and `tooling` — the two things that actually have multiple consumers.

Two honest caveats:

- **A lint rule is opt-in per pattern; a package boundary is total.** Add a new outward
  directory and forget to add it to the `group`, and the hole opens silently. Mitigation:
  invert it — restrict `domain` to importing *only* relative paths and `packages/contracts`,
  so new directories are denied by default rather than allowed by default.
- **It only catches what it is pointed at.** It cannot stop `apps/web` from opening a
  database connection, because that is a *dependency* problem rather than an import-path
  problem. That is why `apps/web` not listing `drizzle`/`postgres` in its `package.json`
  still matters — a real package boundary, doing the one job it is uniquely good at (§1).

Reproducible at
`/private/tmp/claude-501/.../scratchpad/pkgdemo/{single,pkgs,lint}` for the rest of this
session; the file listings above are the whole demo.
