import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createApplication } from "@/composition/create-application";
import {
	migrateSqliteToPostgres,
	uuidFor,
	verifyMigration,
} from "@/persistence/postgres/etl";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
} from "../../fixtures/postgres";
import {
	makeTempDirectory,
	removeTempDirectory,
} from "../../fixtures/temp-dir";

const available = await postgresAvailable();

let harness: PostgresHarness;
let directory: string;
let sqlitePath: string;
let quizSetId: string;

const seed = async (): Promise<string> => {
	const application = createApplication({ databasePath: sqlitePath });

	try {
		const folder = await application.ensureFolderPath.execute({
			path: ["Programming", "Books"],
		});

		const { quizSetId: id } = await application.createQuizSet.execute({
			title: "Designing Data-Intensive Applications",
			language: "en",
			tags: ["systems", "storage"],
		});

		await application.moveQuizSet.execute({
			quizSetId: id,
			folderId: folder.folderId,
		});

		await application.addQuestions.execute({
			quizSetId: id,
			questions: [
				{
					type: "single_choice",
					prompt: "What does replication buy?",
					difficulty: "medium",
					topic: "replication",
					options: [
						{ text: "Availability", isCorrect: true },
						{ text: "Smaller disks", isCorrect: false },
					],
				},
				{
					type: "true_false",
					prompt: "An LSM tree writes in place.",
					difficulty: "easy",
					options: [
						{ text: "True", isCorrect: false },
						{ text: "False", isCorrect: true },
					],
				},
			],
		});

		await application.addVocabulary.execute({
			quizSetId: id,
			pairs: [{ term: ["shard"], translation: ["шард"] }],
			directions: ["term_to_translation", "translation_to_term"],
			topic: "partitioning",
		});

		await application.publishQuizSet.execute({ quizSetId: id });

		const { attemptId } = await application.startQuizAttempt.execute({
			quizSetId: id,
			telegramUserId: 7,
		});

		const question = application.getQuizSet
			? (await application.getQuizSet.execute({ quizSetId: id })).questions[0]
			: undefined;

		if (question !== undefined) {
			const correct = question.options.find((option) => option.isCorrect);

			await application.answerQuestion.execute({
				telegramUserId: 7,
				questionId: question.id,
				selectedOptionPositions:
					correct === undefined ? [] : [correct.position],
			});
		}

		await application.finishQuizAttempt.execute({ telegramUserId: 7 });

		void attemptId;

		return String(id);
	} finally {
		application.close();
	}
};

const applySchema = (): Promise<void> => applyMigration(harness);

beforeAll(async () => {
	if (!available) {
		return;
	}

	directory = makeTempDirectory("recall-etl-");
	sqlitePath = join(directory, "quiz.sqlite");
	quizSetId = await seed();

	harness = await openPostgres("etl");
	await applySchema();
	await migrateSqliteToPostgres({ sqlitePath, client: harness.client });
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

		await migrateSqliteToPostgres({ sqlitePath, client: harness.client });

		const after = await harness.client<{ n: number }[]>`
			select count(*)::int as n from questions
		`;

		expect(after[0]?.n).toBe(before[0]?.n);
	});
});
