import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QuestionType, toQuestionId } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { QuestionValidationError } from "@/domain/quiz-set/quiz-set.errors";
import {
	anotherQuestionInput,
	aQuestionInput,
	createQuizSetsHarness,
	type QuizSetsHarness,
} from "./quiz-sets.fixture";
import { QuestionNotFoundError, UpdateQuestion } from "./update-question";
import { QuizSetNotFoundError } from "./update-quiz-set";

let harness: QuizSetsHarness;
let update: UpdateQuestion;

beforeEach(() => {
	harness = createQuizSetsHarness();
	update = new UpdateQuestion(harness.context);
});

afterEach(() => {
	harness.context.close();
});

const firstQuestionOf = (quizSetId: ReturnType<typeof toQuizSetId>) => {
	const question = harness.context.quizSets.findById(quizSetId)?.questions[0];

	if (question === undefined) {
		throw new Error("the set has no questions");
	}

	return question;
};

describe("UpdateQuestion", () => {
	test("fixes a prompt on a published set", async () => {
		const quizSetId = await harness.newPublished();
		const before = firstQuestionOf(quizSetId);

		await update.execute({
			quizSetId,
			questionId: before.id,
			prompt: "What does WAL actually stand for?",
		});

		const after = firstQuestionOf(quizSetId);

		expect(after.prompt).toBe("What does WAL actually stand for?");
		expect(String(after.id)).toBe(String(before.id));
	});

	test("keeps the fields it was not given", async () => {
		const quizSetId = await harness.newPublished();
		const before = firstQuestionOf(quizSetId);

		await update.execute({
			quizSetId,
			questionId: before.id,
			prompt: "Reworded",
		});

		const after = firstQuestionOf(quizSetId);

		expect(after.difficulty).toBe(before.difficulty);
		expect(after.options.map((option) => option.text)).toEqual(
			before.options.map((option) => option.text),
		);
	});

	test("adds a synonym to a typed answer without touching the first one", async () => {
		const quizSetId = await harness.newDraft();
		await harness.add.execute({
			quizSetId,
			questions: [
				aQuestionInput({
					type: QuestionType.TypedAnswer,
					prompt: "zip",
					options: [{ text: "блискавка", isCorrect: true }],
				}),
			],
		});
		const before = firstQuestionOf(quizSetId);

		await update.execute({
			quizSetId,
			questionId: before.id,
			options: [
				{ text: "блискавка", isCorrect: true },
				{ text: "змійка", isCorrect: true },
				{ text: "повзунок", isCorrect: true },
			],
		});

		const after = firstQuestionOf(quizSetId);

		expect(after.options.map((option) => option.text)).toEqual([
			"блискавка",
			"змійка",
			"повзунок",
		]);
		expect(String(after.id)).toBe(String(before.id));
	});

	test("still refuses answers the question type does not allow", async () => {
		const quizSetId = await harness.newPublished();
		const question = firstQuestionOf(quizSetId);

		await expect(
			update.execute({
				quizSetId,
				questionId: question.id,
				options: [
					{ text: "One", isCorrect: true },
					{ text: "Two", isCorrect: true },
				],
			}),
		).rejects.toThrow(QuestionValidationError);
	});

	test("refuses a rewording that duplicates another question", async () => {
		const quizSetId = await harness.newDraft();
		await harness.add.execute({
			quizSetId,
			questions: [aQuestionInput(), anotherQuestionInput()],
		});

		const [first, second] = harness.context.quizSets.findById(quizSetId)
			?.questions as [
			ReturnType<typeof firstQuestionOf>,
			ReturnType<typeof firstQuestionOf>,
		];

		await expect(
			update.execute({
				quizSetId,
				questionId: second.id,
				prompt: first.prompt,
			}),
		).rejects.toThrow();
	});

	test("refuses an archived set", async () => {
		const quizSetId = await harness.newPublished();
		const question = firstQuestionOf(quizSetId);
		await harness.archive.execute({ quizSetId });

		await expect(
			update.execute({ quizSetId, questionId: question.id, prompt: "Nope" }),
		).rejects.toThrow();
	});

	test("refuses a question that is not in the set", async () => {
		const quizSetId = await harness.newPublished();

		await expect(
			update.execute({
				quizSetId,
				questionId: toQuestionId("missing"),
				prompt: "Nope",
			}),
		).rejects.toThrow(QuestionNotFoundError);
	});

	test("refuses a set that does not exist", async () => {
		await expect(
			update.execute({
				quizSetId: toQuizSetId("missing"),
				questionId: toQuestionId("missing"),
				prompt: "Nope",
			}),
		).rejects.toThrow(QuizSetNotFoundError);
	});

	test("cannot change the type of a question", async () => {
		const quizSetId = await harness.newPublished();
		const question = firstQuestionOf(quizSetId);

		await update.execute({
			quizSetId,
			questionId: question.id,
			prompt: "Still single choice",
		});

		expect(firstQuestionOf(quizSetId).type).toBe(QuestionType.SingleChoice);
	});
});
