
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

1. **`apps/api` — NestJS on Node, with the Express adapter.**
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
- **File** names do not repeat it: `use-cases/attempts/answer-question.ts`, not
  `answer-question.use-case.ts`. The directory already says `use-cases`, and a path that
  stutters is worse than one that does not. This is the opposite of `*.handler.ts` /
  `*.presenter.ts` / `*.tool.ts`, which sit in directories that do **not** name their role.

## Code comments

Do not write code comments. Not header comments, not JSDoc, not a one-line note
above a tricky branch, not a "why this and not that" explanation. In 90%+ of
cases they are useless: they restate what the code already says, and they rot.

When something needs explaining, put it in the commit message or the pull
request description, where it is dated and reviewable.

The only exceptions are machine-readable directives (`biome-ignore`,
`@ts-expect-error`) and licence headers, which are not prose.
