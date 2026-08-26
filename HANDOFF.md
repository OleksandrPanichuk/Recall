# Handoff: phase 7 is done; the web app (phase 9) is next

> Written 2026-08-26, replacing the handoff that announced the app split.
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
| `refactor/monorepo-split` | green | PR #76 → `rewrite`. |
| `wip/postgres-cutover` | **green, 1295 tests** | everything below. PR #77 → `refactor/monorepo-split`. |

```bash
git checkout wip/postgres-cutover
bun install
bun run db:up            # Postgres 17 in Docker on 55432
bun run db:migrate       # five migrations
bun run verify           # biome + tsc + 1295 tests + build, all green
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

## 4. Phase 9 — the web app — is next

`apps/web` does not exist. What is already in place for it:

- **the wire shapes**: `packages/contracts` covers the whole practice flow (browse, start, current
  question, answer, finish, statistics, attempt detail, settings, repetitions);
- **identity**: `/api/auth/*` issues the cookie, and `better-auth/client` is the documented way to
  consume it. `WEB_APP_URL` is where a login link lands;
- **the decision already taken**: the API is the only issuer. `apps/web` forwards cookies; it must
  not host its own Better Auth, and it must not touch the database (§5, and the hard rule in
  `CLAUDE.md`).

The plan's §4 wants advanced statistics; the analytics *views* are phase 11, so the MVP is auth,
browse, practice and attempt review.

**One thing to decide before writing code:** the practice flow currently keys attempts by
`telegramUserId`, which a web-only user does not have. Either the web app resolves a synthetic id
from the session, or `attempts.telegram_user_id` becomes nullable next to `owner_id` and the use
cases key on the owner. The second is the honest fix and it touches the attempt aggregate.

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
- **One flaky test seen once:** `apps/api/src/adapters/admin/api.test.ts` — "deletes one and
  answers with the record that went" failed a single full run and passed in isolation and on
  re-run. Nothing was changed for it. If it recurs, suspect cross-file env or port reuse.
