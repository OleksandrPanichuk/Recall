# Repository instructions

## Product context

Read `DESCRIPTION.md` before planning or implementing product changes. Read `ARCHITECTURE.md` for binding dependency rules, patterns, and folder ownership **in v1 code (`src/`)**. Read `REWRITE_PLAN.md` for the same questions **in v2 code (`apps/`, `packages/`)**, plus phase order, acceptance gates, and every settled architectural decision. Read `WORKFLOW.md` before orchestrating multi-agent implementation.

`DEVELOPMENT_PLAN.md` no longer exists; the Sequencing section of `REWRITE_PLAN.md` replaced it.

This repository is a cleaned foundation for a personal learning quiz bot. The former publish-bot implementation has been removed; do not recreate publishing behavior unless a current requirement explicitly asks for it.

## Branch and pull requests

- The v2 rewrite happens on **`rewrite`**. `main` is frozen at v1 until the rewrite lands.
- **Every pull request targets `rewrite`.** Do not open one against `main`, and do not merge
  v2 work into `main` piecemeal.
- Branch from `rewrite` with the existing naming (`feat/…`, `fix/…`, `refactor/…`, `docs/…`).
- Do not break v1: `apps/api` must keep passing `bun run verify` for as long as it carries the
  v1 code, even while new apps are being built beside it.
- The repository is a Bun workspace (`apps/*`, `packages/*`). `bun run verify` at the root
  still runs the whole gate; per-workspace scripts go through `bun run --filter`.

## Runtime and commands

- Use Bun, TypeScript, Telegraf, and `bun:sqlite`.
- Install dependencies with `bun install`.
- Run tests with `bun test`.
- Run lint and formatting checks with `bun run check`.
- Run type checking with `bun run typecheck`.
- Run the production build with `bun run build`.
- Run the full local quality gate with `bun run verify`.
- Do not introduce Node-only infrastructure when Bun provides the required primitive.
- Keep secrets in environment variables and never commit real tokens or credentials.

## Architecture boundaries

- For v1 code, treat `ARCHITECTURE.md` as the source of truth for structure and pattern use.
- For v2 code, `REWRITE_PLAN.md` is the source of truth — §1 for the monorepo layout, §8 for
  module boundaries and the `apps/api/src/modules/` structure, §6 for the schema and its
  vocabulary, §2 for the async port contract. Where the two documents disagree on this
  branch, `REWRITE_PLAN.md` wins.
- Only `apps/api` may reach the database. `apps/bot`, `apps/mcp`, `apps/admin`, and
  `apps/web` — including its server functions — are HTTP clients of the API.
- The former publish-bot layout has been removed; do not recreate its `commands`, `core`, `helpers`, or global `types.ts` structure by default.
- Keep Telegram handlers and MCP tools as adapters over shared application services.
- Keep domain behavior independent from Telegraf and MCP transports.
- Route database writes through repositories and application services; adapters must not write arbitrary SQL.
- Follow the dependency direction `adapters -> application -> domain`; only composition and entrypoints may wire concrete implementations.
- Create target directories incrementally with accepted behavior; do not generate the complete architecture as empty scaffolding.
- Avoid global `helpers`, `core`, `common`, and global `types` dumping grounds in new code; a module-local `utils/` directory, `*.types.ts` and `*.constants.ts` files beside their owner, and `src/shared/utils/` for layer-free primitives are the expected shape (see `ARCHITECTURE.md`).
- Treat AI-generated quiz content as untrusted input and validate it before persistence and publication.
- Restrict the bot to `ALLOWED_TELEGRAM_USER_ID` in v1 code. Multi-user **has now been
  requested**: v2 replaces this with a `UserId` resolved from Better Auth (`REWRITE_PLAN.md`
  §3, §5, phase 7). Do not carry the allowlist into `apps/`, and never accept a
  caller-supplied user id over HTTP.

## Development workflow

For implementation-plan execution, use the `run-reviewed-development` skill when available.

- Use one coordinator, one task implementer, and an independent read-only reviewer.
- Follow TDD for behavior changes.
- Review every task before starting its dependent task.
- Send findings back to the implementer, then independently re-review the fix diff.
- Do not allow two agents to edit the same worktree concurrently.
- Run focused verification per task and full verification before completion.
- Do not claim success from agent reports alone; inspect the diff and run fresh commands.

