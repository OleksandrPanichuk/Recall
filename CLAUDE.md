
Default to using Bun instead of Node.js.

## The rewrite landed — know which code you are touching

**`main` is the trunk.** v2 shipped on it in #85; the `rewrite` branch is gone. Branch off
`main`, and open pull requests against `main`.

The v1 and v2 shapes still coexist *inside* `apps/api/src`, so the distinction below is
about code, not branches:

| | v1 shape | v2 shape |
| --- | --- | --- |
| Lives in | `apps/api/src/{adapters,composition,entrypoints}` | `apps/*`, `packages/*`, and `apps/api/src/{modules,persistence}` |
| Binding doc | `ARCHITECTURE.md` | **`REWRITE_PLAN.md`** |
| Runtime | Bun | Bun everywhere **except `apps/api`** (Node + NestJS) |

Where the two conflict, `REWRITE_PLAN.md` wins; `ARCHITECTURE.md` stays binding for the
layering inside the three directories that still keep their v1 shape. Phase 2 moved that
tree from `src/` to `apps/api/src/` without changing anything inside it.

The dependency direction is **enforced, not just documented**: `biome.json` carries
`noRestrictedImports` overrides that fail the build when `domain` imports outward or
`application` imports adapters. Run `bun run lint` to see them fire. `DEVELOPMENT_PLAN.md`
has been deleted — its role is taken by the Sequencing section of `REWRITE_PLAN.md`.

`HANDOFF.md` is a record of how the rewrite was carried out, not current instructions. Read
it for context on why something is the way it is; do not follow its branch table.

Before planning or implementation, read `AGENTS.md`, `DESCRIPTION.md`, `ARCHITECTURE.md`, `REWRITE_PLAN.md`, and `WORKFLOW.md`. Treat `ARCHITECTURE.md` as binding for dependency direction, pattern selection, and folder ownership in the v1-shaped directories, and `REWRITE_PLAN.md` as binding for the same questions everywhere else. For planned implementation work, use the globally installed `run-reviewed-development` workflow when available: a fresh implementer handles one task, an independent read-only agent reviews it, findings return to the implementer, and every fix receives a scoped re-review before dependent work begins.

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

**Registration is open** (`emailAndPassword.enabled`), so `POST /api/auth/sign-up/email` is
reachable by anyone — that is now a product decision, not an oversight. What holds the line is
the rate limit (`AUTH_RATE_LIMIT`, `SIGN_UPS_PER_HOUR`) and the fact that ownership is resolved
from the session, so a new account starts empty and can never name another owner's rows.

**Password reset goes out over SMTP through nodemailer**, configured by `SMTP_URL` and
`MAIL_FROM`. With no `SMTP_URL` the mailer only *logs* the letter — the flow still works locally,
the link is in the api log, and nothing silently pretends to have sent. `bun run db:up` starts
Mailpit next to Postgres (SMTP on 55025, a mailbox to read at http://127.0.0.1:55026) so the real
path can be exercised without a provider. **Email verification stays off** by decision: reset
mail goes to the real mailbox either way, so an unverified address cannot be used to take over
someone else's account — the costs are typo'd addresses and squatted ones.

**The endpoint is `/request-password-reset`, not `/forget-password`.** Better Auth 1.7 keeps the
old name as an alias that is not mounted; calling it gives a 404 that looks like a routing bug.

Login links are minted **only** from `/bot/auth/login-link`, behind the bot token. Do not move
that into a Better Auth endpoint: `SERVER_ONLY` merely hides an endpoint from the generated
client, so a route that turns a Telegram id into a session would be reachable by anyone. The
plugin's job is only to *spend* a token it did not mint. It remains the only way a Telegram id
becomes a session, and it is unaffected by open registration.

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

**Two schedulers, one seam.** `study_settings.scheduler` is `ladder` or `fsrs`, and
`scheduleAfter` dispatches on it; the ladder stays the default. FSRS is `ts-fsrs` rather than a
hand-rolled memory model, configured with `enable_short_term: false` so every interval is a whole
day and `enable_fuzz: false` so the same history always schedules the same day. The app knows only
right and wrong, so the four FSRS grades collapse to **Again / Good** — adding Hard and Easy means
a richer answer model first, not a scheduler change.

Three behaviours differ between them, and all three are pinned by tests. **`maxRepetitions` retires
a question under the ladder only** — FSRS keeps scheduling, bounded by `maxIntervalDays`. **A first
wrong answer is a lapse under the ladder but not under FSRS**, which counts a lapse only when
something already learned is forgotten; that makes the leech list stricter under FSRS. And FSRS
writes `review_states.stability` / `difficulty`, which the ladder leaves null — a schedule the
ladder wrote is picked up by FSRS as a fresh card, which is the honest reading of no memory state.

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

### The shape of the tree

```text
src/
  features/<feature>/          pages · practice · statistics · review · settings
    ui/views/                  one per screen: QuizStatisticsView, PracticeView
    ui/components/             the parts a view composes
    hooks/                     use-autosave, use-practice-session
    lib/                       server functions (*.api.ts), pure helpers, types
    constants/                 feature-wide constants
  shared/
    ui/components/             AppShell, PageHeading, SignInPrompt, NotFound, ErrorPanel
    lib/                       api, session, request, viewer, utils
  components/ui/               shadcn primitives — where `components.json` points
  routes/                      file routing only
```

- **A route file holds routing and data, nothing else.** `createFileRoute`, its loader, and a
  component that returns one view with props taken off the Route: `return <QuizStatisticsView
  quizId={quizId} statistics={…} />`. Markup, state and branching live in the view. A route that
  grew a `useState` is a view waiting to be extracted.
- **A view belongs to exactly one feature** and is named for the screen, ending in `View`. It may
  import components from another feature — the quiz screen shows `SettingsEditor` — but never
  another feature's view.
- **`shared/` never imports a feature.** It is the bottom of the graph. `AppShell` takes the page
  tree as a rendered node rather than importing `PageTree`, which is what keeps that true.
- **A component file contains `interface Props` and the component. Nothing else.** No second
  type, no constant, no helper, no sub-component. The props type is always called `Props` — it
  is never read outside its own file, so a longer name buys nothing.
- **A component that needs anything beside it becomes a folder.** One loose `Button.tsx` stays
  a file; the moment it grows a constant or a helper it becomes:

  ```text
  ComponentName/
    index.ts                    export { ComponentName } from "./ComponentName"
    ComponentName.tsx
    ComponentName.constants.ts
    ComponentName.lib.ts        pure helpers
    ComponentName.types.ts
  ```

  Everyone imports the folder, never `ComponentName/ComponentName` — `index.ts` is the only
  entrance. A sub-component used by nothing else lives in the folder too (`PageTree/PageRow.tsx`).
- **A sidecar that production code outside the folder imports is not component-private.** It
  belongs in the feature's `constants/` or `lib/`, or in `shared/lib/` if more than one feature
  wants it — `MIN_PASSWORD_LENGTH` and the `SaveState` type both got there that way. Tests
  reaching in for pure logic (`PageTree/PageTree.projection`) are fine and expected.
- **Component files are PascalCase and named for the component**: `QuestionCard.tsx`,
  `ui/Button.tsx`. This is the opposite of the api's `answer-question.ts`, and deliberate — it is
  the convention every shadcn snippet and React codebase assumes, and the file *is* the component.
  Everything that is not a component keeps kebab-case: `lib/pages.api.ts`, `hooks/use-autosave.ts`.
- **Hooks live in the feature's `hooks/`**, one per file, named for the hook. Not in `lib/` —
  `lib/` is for things that do not touch React.
- **Server functions live in `<feature>/lib/<feature>.api.ts`**, so the thing that fetches sits
  with the screens that need it. `shared/lib/api.ts` builds the client, `shared/lib/request.ts`
  holds `missingAsNull` and `idInput`, and only `shared/lib/viewer.ts` knows about the session.
- **`@/` means `apps/web/src`**, as shadcn expects. The root tsconfig maps `@/` to the api's
  source, so `apps/web` is excluded there and typechecked as its own project — `bun run typecheck`
  runs both.
- **shadcn primitives stay in `src/components/ui`** because `components.json` points there, so
  `shadcn add` keeps working. They are the only components outside `features/` and `shared/`.
- **Every question type has its own answering component** (`ChoiceOptions`, `TypedAnswerField`,
  `OrderingOptions`, `MatchingOptions`), chosen by `QuestionCard`. Rendering `question.options` as
  buttons for every type leaves typed and cloze questions unanswerable — they have no options at
  all — and grades a multiple-choice question on the first click.

- **Page order is the owner's, not the alphabet's.** `pages.position` is fractional
  (`numeric(20,10)`), so inserting between two siblings is one row written, not a renumbering
  of the parent. Listings order by `(position, title, id)` — the title is only a tiebreak for
  rows that share a position, which is what every page imported before ordering existed does.
  Halving a gap runs out after about thirty insertions between the same pair; `canSitBetween`
  says so and `ReorderFolderUseCase` renumbers that parent instead of rounding two pages onto
  the same position. Never place a page by writing a position from the caller — pass the two
  siblings it should land between and let the use case pick, or the exhaustion check is bypassed.
- **The page tree drags with `@dnd-kit`, and it renders flat.** A tree that reparents needs a
  single sortable list, so `PageTree` renders every visible page as one `<li>` indented by
  `depth` — there is no recursive branch component, and the open/closed state has to live in
  the tree, not in each row, because the flattened list depends on it. Three things it is easy
  to get wrong, each paid for once:
  - **dnd-kit's `over` means "take that row's place", not "go after it".** Projecting from
    `overIndex + 1` makes dragging *upwards* a no-op — the projection lands exactly where the
    page already was. `arrayMove` first, then read the neighbours at `overIndex`, as dnd-kit's
    own tree example does.
  - **Give `DndContext` an explicit `id`.** Without one it numbers its `aria-describedby`
    targets from a counter that differs between the server render and the client, and every
    page load logs a hydration mismatch.
  - **Expand a parent when something is dropped into it**, or the page silently disappears —
    it is under a collapsed parent, and it looks exactly like data loss.

  Keyboard dragging is the reason for the library: the handle is focusable, space picks a page
  up, arrows move it. The announcements must name the page, not its uuid.
- **Images live in MinIO, and the markdown stores a relative path.** `/app/uploads/<id>`, never
  an absolute URL — an origin baked into a summary rots the moment the app moves, which is the
  same bug as the `blob:` URL this replaced. Crepe's `proxyDomURL` and react-markdown's
  `urlTransform` resolve it against the API for display. The upload is the one place the browser
  talks to the API directly rather than through a server function: an `<img>` needs a real GET,
  so `WEB_APP_URL` is a CORS origin with credentials. Objects are keyed `<owner>/<id>` and the
  `attachments` row is owner-scoped, so serving checks ownership before it streams.
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

**Telegram delivery is polling locally and a webhook in production, chosen by config.**
`TELEGRAM_WEBHOOK_URL` plus `TELEGRAM_WEBHOOK_SECRET` turns the webhook on; with neither the
bot long-polls, which is what a laptop wants and what every test assumes. A url without a
secret is refused at startup rather than left open — the secret is the *only* thing standing
between that route and anyone who guesses the path.

Two properties the handler must keep. It **marks an `update_id` seen before it awaits the
handler**, not after: Telegram retries an update whose response is slow, and marking
afterwards means the retry arrives while the first is still running and the update is taken
twice. And it **answers 200 even when the handler throws**, because a non-200 is a request to
redeliver — an error that will fail again forever becomes an infinite retry loop. The error
goes to the log, not to Telegram. `apps/bot/tests/webhook.test.ts` pins both, including three
concurrent retries of one update being handled exactly once.

Do not delete the webhook on shutdown; that drops updates for the length of a deploy.

**Never assert that a shuffle came out different.** `shuffled(items, seed)` is a seeded
Fisher-Yates, so it is deterministic — but an attempt seeds it with its own id, which is a
fresh uuid every run, and identity is a legitimate outcome (1 in 5040 for seven questions).
`expect(planned).not.toEqual(authored)` is a test that fails on a schedule nobody can
reproduce. Assert the exact permutation instead: `expect(planned).toEqual(shuffled(before,
String(attemptId)))`, taking `before` from a run with the toggle off when the pre-shuffle
order is not the authored one. The property that shuffling reorders at all belongs in
`packages/kit/src/utils/shuffle.test.ts`, where the seeds are fixed.

**`bun run verify` builds before it typechecks, and the order is load-bearing.**
`apps/web/src/routeTree.gen.ts` is generated by the TanStack Router Vite plugin and is
gitignored, so on a fresh checkout it does not exist — every `createFileRoute` resolves to
`never` and the web typecheck fails with two dozen errors that look like broken route types.
Only `build` generates it. Do not reorder `verify` back.

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
