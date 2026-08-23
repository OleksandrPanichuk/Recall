import type { Context, MiddlewareFn } from "telegraf";
import type { Logger } from "@/infrastructure/logging/logger.types";
import { userMessageFor } from "../presenters/error.presenter";
import { notice } from "../presenters/menu.presenter";
import { render } from "../screen";
import { describeUpdate } from "../utils/describe-update";

export function errorMiddleware(logger: Logger): MiddlewareFn<Context> {
	return async (ctx, next) => {
		try {
			await next();
		} catch (error) {
			logger.error("telegram handler failed", {
				...describeUpdate(ctx),
				error,
			});

			try {
				await render(ctx, notice(userMessageFor(error)));
			} catch (renderError) {
				logger.error("could not show the error notice", {
					...describeUpdate(ctx),
					error: renderError,
				});
			}
		}
	};
}
