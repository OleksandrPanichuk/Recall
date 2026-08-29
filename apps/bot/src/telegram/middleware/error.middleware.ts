import type { Logger } from "@recall/kit";
import type { Context, MiddlewareFn } from "telegraf";
import { errorScreen } from "../presenters/error.presenter";
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
				await render(ctx, errorScreen(error));
			} catch (renderError) {
				logger.error("could not show the error notice", {
					...describeUpdate(ctx),
					error: renderError,
				});
			}
		}
	};
}
