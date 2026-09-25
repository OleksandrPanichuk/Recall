import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { scopeFor } from "@tests/fixtures/postgres-scope";
import { drizzle } from "drizzle-orm/postgres-js";
import type { OwnerId } from "@/core/owner";
import type { RecallDatabase } from "@/db/client";
import { DatabaseHandle } from "@/db/connection";
import * as schema from "@/db/schema";
import {
	BrowseFolderUseCase,
	ListPageTreeUseCase,
	PageEntity,
	PagesService,
	toPageId,
} from "@/modules/pages";
import {
	createQuestion,
	Difficulty,
	ListQuestionsUseCase,
	QuestionType,
	QuizSetEntity,
	type QuizSetId,
	toQuestionId,
	toQuestionOptionId,
	toQuizSetId,
} from "@/modules/quizzes";
import {
	ListDueRepetitionsUseCase,
	ListLeechesUseCase,
	PostgresSchedulesRepository,
} from "@/modules/scheduling";
import { FixedOwnerContext } from "@/shared/request-context";
import {
	applyMigration,
	openPostgres,
	type PostgresHarness,
	postgresAvailable,
	seedOwner,
} from "../../fixtures/postgres";

const available = await postgresAvailable();

const PAGES = 40;
const SETS_PER_PAGE = 3;
const QUESTIONS_PER_SET = 5;
const LARGE_SET = 200;

const at = new Date("2026-08-01T10:00:00.000Z");
const later = new Date("2026-08-02T10:00:00.000Z");
const uuid = (): string => crypto.randomUUID();

let harness: PostgresHarness;
let owner: OwnerId;
let queries = 0;
let counted: RecallDatabase;
let plain: RecallDatabase;
let rootId: string;
let largeSetId: QuizSetId;

const question = (prompt: string, position: number) =>
	createQuestion({
		id: toQuestionId(uuid()),
		type: QuestionType.SingleChoice,
		prompt,
		difficulty: Difficulty.Medium,
		position,
		options: [
			{
				id: toQuestionOptionId(uuid()),
				text: `Right for ${prompt}`,
				isCorrect: true,
				position: 0,
			},
			{
				id: toQuestionOptionId(uuid()),
				text: `Wrong for ${prompt}`,
				isCorrect: false,
				position: 1,
			},
		],
	});

const setOf = (title: string, size: number, pageId?: string) =>
	QuizSetEntity.publish(
		QuizSetEntity.addQuestions(
			QuizSetEntity.moveToPage(
				QuizSetEntity.create({
					id: toQuizSetId(uuid()),
					title,
					language: "en",
					createdAt: at,
				}),
				pageId === undefined ? undefined : toPageId(pageId),
				at,
			),
			Array.from({ length: size }, (_, index) =>
				question(`${title} question ${index}`, index),
			),
			at,
		),
		at,
	);

const repositories = (db: RecallDatabase) => {
	const scope = scopeFor(db, owner);

	return {
		pages: scope.pages,
		quizzes: scope.quizzes,
		schedules: new PostgresSchedulesRepository(
			new DatabaseHandle(db),
			new FixedOwnerContext(owner),
		),
	};
};

const countQueries = async (operation: () => Promise<unknown>) => {
	queries = 0;
	await operation();

	return queries;
};

beforeAll(async () => {
	if (!available) {
		return;
	}

	harness = await openPostgres("read_paths");
	await applyMigration(harness);
	owner = await seedOwner(harness, "read paths owner");
	plain = drizzle({ client: harness.client, schema });
	counted = drizzle({
		client: harness.client,
		schema,
		logger: {
			logQuery: () => {
				queries += 1;
			},
		},
	});

	const { pages, quizzes, schedules } = repositories(plain);

	rootId = uuid();
	await pages.save(
		PageEntity.create({ id: toPageId(rootId), name: "Library", createdAt: at }),
	);

	const dueQuestionIds: string[] = [];

	for (let index = 0; index < PAGES; index += 1) {
		const pageId = uuid();

		await pages.save(
			PageEntity.create({
				id: toPageId(pageId),
				name: `Shelf ${index}`,
				parentId: toPageId(rootId),
				position: index,
				createdAt: at,
			}),
		);

		for (let set = 0; set < SETS_PER_PAGE; set += 1) {
			const quiz = setOf(
				`Shelf ${index} set ${set}`,
				QUESTIONS_PER_SET,
				pageId,
			);

			await quizzes.save(quiz);
			dueQuestionIds.push(String(quiz.questions[0]?.id));
		}
	}

	const large = setOf("Large set", LARGE_SET);

	largeSetId = large.id;
	await quizzes.save(large);

	await schedules.saveSchedules(
		dueQuestionIds.map((id) => ({
			questionId: toQuestionId(id),
			repetitionCount: 1,
			lapses: 5,
			lastCompletedAt: at,
			dueAt: at,
		})),
	);
}, 120_000);

afterAll(async () => {
	await harness?.close();
});

describe.skipIf(!available)("read paths on a large library", () => {
	test("the page tree costs two queries however many pages there are", async () => {
		const { pages } = repositories(counted);
		let tree: Awaited<ReturnType<ListPageTreeUseCase["execute"]>> = [];
		const spent = await countQueries(async () => {
			tree = await new ListPageTreeUseCase(pages).execute();
		});

		expect(tree).toHaveLength(PAGES + 1);
		expect(tree.filter((node) => node.depth === 1)).toHaveLength(PAGES);
		expect(
			tree.every(
				(node) =>
					node.depth === 0 ||
					(node.setCount === SETS_PER_PAGE && node.unpublishedCount === 0),
			),
		).toBe(true);
		expect(spent).toBe(2);
	});

	test("browsing a folder does not count its children one by one", async () => {
		const { pages } = repositories(counted);
		const useCase = new BrowseFolderUseCase(pages, new PagesService(pages));
		let children: readonly { itemCount: number }[] = [];
		const spent = await countQueries(async () => {
			children = (await useCase.execute({ folderId: toPageId(rootId) }))
				.children;
		});

		expect(children).toHaveLength(PAGES);
		expect(children.every((child) => child.itemCount === SETS_PER_PAGE)).toBe(
			true,
		);
		expect(spent).toBeLessThanOrEqual(8);
	});

	test("the due list does not load every set", async () => {
		const { quizzes, schedules } = repositories(counted);
		const useCase = new ListDueRepetitionsUseCase(
			schedules,
			quizzes,
			{ now: () => later },
			{ name: () => "UTC" },
		);
		let due: Awaited<ReturnType<ListDueRepetitionsUseCase["execute"]>> = [];
		const spent = await countQueries(async () => {
			due = await useCase.execute({});
		});

		expect(due).toHaveLength(PAGES * SETS_PER_PAGE);
		expect(due.every((set) => set.dueCount === 1)).toBe(true);
		expect(spent).toBe(2);
	});

	test("the leech list locates its questions in one query", async () => {
		const { quizzes, schedules } = repositories(counted);
		let leeches: Awaited<ReturnType<ListLeechesUseCase["execute"]>> = [];
		const spent = await countQueries(async () => {
			leeches = await new ListLeechesUseCase(schedules, quizzes).execute({});
		});

		expect(leeches).toHaveLength(PAGES * SETS_PER_PAGE);
		expect(spent).toBe(2);
	});

	test("listing every question costs three queries, not three per set", async () => {
		const { quizzes } = repositories(counted);
		let rows: Awaited<ReturnType<ListQuestionsUseCase["execute"]>> = [];
		const spent = await countQueries(async () => {
			rows = await new ListQuestionsUseCase(quizzes).execute({});
		});

		expect(rows).toHaveLength(
			PAGES * SETS_PER_PAGE * QUESTIONS_PER_SET + LARGE_SET,
		);
		expect(rows.every((row) => row.question.options.length === 2)).toBe(true);
		expect(spent).toBe(3);
	});

	test("adding one question to a large set writes that question, not the set", async () => {
		const { quizzes } = repositories(counted);
		const stored = await repositories(plain).quizzes.findById(largeSetId);

		if (stored === undefined) {
			throw new Error("the large set was not saved");
		}

		const spent = await countQueries(() =>
			quizzes.save(
				QuizSetEntity.addQuestions(
					stored,
					[question("One more", LARGE_SET)],
					later,
				),
				0,
			),
		);
		const after = await repositories(plain).quizzes.findById(largeSetId);

		expect(after?.questions).toHaveLength(LARGE_SET + 1);
		expect(after?.questions.slice(0, LARGE_SET)).toEqual([...stored.questions]);
		expect(spent).toBeLessThanOrEqual(7);
	});
});
