import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { createFolder, renameFolder, toFolderId } from "@/domain/folder/folder";
import type { RecallDatabase } from "@/persistence/postgres/client";
import * as schema from "@/persistence/postgres/schema";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";
import {
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

let harness: PostgresHarness;
let db: RecallDatabase;

const at = new Date("2026-08-01T10:00:00.000Z");

const applySchema = async (): Promise<void> => {
	const file = join(
		import.meta.dir,
		"..",
		"..",
		"..",
		"drizzle-postgres",
		"0000_tan_power_man.sql",
	);

	for (const statement of readFileSync(file, "utf8")
		.split("--> statement-breakpoint")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)) {
		await harness.client.unsafe(statement);
	}
};

const page = (id: string, name: string, parentId?: string) =>
	createFolder({
		id: toFolderId(id),
		name,
		parentId: parentId === undefined ? undefined : toFolderId(parentId),
		createdAt: at,
	});

const uuid = (): string => crypto.randomUUID();

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("pages");
	await applySchema();
	db = drizzle({ client: harness.client, schema });
});

afterAll(async () => {
	await harness?.close();
});

beforeEach(async () => {
	if (available) {
		await harness.client.unsafe("truncate pages, quizzes cascade");
	}
});

describe.skipIf(!available)("the postgres page repository", () => {
	test("saves a page and reads it back", async () => {
		const unitOfWork = createPostgresUnitOfWork(db);
		const id = uuid();

		await unitOfWork.run(async ({ pages }) => {
			await pages.save(page(id, "Programming"));
		});

		const stored = await readOnlyScope(db).pages.findById(toFolderId(id));

		expect(stored?.name).toBe("Programming");
		expect(stored?.parentId).toBeUndefined();
	});

	test("keeps a parent and lists its children in name order", async () => {
		const unitOfWork = createPostgresUnitOfWork(db);
		const root = uuid();
		const first = uuid();
		const second = uuid();

		await unitOfWork.run(async ({ pages }) => {
			await pages.save(page(root, "Books"));
			await pages.save(page(second, "Zebra", root));
			await pages.save(page(first, "Alpha", root));
		});

		const children = await readOnlyScope(db).pages.listChildren(
			toFolderId(root),
		);

		expect(children.map((child) => child.name)).toEqual(["Alpha", "Zebra"]);
	});

	test("walks ancestors from the leaf up", async () => {
		const unitOfWork = createPostgresUnitOfWork(db);
		const top = uuid();
		const middle = uuid();
		const leaf = uuid();

		await unitOfWork.run(async ({ pages }) => {
			await pages.save(page(top, "Programming"));
			await pages.save(page(middle, "Books", top));
			await pages.save(page(leaf, "DDIA", middle));
		});

		const ancestors = await readOnlyScope(db).pages.listAncestors(
			toFolderId(leaf),
		);

		expect(ancestors.map((entry) => entry.name)).toEqual([
			"Programming",
			"Books",
		]);
	});

	test("updates a page in place on rename", async () => {
		const unitOfWork = createPostgresUnitOfWork(db);
		const id = uuid();

		await unitOfWork.run(async ({ pages }) => {
			await pages.save(page(id, "Programing"));
		});

		await unitOfWork.run(async ({ pages }) => {
			const stored = await pages.findById(toFolderId(id));

			if (stored === undefined) {
				throw new Error("the page vanished");
			}

			await pages.save(renameFolder(stored, "Programming", at));
		});

		const all = await readOnlyScope(db).pages.listAll();

		expect(all).toHaveLength(1);
		expect(all[0]?.name).toBe("Programming");
	});

	test("counts quizzes filed under a page, by status", async () => {
		const unitOfWork = createPostgresUnitOfWork(db);
		const id = uuid();

		await unitOfWork.run(async ({ pages }) => {
			await pages.save(page(id, "Books"));
		});

		for (const status of ["published", "draft"]) {
			await harness.client`
				insert into quizzes (id, page_id, title, language, status)
				values (${uuid()}::uuid, ${id}::uuid, ${status}::text, 'en'::text, ${status}::text)
			`;
		}

		const scope = readOnlyScope(db);

		expect(await scope.pages.countQuizzesIn(toFolderId(id))).toBe(2);
		expect(
			await scope.pages.countQuizzesIn(toFolderId(id), ["published"]),
		).toBe(1);
	});

	test("rolls the whole boundary back when the operation throws", async () => {
		const unitOfWork = createPostgresUnitOfWork(db);
		const first = uuid();
		const second = uuid();

		await expect(
			unitOfWork.run(async ({ pages }) => {
				await pages.save(page(first, "Kept"));
				await pages.save(page(second, "Lost", first));

				throw new Error("give it all back");
			}),
		).rejects.toThrow("give it all back");

		expect(await readOnlyScope(db).pages.listAll()).toEqual([]);
	});

	test("refuses two children of the same parent with one slug", async () => {
		const unitOfWork = createPostgresUnitOfWork(db);
		const root = uuid();

		await unitOfWork.run(async ({ pages }) => {
			await pages.save(page(root, "Books"));
			await pages.save(page(uuid(), "Chapter One", root));
		});

		let reported = "";

		try {
			await unitOfWork.run(async ({ pages }) => {
				await pages.save(page(uuid(), "chapter one", root));
			});
		} catch (error) {
			// drizzle wraps the driver error, so the constraint name is on the cause
			const failure = error as Error & { cause?: Error };

			reported = `${failure.message} ${failure.cause?.message ?? ""}`;
		}

		expect(reported).toContain("pages_parent_slug_unique");
	});

	test("deletes a page", async () => {
		const unitOfWork = createPostgresUnitOfWork(db);
		const id = uuid();

		await unitOfWork.run(async ({ pages }) => {
			await pages.save(page(id, "Temporary"));
		});

		await unitOfWork.run(async ({ pages }) => {
			await pages.delete(toFolderId(id));
		});

		expect(await readOnlyScope(db).pages.listAll()).toEqual([]);
	});
});
