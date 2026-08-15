# Repository instructions

## Product context

Read `DESCRIPTION.md` before planning or implementing product changes. Read `ARCHITECTURE.md` for binding dependency rules, patterns, and target folder ownership. Read `DEVELOPMENT_PLAN.md` to understand phase order and acceptance gates. Read `WORKFLOW.md` before orchestrating multi-agent implementation.

This repository is a cleaned foundation for a personal learning quiz bot. The former publish-bot implementation has been removed; do not recreate publishing behavior unless a current requirement explicitly asks for it.

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

- Treat `ARCHITECTURE.md` as the source of truth for new production-code structure and pattern use.
- The former publish-bot layout has been removed; do not recreate its `commands`, `core`, `helpers`, or global `types.ts` structure by default.
- Keep Telegram handlers and MCP tools as adapters over shared application services.
- Keep domain behavior independent from Telegraf and MCP transports.
- Route database writes through repositories and application services; adapters must not write arbitrary SQL.
- Follow the dependency direction `adapters -> application -> domain`; only composition and entrypoints may wire concrete implementations.
- Create target directories incrementally with accepted behavior; do not generate the complete architecture as empty scaffolding.
- Avoid global `helpers`, `core`, `common`, and global `types` dumping grounds in new code; a module-local `utils/` directory, `*.types.ts` and `*.constants.ts` files beside their owner, and `src/shared/utils/` for layer-free primitives are the expected shape (see `ARCHITECTURE.md`).
- Treat AI-generated quiz content as untrusted input and validate it before persistence and publication.
- Restrict the bot to `ALLOWED_TELEGRAM_USER_ID` until multi-user behavior is explicitly requested.

## Development workflow

For implementation-plan execution, use the `run-reviewed-development` skill when available.

- Use one coordinator, one task implementer, and an independent read-only reviewer.
- Follow TDD for behavior changes.
- Review every task before starting its dependent task.
- Send findings back to the implementer, then independently re-review the fix diff.
- Do not allow two agents to edit the same worktree concurrently.
- Run focused verification per task and full verification before completion.
- Do not claim success from agent reports alone; inspect the diff and run fresh commands.

Until this directory is initialized as a Git repository, agents may plan and document work but must not start the multi-agent implementation loop.
