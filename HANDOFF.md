# Handoff: finish the Postgres cutover

> Read this before touching anything. It is written for a fresh session with no memory of the
> work so far. Written 2026-08-24.
>
> **Background reading, in order:** `CLAUDE.md` (rules, and the traps section — those were
> paid for), then `REWRITE_PLAN.md` (the whole plan; §"Phase 5" and the revision log r8–r17
> carry the decisions and the corrections). `ARCHITECTURE.md` describes v1 and is superseded
> for anything under `apps/`.

---

## 1. Where things are

| branch | state | what it is |
| --- | --- | --- |
| `main` | untouched, v1 | frozen until the rewrite lands. Do not target it. |
| `fix/stable-option-ids` (`0469c40`) | green | PR #75. Phase 1: option ids stay stable across edits. |
| `refactor/monorepo-split` (`c5be492`) | **green, 1469 tests** | PR #76, stacked on #75. Phases 2–5 minus the cutover. |
| `wip/postgres-cutover` (`2f0852a`) | **source green, tests not** | the cutover. **This is where you work.** |

```bash
git checkout wip/postgres-cutover
bun install
bun run db:up          # Postgres 17 in Docker on 55432
bun run typecheck      # 158 errors, all in tests. 0 in src.
bun run check          # also fails — see the note below, it is not what it looks like
```

**`bun run check` fails with four *parse* errors, not lint errors.** Three files were left
mid-edit by a partial `await` pass and contain `await` inside a non-async arrow, which Biome
cannot parse, so it also refuses to format the file:

```
src/application/use-cases/attempts/attempts.fixture.ts:58
src/application/use-cases/practice/practice.fixture.ts:58 and :120
src/application/use-cases/folders/ensure-folder-path.test.ts:69
```

Fix those four first — make the enclosing arrow `async` and await the call — and `check` will
start reporting real problems instead of refusing to read the file. They are the same two
fixtures §4a tells you to start with, so this is the same first step, just with a sharper
error message.

`refactor/monorepo-split` must stay green. Do not commit broken state to it.

---

## 2. Your job, in one sentence

Get `wip/postgres-cutover` to pass `bun run verify`, then prove the bot actually serves a quiz
from Postgres.

---

## 3. What is already done (do not redo it)

On `wip/postgres-cutover`:

- **All 34 use cases** take `UnitOfWork<RepositoryScope>` + `ApplicationDependencies`
  (`apps/api/src/application/use-case.ts`). Every write is inside a unit-of-work boundary.
- **All five repositories** exist twice — Postgres (`apps/api/src/persistence/postgres/`) and
  in-memory (`apps/api/src/persistence/memory/`) — behind **shared contract suites** in
  `apps/api/tests/contracts/`. 87 contract tests, both engines. Do not write engine-specific
  repository tests; add to the contract instead.
- `create-application.ts` builds a Postgres connection. `DATABASE_URL` replaced
  `DATABASE_PATH`. `close()` is now **async**.
- The §6 schema is in `apps/api/src/persistence/postgres/schema.ts`, one migration in
  `apps/api/drizzle-postgres/`. Constraints are proven in
  `tests/integration/postgres/schema-constraints.test.ts`.
- **The ETL works and verifies itself** (`apps/api/src/persistence/postgres/etl.ts`). It is
  idempotent and has been run against the real backup: 13 pages, 9 quizzes, 32 term_pairs, 306
  questions, 915 options, 38 attempts, 312 responses, 227 review_states, 7 study_settings.
- Deleted: the five SQLite repositories and mappers, the five synchronous ports, the nine
  SQLite integration test files, and the `backup`/`restore`/`migrate`/`seed` scripts.
- **A verified backup exists**: `data/quiz.before-postgres-20260823-170412.sqlite`, checked
  table-by-table against live, with counts in `data/etl-baseline.json`.

---

## 4. The remaining work

### 4a. 158 type errors, and they are mostly one thing

103 of the 158 are `TS2339` — tests reaching for repositories that moved onto the scope and
became async. **This mapping is the bulk of the job:**

| test writes | should be |
| --- | --- |
| `context.quizSets.findById(x)` | `await context.scope.quizzes.findById(x)` |
| `context.quizSets.list(f)` | `await context.scope.quizzes.list(f)` — and `folderId` in the filter is now `pageId` |
| `context.attempts.findById(x)` | `await context.scope.attempts.findById(x)` |
| `context.attempts.findActiveByUser(u)` | `await context.scope.attempts.findActiveFor(u)` |
| `context.attempts.listCompletedBySet(u, q)` | `await context.scope.attempts.listCompletedForQuiz(u, q)` |
| `context.folders.findById(x)` | `await context.scope.pages.findById(x)` |
| `context.folders.countSetsIn(x)` | `await context.scope.pages.countQuizzesIn(x)` |
| `context.folders.countChildFolders(x)` | `await context.scope.pages.countChildPages(x)` |
| `context.vocabulary.listBySet(q)` | `await context.scope.termPairs.listForQuiz(q)` |
| `context.repetition.findSettings(q)` | `await context.scope.reviews.findSettings({ kind: "quiz", quizId: q })` |
| `context.repetition.findDefaults()` | `await context.scope.reviews.findSettings({ kind: "owner" })` |
| `context.repetition.saveDefaults(s)` | `await context.scope.reviews.saveSettings({ kind: "owner" }, s)` |
| `context.transaction` | gone — use `context.unitOfWork` |
| `context.database`, `context.client` | **gone with no replacement** — see 4b |

`resolveWithSource(...)` and `resolveRepetitionSettings(...)` return promises now. Helpers
`ownerScope` / `quizScope(id)` are exported from
`application/use-cases/settings/resolve-quiz-settings.ts`.

The other error classes are almost all cascades of the above: **27 `TS7006`** (implicit `any`,
because the expression's type failed to resolve) and **4 `TS1308`** (`await` outside an async
function — make the enclosing arrow `async`). They disappear as the mapping is applied. The
**13 `TS2353`** are `databasePath:` still being passed to `createApplication` — change to
`databaseUrl:`.

Per-file counts, worst first — start with the small ones to build confidence in the pattern,
then do the big ones:

```
14  quiz-sets/update-vocabulary.test.ts        4  quiz-sets/archive-quiz-set.test.ts
14  folders/browse-folder.test.ts              4  attempts/finish-quiz-attempt.test.ts
13  quiz-sets/add-questions.test.ts            4  attempts/answer-question.test.ts
13  attempts/start-quiz-attempt.test.ts        3  quiz-sets/update-quiz-set.test.ts
12  quiz-sets/move-quiz-set.test.ts            3  attempts/attempts.fixture.ts
 9  repetition/repetition.test.ts              3  adapters/mcp/http/app.test.ts
 8  tests/e2e/operations.test.ts               2  tests/e2e/telegram/bot-harness.ts
 8  quiz-sets/update-question.test.ts          2  infrastructure/config/env.test.ts
 7  practice/practice.fixture.ts               2  statistics/get-quiz-statistics.test.ts
 7  attempts/resume-quiz-attempt.test.ts       2  quiz-sets/delete-question.test.ts
 5  practice/start-practice-session.test.ts    2  folders/ensure-folder-path.test.ts
 4  quiz-sets/publish-quiz-set.test.ts         1  each: 9 more files
```

**Do the two fixtures first** — `attempts/attempts.fixture.ts` and
`practice/practice.fixture.ts`. Their `positionOf`, `questionIdOf` and `questionsOf` helpers
must become `async` (and the interface must say `Promise<…>`), which then requires `await` at
every call site in the tests that use them. `folders/folders.fixture.ts` and
`quiz-sets/quiz-sets.fixture.ts` are already ported — copy their shape.

### 4b. Tests that are obsolete, not broken — delete them

These assert on things that no longer exist. **Do not try to port them.** Judge each, but the
default is deletion:

- anything reaching `context.database` / `context.client` (6 errors) — raw SQLite handle
  assertions inside use-case tests;
- `tests/e2e/operations.test.ts` — backup/restore/hot-backup behaviour for the quiz SQLite
  file. Postgres uses `pg_dump`; the OAuth SQLite file is the only file left, and phase 7
  deletes it;
- `apps/api/src/adapters/mcp/http/app.test.ts` lines using `application.client` /
  `application.transaction` — the OAuth store now opens its own database
  (`createOAuthDatabase`), so pass that instead;
- any assertion on the **18-character base36 id format**. Ids are uuids now.
  `createSequentialIdGenerator` in `tests/fixtures/memory.fixture.ts` emits deterministic
  uuid-shaped ids for tests that need stable values.

### 4c. Things outside the type checker that still need doing

- **`.env.example`** still documents `DATABASE_PATH`. It needs `DATABASE_URL` (Postgres) and
  `OAUTH_DATABASE_PATH` (default `./data/oauth.sqlite`). The real `.env` needs the same.
- **`scripts/up.ts`** — the supervisor. Check it still boots: `db:up` must run before the
  services, and `migrate` no longer exists as a script.
- **`README.md`** — the operator manual still describes the SQLite workflow, `bun run backup`,
  and `DATABASE_PATH`. Large, Ukrainian, worth a pass at the end, not the start.

---

## 5. How to work on this

```bash
bun run db:up                      # Postgres must be up for the integration tests
bun run typecheck                  # your worklist
bun test ./apps/api/tests/unit/    # fast, no Docker: the in-memory contracts
bun run verify                     # the gate: biome + tsc + bun test + build
```

**Two rules learned the hard way in the previous session. Both cost real time.**

1. **Never run a regex over class bodies.** A pass over 20 files inserted repository fields
   into an *error class's* constructor and produced 186 errors. Port file by file, anchored on
   text you have actually read.
2. **Assert every scripted replacement.** A `str.replace()` that silently did not match left
   `restoreInto` missing three maps, which broke in-memory transaction rollback without
   failing anything until a contract test caught it. If you script an edit, `assert
   s.count(old) == 1` first.

---

## 6. Traps already discovered — all are in `CLAUDE.md`, summarised here

- **postgres.js picks parameter encoders from the first execution of a query string.** An
  insert whose first row has `null` where a later row has a value binds the later row against
  the wrong types. Symptoms: a foreign key violation naming a parent that plainly exists, or
  `TypeError: … Received an instance of Date`. **Cast every placeholder** (`${x}::uuid`,
  `::text`, `::timestamptz`) and **pass timestamps as ISO strings, never `Date`**.
- **drizzle-kit hardcodes `REFERENCES "public"."…"`.** A per-schema test database leaves every
  foreign key pointing at an empty `public`. `tests/fixtures/postgres.ts` creates a **database**
  per run for that reason.
- **`expect(query).rejects` never settles against a postgres.js query** — it is a lazy
  thenable and the test hangs to timeout. Force it through `catch`; see `failureOf` in
  `tests/integration/postgres/schema-constraints.test.ts`.
- **drizzle wraps driver errors.** Constraint assertions must read `error.cause`, not
  `error.message`.
- **An unawaited write inside a Postgres transaction survives the rollback** — measured 8/8.
  That is why repositories are only reachable from inside `unitOfWork.run`. Never hold a
  repository outside the boundary.
- **Bun defaults to TC39 decorators; Nest needs legacy ones** (`experimentalDecorators`), and
  **`emitDecoratorMetadata` is deliberately off** — with it on, Biome's `useImportType` autofix
  rewrites a class import to `import type`, erases the metadata, and DI breaks at runtime.
  **Every Nest injection point uses an explicit `@Inject(Token)`.**
- **Migration filenames are not written in code.** drizzle-kit renames the file on every
  regeneration; tests and the ETL read the newest `.sql` from the directory.

---

## 7. Settled decisions — do not relitigate

From `REWRITE_PLAN.md` §Decisions: web app is Bun + TanStack Start + TanStack Query; auth is
Better Auth mounted in `apps/api`; HTTP adapter is **Express, not Fastify**; ids are **uuidv7**
with a 22-char base64url form in Telegram callbacks; renames are approved (`pages`, `quizzes`,
`term_pairs`, `attempts`, `responses`, `review_states`, `study_settings`); v1 is private-only
with a marketplace later; Telegram moves to **webhook** in phase 8.

Also settled during the cutover:

- **`apps/api` stays on Bun for now.** The MCP OAuth store and the SDK provider above it are
  synchronous throughout, so client credentials keep their own SQLite file. `bun:sqlite`
  therefore stays in the tree and the **Node switch moves to phase 7**, when Better Auth
  replaces OAuth.
- **Ownership is still absent by design.** `owner_id` arrives in phase 7. But the legacy
  `telegram_user_id` **is preserved** on `attempts` and `review_states` — the domain requires
  it and phase 7 needs it to map the Telegram account. Defer the model, never the data.
- **Per-bounded-context migration was retracted.** The repositories are welded by SQL
  (`topicAccuracy` joins `questions`; the folder repository reads `quiz_sets`), so this is one
  cutover.

---

## 8. The finish line

Type-green is not done. Done is:

```bash
bun run verify                    # biome, tsc, tests, build — all green

# then, against a scratch database, prove the migration end to end
docker exec recall-postgres psql -U recall -d recall \
  -c 'drop database if exists recall_live with (force)' -c 'create database recall_live'
cd apps/api && APPLY_SCHEMA=1 bun run ./scripts/migrate-to-postgres.ts \
  ../../data/quiz.before-postgres-20260823-170412.sqlite \
  postgres://recall:recall@127.0.0.1:55432/recall_live
# expect: every count matching, then "verification passed"

# then the thing nobody has done yet
DATABASE_URL=postgres://recall:recall@127.0.0.1:55432/recall_live bun run status
# expect: 9 published sets, 306 questions, 38 attempts, 312 answers

DATABASE_URL=... bun run dev       # start the bot; open a quiz; answer a question
```

**That last step is the real proof and it has never been run.** The ETL is verified against
real data and the source compiles, but "the bot serves a quiz from Postgres and records an
answer" is unproven. Do it before opening a pull request.

When it passes: open a PR from `wip/postgres-cutover` into `refactor/monorepo-split`, and
update `REWRITE_PLAN.md` — mark phase 5/6 done, and note in the revision log what the smoke
test actually showed.

**Keep the SQLite file.** After the cutover it is the escape hatch, and per the cutover section
of the plan it stays read-only rather than being deleted.
