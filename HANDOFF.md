# Handoff: the monorepo is split into apps; phase 7 (identity) is next

> Written 2026-08-25, replacing the handoff that announced the Postgres cutover.
>
> **Background reading, in order:** `CLAUDE.md` (rules, and the traps section — every one of
> those was paid for), then `REWRITE_PLAN.md` — §"Splitting the apps out (r19)" and §"The bot as
> a client, not a co-tenant (r20)" for what just landed. `ARCHITECTURE.md` describes v1 and is
> superseded for anything under `apps/`.

---

## 1. Where things are

| branch | state | what it is |
| --- | --- | --- |
| `main` | untouched, v1 | frozen until the rewrite lands. Do not target it. |
| `refactor/monorepo-split` | green | PR #76, retarget to `rewrite` before merging. |
| `wip/postgres-cutover` | **green, 1254 tests** | the cutover **and** the app split. Opens into `refactor/monorepo-split`. |

```bash
git checkout wip/postgres-cutover
bun install
bun run db:up          # Postgres 17 in Docker on port 55432
bun run db:migrate
bun run verify         # biome + tsc + 1254 tests + four builds, all green
```

`bun run verify` also passes with Docker down: the tests that need Postgres skip. Setting
`TEST_DATABASE_URL` makes them mandatory instead.

The count moved 1263 → 1254 across the split: `loadHttpEnvironment` and `loadEnvironment` lost
their last callers and went, with their tests. Coverage went **up** — the 175 bot tests now run
through real HTTP, real zod validation and the real error filter.

---

## 2. What the apps are now

```
apps/api     NestJS. The only thing that talks to the database.
             /quizzes  public REST + Swagger at /docs
             /bot/*    internal RPC for the bot, guarded by BOT_API_TOKEN, not in Swagger
             /api/*    the admin surface, guarded by ADMIN_PASSPHRASE
             /mcp      the MCP surface, exists only when MCP_HTTP_TOKEN is set
apps/bot     Telegraf router. Reaches every use case through createBotClient over HTTP.
apps/mcp     stdio↔HTTP bridge. Forwards JSON-RPC to the api's /mcp.
apps/admin   react-admin SPA on Bun.serve.
packages/contracts  zod wire schemas + the typed client. ids are strings, dates are ISO.
packages/kit        logger, shutdown, daily timer, pure text/shuffle/timezone helpers.
```

`bun run up` supervises three processes — api, bot, admin. MCP is no longer a process; it is
the api. A service is skipped when its token is absent, and says which one.

Three mounting facts, each of which cost a debugging session:

- **Nest middleware gets a path, and Express strips it from a mounted sub-app.** The MCP Express
  app is therefore mounted path-lessly on the underlying instance from `createApiApp`. Mount it
  through `consumer.apply(...)` and `/mcp` 404s on every request, token or not.
- **Behind a wildcard mount, `request.path` is always `/`.** The admin bridge
  (`modules/integration/admin/fetch-routes.ts`) matches on `originalUrl` for that reason.
- **Copying a Fetch response's headers onto an Express response duplicates `content-length`.**
  The bridge skips framing headers; happy-dom rejects the response otherwise.

---

## 3. How the split is proven

Not by tests alone. Against the post-cutover `recall_live` database, with only Telegram's
outbound transport stubbed — the real Telegraf router, the real client, the real controller:

```
/start   → Головне меню.  (7 buttons)
browse   → Оберіть набір:  📘 DDIA — Розділ 2 …
tap quiz → DDIA — Розділ 2: Data Models and Query Languages — питання 1/20  (4 options)
answer   → ❌ Неправильно / Правильна відповідь: Edgar Codd, 1970
```

and the database moved 38→39 attempts, 312→313 responses. Reproduce it by starting the api with
`DATABASE_URL=…/recall_live` and `BOT_API_TOKEN=…`, then driving `createBot` with
`createBotClient` pointed at it (the harness in `apps/bot/tests/bot-harness.ts` does exactly this
against in-memory repositories; swap the dependencies for a Postgres connection to repeat it).

MCP was proven the same way: `tools/list` returns 19 tools through the api, and
`quiz_create_set` → `quiz_list_sets` round-trips through Postgres. `apps/mcp/tests/stdio.test.ts`
spawns the api **and** the bridge as real processes and does it over stdio.

---

## 4. What is left before merging

Nothing functional. Two things still open from the previous handoff:

- **PR #76 needs retargeting to `rewrite`** — `gh pr edit 76 --base rewrite`. It still points at
  the merged-and-undeleted `fix/stable-option-ids`.
- **The PR for this branch is not open yet** —
  `gh pr create --base refactor/monorepo-split --head wip/postgres-cutover`.

Housekeeping: the local `.env` points `DATABASE_URL` at `…/recall_live`, the rehearsal database,
and now also needs `BOT_API_TOKEN` for the bot to start. **Keep the SQLite files** —
`data/quiz.before-postgres-20260823-170412.sqlite` is the escape hatch and stays read-only.

---

## 5. Phase 7 inherits four things

- **`bun:sqlite` is still in the tree**, for the MCP OAuth store only (`OAUTH_DATABASE_PATH`,
  default `./data/oauth.sqlite`). The store and the SDK provider above it are synchronous
  throughout, so the **Bun → Node switch for `apps/api` waits for Better Auth to replace it.**
- **Ownership is still absent by design.** `owner_id` arrives in phase 7. `telegram_user_id`
  is preserved on `attempts` and `review_states` — the domain needs it, and phase 7 needs it to
  map the Telegram account to a user.
- **`/bot/*` trusts a shared token, not a user.** Every command carries `telegramUserId` in its
  body and the api believes it. That is exactly right for a single-owner install and exactly
  wrong for multi-user: phase 7 must move identity into the credential and stop trusting the
  body. The guard to change is `modules/bot/bot-token.guard.ts`.
- **`apps/web` does not exist yet.** When it arrives it consumes `packages/contracts` the way
  the bot does; the wire shapes are already there for the practice flow.

---

## 6. Traps, beyond the ones in `CLAUDE.md`

- **Bun loads `.env` automatically, and the repo's `.env` sets `MCP_HTTP_ALLOWED_HOST`.** That
  turns on DNS-rebinding protection, so a manual `curl` to `127.0.0.1/mcp` is refused with
  *"Invalid Host header"* — which looks exactly like a broken mount and is not. Tests pass
  `--env-file=/dev/null` for this reason; do the same when reproducing by hand.
- **An error the bot must distinguish needs two entries, not one:** `modules/shared/errors/
  error-map.ts` (or it becomes a flat 500 with no name) **and** `ApiErrorName` in
  `packages/contracts`. If the next screen needs a field off the error, add its key to
  `DETAIL_KEYS` — nothing else crosses the wire.
- **Never regex a class body, and never run a scripted edit without asserting the match.** Both
  cost a revert this month; `assert s.count(old) == 1` before every replacement is the rule.
