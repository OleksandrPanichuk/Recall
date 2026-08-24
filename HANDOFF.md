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

`bun run verify` also passes with Docker down: the 61 tests that need Postgres skip. Setting
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

**Verified against real data, not only against tests** — and re-verified independently
afterwards, because the first write-up quoted numbers that no longer matched any database on
disk. What is reproducible today, command by command:

```bash
docker exec recall-postgres psql -U recall -d recall \
  -c 'drop database if exists recall_proof with (force)' -c 'create database recall_proof'
cd apps/api && APPLY_SCHEMA=1 bun run ./scripts/migrate-to-postgres.ts \
  ../../data/quiz.before-postgres-20260823-170412.sqlite \
  postgres://recall:recall@127.0.0.1:55432/recall_proof
# → "verification passed: every mapped table and total agrees"

DATABASE_URL=postgres://recall:recall@127.0.0.1:55432/recall_proof bun run status
# → 9 published sets, 306 questions, 38 attempts done, 312 answers stored
```

Then a full practice cycle driven through the real use cases against that database — list
published quizzes, start an attempt, serve the current question, answer it, finish, read the
attempt back:

```
quiz: A1 Clothes Vocabulary (76 questions)
served 1/76 [typed_answer]: футболка      answered, correct=true
finished: score 1/76                       attempts for this quiz: 1 -> 2
review resolves what was chosen: true
```

and the database moved 38→39 attempts, 312→313 responses, 227→228 review states. So an attempt
started, an answer persisted, a repetition schedule advanced, and the attempt review resolved
what was chosen — the phase-1 fix holding on Postgres.

One honest limit: that cycle exercised the **application layer**, not Telegraf itself. Nothing
has driven a real Telegram update through the router against Postgres, and the earlier claim
that it had is not reproducible from any database on disk. `bun run dev` with a bot token is
still the one unproven step.

---

## 3. What is left before merging

Nothing functional. Open the PR from `wip/postgres-cutover` into `refactor/monorepo-split`.

**Two things actually still open, found while checking this handoff:**

- **PR #76 needs retargeting to `rewrite`.** #75 was squash-merged into `rewrite`, but
  `fix/stable-option-ids` was not deleted, so GitHub did not auto-retarget #76 — it still points
  at a merged branch, and merging it today would land in a dead end.
  `gh pr edit 76 --base rewrite`.
- **The PR for this branch is not open yet.** `gh pr create --base refactor/monorepo-split
  --head wip/postgres-cutover`. Both were attempted and failed on a network outage; the branch
  itself is pushed (`origin/wip/postgres-cutover` = `fa98331`).

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
