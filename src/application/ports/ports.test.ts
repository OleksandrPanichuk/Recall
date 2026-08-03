import { expect, test } from "bun:test";
import type { Clock } from "./clock";
import type { IdGenerator } from "./id-generator";
import type { Transaction } from "./transaction";

function assertTransactionIsSynchronous(transaction: Transaction): void {
	// @ts-expect-error bun:sqlite transactions must not cross an await boundary.
	transaction.run(async () => "not allowed");
}

void assertTransactionIsSynchronous;

test("application ports accept deterministic test implementations", () => {
	const instant = new Date("2026-08-03T12:00:00.000Z");
	const clock: Clock = { now: () => instant };
	const idGenerator: IdGenerator = { generate: () => "stable-id" };
	const transaction: Transaction = { run: (operation) => operation() };

	expect(clock.now()).toEqual(instant);
	expect(idGenerator.generate()).toBe("stable-id");
	expect(transaction.run(() => "committed")).toBe("committed");
});
