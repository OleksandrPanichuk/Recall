import { describe, expect, test } from "bun:test";
import { type SupervisedProcess, superviseProcesses } from "./up.supervise";

interface Fake extends SupervisedProcess {
	readonly killed: () => number;
	finish(code: number): void;
}

const aChild = (name: string): Fake => {
	let settle: (code: number) => void = () => {};
	let kills = 0;
	const exited = new Promise<number>((resolve) => {
		settle = resolve;
	});

	return {
		name,
		exited,
		kill: () => {
			kills += 1;
		},
		killed: () => kills,
		finish: (code) => settle(code),
	};
};

describe("superviseProcesses", () => {
	test("stops the others as soon as one exits", async () => {
		const bot = aChild("bot");
		const mcp = aChild("mcp");
		const supervising = superviseProcesses([bot, mcp]);

		bot.finish(1);
		await Promise.resolve();
		mcp.finish(0);
		await supervising;

		expect(mcp.killed()).toBe(1);
		expect(bot.killed()).toBe(0);
	});

	test("reports which one went first, and with what code", async () => {
		const bot = aChild("bot");
		const mcp = aChild("mcp");
		const supervising = superviseProcesses([bot, mcp]);

		mcp.finish(3);
		await Promise.resolve();
		bot.finish(0);

		expect(await supervising).toEqual({ name: "mcp", code: 3 });
	});

	test("waits for the stopped ones before resolving", async () => {
		const bot = aChild("bot");
		const mcp = aChild("mcp");
		const order: string[] = [];

		const supervising = superviseProcesses([bot, mcp]).then(() => {
			order.push("supervisor resolved");
		});

		bot.finish(0);
		await Bun.sleep(5);
		order.push("mcp was still running");
		mcp.finish(0);
		await supervising;

		expect(order).toEqual(["mcp was still running", "supervisor resolved"]);
	});

	test("supervising nothing is not an error", async () => {
		expect(await superviseProcesses([])).toBeUndefined();
	});

	test("a lone child needs no killing", async () => {
		const bot = aChild("bot");
		const supervising = superviseProcesses([bot]);

		bot.finish(0);

		expect(await supervising).toEqual({ name: "bot", code: 0 });
		expect(bot.killed()).toBe(0);
	});
});
