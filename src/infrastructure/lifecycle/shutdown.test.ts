import { describe, expect, test } from "bun:test";
import { silentLogger } from "../logging/logger";
import { createShutdown } from "./shutdown";

const shutdown = () => createShutdown({ logger: silentLogger });

describe("createShutdown", () => {
	test("runs tasks in reverse registration order", async () => {
		const order: string[] = [];
		const stop = shutdown();

		stop.register({ name: "database", run: () => void order.push("database") });
		stop.register({ name: "bot", run: () => void order.push("bot") });

		await stop.trigger("SIGINT");

		expect(order).toEqual(["bot", "database"]);
	});

	test("awaits asynchronous tasks", async () => {
		const order: string[] = [];
		const stop = shutdown();

		stop.register({
			name: "slow",
			run: () => Promise.resolve().then(() => void order.push("slow")),
		});
		stop.register({ name: "fast", run: () => void order.push("fast") });

		await stop.trigger("SIGTERM");

		expect(order).toEqual(["fast", "slow"]);
	});

	test("a repeated signal does not start a second teardown", async () => {
		let runs = 0;
		const stop = shutdown();
		stop.register({
			name: "database",
			run: () => {
				runs += 1;
			},
		});

		await Promise.all([
			stop.trigger("SIGINT"),
			stop.trigger("SIGINT"),
			stop.trigger("SIGTERM"),
		]);

		expect(runs).toBe(1);
	});

	test("one failing task does not strand the others", async () => {
		const order: string[] = [];
		const stop = shutdown();

		stop.register({ name: "database", run: () => void order.push("database") });
		stop.register({
			name: "bot",
			run: () => {
				throw new Error("telegram is unreachable");
			},
		});

		await stop.trigger("SIGINT");

		expect(order).toEqual(["database"]);
	});

	test("reports whether it has been triggered", async () => {
		const stop = shutdown();

		expect(stop.triggered).toBe(false);

		await stop.trigger("SIGINT");

		expect(stop.triggered).toBe(true);
	});

	test("registers a handler for each signal", () => {
		const registered: string[] = [];
		const stop = createShutdown({
			logger: silentLogger,
			onProcess: (signal) => registered.push(signal),
		});

		stop.listen();

		expect(registered).toEqual(["SIGINT", "SIGTERM"]);
	});

	test("a signal handler runs the tasks", async () => {
		const handlers = new Map<string, () => void>();
		let closed = false;
		const stop = createShutdown({
			logger: silentLogger,
			onProcess: (signal, handler) => handlers.set(signal, handler),
		});

		stop.register({
			name: "database",
			run: () => {
				closed = true;
			},
		});
		stop.listen();
		handlers.get("SIGTERM")?.();
		await stop.trigger("SIGTERM");

		expect(closed).toBe(true);
	});
});
