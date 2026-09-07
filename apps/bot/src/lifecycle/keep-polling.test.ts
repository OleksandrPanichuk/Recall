import { describe, expect, mock, test } from "bun:test";
import { createShutdown, silentLogger } from "@recall/kit";
import {
	delayFor,
	HEALTHY_AFTER_MS,
	keepPolling,
	MAX_CONSECUTIVE_FAILURES,
} from "./keep-polling";
import { onLaunchFailure } from "./launch-failure";

const dropped = (): Error =>
	Object.assign(new TypeError("The socket connection was closed"), {
		code: "ECONNRESET",
	});

interface Harness {
	readonly launches: { readonly dropPendingUpdates: boolean }[];
	readonly waits: number[];
	readonly onFatal: ReturnType<typeof mock>;
	readonly shutdown: ReturnType<typeof createShutdown>;
	run(): Promise<void>;
	settled(): Promise<void>;
}

const harnessOf = (
	outcomes: readonly (Error | "resolve" | "hang")[],
	options: { readonly aliveFor?: number } = {},
): Harness => {
	const launches: { readonly dropPendingUpdates: boolean }[] = [];
	const waits: number[] = [];
	const onFatal = mock(() => undefined);
	const shutdown = createShutdown({ logger: silentLogger });
	const fail = onLaunchFailure({ logger: silentLogger, shutdown, onFatal });
	let clock = 0;

	const launch = async (launchOptions: {
		readonly dropPendingUpdates: boolean;
	}): Promise<void> => {
		launches.push(launchOptions);

		clock += options.aliveFor ?? 0;

		const outcome = outcomes[launches.length - 1] ?? "resolve";

		if (outcome === "hang") {
			await new Promise(() => undefined);
		}

		if (outcome !== "resolve") {
			throw outcome;
		}
	};

	return {
		launches,
		waits,
		onFatal,
		shutdown,
		settled: () => shutdown.trigger("settling"),
		run: () =>
			keepPolling({
				launch,
				logger: silentLogger,
				shutdown,
				onFatal: fail,
				now: () => clock,
				wait: async (ms) => {
					waits.push(ms);
					clock += ms;
				},
			}),
	};
};

describe("a poll that dies on a dropped connection", () => {
	test("comes back instead of taking the process down", async () => {
		const harness = harnessOf([dropped(), dropped(), "resolve"]);

		await harness.run();

		expect(harness.launches).toHaveLength(3);
		expect(harness.onFatal).not.toHaveBeenCalled();
	});

	test("drops pending updates on the first launch only", async () => {
		const harness = harnessOf([dropped(), "resolve"]);

		await harness.run();

		expect(harness.launches.map((one) => one.dropPendingUpdates)).toEqual([
			true,
			false,
		]);
	});

	test("backs off, and the backoff is bounded", async () => {
		const harness = harnessOf([
			dropped(),
			dropped(),
			dropped(),
			dropped(),
			"resolve",
		]);

		await harness.run();

		expect(harness.waits).toEqual([1_000, 2_000, 4_000, 8_000]);
		expect(delayFor(99)).toBe(30_000);
	});

	test("gives up once it has failed enough times in a row", async () => {
		const harness = harnessOf(
			Array.from({ length: MAX_CONSECUTIVE_FAILURES + 1 }, dropped),
		);

		await harness.run();
		await harness.settled();

		expect(harness.launches).toHaveLength(MAX_CONSECUTIVE_FAILURES + 1);
		expect(harness.onFatal).toHaveBeenCalled();
		expect(harness.shutdown.triggered).toBe(true);
	});

	test("but a run that stayed up starts the count over", async () => {
		const harness = harnessOf(
			Array.from({ length: MAX_CONSECUTIVE_FAILURES + 1 }, dropped),
			{ aliveFor: HEALTHY_AFTER_MS },
		);

		const running = harness.run();

		await Promise.race([running, Bun.sleep(50)]);
		await harness.shutdown.trigger("SIGTERM");
		await running;

		expect(harness.onFatal).not.toHaveBeenCalled();
		expect(harness.waits.every((one) => one === 1_000)).toBe(true);
	});
	test("a shutdown during the backoff is not waited out", async () => {
		const shutdown = createShutdown({ logger: silentLogger });
		const launches: number[] = [];

		const running = keepPolling({
			launch: async () => {
				launches.push(1);

				throw dropped();
			},
			logger: silentLogger,
			shutdown,
			onFatal: () => undefined,
			wait: (_ms, interruptible) =>
				new Promise((resolve) => {
					const timer = setTimeout(resolve, 30_000);

					interruptible(() => {
						clearTimeout(timer);
						resolve();
					});
				}),
		});

		while (launches.length === 0) {
			await Bun.sleep(1);
		}

		await shutdown.trigger("SIGTERM");
		await running;

		expect(launches).toHaveLength(1);
	});
});

describe("a poll that dies of anything else", () => {
	test("is fatal, because retrying a 401 forever helps nobody", async () => {
		const harness = harnessOf([
			Object.assign(new Error("401: Unauthorized"), { code: 401 }),
		]);

		await harness.run();
		await harness.settled();

		expect(harness.launches).toHaveLength(1);
		expect(harness.onFatal).toHaveBeenCalled();
	});

	test("unless a shutdown had already begun", async () => {
		const harness = harnessOf([
			new TypeError("Attempted to assign to readonly property."),
		]);

		await harness.shutdown.trigger("SIGTERM");
		await harness.run();

		expect(harness.launches).toHaveLength(0);
		expect(harness.onFatal).not.toHaveBeenCalled();
	});
});
