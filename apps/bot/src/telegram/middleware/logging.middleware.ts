import type { Logger } from "@recall/kit";
import type { Context, MiddlewareFn } from "telegraf";
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

		const record = (outcome: string): void => {
			try {
				options.logger.info("telegram update", {
					...describeUpdate(ctx),
					durationMs: now() - startedAt,
					outcome,
				});
			} catch {}
		};

		try {
			await next();
		} catch (error) {
			record("failed");

			throw error;
		}

		record("ok");
	};
}
