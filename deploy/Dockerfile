FROM oven/bun:1.4.0 AS manifests
WORKDIR /repo
COPY package.json bun.lock ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/bot/package.json apps/bot/package.json
COPY apps/mcp/package.json apps/mcp/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/kit/package.json packages/kit/package.json
COPY packages/tooling/package.json packages/tooling/package.json


FROM manifests AS deps
RUN bun install --frozen-lockfile


FROM manifests AS runtime-deps
RUN bun install --frozen-lockfile --production --filter '@recall/api'


FROM deps AS build
ARG VITE_API_ORIGIN=""
COPY tsconfig.json ./
COPY packages packages
COPY apps apps
RUN bun run --filter '@recall/kit' build \
	&& bun run --filter '@recall/contracts' build \
	&& bun run --filter '@recall/api' build \
	&& bun run --filter '@recall/bot' build \
	&& bun run --filter '@recall/mcp' build
RUN VITE_API_ORIGIN="${VITE_API_ORIGIN}" bun run --filter '@recall/web' build
RUN test -z "$(grep -rl '127\.0\.0\.1:8767' apps/web/.output/public/assets 2>/dev/null)"


FROM build AS migrate
WORKDIR /repo/apps/api
ENV NODE_ENV=production
CMD ["bun", "run", "./node_modules/drizzle-kit/bin.cjs", "migrate", "--config", "drizzle.postgres.config.ts"]


FROM node:22-slim AS api
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=runtime-deps /repo/node_modules node_modules
COPY --from=runtime-deps /repo/apps/api/node_modules apps/api/node_modules
COPY --from=runtime-deps /repo/packages/contracts/node_modules packages/contracts/node_modules
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/kit/package.json packages/kit/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build /repo/packages/kit/dist packages/kit/dist
EXPOSE 8767
USER node
CMD ["node", "apps/api/dist/main.js"]


FROM oven/bun:1.4.0-slim AS web
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/web/.output ./
EXPOSE 3000
USER bun
CMD ["bun", "run", "./server/index.mjs"]


FROM oven/bun:1.4.0-slim AS bot
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/bot/dist/main.js ./main.js
EXPOSE 8768
USER bun
CMD ["bun", "run", "./main.js"]


FROM oven/bun:1.4.0-slim AS mcp
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/mcp/dist/main.js ./main.js
USER bun
CMD ["bun", "run", "./main.js"]
