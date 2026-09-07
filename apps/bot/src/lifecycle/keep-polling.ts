import type { Logger, Shutdown } from "@recall/kit";
import { isTransientNetworkError } from "./transient";

export const HEALTHY_AFTER_MS = 60_000;
export const MAX_CONSECUTIVE_FAILURES = 10;
const FIRST_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

export function delayFor(failures: number): number {
	return Math.min(FIRST_DELAY_MS * 2 ** (failures - 1), MAX_DELAY_MS);
}

interface KeepPollingOptions {
	readonly launch: (options: {
		readonly dropPendingUpdates: boolean;
	}) => Promise<void>;
	readonly logger: Logger;
	readonly shutdown: Shutdown;
	readonly onFatal: (error: unknown) => void;
	readonly now?: () => number;
	readonly wait?: (
		ms: number,
		interruptible: (stop: () => void) => void,
	) => Promise<void>;
}

export async function keepPolling({
	launch,
	logger,
	shutdown,
	onFatal,
	now = () => Date.now(),
	wait = (ms, interruptible) =>
		new Promise((resolve) => {
			const timer = setTimeout(resolve, ms);

			interruptible(() => {
				clearTimeout(timer);
				resolve();
			});
		}),
}: KeepPollingOptions): Promise<void> {
	let failures = 0;
	let dropPendingUpdates = true;
	let stopWaiting: (() => void) | undefined;

	shutdown.register({
		name: "reconnect-backoff",
		run: () => {
			stopWaiting?.();
		},
	});

	while (!shutdown.triggered) {
		const startedAt = now();

		try {
			await launch({ dropPendingUpdates });

			return;
		} catch (error) {
			if (shutdown.triggered || !isTransientNetworkError(error)) {
				onFatal(error);

				return;
			}

			failures = now() - startedAt >= HEALTHY_AFTER_MS ? 1 : failures + 1;

			if (failures > MAX_CONSECUTIVE_FAILURES) {
				logger.error("telegram is unreachable, giving up", { failures });
				onFatal(error);

				return;
			}

			const delay = delayFor(failures);

			logger.warn("telegram connection dropped, reconnecting", {
				error,
				failures,
				retryInMs: delay,
			});

			await wait(delay, (stop) => {
				stopWaiting = stop;
			});

			stopWaiting = undefined;
			dropPendingUpdates = false;
		}
	}
}
