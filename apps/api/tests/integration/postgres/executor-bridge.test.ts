import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { OwnerId } from "@/core/owner";
import type { RecallDatabase } from "@/db/client";
import { DatabaseExecutor } from "@/db/executor";
import * as schema from "@/db/schema";
import { pages } from "@/db/schema";
import { PageEntity } from "@/modules/pages";
import { createPostgresUnitOfWork } from "@/persistence/postgres/unit-of-work";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedOwner,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

let harness: PostgresHarness;
let db: RecallDatabase;
let owner: OwnerId;

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("bridge");
	await applyMigration(harness);
	db = drizzle({ client: harness.client, schema });
	owner = await seedOwner(harness, "bridge owner");
});

afterAll(async () => {
	await harness?.close();
});

const titleOf = async (id: string): Promise<string | undefined> => {
	const [row] = await DatabaseExecutor.for(db)
		.select({ title: pages.title })
		.from(pages)
		.where(eq(pages.id, id))
		.limit(1);

	return row?.title;
};

const aPage = (name: string) =>
	PageEntity.create({
		id: crypto.randomUUID() as never,
		name,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
	});

describe.skipIf(!available)("the executor bridge", () => {
	test("a repository built the old way and a query built the new way share one transaction", async () => {
		const page = aPage("visible inside");

		await createPostgresUnitOfWork(db, owner).run(async (scope) => {
			expect(DatabaseExecutor.isOpen()).toBe(true);

			await scope.pages.save(page);

			expect(await titleOf(page.id)).toBe("visible inside");
		});

		expect(DatabaseExecutor.isOpen()).toBe(false);
		expect(await titleOf(page.id)).toBe("visible inside");
	});

	test("a failure discards the old scope's write and the new executor agrees it is gone", async () => {
		const page = aPage("never committed");

		await expect(
			createPostgresUnitOfWork(db, owner).run(async (scope) => {
				await scope.pages.save(page);

				expect(await titleOf(page.id)).toBe("never committed");

				throw new Error("rolled back");
			}),
		).rejects.toThrow("rolled back");

		expect(await titleOf(page.id)).toBeUndefined();
	});

	test("a nested run joins rather than committing early", async () => {
		const outer = aPage("outer");
		const inner = aPage("inner");
		const unitOfWork = createPostgresUnitOfWork(db, owner);

		await expect(
			unitOfWork.run(async (scope) => {
				await scope.pages.save(outer);

				await unitOfWork.run(async (nested) => {
					await nested.pages.save(inner);
				});

				throw new Error("rolled back");
			}),
		).rejects.toThrow("rolled back");

		expect(await titleOf(outer.id)).toBeUndefined();
		expect(await titleOf(inner.id)).toBeUndefined();
	});

	test("outside a transaction the executor is the connection, not a stale scope", async () => {
		const page = aPage("committed");

		await createPostgresUnitOfWork(db, owner).run((scope) =>
			scope.pages.save(page),
		);

		expect(DatabaseExecutor.isOpen()).toBe(false);
		expect(await titleOf(page.id)).toBe("committed");
	});
});
