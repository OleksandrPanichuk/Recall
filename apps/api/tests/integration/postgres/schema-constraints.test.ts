import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

let harness: PostgresHarness;

const uuid = (): string => crypto.randomUUID();

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("schema");

	await applyMigration(harness);
});

afterAll(async () => {
	if (available) {
		await harness.close();
	}
});

const insertPage = (id: string, slug: string, parentId: string | null) =>
	harness.client`
		insert into pages (id, parent_id, title, slug)
		values (${id}, ${parentId}, ${slug}, ${slug})
	`;

// postgres.js queries are lazy thenables, and expect().rejects never settles
// against them under bun test. Forcing them through catch() does.
const failureOf = async (run: () => PromiseLike<unknown>): Promise<Error> => {
	try {
		await run();
	} catch (error) {
		return error as Error;
	}

	throw new Error("the statement was expected to fail, and did not");
};

describe.skipIf(!available)("the postgres schema", () => {
	test("refuses two root pages with the same slug", async () => {
		await insertPage(uuid(), "programming", null);

		const failure = await failureOf(() =>
			insertPage(uuid(), "programming", null),
		);

		expect(failure.message).toContain("pages_parent_slug_unique");
	});

	test("allows the same slug under different parents", async () => {
		const first = uuid();
		const second = uuid();

		await insertPage(first, "books-a", null);
		await insertPage(second, "books-b", null);

		await insertPage(uuid(), "chapter-1", first);

		expect(await insertPage(uuid(), "chapter-1", second)).toBeDefined();
	});

	test("refuses a second owner-wide settings row", async () => {
		const settings = (id: string) => harness.client`
			insert into study_settings
				(id, scope_type, scope_id, intervals_days, max_interval_days, max_repetitions)
			values (${id}, 'owner', null, '{1,3,7}', 90, 5)
		`;

		await settings(uuid());

		const failure = await failureOf(() => settings(uuid()));

		expect(failure.message).toContain("study_settings_scope_unique");
	});

	test("refuses a hard delete of a question that has answers", async () => {
		const quizId = uuid();
		const questionId = uuid();
		const attemptId = uuid();

		await harness.client`
			insert into quizzes (id, title, language, status)
			values (${quizId}, 'Replication', 'en', 'published')
		`;
		await harness.client`
			insert into questions (id, quiz_id, type, prompt, difficulty, position, fingerprint)
			values (${questionId}, ${quizId}, 'single_choice', 'Why replicate?', 'medium', 0, 'fp-1')
		`;
		await harness.client`
			insert into attempts (id, quiz_id, mode, status, started_at)
			values (${attemptId}, ${quizId}, 'full', 'completed', now())
		`;
		await harness.client`
			insert into responses (attempt_id, question_id, selected_option_ids, is_correct, answered_at)
			values (${attemptId}, ${questionId}, '{}', true, now())
		`;

		const failure = await failureOf(
			() => harness.client`delete from questions where id = ${questionId}`,
		);

		expect(failure.message).toContain("violates foreign key constraint");
	});

	test("stores selected options as a real uuid array", async () => {
		const rows = await harness.client<{ kind: string }[]>`
			select data_type as kind from information_schema.columns
			where table_schema = ${harness.schema}
			  and table_name = 'responses' and column_name = 'selected_option_ids'
		`;

		expect(rows[0]?.kind).toBe("ARRAY");
	});

	test("keeps timestamps in a zone-aware type", async () => {
		const rows = await harness.client<{ kind: string }[]>`
			select data_type as kind from information_schema.columns
			where table_schema = ${harness.schema}
			  and table_name = 'attempts' and column_name = 'started_at'
		`;

		expect(rows[0]?.kind).toBe("timestamp with time zone");
	});
});
