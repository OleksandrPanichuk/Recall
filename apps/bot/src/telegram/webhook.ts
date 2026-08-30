import { matchesSecret } from "@recall/kit";
import type { Update } from "telegraf/types";
import { createSeenUpdates, type SeenUpdates } from "./seen-updates";
import { SECRET_HEADER } from "./webhook.constants";

export interface WebhookOptions {
	readonly path: string;
	readonly secret: string;
	handleUpdate(update: Update): Promise<void>;
	onError(error: unknown): void;
	readonly seen?: SeenUpdates;
}

const isUpdate = (value: unknown): value is Update =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as { update_id?: unknown }).update_id === "number";

export function createWebhookHandler(
	options: WebhookOptions,
): (request: Request) => Promise<Response> {
	const seen = options.seen ?? createSeenUpdates();

	return async (request: Request): Promise<Response> => {
		const url = new URL(request.url);

		if (url.pathname === "/health/live") {
			return new Response("ok");
		}

		if (url.pathname !== options.path) {
			return new Response("not found", { status: 404 });
		}

		if (request.method !== "POST") {
			return new Response("method not allowed", { status: 405 });
		}

		if (
			!matchesSecret(request.headers.get(SECRET_HEADER) ?? "", options.secret)
		) {
			return new Response("forbidden", { status: 403 });
		}

		const body: unknown = await request.json().catch(() => undefined);

		if (!isUpdate(body)) {
			return new Response("bad request", { status: 400 });
		}

		if (!seen.firstSighting(body.update_id)) {
			return new Response("ok");
		}

		try {
			await options.handleUpdate(body);
		} catch (error) {
			options.onError(error);
		}

		return new Response("ok");
	};
}
