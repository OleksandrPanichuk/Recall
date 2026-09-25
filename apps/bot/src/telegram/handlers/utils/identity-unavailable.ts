import { isApiError } from "@recall/contracts";
import type { Context } from "telegraf";
import { loginUnavailable } from "../../presenters/login.presenter";
import { render } from "../../screen";

export async function unlessIdentityUnavailable(
	ctx: Context,
	run: () => Promise<void>,
): Promise<void> {
	try {
		await run();
	} catch (error) {
		if (isApiError(error) && error.status === 503) {
			await render(ctx, loginUnavailable());

			return;
		}

		throw error;
	}
}
