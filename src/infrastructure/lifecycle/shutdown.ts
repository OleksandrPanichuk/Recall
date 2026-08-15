import type { Logger } from "../logging/logger.types";

export interface ShutdownTask {
	readonly name: string;
	run(): void | Promise<void>;
}

export interface Shutdown {
	register(task: ShutdownTask): void;
	trigger(reason: string): Promise<void>;
	listen(signals?: readonly NodeJS.Signals[]): void;
	readonly triggered: boolean;
}

export interface ShutdownOptions {
	readonly logger: Logger;
	readonly onProcess?: (signal: NodeJS.Signals, handler: () => void) => void;
}

export const DEFAULT_SIGNALS: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

// Reverse registration order, so polling stops before the database it writes to
// closes — otherwise a signal mid-answer pulls the handle out of a transaction.
export function createShutdown(options: ShutdownOptions): Shutdown {
	const tasks: ShutdownTask[] = [];
	let running: Promise<void> | undefined;

	const runAll = async (reason: string): Promise<void> => {
		options.logger.info("shutting down", { reason, tasks: tasks.length });

		for (const task of [...tasks].reverse()) {
			try {
				await task.run();
				options.logger.debug("stopped", { task: task.name });
			} catch (error) {
				options.logger.error("shutdown task failed", {
					task: task.name,
					error,
				});
			}
		}

		options.logger.info("shutdown complete", { reason });
	};

	return {
		register: (task) => {
			tasks.push(task);
		},
		trigger: (reason) => {
			if (running === undefined) {
				running = runAll(reason);
			}

			return running;
		},
		listen: (signals = DEFAULT_SIGNALS) => {
			for (const signal of signals) {
				const handler = (): void => {
					if (running === undefined) {
						running = runAll(signal);
					}

					void running;
				};

				if (options.onProcess === undefined) {
					process.once(signal, handler);
				} else {
					options.onProcess(signal, handler);
				}
			}
		},
		get triggered() {
			return running !== undefined;
		},
	};
}
