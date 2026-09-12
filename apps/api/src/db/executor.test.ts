import { describe, expect, test } from "bun:test";
import type { RecallDatabase } from "./client";
import { DatabaseExecutor, PostgresTransaction } from "./executor";

const scope = { marker: "transaction-scope" };

function fakeDatabase(): { db: RecallDatabase; opened: () => number } {
	let opened = 0;

	const db = {
		marker: "connection",
		transaction: (operation: (scope: unknown) => unknown) => {
			opened += 1;

			return Promise.resolve(operation(scope));
		},
	};

	return { db: db as unknown as RecallDatabase, opened: () => opened };
}

describe("the postgres executor", () => {
	test("hands out the connection when no transaction is open", () => {
		const { db } = fakeDatabase();

		expect(DatabaseExecutor.for(db)).toBe(db);
		expect(DatabaseExecutor.isOpen()).toBe(false);
	});

	test("hands out the transaction scope inside one", async () => {
		const { db } = fakeDatabase();

		await new PostgresTransaction(() => db).run(async () => {
			expect(DatabaseExecutor.for(db)).toBe(scope as never);
			expect(DatabaseExecutor.isOpen()).toBe(true);
		});
	});

	test("a nested run joins the open transaction rather than opening a second", async () => {
		const { db, opened } = fakeDatabase();
		const transaction = new PostgresTransaction(() => db);

		await transaction.run(async () => {
			await transaction.run(async () => {
				expect(DatabaseExecutor.for(db)).toBe(scope as never);
			});
		});

		expect(opened()).toBe(1);
	});

	test("the scope is gone once the operation resolves", async () => {
		const { db } = fakeDatabase();

		await new PostgresTransaction(() => db).run(async () => undefined);

		expect(DatabaseExecutor.for(db)).toBe(db);
		expect(DatabaseExecutor.isOpen()).toBe(false);
	});

	test("a failure propagates so the boundary is discarded", async () => {
		const { db } = fakeDatabase();

		expect(
			new PostgresTransaction(() => db).run(async () => {
				throw new Error("rolled back");
			}),
		).rejects.toThrow("rolled back");
	});

	test("two operations in flight do not see each other's scope", async () => {
		const { db } = fakeDatabase();
		const transaction = new PostgresTransaction(() => db);
		const seen: unknown[] = [];

		await Promise.all([
			transaction.run(async () => {
				await Promise.resolve();
				seen.push(DatabaseExecutor.for(db));
			}),
			(async () => {
				await Promise.resolve();
				seen.push(DatabaseExecutor.for(db));
			})(),
		]);

		expect(seen).toContain(scope);
		expect(seen).toContain(db);
	});
});
