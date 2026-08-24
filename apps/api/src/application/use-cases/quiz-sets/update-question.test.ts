import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AnswerQuestionUseCase } from "@/application/use-cases/attempts/answer-question";
import { FinishQuizAttemptUseCase } from "@/application/use-cases/attempts/finish-quiz-attempt";
import { StartQuizAttemptUseCase } from "@/application/use-cases/attempts/start-quiz-attempt";
import { GetAttemptDetailUseCase } from "@/application/use-cases/statistics/get-attempt-detail";
import { QuestionType, toQuestionId } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { QuestionValidationError } from "@/domain/quiz-set/quiz-set.errors";
import {
	anotherQuestionInput,
	aQuestionInput,
	createQuizSetsHarness,
	type QuizSetsHarness,
} from "./quiz-sets.fixture";
import {
	QuestionNotFoundError,
	UpdateQuestionUseCase,
} from "./update-question";
import { QuizSetNotFoundError } from "./update-quiz-set";

let harness: QuizSetsHarness;
let update: UpdateQuestionUseCase;

beforeEach(() => {
	harness = createQuizSetsHarness();
	update = new UpdateQuestionUseCase(harness.context);
});

afterEach(() => {
	harness.context.close();
});

const firstQuestionOf = async (quizSetId: ReturnType<typeof toQuizSetId>) => {
	const question = (await harness.context.scope.quizzes.findById(quizSetId))
		?.questions[0];

	if (question === undefined) {
		throw new Error("the set has no questions");
	}

	return question;
};

describe("UpdateQuestionUseCase", () => {
	test("fixes a prompt on a published set", async () => {
		const quizSetId = await harness.newPublished();
		const before = await firstQuestionOf(quizSetId);

		await update.execute({
			quizSetId,
			questionId: before.id,
			prompt: "What does WAL actually stand for?",
		});

		const after = await firstQuestionOf(quizSetId);

		expect(after.prompt).toBe("What does WAL actually stand for?");
		expect(String(after.id)).toBe(String(before.id));
	});

	test("keeps the fields it was not given", async () => {
		const quizSetId = await harness.newPublished();
		const before = await firstQuestionOf(quizSetId);

		await update.execute({
			quizSetId,
			questionId: before.id,
			prompt: "Reworded",
		});

		const after = await firstQuestionOf(quizSetId);

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
		const before = await firstQuestionOf(quizSetId);

		await update.execute({
			quizSetId,
			questionId: before.id,
			options: [
				{ text: "блискавка", isCorrect: true },
				{ text: "змійка", isCorrect: true },
				{ text: "повзунок", isCorrect: true },
			],
		});

		const after = await firstQuestionOf(quizSetId);

		expect(after.options.map((option) => option.text)).toEqual([
			"блискавка",
			"змійка",
			"повзунок",
		]);
		expect(String(after.id)).toBe(String(before.id));
	});

	test("still refuses answers the question type does not allow", async () => {
		const quizSetId = await harness.newPublished();
		const question = await firstQuestionOf(quizSetId);

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

		const [first, second] = (
			await harness.context.scope.quizzes.findById(quizSetId)
		)?.questions as [
			Awaited<ReturnType<typeof firstQuestionOf>>,
			Awaited<ReturnType<typeof firstQuestionOf>>,
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
		const question = await firstQuestionOf(quizSetId);
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
		const question = await firstQuestionOf(quizSetId);

		await update.execute({
			quizSetId,
			questionId: question.id,
			prompt: "Still single choice",
		});

		expect((await firstQuestionOf(quizSetId)).type).toBe(
			QuestionType.SingleChoice,
		);
	});
	test("keeps option ids stable when the options are rewritten", async () => {
		const quizSetId = await harness.newPublished();
		const before = await firstQuestionOf(quizSetId);

		await update.execute({
			quizSetId,
			questionId: before.id,
			options: [
				{ text: "Write-ahead logging", isCorrect: true },
				{ text: "Weekly audit log", isCorrect: false },
			],
		});

		const after = await firstQuestionOf(quizSetId);

		expect(after.options.map((option) => String(option.id))).toEqual(
			before.options.map((option) => String(option.id)),
		);
		expect(after.options[0]?.text).toBe("Write-ahead logging");
	});

	test("leaves a finished attempt still able to name what was chosen", async () => {
		const user = 42;
		const quizSetId = await harness.newPublished();
		const question = await firstQuestionOf(quizSetId);
		const wrong = question.options.find((option) => !option.isCorrect);

		if (wrong === undefined) {
			throw new Error("the fixture has no incorrect option");
		}

		const start = new StartQuizAttemptUseCase(harness.context);
		const answer = new AnswerQuestionUseCase(harness.context);
		const finish = new FinishQuizAttemptUseCase(harness.context);
		const detail = new GetAttemptDetailUseCase(harness.context);

		const { attemptId } = await start.execute({
			quizSetId,
			telegramUserId: user,
		});

		await answer.execute({
			telegramUserId: user,
			questionId: question.id,
			selectedOptionPositions: [wrong.position],
		});

		await finish.execute({ telegramUserId: user });

		await update.execute({
			quizSetId,
			questionId: question.id,
			options: [
				{ text: "Write-ahead logging", isCorrect: true },
				{ text: "Weekly audit log", isCorrect: false },
			],
		});

		const reviewed = await detail.execute({ attemptId, telegramUserId: user });
		const answered = reviewed.answers.find(
			(entry) => String(entry.question.id) === String(question.id),
		);

		expect(answered?.selectedOptionIds.length).toBe(1);

		const resolved = answered?.selectedOptionIds.map((id) =>
			answered.question.options.find((option) => option.id === id),
		);

		expect(resolved?.every((option) => option !== undefined)).toBe(true);
	});
});
