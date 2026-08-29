
Default to using Bun instead of Node.js.

## A rewrite is in progress — know which code you are touching

This branch (`rewrite`) is where the v2 platform is built. `main` is frozen at v1 and stays
that way until the rewrite lands. Every pull request targets `rewrite`, never `main`.

| | v1 | v2 |
| --- | --- | --- |
| Lives in | `apps/api/src/**` (as re-housed in phase 2) | `apps/*`, `packages/*` |
| Binding doc | `ARCHITECTURE.md` | **`REWRITE_PLAN.md`** |
| Runtime | Bun everywhere, `bun:sqlite` | Bun everywhere **except `apps/api`** (Node + NestJS) |
| Status | works, 1375 tests green — do not break it | under construction |

Where the two conflict **on this branch, `REWRITE_PLAN.md` wins**; `ARCHITECTURE.md` stays
binding for the layering *inside* `apps/api/src` for as long as it keeps its v1 shape
(`adapters/`, `composition/`, `entrypoints/`). Phase 2 moved that tree from `src/` to
`apps/api/src/` without changing anything inside it.

The dependency direction is now **enforced, not just documented**: `biome.json` carries
`noRestrictedImports` overrides that fail the build when `domain` imports outward or
`application` imports adapters. Run `bun run lint` to see them fire. `DEVELOPMENT_PLAN.md` has been deleted — its role is
taken by the Sequencing section of `REWRITE_PLAN.md`.

**If you are picking this up mid-rewrite, read `HANDOFF.md` first** — it says which branch to
work on, what is already done, and what is left. The Postgres cutover is in progress on
`wip/postgres-cutover`.

Before planning or implementation, read `AGENTS.md`, `DESCRIPTION.md`, `ARCHITECTURE.md`, `REWRITE_PLAN.md`, and `WORKFLOW.md`. Treat `ARCHITECTURE.md` as binding for dependency direction, pattern selection, and folder ownership in v1 code, and `REWRITE_PLAN.md` as binding for the same questions in v2 code. For planned implementation work, use the globally installed `run-reviewed-development` workflow when available: a fresh implementer handles one task, an independent read-only agent reviews it, findings return to the implementer, and every fix receives a scoped re-review before dependent work begins.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

These rules hold everywhere **except** the two v2 exemptions below.

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express` —
  with one exception, granted by the owner: `src/adapters/mcp/http/` runs on
  Express because the MCP SDK's OAuth endpoints (`mcpAuthRouter`,
  `requireBearerAuth`) are Express middleware, and hand-rolling an authorization
  server is not worth it. Do not "fix" that by removing Express.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres in v1 code. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

### v2 exemptions (owner-granted, `REWRITE_PLAN.md` §1)

Two apps are exempt because the owner chose frameworks that cannot honour the rules above.
Both exemptions are **scoped to their directory** — do not let them spread.

1. **`apps/api` — NestJS on Node, with the Express adapter.** It really is Node now:
   `bun run --filter '@recall/api' build` emits ESM to `apps/api/dist` (tsc, then `tsc-alias`
   to rewrite `@/…` and add the `.js` extensions Node's ESM loader demands), and
   `bun run api:node` starts it with plain `node`. `bun run api` still runs the TypeScript
   directly for development. Two consequences worth knowing: **nothing under
   `apps/api/src` may use a Bun global** — `Bun.hash` in the fingerprint became
   `node:crypto`, and the bootstrap moved out of `api.ts` into `entrypoints/serve.ts`
   because `import.meta.main` is a Bun-ism — and `packages/kit` / `packages/contracts`
   ship both: `exports` gives Bun `./src/index.ts` and Node `./dist/index.js`, so dev needs
   no build while Node gets real JavaScript. `better-auth` is ESM-only, which is why the
   build cannot be CommonJS.
   `@nestjs/platform-express`, not Fastify: the MCP SDK's OAuth pieces are Express
   middleware, Better Auth documents the Express handler, and Express is Nest's
   best-supported adapter. Persistence is drizzle-orm over a Postgres driver
   (`postgres`/`pg`), not `Bun.sql`, because this app runs on Node. Everything else here —
   `bun install`, `bun test`, `bun run` — stays Bun.
2. **`apps/web` — TanStack Start, which requires Vite** (plus Nitro for deployment, `bun`
   preset). This overrides the "Don't use `vite`" rule in the Frontend section below, for
   `apps/web` only.

`apps/bot`, `apps/mcp`, `apps/admin`, `packages/*`, `scripts/`, and all of `src/` stay on
plain Bun with no exemption.

**`apps/bot`, `apps/mcp` and `apps/admin` are clients of the API, not of the database.**
`apps/bot` holds the Telegraf router, its handlers and its presenters, and reaches every use
case over HTTP through `createBotClient` from `packages/contracts`. The `TelegramUseCases`
interface it renders against is now the client's, so a handler cannot accidentally reach a
repository. `packages/contracts` owns the wire shapes (zod, ids as plain strings, timestamps as
ISO strings) and `packages/kit` the shared runtime bits (logger, shutdown, daily timer, pure
utils). The API's `/bot/*` surface is guarded by `BOT_API_TOKEN` and excluded from Swagger — it
is an internal RPC surface, not public REST.

**Identity: the api is the only issuer, and no caller ever names a user.** Better Auth lives in
`apps/api` at `/api/auth/*`, mounted on the raw Express instance **before** the body parser —
`NestFactory.create` is therefore given `bodyParser: false` and `json()`/`urlencoded()` are
mounted by hand afterwards. Better Auth reads the raw request body itself, and a parser that has
already consumed the stream leaves it hanging.

Login links are minted **only** from `/bot/auth/login-link`, behind the bot token. Do not move
that into a Better Auth endpoint: `SERVER_ONLY` merely hides an endpoint from the generated
client, so a route that turns a Telegram id into a session would be reachable by anyone. The
plugin's job is only to *spend* a token it did not mint. Email+password stays disabled until the
plan's second auth phase — enabling it opens `POST /sign-up/email` to the world.

**Ownership lives in the repository scope, not in the use cases.** Seven tables carry
`owner_id` (`pages`, `quizzes`, `questions`, `attempts`, `term_pairs`, `review_states`,
`study_settings`); their children are reached only through an owned parent. `scopeFor(executor,
owner)` builds every repository against one owner, so a use case cannot name another owner's
rows — it never holds anything that could. **Never add a repository method that takes an owner
as an argument**; that would put the decision back in the caller. The in-memory double gives each
owner its own store, which is the same isolation expressed as a partition. `tests/contracts/
ownership.contract.ts` runs against both engines and is the proof.

Every unique constraint that used to be instance-wide is now per owner — a legacy id, a page
slug, an instance-wide settings row. Two people may import the same v1 export.

**`apps/web` never holds a credential, and never talks to the database.** Every call goes
through a TanStack Start **server function**, which forwards the browser's cookie to the API and
returns the answer — so the browser talks to one origin, there is no CORS, and the API stays the
only issuer of identity. `viewerOf()` asks the API `/api/auth/get-session` rather than decoding
the cookie: it is signed with a secret this app does not have and should not.

**Two surfaces, one contract.** `/bot/*` (bot token) and `/app/*` (session cookie) serve the same
practice routes from the same schemas and the same wire mappers; only who the API believes the
caller to be differs. `createBotClient` and `createAppClient` are the same implementation with
different headers — and `createAppClient` returns `PracticeUseCases`, which has **no** way to
mint a login link or a token. Adding a practice route means adding it to both controllers.

**No practice command carries an identity.** `getCurrentQuestion`, `answerQuestion`,
`finishQuizAttempt`, `listDueRepetitions`, `listLeeches`, `getQuizStatistics` and
`getAttemptDetail` take no user at all — the repository scope already knows the owner, and
`findActive()` / `listDue(at)` are owner-scoped by construction. **Never add a `telegramUserId`
to a practice command or a repository method**; a parameter there is a caller naming a user
again, and it is what made a web client impossible. `telegramUserId` survives in exactly three
places: as **provenance** on `attempts.telegram_user_id` and `review_states.telegram_user_id`
(optional, written when a Telegram client starts the attempt), on the **auth** routes where the
account itself is the subject (`/bot/auth/*`), and as the reminder's `chatId` — which is where to
send a message, not who is asking.

**The api decides who the caller is; the caller never says.** `BotTokenGuard` refuses any body
naming a `telegramUserId` other than `ALLOWED_TELEGRAM_USER_ID`, so holding the bot token does not
let anyone read another account's data. The owner itself is resolved from the linked Telegram
account (`instanceOwnerResolver`), cached, and reached lazily through `lazyScope` — which is what
lets the http surfaces be built at boot, before anyone has linked. `ensureTelegramOwner` /
`findTelegramOwner` in `persistence/postgres/owner.ts` are the *only* place that maps a Telegram
id to an owner; the ETL and the login flow both go through them, so an import cannot land under a
different user than the one the bot will hand the platform to.

**There is no SQLite left in the api's runtime.** The OAuth store lives in Postgres
(`persistence/postgres/oauth.store.ts`) and its interface is **async** — it was synchronous only
because it was a local file, and that is what used to pin this app to `bun:sqlite`. The one
remaining `bun:sqlite` import is the ETL reading a v1 backup, which is a Bun script and not part
of the server. `OAUTH_DATABASE_PATH` is gone.

**An OAuth grant carries its owner from consent to every token minted off it** — including across
refresh rotation, which is where this silently degrades into an unscoped token. `approve(id,
ownerId)` binds the code; `issue(clientId, scopes, ownerId)` stamps both halves of the pair. A
logged-in browser approving the consent screen binds that user; with no session it is the
instance owner, because knowing the passphrase is what proves that on a single-owner install.

**MCP is per credential, not per instance.** `createMcpHttpApp` takes `applicationFor(owner)`
and builds the tools for whoever the bearer token belongs to, so two people with two tokens see
two libraries. Verification returns a **principal**, never a boolean: a personal token
(`recall_pat_…`, sha256-hashed at rest, issued by the bot via `/bot/auth/tokens/*`) names its own
owner; the static `MCP_HTTP_TOKEN` and an OAuth grant resolve to the instance owner, because the
consent gate is a passphrase and whoever knows it *is* that owner. The MCP SDK **refuses an auth
assertion with no expiry**, so a non-expiring personal token still gets a bounded assertion.

**A refusal travels as a name, not a class.** The API answers a domain error with
`{ error: "<ErrorName>", details }`, and the bot maps that name to user text
(`ApiErrorName` / `isApiError` in `packages/contracts`). Only a whitelist of detail keys
(`mode`, `folderId`, `quizSetId`, `questionId`, `attemptId`) crosses the wire, so an error can
never leak a field nobody vetted. Adding an error the bot must distinguish means adding it to
`error-map.ts` **and** `ApiErrorName` — an error missing from the map becomes a flat 500.

**`apps/mcp` and `apps/admin` are clients of the API, not of the database.** `apps/mcp` is a
stdio↔HTTP bridge: it forwards JSON-RPC to the API's `/mcp` and holds no application code. The
MCP tools themselves live in `apps/api` and are mounted on the underlying Express instance from
`createApiApp` — **not** through Nest middleware, which gives the sub-app a path that Express
then strips, so `/mcp` never matches and every request 404s. `/mcp` exists only when
`MCP_HTTP_TOKEN` is set.

**Postgres.** `bun run db:up` starts Postgres 17 in Docker on
port 55432; `db:down` stops it, `db:reset` wipes the volume. Tests that need it discover it via
`TEST_DATABASE_URL` (falling back to the Docker default) and **skip** when it is unreachable,
so `bun run verify` passes without Docker. Setting `TEST_DATABASE_URL` makes them mandatory
instead: if it is set and Postgres is missing, the suite fails rather than skipping.

**Cast every postgres.js placeholder, and never pass a `Date`.** postgres.js picks parameter
encoders from the first execution of a query string and reuses them, so an insert whose first
row has `null` where a later row has a value binds that later row against the wrong types. It
surfaces as a foreign key violation on a parent that exists, or as `TypeError: … Received an
instance of Date` from inside postgres.js. Write `${x}::uuid`, `::text`, `::timestamptz`, and
pass timestamps as ISO strings. The failure is order-dependent, so it hides in small fixtures.

**Postgres tests get a database per run, not a schema.** drizzle-kit writes
`REFERENCES "public"."…"` into every foreign key, so tables created in a custom schema end up
with constraints pointing at an empty `public` — parents insert, children fail on a confusing
FK violation. `tests/fixtures/postgres.ts` creates and drops a database per run.

**`expect(query).rejects` does not work on postgres.js queries.** They are lazy thenables and
the assertion never settles, so the test hangs to timeout instead of failing. Force execution
through `catch` — see `failureOf` in `tests/integration/postgres/schema-constraints.test.ts`.

**A test that sets `process.env.DATABASE_URL` must restore it.** `tests/fixtures/postgres.ts`
reads `TEST_DATABASE_URL ?? DATABASE_URL ?? default` to decide whether Postgres is reachable, so
a test that points it at a per-run database and then drops that database leaves every later
suite deciding Postgres is unreachable — and skipping, green.

**Never leave a promise unawaited inside a transaction.** Measured, not theoretical: on
Postgres an unawaited write inside a `db.transaction(...)` callback survives when that
transaction rolls back — 8/8 runs. It commits on its own connection while the boundary is
discarded. `apps/api/tests/integration/postgres/transaction-semantics.test.ts` pins this.
Repositories are reached through the `UnitOfWork` scope so the mistake is hard to express;
there is no lint rule covering it (Biome's `noFloatingPromises` is inert here).

One hard rule that outranks convenience: **only `apps/api` talks to the database.**
`apps/web` has a server (TanStack Start server functions) and must still reach data over
HTTP — it must not depend on drizzle or a Postgres driver at all.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Applies to `apps/admin` and any v1 UI. `apps/web` is exempt — see the v2 exemptions above.

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Naming

Beyond the conventions in `ARCHITECTURE.md`:

- Application use cases carry their role in the **class** name: `AnswerQuestionUseCase`, not
  `AnswerQuestion`. The class name is its NestJS injection token, so it is read out of
  context and has to be distinguishable from `AnswerQuestionCommand` and
  `AnswerQuestionController` at a glance.
- **Every NestJS injection point uses an explicit `@Inject(Token)`.** Never rely on
  constructor parameter types for DI: `emitDecoratorMetadata` is deliberately **off**, because
  with it on, Biome's `useImportType` autofix rewrites a class import to `import type`, erases
  the metadata, and DI breaks at runtime with the imports still looking correct. With it off,
  a missing `@Inject` fails loudly at startup instead. `experimentalDecorators` is on — Nest
  needs legacy decorators, and Bun defaults to the TC39 ones.
- **File** names do not repeat it: `use-cases/attempts/answer-question.ts`, not
  `answer-question.use-case.ts`. The directory already says `use-cases`, and a path that
  stutters is worse than one that does not. This is the opposite of `*.handler.ts` /
  `*.presenter.ts` / `*.tool.ts`, which sit in directories that do **not** name their role.

## `apps/web`

Tailwind v4 (through `@tailwindcss/vite`, no config file — the theme is CSS variables in
`src/styles/app.css`) and shadcn/ui components copied into `src/components/ui`.

- **Component files are PascalCase and named for the component**: `QuestionCard.tsx`,
  `ui/Button.tsx`. This is the opposite of the api's `answer-question.ts`, and deliberate — it is
  the convention every shadcn snippet and React codebase assumes, and the file *is* the component.
  Everything that is not a component keeps kebab-case: `lib/practice.ts`, `lib/session.ts`.
- **A route file holds routing and data, not markup.** `createFileRoute`, its loader, and a thin
  component that composes named components from `src/components`. If a route grows a second
  screenful of JSX, that JSX is a component.
- **`@/` means `apps/web/src`**, as shadcn expects. The root tsconfig maps `@/` to the api's
  source, so `apps/web` is excluded there and typechecked as its own project — `bun run typecheck`
  runs both.
- **Every question type has its own answering component** (`ChoiceOptions`, `TypedAnswerField`,
  `OrderingOptions`, `MatchingOptions`), chosen by `QuestionCard`. Rendering `question.options` as
  buttons for every type leaves typed and cloze questions unanswerable — they have no options at
  all — and grades a multiple-choice question on the first click.

- **The page editor is Milkdown's Crepe**, and it is *uncontrolled on purpose*. Markdown is the
  document model — the same `content_md` an AI writes over MCP — so there is no lossy block-JSON
  round-trip, but it also means the editor owns the document once it is created. It takes the
  markdown through a ref captured at first render and is read back with `getMarkdown()` on save;
  never pass the prop into the effect's dependencies, or every keystroke in the parent rebuilds
  the editor. Readiness is **state**, not a ref: a ref set from `onReady` does not re-render, so
  the Save button stays disabled forever. Crepe is loaded through `lazy()` inside `ClientOnly`,
  which keeps 1.3 MB of ProseMirror out of the page route and off the server.
- **Theme Crepe with our tokens, not its shipped themes.** A theme is only a block of
  `--crepe-*` variables on `.milkdown`; `styles/app.css` maps them to the shadcn tokens, so light
  and dark follow the app. Importing `theme/frame.css` *and* `frame-dark.css` would fight over
  the same variables.

**Only one test file per `bun test` process may register happy-dom.** `GlobalRegistrator`
replaces `globalThis` wholesale; a second file registering, or the first unregistering while
another still needs the DOM, breaks whichever file loses. `apps/admin` owns that registration in
the root run, so `apps/web`'s component tests run in their own process — `bun run test` is the
root suite **and** `bun run --filter '@recall/web' test`. Never call plain `bun test` as the gate;
it silently skips the web app.

Inside `apps/web` the registration is a preload (`tests/register-dom.ts`, via `bunfig.toml`), so
every file in `tests/dom/` shares one DOM. `tests/server/` proves the opposite — that the editor
renders server-side with no DOM at all — and runs in a second process with `RECALL_NO_DOM=1`,
which is the only thing that turns the preload off. `bun --config` does **not** override it; the
flag was the only mechanism that worked.

## Code comments

Do not write code comments. Not header comments, not JSDoc, not a one-line note
above a tricky branch, not a "why this and not that" explanation. In 90%+ of
cases they are useless: they restate what the code already says, and they rot.

When something needs explaining, put it in the commit message or the pull
request description, where it is dated and reviewable.

The only exceptions are machine-readable directives (`biome-ignore`,
`@ts-expect-error`) and licence headers, which are not prose.
