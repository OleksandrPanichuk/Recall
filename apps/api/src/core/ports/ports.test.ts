import { expect, test } from "bun:test";
import type { Transaction } from "../transaction";
import type { Clock } from "./clock";
import type { IdGenerator } from "./id-generator";

test("core ports accept object literals, so a fixture needs no subclass", () => {
	const instant = new Date("2026-08-03T12:00:00.000Z");
	const clock: Clock = { now: () => instant };
	const idGenerator: IdGenerator = { generate: () => "stable-id" };

	expect(clock.now()).toEqual(instant);
	expect(idGenerator.generate()).toBe("stable-id");
});

test("a transaction awaits its operation and returns the result", async () => {
	const transaction: Transaction = { run: (operation) => operation() };

	expect(await transaction.run(async () => "committed")).toBe("committed");
});

test("a transaction propagates the failure that discards it", async () => {
	const transaction: Transaction = { run: (operation) => operation() };

	expect(
		transaction.run(async () => {
			throw new Error("rolled back");
		}),
	).rejects.toThrow("rolled back");
});
