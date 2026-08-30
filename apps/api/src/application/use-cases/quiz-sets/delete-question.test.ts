import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { toQuestionId } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { AnswerQuestionUseCase } from "../attempts/answer-question";
import { StartQuizAttemptUseCase } from "../attempts/start-quiz-attempt";
import {
	AnsweredQuestionError,
	DeleteQuestionUseCase,
} from "./delete-question";
import {
	anotherQuestionInput,
	aQuestionInput,
	createQuizSetsHarness,
	type QuizSetsHarness,
} from "./quiz-sets.fixture";
import { QuestionNotFoundError } from "./update-question";
import { QuizSetNotFoundError } from "./update-quiz-set";

const USER = 42;

let harness: QuizSetsHarness;
let remove: DeleteQuestionUseCase;

beforeEach(() => {
	harness = createQuizSetsHarness();
	remove = new DeleteQuestionUseCase(harness.context);
});

afterEach(() => {
	harness.context.close();
});

const twoQuestions = async () => {
	const quizSetId = await harness.newDraft();

	await harness.add.execute({
		quizSetId,
		questions: [aQuestionInput(), anotherQuestionInput()],
	});
	await harness.publish.execute({ quizSetId });

	return quizSetId;
};

const questionsOf = async (quizSetId: ReturnType<typeof toQuizSetId>) =>
	(await harness.context.scope.quizzes.findById(quizSetId))?.questions ?? [];

const answerFirst = async (quizSetId: ReturnType<typeof toQuizSetId>) => {
	const start = new StartQuizAttemptUseCase(harness.context);
	const answer = new AnswerQuestionUseCase(harness.context);
	const question = (await questionsOf(quizSetId))[0];

	await start.execute({ quizSetId, telegramUserId: USER });
	harness.context.clock.advance(60_000);
	await answer.execute({
		questionId: question?.id as never,
		selectedOptionPositions: [0],
	});
};

describe("DeleteQuestionUseCase", () => {
	test("removes a question nobody has answered", async () => {
		const quizSetId = await twoQuestions();
		const [, second] = await questionsOf(quizSetId);

		await remove.execute({ quizSetId, questionId: second?.id as never });

		expect(await questionsOf(quizSetId)).toHaveLength(1);
	});

	test("renumbers what is left, so the plan has no gaps", async () => {
		const quizSetId = await twoQuestions();
		const [first] = await questionsOf(quizSetId);

		await remove.execute({ quizSetId, questionId: first?.id as never });

		expect(
			(await questionsOf(quizSetId)).map((question) => question.position),
		).toEqual([0]);
	});

	test("refuses a question that carries answering history", async () => {
		const quizSetId = await twoQuestions();
		await answerFirst(quizSetId);
		const [first] = await questionsOf(quizSetId);

		await expect(
			remove.execute({ quizSetId, questionId: first?.id as never }),
		).rejects.toThrow(AnsweredQuestionError);
	});

	test("leaves the answered question exactly where it was", async () => {
		const quizSetId = await twoQuestions();
		await answerFirst(quizSetId);
		const [first] = await questionsOf(quizSetId);

		await remove
			.execute({ quizSetId, questionId: first?.id as never })
			.catch(() => undefined);

		expect(await questionsOf(quizSetId)).toHaveLength(2);
	});

	test("refuses to empty a set", async () => {
		const quizSetId = await harness.newPublished();
		const [only] = await questionsOf(quizSetId);

		await expect(
			remove.execute({ quizSetId, questionId: only?.id as never }),
		).rejects.toThrow();
		expect(await questionsOf(quizSetId)).toHaveLength(1);
	});

	test("refuses an archived set", async () => {
		const quizSetId = await twoQuestions();
		const [first] = await questionsOf(quizSetId);
		await harness.archive.execute({ quizSetId });

		await expect(
			remove.execute({ quizSetId, questionId: first?.id as never }),
		).rejects.toThrow();
	});

	test("refuses a question that is not in the set", async () => {
		const quizSetId = await twoQuestions();

		await expect(
			remove.execute({ quizSetId, questionId: toQuestionId("missing") }),
		).rejects.toThrow(QuestionNotFoundError);
	});

	test("refuses a set that does not exist", async () => {
		await expect(
			remove.execute({
				quizSetId: toQuizSetId("missing"),
				questionId: toQuestionId("missing"),
			}),
		).rejects.toThrow(QuizSetNotFoundError);
	});
});
