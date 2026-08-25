import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { OwnerId } from "@/application/ports/owner";
import {
	migrateSqliteToPostgres,
	uuidFor,
	verifyMigration,
} from "@/persistence/postgres/etl";
import { seedLegacyDatabase } from "../../fixtures/legacy-sqlite";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedOwner,
} from "../../fixtures/postgres";
import {
	makeTempDirectory,
	removeTempDirectory,
} from "../../fixtures/temp-dir";

const available = await postgresAvailable();

let harness: PostgresHarness;
let owner: OwnerId;
let directory: string;
let sqlitePath: string;
let quizSetId: string;

const applySchema = (): Promise<void> => applyMigration(harness);

beforeAll(async () => {
	if (!available) {
		return;
	}

	directory = makeTempDirectory("recall-etl-");
	sqlitePath = join(directory, "quiz.sqlite");
	quizSetId = seedLegacyDatabase(sqlitePath).quizSetId;

	harness = await openPostgres("etl");
	await applySchema();
	owner = await seedOwner(harness, "etl owner");
	await migrateSqliteToPostgres({ sqlitePath, client: harness.client, owner });
});

afterAll(async () => {
	await harness?.close();

	if (directory !== undefined) {
		removeTempDirectory(directory);
	}
});

describe.skipIf(!available)("the sqlite to postgres migration", () => {
	test("verifies clean against its source", async () => {
		const issues = await verifyMigration({
			sqlitePath,
			client: harness.client,
		});

		expect(issues).toEqual([]);
	});

	test("keeps the folder tree, with parents before children", async () => {
		const rows = await harness.client<
			{ title: string; parent: string | null }[]
		>`
			select p.title, parent.title as parent
			from pages p left join pages parent on parent.id = p.parent_id
			order by p.title
		`;

		expect([...rows]).toEqual([
			{ title: "Books", parent: "Programming" },
			{ title: "Programming", parent: null },
		]);
	});

	test("maps the quiz onto its page and keeps tags as an array", async () => {
		const rows = await harness.client<
			{ title: string; tags: string[]; page: string }[]
		>`
			select q.title, q.tags, p.title as page
			from quizzes q join pages p on p.id = q.page_id
		`;

		expect(rows[0]?.tags).toEqual(["systems", "storage"]);
		expect(rows[0]?.page).toBe("Books");
	});

	test("derives ids deterministically from the legacy id", async () => {
		const rows = await harness.client<{ id: string }[]>`
			select id::text as id from quizzes where legacy_id = ${quizSetId}
		`;

		expect(rows[0]?.id).toBe(uuidFor("quiz", quizSetId));
	});

	test("records which term pair generated a question, and in which direction", async () => {
		const rows = await harness.client<{ direction: string; term: string }[]>`
			select s.direction, t.terms[1] as term
			from question_sources s join term_pairs t on t.id = s.term_pair_id
			order by s.direction
		`;

		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.direction).sort()).toEqual([
			"term_to_translation",
			"translation_to_term",
		]);
		expect(rows.every((row) => row.term === "shard")).toBe(true);
	});

	test("normalises the attempt question list into rows", async () => {
		const rows = await harness.client<{ n: number }[]>`
			select count(*)::int as n from attempt_questions
		`;

		expect(rows[0]?.n).toBeGreaterThan(0);
	});

	test("is idempotent", async () => {
		const before = await harness.client<{ n: number }[]>`
			select count(*)::int as n from questions
		`;

		await migrateSqliteToPostgres({
			sqlitePath,
			client: harness.client,
			owner,
		});

		const after = await harness.client<{ n: number }[]>`
			select count(*)::int as n from questions
		`;

		expect(after[0]?.n).toBe(before[0]?.n);
	});
});
