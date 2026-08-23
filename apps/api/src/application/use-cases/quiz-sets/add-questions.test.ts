import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { TestContext } from "@tests/fixtures/application.fixture";
import { QuestionType } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	DuplicateQuestionError,
	QuestionValidationError,
	QuizSetTransitionError,
} from "@/domain/quiz-set/quiz-set.errors";
import {
	type AddQuestionsUseCase,
	EmptyQuestionBatchError,
	MAX_QUESTIONS_PER_BATCH,
	QuestionBatchTooLargeError,
} from "./add-questions";
import {
	anotherQuestionInput,
	aQuestionInput,
	createQuizSetsHarness,
	type QuizSetsHarness,
} from "./quiz-sets.fixture";
import { QuizSetNotFoundError } from "./update-quiz-set";

let context: TestContext;
let add: AddQuestionsUseCase;
let newDraft: QuizSetsHarness["newDraft"];
let newPublished: QuizSetsHarness["newPublished"];
let newArchived: QuizSetsHarness["newArchived"];

beforeEach(() => {
	({ context, add, newDraft, newPublished, newArchived } =
		createQuizSetsHarness());
});

afterEach(() => {
	context.close();
});

describe("AddQuestionsUseCase", () => {
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

	test("adds to a published set and keeps the positions contiguous", async () => {
		const quizSetId = await newPublished();

		await add.execute({ quizSetId, questions: [anotherQuestionInput()] });

		const stored = context.quizSets.findById(quizSetId);

		expect(stored?.questions.map((question) => question.position)).toEqual([
			0, 1,
		]);
	});

	test("refuses to add to an archived set", async () => {
		const quizSetId = await newArchived();

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
