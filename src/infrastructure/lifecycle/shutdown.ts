import type { Logger } from "../logging/logger";

export interface ShutdownTask {
	readonly name: string;
	run(): void | Promise<void>;
}

export interface Shutdown {
	/** Tasks run in reverse registration order, so dependencies close last. */
	register(task: ShutdownTask): void;
	/** Resolves once every task has been given its chance. Safe to call twice. */
	trigger(reason: string): Promise<void>;
	listen(signals?: readonly NodeJS.Signals[]): void;
	readonly triggered: boolean;
}

export interface ShutdownOptions {
	readonly logger: Logger;
	readonly onProcess?: (signal: NodeJS.Signals, handler: () => void) => void;
}

export const DEFAULT_SIGNALS: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

/**
 * Ordered teardown. Tasks are registered in start-up order and run in reverse,
 * so the bot stops accepting updates before the database it writes to closes —
 * without that ordering a signal arriving mid-answer would close the handle
 * underneath an open transaction.
 *
 * One task failing must not strand the rest, so each is isolated.
 */
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
			// A second signal must not start a second teardown over the first.
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
