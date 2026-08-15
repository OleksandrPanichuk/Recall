import type { Context, MiddlewareFn } from "telegraf";
import type { Logger } from "@/infrastructure/logging/logger.types";
import { describeUpdate } from "../utils/describe-update";

export interface LoggingMiddlewareOptions {
	readonly logger: Logger;
	readonly now?: () => number;
}

export function loggingMiddleware(
	options: LoggingMiddlewareOptions,
): MiddlewareFn<Context> {
	const now = options.now ?? (() => Date.now());

	return async (ctx, next) => {
		const startedAt = now();
		const fields = describeUpdate(ctx);

		try {
			await next();
			options.logger.info("telegram update", {
				...fields,
				durationMs: now() - startedAt,
				outcome: "ok",
			});
		} catch (error) {
			options.logger.info("telegram update", {
				...fields,
				durationMs: now() - startedAt,
				outcome: "failed",
			});

			throw error;
		}
	};
}
