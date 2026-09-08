# Repository instructions

## Product context

Read `DESCRIPTION.md` before planning or implementing product changes. Read `REWRITE_PLAN.md` for binding dependency rules, patterns and folder ownership, plus phase order, acceptance gates, and every settled architectural decision. `ARCHITECTURE.md` describes the v1 layering, which no longer exists in the tree; it is history, not a rule book. Read `WORKFLOW.md` before orchestrating multi-agent implementation.

`DEVELOPMENT_PLAN.md` no longer exists; the Sequencing section of `REWRITE_PLAN.md` replaced it.

This repository is a cleaned foundation for a personal learning quiz bot. The former publish-bot implementation has been removed; do not recreate publishing behavior unless a current requirement explicitly asks for it.

## Branch and pull requests

- **`rewrite_v3` is the trunk while the api rewrite is in flight.** `main` carries v2.
- **Every pull request targets `rewrite_v3`.** Branch from it with the existing naming
  (`feat/…`, `fix/…`, `refactor/…`, `docs/…`).
- `bun run verify` is the gate and must stay green. Note the order: it **builds before it
  typechecks**, because `apps/web`'s route tree is generated during the build.
- The repository is a Bun workspace (`apps/*`, `packages/*`). `bun run verify` at the root
  still runs the whole gate; per-workspace scripts go through `bun run --filter`.

## Runtime and commands

- Use Bun and TypeScript everywhere except `apps/api`, which is Node and NestJS.
- Install dependencies with `bun install`.
- Run tests with `bun test`.
- Run lint and formatting checks with `bun run check`.
- Run type checking with `bun run typecheck`.
- Run the production build with `bun run build`.
- Run the full local quality gate with `bun run verify`.
- Do not introduce Node-only infrastructure when Bun provides the required primitive.
- Keep secrets in environment variables and never commit real tokens or credentials.

## Architecture boundaries

- `REWRITE_PLAN.md` is the source of truth — §3 for the layout of `apps/api/src`, §4 for what
  goes in a module and what its files are called, §5 for the module catalogue and the
  dependency graph, §6 for owner context, transactions, errors and DI.
- **The api is capability modules.** A new capability gets its own directory under
  `apps/api/src/modules`, never a second capability inside an existing one.
- Only `apps/api` may reach the database. `apps/bot`, `apps/mcp`, `apps/admin`, and
  `apps/web` — including its server functions — are HTTP clients of the API.
- The former publish-bot layout has been removed; do not recreate its `commands`, `core`, `helpers`, or global `types.ts` structure by default.
- Keep Telegram handlers and MCP tools as adapters over shared application services.
- Keep domain behavior independent from Telegraf and MCP transports.
- Route database writes through repositories and application services; adapters must not write arbitrary SQL.
- A module reaches another module through its barrel and never through its internals, and only
  a `*.module.ts` may bind a port to an adapter. `biome.json` fails the build on both.
- Create target directories incrementally with accepted behavior; do not generate the complete architecture as empty scaffolding.
- Avoid global `helpers`, `core`, `common`, and global `types` dumping grounds in new code; a module-local `utils/` directory, `*.types.ts` and `*.constants.ts` files beside their owner, and `apps/api/src/shared/utils/` for layer-free primitives are the expected shape (see `REWRITE_PLAN.md` §4).
- Treat AI-generated quiz content as untrusted input and validate it before persistence and publication.
- Ownership comes from the request context, never from the caller. `ALLOWED_TELEGRAM_USER_ID`
  is a guard on the bot surface, not an identity; never accept a caller-supplied user id over
  HTTP.

## Development workflow

For implementation-plan execution, use the `run-reviewed-development` skill when available.

- Use one coordinator, one task implementer, and an independent read-only reviewer.
- Follow TDD for behavior changes.
- Review every task before starting its dependent task.
- Send findings back to the implementer, then independently re-review the fix diff.
- Do not allow two agents to edit the same worktree concurrently.
- Run focused verification per task and full verification before completion.
- Do not claim success from agent reports alone; inspect the diff and run fresh commands.

