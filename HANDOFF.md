# Handoff: the Postgres cutover is done; phase 7 is next

> Written 2026-08-24, replacing the handoff that asked for the cutover to be finished.
>
> **Background reading, in order:** `CLAUDE.md` (rules, and the traps section — those were
> paid for), then `REWRITE_PLAN.md` (§"The cutover, finished (r17)" for what just landed and
> what phase 7 inherits). `ARCHITECTURE.md` describes v1 and is superseded for anything under
> `apps/`.

---

## 1. Where things are

| branch | state | what it is |
| --- | --- | --- |
| `main` | untouched, v1 | frozen until the rewrite lands. Do not target it. |
| `fix/stable-option-ids` | green | PR #75. Phase 1: option ids stay stable across edits. |
| `refactor/monorepo-split` | green, 1469 tests | PR #76, stacked on #75. Phases 2–5 minus the cutover. |
| `wip/postgres-cutover` | **green, 1263 tests** | the cutover. Opens into `refactor/monorepo-split`. |

The test count fell because obsolete SQLite-file tests were deleted, not because coverage was
dropped — see the deletions listed in r17.

```bash
git checkout wip/postgres-cutover
bun install
bun run db:up          # Postgres 17 in Docker on port 55432
bun run db:migrate     # apply the schema
bun run verify         # biome + tsc + 1263 tests + build, all green
```

`bun run verify` also passes with Docker down: the 65 tests that need Postgres skip. Setting
`TEST_DATABASE_URL` makes them mandatory instead, and a guard in
`tests/integration/postgres/transaction-semantics.test.ts` fails the suite if they skipped
while that variable was set.

---

## 2. What the cutover actually did

Beyond the port itself (all 34 use cases on `UnitOfWork<RepositoryScope>`, the composition root
on Postgres, `DATABASE_URL` replacing `DATABASE_PATH`), the finishing session:

- fixed **four defects the port had introduced** — a non-uuid id returning 500 instead of 404,
  "outstanding mistakes" never forgetting a corrected mistake, the connection-string password
  reaching stdout, and a test leaking `DATABASE_URL` so that later suites silently skipped.
  Each is pinned by a test; the first two are pinned in the shared contract suites, so both
  engines stay honest. Details in `REWRITE_PLAN.md` r17;
- split `create-application.ts` into `createUseCases(dependencies)` and the Postgres wrapper
  `createApplication`, so adapter e2e tests build the same 34 use cases over the in-memory
  scope (`tests/fixtures/application.fixture.ts`) instead of needing a container;
- replaced the deleted `scripts/migrate.ts` step in `scripts/up.ts` with a Postgres reachability
  probe plus `bun run db:migrate` — `bun run up` refuses to start anything if the database is
  not answering, and says `bun run db:up`;
- rewrote the storage, environment, migration, backup and layout sections of `README.md`, and
  `.env.example`.

**Verified against real data, not only against tests.** The ETL was rehearsed from
`data/quiz.before-postgres-20260823-170412.sqlite` into a scratch database (`verification
passed`, every count matching `data/etl-baseline.json`), `bun run status` reported 9 published
sets / 306 questions / 38 attempts / 312 answers off it, and the real bot router then served
question 1/20 of a migrated quiz and recorded the answer (312 → 313 responses).

---

## 3. What is left before merging

Nothing functional. Open the PR from `wip/postgres-cutover` into `refactor/monorepo-split`.

Two housekeeping notes for whoever merges:

- the local `.env` now points `DATABASE_URL` at `…/recall_live`, which is the database the
  rehearsal wrote. Point it wherever the real data should live and re-run the ETL there;
- **keep the SQLite files.** `data/quiz.before-postgres-20260823-170412.sqlite` is the escape
  hatch and stays read-only, per the cutover section of the plan.

---

## 4. Phase 7 inherits three things

- **`bun:sqlite` is still in the tree**, for the MCP OAuth store only
  (`OAUTH_DATABASE_PATH`, default `./data/oauth.sqlite`). The store and the SDK provider above
  it are synchronous throughout. r16 wanted those tables moved during the cutover to unblock
  the Node switch; that was reversed, because Better Auth replaces the provider in phase 7
  anyway. So the **Bun → Node switch for `apps/api` moves to phase 7**.
- **Ownership is still absent by design.** `owner_id` arrives in phase 7. The legacy
  `telegram_user_id` is preserved on `attempts` and `review_states` — the domain requires it,
  and phase 7 needs it to map the Telegram account.
- **The v1 SQLite schema and migrator are still there** (`apps/api/drizzle/`,
  `adapters/persistence/sqlite/`), because the OAuth file uses them, and
  `tests/fixtures/legacy-sqlite.ts` uses them to build the ETL test's source. Both go when the
  OAuth store does.

---

## 5. Traps — all in `CLAUDE.md`, and one more from this session

The postgres.js encoder trap, the drizzle-kit `REFERENCES "public"."…"` trap, `expect(query)
.rejects` never settling, drizzle wrapping driver errors, and the unawaited write surviving a
rollback are all in `CLAUDE.md`. One to add from finishing the port:

- **A test that sets `process.env.DATABASE_URL` must restore it.** `tests/fixtures/postgres.ts`
  reads `TEST_DATABASE_URL ?? DATABASE_URL ?? default` to decide whether Postgres is reachable,
  so a test that points that variable at a per-run database and then drops the database leaves
  every later suite deciding Postgres is unreachable — and skipping, green.
