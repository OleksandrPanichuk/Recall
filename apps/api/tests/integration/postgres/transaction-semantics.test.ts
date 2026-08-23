import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import {
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

let harness: PostgresHarness;

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("tx");
	await harness.client.unsafe(
		`create table note (id text primary key, body text not null)`,
	);
});

afterAll(async () => {
	if (available) {
		await harness.close();
	}
});

const bodies = async (): Promise<readonly string[]> => {
	const rows = await harness.client<{ body: string }[]>`
		select body from note order by body
	`;

	return rows.map((row) => row.body);
};

describe.skipIf(!available)("postgres transaction semantics", () => {
	test("commits every write in the boundary", async () => {
		await harness.db.transaction(async (tx) => {
			await tx.execute(sql`insert into note (id, body) values ('a', 'first')`);
			await tx.execute(sql`insert into note (id, body) values ('b', 'second')`);
		});

		expect(await bodies()).toEqual(["first", "second"]);
	});

	test("rolls the whole boundary back when the callback throws", async () => {
		const before = await bodies();

		await expect(
			harness.db.transaction(async (tx) => {
				await tx.execute(
					sql`insert into note (id, body) values ('c', 'third')`,
				);

				throw new Error("give it back");
			}),
		).rejects.toThrow("give it back");

		expect(await bodies()).toEqual(before);
	});

	test("reads its own writes inside the boundary", async () => {
		await harness.db.transaction(async (tx) => {
			await tx.execute(sql`insert into note (id, body) values ('d', 'fourth')`);

			const seen = await tx.execute<{ body: string }>(
				sql`select body from note where id = 'd'`,
			);

			expect(seen).toHaveLength(1);
		});

		expect(await bodies()).toContain("fourth");
	});

	test("nests through a savepoint and rolls back only the inner boundary", async () => {
		await harness.db.transaction(async (tx) => {
			await tx.execute(sql`insert into note (id, body) values ('e', 'outer')`);

			try {
				await tx.transaction(async (inner) => {
					await inner.execute(
						sql`insert into note (id, body) values ('f', 'inner')`,
					);

					throw new Error("inner only");
				});
			} catch {}
		});

		const kept = await bodies();

		expect(kept).toContain("outer");
		expect(kept).not.toContain("inner");
	});

	test("a write that is not awaited survives a rolled-back boundary", async () => {
		let escaped: Promise<unknown> | undefined;

		await harness.db
			.transaction(async (tx) => {
				escaped = tx.execute(
					sql`insert into note (id, body) values ('g', 'unawaited')`,
				);

				throw new Error("roll it all back");
			})
			.catch(() => {});

		await escaped?.catch(() => {});

		expect(await bodies()).toContain("unawaited");
	});
});

test("the suite is not silently skipped where postgres is required", () => {
	if (process.env.TEST_DATABASE_URL !== undefined) {
		expect(available).toBe(true);
	}
});
