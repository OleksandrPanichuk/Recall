import type { Logger, Shutdown } from "@recall/kit";

export interface LaunchFailureOptions {
	readonly logger: Logger;
	readonly shutdown: Shutdown;
	readonly onFatal: () => void;
}

export function onLaunchFailure({
	logger,
	shutdown,
	onFatal,
}: LaunchFailureOptions): (error: unknown) => void {
	return (error: unknown): void => {
		if (shutdown.triggered) {
			logger.debug("telegram stopped while shutting down", { error });

			return;
		}

		logger.error("bot stopped", { error });

		void shutdown.trigger("launch-failed").then(onFatal);
	};
}
