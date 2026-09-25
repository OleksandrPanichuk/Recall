import type { Logger, Shutdown } from "@recall/kit";
import {
	delayFor,
	interruptibleWait,
	MAX_CONSECUTIVE_FAILURES,
	type Wait,
} from "./keep-polling";
import { isTransientNetworkError } from "./transient";

const RATE_LIMITED = 429;
const SERVER_ERROR = 500;

const telegramCodeOf = (error: unknown): number | undefined => {
	const code = (error as { code?: unknown } | null)?.code;

	return typeof code === "number" ? code : undefined;
};

const retryAfterMs = (error: unknown): number | undefined => {
	const seconds = (error as { parameters?: { retry_after?: unknown } } | null)
		?.parameters?.retry_after;

	return typeof seconds === "number" ? seconds * 1000 : undefined;
};

const isRetryable = (error: unknown): boolean => {
	const code = telegramCodeOf(error);

	return (
		isTransientNetworkError(error) ||
		code === RATE_LIMITED ||
		(code !== undefined && code >= SERVER_ERROR)
	);
};

export interface WebhookRegistration {
	readonly secret_token: string;
	readonly drop_pending_updates: boolean;
}

interface RegisterWebhookOptions {
	readonly setWebhook: (
		url: string,
		options: WebhookRegistration,
	) => Promise<unknown>;
	readonly url: string;
	readonly secret: string;
	readonly logger: Logger;
	readonly shutdown: Shutdown;
	readonly onFatal: (error: unknown) => void;
	readonly onListening: () => void;
	readonly wait?: Wait;
}

export async function registerWebhook({
	setWebhook,
	url,
	secret,
	logger,
	shutdown,
	onFatal,
	onListening,
	wait = interruptibleWait,
}: RegisterWebhookOptions): Promise<void> {
	let stopWaiting: (() => void) | undefined;

	shutdown.register({
		name: "webhook-backoff",
		run: () => {
			stopWaiting?.();
		},
	});

	for (let attempt = 1; !shutdown.triggered; attempt += 1) {
		try {
			await setWebhook(url, {
				secret_token: secret,
				drop_pending_updates: false,
			});
			onListening();

			return;
		} catch (error) {
			if (shutdown.triggered || !isRetryable(error)) {
				onFatal(error);

				return;
			}

			if (attempt >= MAX_CONSECUTIVE_FAILURES) {
				logger.error("telegram is unreachable, giving up", {
					attempts: attempt,
				});
				onFatal(error);

				return;
			}

			const delay = retryAfterMs(error) ?? delayFor(attempt);

			logger.warn("could not register the webhook, retrying", {
				error,
				attempts: attempt,
				retryInMs: delay,
			});

			await wait(delay, (stop) => {
				stopWaiting = stop;
			});

			stopWaiting = undefined;
		}
	}
}
