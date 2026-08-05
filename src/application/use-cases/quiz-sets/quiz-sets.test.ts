import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestContext,
	type TestContext,
} from "@tests/fixtures/application.fixture";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import {
	type QuizSetId,
	QuizSetStatus,
	toQuizSetId,
} from "@/domain/quiz-set/quiz-set";
import {
	DuplicateQuestionError,
	EmptyQuizSetError,
	QuestionValidationError,
	QuizSetTransitionError,
	QuizSetValidationError,
} from "@/domain/quiz-set/quiz-set.errors";
import {
	AddQuestions,
	EmptyQuestionBatchError,
	MAX_QUESTIONS_PER_BATCH,
	QuestionBatchTooLargeError,
	type QuestionInput,
} from "./add-questions";
import { ArchiveQuizSet } from "./archive-quiz-set";
import { CreateQuizSet } from "./create-quiz-set";
import { PublishQuizSet } from "./publish-quiz-set";
import { QuizSetNotFoundError, UpdateQuizSet } from "./update-quiz-set";

let context: TestContext;
let create: CreateQuizSet;
let update: UpdateQuizSet;
let add: AddQuestions;
let publish: PublishQuizSet;
let archive: ArchiveQuizSet;

beforeEach(() => {
	context = createTestContext();
	create = new CreateQuizSet(context);
	update = new UpdateQuizSet(context);
	add = new AddQuestions(context);
	publish = new PublishQuizSet(context);
	archive = new ArchiveQuizSet(context);
});

afterEach(() => {
	context.close();
});

const aQuestionInput = (
	overrides: Partial<QuestionInput> = {},
): QuestionInput => ({
	type: QuestionType.SingleChoice,
	prompt: "What does WAL stand for?",
	difficulty: Difficulty.Medium,
	options: [
		{ text: "Write-ahead log", isCorrect: true },
		{ text: "Weekly audit log", isCorrect: false },
	],
	...overrides,
});

const anotherQuestionInput = (): QuestionInput =>
	aQuestionInput({ prompt: "What does PRAGMA foreign_keys do?" });

const newDraft = async (): Promise<QuizSetId> => {
	const { quizSetId } = await create.execute({
		title: "Bun persistence",
		language: "uk",
	});

	return quizSetId;
};

const newPublished = async (): Promise<QuizSetId> => {
	const quizSetId = await newDraft();

	await add.execute({ quizSetId, questions: [aQuestionInput()] });
	await publish.execute({ quizSetId });

	return quizSetId;
};

describe("CreateQuizSet", () => {
	test("stores a draft and returns its id", async () => {
		const quizSetId = await newDraft();
		const stored = context.quizSets.findById(quizSetId);

		expect(String(quizSetId)).toBe("id-1");
		expect(stored?.title).toBe("Bun persistence");
		expect(stored?.status).toBe(QuizSetStatus.Draft);
		expect(stored?.questions).toHaveLength(0);
	});

	test("stamps the timestamps from the clock", async () => {
		context.clock.set(new Date("2026-08-04T09:00:00.000Z"));

		const stored = context.quizSets.findById(await newDraft());

		expect(stored?.createdAt.toISOString()).toBe("2026-08-04T09:00:00.000Z");
		expect(stored?.updatedAt.toISOString()).toBe("2026-08-04T09:00:00.000Z");
	});

	test("keeps and normalises the optional metadata", async () => {
		const { quizSetId } = await create.execute({
			title: "Bun persistence",
			language: "uk",
			description: "Drills",
			source: "DDIA",
			sourceChapters: "1-3",
			tags: ["bun", "bun", " sqlite "],
		});
		const stored = context.quizSets.findById(quizSetId);

		expect(stored?.description).toBe("Drills");
		expect(stored?.source).toBe("DDIA");
		expect(stored?.tags).toEqual(["bun", "sqlite"]);
	});

	test("rejects an empty title and stores nothing", async () => {
		await expect(
			create.execute({ title: "   ", language: "uk" }),
		).rejects.toThrow(QuizSetValidationError);
		expect(context.quizSets.list()).toEqual([]);
	});
});

describe("UpdateQuizSet", () => {
	test("changes only the fields it was given", async () => {
		const quizSetId = await newDraft();
		context.clock.advance(60_000);

		await update.execute({ quizSetId, title: "Renamed" });
		const stored = context.quizSets.findById(quizSetId);

		expect(stored?.title).toBe("Renamed");
		expect(stored?.language).toBe("uk");
		expect(stored?.updatedAt.toISOString()).toBe("2026-08-01T10:01:00.000Z");
	});

	test("rejects an unknown set", async () => {
		await expect(
			update.execute({ quizSetId: toQuizSetId("missing"), title: "Renamed" }),
		).rejects.toThrow(QuizSetNotFoundError);
	});

	test("refuses to edit published content", async () => {
		const quizSetId = await newPublished();
		context.clock.advance(60_000);

		await expect(
			update.execute({ quizSetId, title: "Renamed" }),
		).rejects.toThrow(QuizSetTransitionError);
		expect(context.quizSets.findById(quizSetId)?.title).toBe("Bun persistence");
	});
});

describe("AddQuestions", () => {
	test("adds a batch in order with generated ids", async () => {
		const quizSetId = await newDraft();

		const result = await add.execute({
			quizSetId,
			questions: [aQuestionInput(), anotherQuestionInput()],
		});
		const stored = context.quizSets.findById(quizSetId);

		expect(result.alreadyPresent).toBe(false);
		expect(result.addedQuestionIds).toHaveLength(2);
		expect(stored?.questions.map((question) => question.position)).toEqual([
			0, 1,
		]);
		expect(stored?.questions[0]?.prompt).toBe("What does WAL stand for?");
		expect(
			stored?.questions[0]?.options.map((option) => option.position),
		).toEqual([0, 1]);
	});

	test("a second batch appends rather than replacing", async () => {
		const quizSetId = await newDraft();
		await add.execute({ quizSetId, questions: [aQuestionInput()] });

		await add.execute({ quizSetId, questions: [anotherQuestionInput()] });

		expect(
			context.quizSets.findById(quizSetId)?.questions.map((q) => q.position),
		).toEqual([0, 1]);
	});

	test("replaying an identical batch is a no-op", async () => {
		const quizSetId = await newDraft();
		await add.execute({ quizSetId, questions: [aQuestionInput()] });
		const before = context.quizSets.findById(quizSetId);
		context.clock.advance(60_000);

		const result = await add.execute({
			quizSetId,
			questions: [aQuestionInput()],
		});
		const after = context.quizSets.findById(quizSetId);

		expect(result).toEqual({ addedQuestionIds: [], alreadyPresent: true });
		expect(after?.questions).toHaveLength(1);
		expect(after?.updatedAt).toEqual(before?.updatedAt as Date);
	});

	test("a partially overlapping batch is a conflict and changes nothing", async () => {
		const quizSetId = await newDraft();
		await add.execute({ quizSetId, questions: [aQuestionInput()] });
		const before = context.quizSets.findById(quizSetId);
		context.clock.advance(60_000);

		await expect(
			add.execute({
				quizSetId,
				questions: [aQuestionInput(), anotherQuestionInput()],
			}),
		).rejects.toThrow(DuplicateQuestionError);

		const after = context.quizSets.findById(quizSetId);

		expect(after?.questions).toHaveLength(1);
		expect(after?.updatedAt).toEqual(before?.updatedAt as Date);
	});

	test.each([
		[
			"single_choice with two correct options",
			aQuestionInput({
				options: [
					{ text: "Write-ahead log", isCorrect: true },
					{ text: "Weekly audit log", isCorrect: true },
				],
			}),
		],
		[
			"single_choice with no correct option",
			aQuestionInput({
				options: [
					{ text: "Write-ahead log", isCorrect: false },
					{ text: "Weekly audit log", isCorrect: false },
				],
			}),
		],
		[
			"multiple_choice with no correct option",
			aQuestionInput({
				type: QuestionType.MultipleChoice,
				options: [
					{ text: "Write-ahead log", isCorrect: false },
					{ text: "Weekly audit log", isCorrect: false },
				],
			}),
		],
		[
			"true_false with three options",
			aQuestionInput({
				type: QuestionType.TrueFalse,
				options: [
					{ text: "True", isCorrect: true },
					{ text: "False", isCorrect: false },
					{ text: "Maybe", isCorrect: false },
				],
			}),
		],
	])("rejects a %s and stores nothing", async (_name, question) => {
		const quizSetId = await newDraft();

		await expect(
			add.execute({ quizSetId, questions: [question] }),
		).rejects.toThrow(QuestionValidationError);
		expect(context.quizSets.findById(quizSetId)?.questions).toHaveLength(0);
	});

	test("rejects an unknown set", async () => {
		await expect(
			add.execute({
				quizSetId: toQuizSetId("missing"),
				questions: [aQuestionInput()],
			}),
		).rejects.toThrow(QuizSetNotFoundError);
	});

	test("refuses to add to a published set", async () => {
		const quizSetId = await newPublished();

		await expect(
			add.execute({ quizSetId, questions: [anotherQuestionInput()] }),
		).rejects.toThrow(QuizSetTransitionError);
	});

	test("rejects an empty batch", async () => {
		await expect(
			add.execute({ quizSetId: await newDraft(), questions: [] }),
		).rejects.toThrow(EmptyQuestionBatchError);
	});

	test("rejects a batch over the limit and stores nothing", async () => {
		const quizSetId = await newDraft();
		const questions = Array.from(
			{ length: MAX_QUESTIONS_PER_BATCH + 1 },
			(_value, index) => aQuestionInput({ prompt: `Question ${index}` }),
		);

		await expect(add.execute({ quizSetId, questions })).rejects.toThrow(
			QuestionBatchTooLargeError,
		);
		expect(context.quizSets.findById(quizSetId)?.questions).toHaveLength(0);
	});
});

describe("PublishQuizSet", () => {
	test("publishes a draft that has questions", async () => {
		const quizSetId = await newPublished();
		const stored = context.quizSets.findById(quizSetId);

		expect(stored?.status).toBe(QuizSetStatus.Published);
		expect(stored?.publishedAt).toBeDefined();
	});

	test("publishing again keeps the original timestamp", async () => {
		const quizSetId = await newPublished();
		const first = context.quizSets.findById(quizSetId)?.publishedAt;
		context.clock.advance(60_000);

		await publish.execute({ quizSetId });

		expect(context.quizSets.findById(quizSetId)?.publishedAt).toEqual(
			first as Date,
		);
	});

	test("refuses a set with no questions", async () => {
		const quizSetId = await newDraft();

		await expect(publish.execute({ quizSetId })).rejects.toThrow(
			EmptyQuizSetError,
		);
		expect(context.quizSets.findById(quizSetId)?.status).toBe(
			QuizSetStatus.Draft,
		);
	});

	test("rejects an unknown set", async () => {
		await expect(
			publish.execute({ quizSetId: toQuizSetId("missing") }),
		).rejects.toThrow(QuizSetNotFoundError);
	});
});

describe("ArchiveQuizSet", () => {
	test("archives a published set and keeps publishedAt", async () => {
		const quizSetId = await newPublished();
		const publishedAt = context.quizSets.findById(quizSetId)?.publishedAt;
		context.clock.advance(60_000);

		await archive.execute({ quizSetId });
		const stored = context.quizSets.findById(quizSetId);

		expect(stored?.status).toBe(QuizSetStatus.Archived);
		expect(stored?.publishedAt).toEqual(publishedAt as Date);
	});

	test("archiving again keeps the original timestamp", async () => {
		const quizSetId = await newPublished();
		await archive.execute({ quizSetId });
		const first = context.quizSets.findById(quizSetId)?.archivedAt;
		context.clock.advance(60_000);

		await archive.execute({ quizSetId });

		expect(context.quizSets.findById(quizSetId)?.archivedAt).toEqual(
			first as Date,
		);
	});

	test("rejects an unknown set", async () => {
		await expect(
			archive.execute({ quizSetId: toQuizSetId("missing") }),
		).rejects.toThrow(QuizSetNotFoundError);
	});
});
