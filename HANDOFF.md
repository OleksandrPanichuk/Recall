# Handoff: pages and summaries (plan §7) are done; analytics is next

> Written 2026-08-26, updated 2026-08-29 when the summaries context landed.
>
> **Background reading, in order:** `CLAUDE.md` (rules, and the traps — every one was paid for),
> then `REWRITE_PLAN.md`, newest sections first: r25 (Node switch), r24 (oauth store + grant
> owner), r23 (per-credential MCP), r22 (ownership), r21 (identity). `ARCHITECTURE.md` describes
> v1 and is superseded for anything under `apps/`.

---

## 1. Where things are

| branch | state | what it is |
| --- | --- | --- |
| `main` | untouched, v1 | frozen until the rewrite lands. Do not target it. |
| `refactor/monorepo-split` | merged into the PR below | was PR #76. |
| `wip/postgres-cutover` | **green, 1337 + 24 tests** | everything below. PR #78 → `rewrite`. |

```bash
git checkout wip/postgres-cutover
bun install
bun run db:up            # Postgres 17 in Docker on 55432
bun run db:migrate       # seven migrations
bun run verify           # biome + tsc + 1337 tests + build, all green
```

`bun run verify` also passes with Docker down — the Postgres tests skip. `TEST_DATABASE_URL`
makes them mandatory instead.

---

## 2. What exists now

```
apps/api     NestJS on **Node**. The only thing that touches the database.
             /quizzes      public REST + Swagger at /docs
             /api/auth/*   Better Auth (sessions, telegram login link)
             /bot/*        internal RPC for the bot, behind BOT_API_TOKEN
             /api/*        the admin surface, behind ADMIN_PASSPHRASE
             /mcp          MCP tools, per credential
apps/bot     Telegraf. Every use case is an HTTP call through packages/contracts.
apps/mcp     stdio↔HTTP bridge to the api's /mcp.
apps/admin   react-admin SPA on Bun.serve.
packages/contracts  zod wire schemas + the typed client (ids are strings, dates ISO)
packages/kit        logger, shutdown, daily timer, pure helpers
```

**Identity.** One instance, one owner: whoever holds the Telegram account named by
`ALLOWED_TELEGRAM_USER_ID`. `/login` in the bot mints a single-use link; following it sets a
one-year, revocable session cookie. `owner_id` sits on seven tables and is bound into the
**repository scope** (`scopeFor(executor, owner)`), so no use case can name another owner's rows.
Email+password is deliberately **off** — enabling it opens public sign-up.

**Credentials that reach the API**

| credential | who it is | issued by |
| --- | --- | --- |
| `BOT_API_TOKEN` | the instance owner; the guard refuses any other `telegramUserId` | env |
| session cookie | the logged-in user | `/login` in the bot |
| `recall_pat_…` | its own owner | `/token` in the bot |
| `MCP_HTTP_TOKEN` | the instance owner | env |
| an OAuth grant | whoever approved consent (session), else the instance owner | `/authorize` |

**Running it.** `bun run api` runs the TypeScript for development; `bun run build` then
`bun run api:node` runs the compiled ESM under plain `node`, which is how it should be deployed.

---

## 3. How it was proven, and how to repeat it

Nothing here rests on tests alone.

```bash
# rebuild the library from the v1 backup, owned by a telegram account
docker exec recall-postgres psql -U recall -d postgres -c 'create database recall_owned'
cd apps/api && DATABASE_URL=…/recall_owned bun run db:migrate:pg
ALLOWED_TELEGRAM_USER_ID=<your id> bun run ./scripts/migrate-to-postgres.ts \
  ../../data/quiz.before-postgres-20260823-170412.sqlite …/recall_owned
# → "verification passed", 9 quizzes / 306 questions / 38 attempts / 312 responses,
#   every owned row under one user, fingerprints recomputed
```

- **the bot**, real Telegraf with only Telegram's transport stubbed: menu → browse →
  *"DDIA — Розділ 2 — питання 1/20"* → answer recorded, 38→39 attempts;
- **isolation**, same database served as a second Telegram account: `/quizzes` returned 9 for the
  owner and **0** for the other, and `/bot/*` refused the foreign account with 403;
- **MCP per credential**: the owner's personal token listed 9 sets, a second owner's token 0, a
  forged token 401, and revoking through the bot turned a working token into a 401;
- **the OAuth grant**: a public PKCE client registered, consented, exchanged, and the token
  listed the owner's 9 sets — and still did after a refresh, with the old refresh token revoked;
- **Node**: `node apps/api/dist/entrypoints/serve.js` served all of the above.

---

## 4. Phases 9 and 10 landed; analytics (plan §4) is next

`apps/web` exists: TanStack Start on Nitro, Tailwind v4, shadcn primitives, every call through a
server function that forwards the browser's cookie. It browses the library, practises every
question type, and reads and writes page summaries.

Plan §7 — the Notion-like pages — is done in the order the plan sequences it:

| step | where |
| --- | --- |
| markdown on a page, `icon` | `Folder` aggregate, `pages.content_md` / `pages.icon` |
| MCP authoring | `quiz_write_summary`, `quiz_append_summary`, `quiz_read_summary` |
| web reader | `PageView` / `PageSummary`, react-markdown + typography |
| editor | Milkdown Crepe, always on, autosaving: slash menu, drag handles, live blocks |
| quiz attachment | `quiz_attach_set` / `quiz_detach_set`, `BrowseView.attached` |
| search | GIN over `to_tsvector('simple', title ‖ content_md)`, `quiz_search_pages` |

What §7 describes and this does **not** have: `position` is a column but nothing reorders by it;
nested-page references are plain links, not `[[slug]]`; no `pgvector`. None of them block what
the brief asked for.

`apps/web` has every route the API can serve: library (with search), page, quiz,
practice, attempt review, `/review` for due repetitions and leeches, `/settings`, and a
not-found. Page mutations — create, rename, icon, delete, tree — go over `/app/*` and
`/bot/*` alike.

Plan §4's analytics landed too: `/insights` shows a year-long activity heatmap, a
fortnight's due forecast, and the questions that go wrong most, over an
`AnalyticsRepository` that does real SQL aggregates rather than in-memory loops.

**What is left** is §5's second auth phase (email+password, deliberately disabled
today), sharing, and FSRS. §4's read models are computed on demand, not materialized — see the
note below.

**Verified live, not only in tests** (2026-08-29): a scratch database, `drizzle-kit migrate` from
empty through 0006, the API on Node, and every new tool driven over real HTTP MCP — write, append,
read, search, attach, history — plus every `/bot/pages/*` route by curl.

The web app was then driven in a real Chrome (puppeteer-core against the installed browser,
installed for the session and removed again): editor mounts and autosaves — typed text survives a
reload; the slash menu opens, filters on Ukrainian, and inserts; block drag handles appear; title
rename, icon pick and sub-page creation all land and refresh the sidebar; a whole quiz is
practised, answered, finished, and read back through statistics and attempt detail; `/review`,
`/settings` and search work; at 390px the drawer opens, closes on navigation, and nothing
overflows sideways. No console errors and no failed requests in any pass.

---

## 5. Traps, beyond the ones in `CLAUDE.md`

- **Bun loads `.env` automatically, and the repo's `.env` sets `MCP_HTTP_ALLOWED_HOST`.** That
  turns on DNS-rebinding protection, so a manual `curl` to `127.0.0.1/mcp` fails with *"Invalid
  Host header"* — which looks exactly like a broken mount and is not. Tests pass
  `--env-file=/dev/null`; do the same by hand.
- **`psql -c "drop database …; create database …"`** sends both statements as one query and fails.
  Two `-c` flags, or two calls. It cost two false "migration is broken" diagnoses.
- **The ETL no longer applies the schema.** `bun run db:migrate` first; the script refuses a
  database with no tables. `APPLY_SCHEMA=1` used to write tables without recording them in
  drizzle's journal, so the next migration tried to create everything again.
- **An error the bot must distinguish needs two entries**, not one: `modules/shared/errors/
  error-map.ts` (or it becomes a flat 500 with no name) **and** `ApiErrorName` in
  `packages/contracts`. A field the next screen needs goes in `DETAIL_KEYS`.
- **Never regex a class body, and never run a scripted edit without asserting the match.** Both
  cost a revert; `assert s.count(old) == 1` before every replacement is the rule.
- **A dev database that predates the journal cannot be migrated.** The local `recall_live` has
  application tables but no `drizzle.__drizzle_migrations`, so `bun run db:migrate` fails with no
  useful message. That database was built before the journal existed; recreate it
  (`bun run db:reset`, then `db:migrate`, then the ETL) rather than trying to patch it. A scratch
  database is the safe way to smoke-test without touching it.
- **The analytics read models are queries, not tables.** §4 sketches
  `daily_activity` / `question_stats` as materialized read models refreshed on write. They are
  three grouped queries instead: at personal scale a `group by` over `responses` is milliseconds,
  and a table refreshed on write is a second thing to keep correct. If a query ever gets slow the
  port is already the seam — `AnalyticsRepository` can be backed by a table without any caller
  changing.
- **One flaky test seen once:** `apps/api/src/adapters/admin/api.test.ts` — "deletes one and
  answers with the record that went" failed a single full run and passed in isolation and on
  re-run. Nothing was changed for it. If it recurs, suspect cross-file env or port reuse.
