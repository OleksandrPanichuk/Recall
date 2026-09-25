import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { OwnerId } from "@/core/owner";
import {
	migrateSqliteToPostgres,
	uuidFor,
	verifyMigration,
} from "../../../scripts/etl";
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
			owner,
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

		expect(rows[0]?.id).toBe(uuidFor(owner, "quiz", quizSetId));
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

	test("carries a Telegram id that does not fit in 32 bits", async () => {
		const attempts = await harness.client<{ id: string }[]>`
			select telegram_user_id::text as id from attempts
			where owner_id = ${owner}::text
		`;
		const reviews = await harness.client<{ id: string }[]>`
			select telegram_user_id::text as id from review_states
			where owner_id = ${owner}::text
		`;

		expect(attempts.map((row) => row.id)).toEqual(["8123456789"]);
		expect(reviews.map((row) => row.id)).toEqual(["8123456789"]);
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

describe.skipIf(!available)("two owners importing the same export", () => {
	let second: OwnerId;

	const countsFor = async (who: OwnerId) => {
		const [row] = await harness.client<
			{
				pages: number;
				quizzes: number;
				questions: number;
				options: number;
				attempts: number;
				responses: number;
				reviews: number;
				settings: number;
			}[]
		>`
			select
				(select count(*)::int from pages where owner_id = ${who}::text) as pages,
				(select count(*)::int from quizzes where owner_id = ${who}::text) as quizzes,
				(select count(*)::int from questions where owner_id = ${who}::text) as questions,
				(select count(*)::int from question_options o
					join questions q on q.id = o.question_id
					where q.owner_id = ${who}::text) as options,
				(select count(*)::int from attempts where owner_id = ${who}::text) as attempts,
				(select count(*)::int from responses r
					join attempts a on a.id = r.attempt_id
					where a.owner_id = ${who}::text) as responses,
				(select count(*)::int from review_states where owner_id = ${who}::text) as reviews,
				(select count(*)::int from study_settings where owner_id = ${who}::text) as settings
		`;

		return row;
	};

	beforeAll(async () => {
		if (!available) {
			return;
		}

		second = await seedOwner(harness, "etl second owner");
		await migrateSqliteToPostgres({
			sqlitePath,
			client: harness.client,
			owner: second,
		});
	});

	test("gives the second owner a full copy of their own", async () => {
		const first = await countsFor(owner);

		expect(first?.questions).toBeGreaterThan(0);
		expect(first?.options).toBeGreaterThan(0);
		expect(await countsFor(second)).toEqual(first);
	});

	test("verifies clean for each owner on its own", async () => {
		expect(
			await verifyMigration({ sqlitePath, client: harness.client, owner }),
		).toEqual([]);
		expect(
			await verifyMigration({
				sqlitePath,
				client: harness.client,
				owner: second,
			}),
		).toEqual([]);
	});

	test("derives different ids for the same legacy row under each owner", async () => {
		const rows = await harness.client<{ owner: string; id: string }[]>`
			select owner_id as owner, id::text as id from quizzes
			where legacy_id = ${quizSetId}::text
		`;
		const byOwner = new Map(rows.map((row) => [row.owner, row.id]));

		expect(byOwner.get(owner)).toBe(uuidFor(owner, "quiz", quizSetId));
		expect(byOwner.get(second)).toBe(uuidFor(second, "quiz", quizSetId));
		expect(byOwner.get(owner)).not.toBe(byOwner.get(second));
	});

	test("points every copied row at its own owner's parents", async () => {
		const crossed = await harness.client<{ n: number }[]>`
			select (
				(select count(*) from quizzes q join pages p on p.id = q.page_id
					where p.owner_id <> q.owner_id)
				+ (select count(*) from questions q join quizzes z on z.id = q.quiz_id
					where z.owner_id <> q.owner_id)
				+ (select count(*) from attempts a join quizzes z on z.id = a.quiz_id
					where z.owner_id <> a.owner_id)
				+ (select count(*) from review_states r join questions q on q.id = r.question_id
					where q.owner_id <> r.owner_id)
				+ (select count(*) from responses r
					join attempts a on a.id = r.attempt_id
					join question_options o on o.id = any(r.selected_option_ids)
					join questions q on q.id = o.question_id
					where q.owner_id <> a.owner_id)
				+ (select count(*) from responses r, unnest(r.selected_option_ids) as chosen(id)
					where not exists (select 1 from question_options o where o.id = chosen.id))
			)::int as n
		`;

		const selected = await harness.client<{ n: number }[]>`
			select count(*)::int as n from responses r, unnest(r.selected_option_ids) as chosen(id)
		`;

		expect(selected[0]?.n).toBeGreaterThan(0);
		expect(crossed[0]?.n).toBe(0);
	});

	test("stays idempotent for the second owner", async () => {
		const before = await countsFor(second);

		await migrateSqliteToPostgres({
			sqlitePath,
			client: harness.client,
			owner: second,
		});

		expect(await countsFor(second)).toEqual(before);
	});
});
