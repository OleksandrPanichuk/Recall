import {
	createTestContext,
	type TestContext,
} from "@tests/fixtures/application.fixture";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { AnswerQuestionUseCase } from "../attempts/answer-question";
import { FinishQuizAttemptUseCase } from "../attempts/finish-quiz-attempt";
import { StartQuizAttemptUseCase } from "../attempts/start-quiz-attempt";
import {
	AddQuestionsUseCase,
	type QuestionInput,
} from "../quiz-sets/add-questions";
import { ArchiveQuizSetUseCase } from "../quiz-sets/archive-quiz-set";
import { CreateQuizSetUseCase } from "../quiz-sets/create-quiz-set";
import { PublishQuizSetUseCase } from "../quiz-sets/publish-quiz-set";
import { StartPracticeSessionUseCase } from "./start-practice-session";

export const USER = 42;

export const aQuestionInput = (
	prompt: string,
	topic?: string,
): QuestionInput => ({
	type: QuestionType.SingleChoice,
	prompt,
	difficulty: Difficulty.Medium,
	topic,
	options: [
		{ text: `Right for ${prompt}`, isCorrect: true },
		{ text: `Wrong for ${prompt}`, isCorrect: false },
	],
});

export interface PracticeHarness {
	readonly context: TestContext;
	readonly practice: StartPracticeSessionUseCase;
	readonly archive: ArchiveQuizSetUseCase;
	readonly finish: FinishQuizAttemptUseCase;
	seedPublishedSet(questions: readonly QuestionInput[]): Promise<QuizSetId>;
	seedDraftSet(questions: readonly QuestionInput[]): Promise<QuizSetId>;
	playAttempt(quizSetId: QuizSetId, correct: readonly boolean[]): Promise<void>;
	answerCurrent(correct: boolean): Promise<void>;
	promptsOf(quizSetId: QuizSetId): readonly string[];
	plannedPrompts(quizSetId: QuizSetId): readonly string[];
}

export function createPracticeHarness(): PracticeHarness {
	const context = createTestContext();
	const create = new CreateQuizSetUseCase(context);
	const add = new AddQuestionsUseCase(context);
	const publish = new PublishQuizSetUseCase(context);
	const start = new StartQuizAttemptUseCase(context);
	const answer = new AnswerQuestionUseCase(context);
	const finish = new FinishQuizAttemptUseCase(context);

	const questionsOf = (quizSetId: QuizSetId) =>
		context.quizSets.findById(quizSetId)?.questions ?? [];

	const seedDraftSet = async (questions: readonly QuestionInput[]) => {
		const { quizSetId } = await create.execute({
			title: `Set ${questions.length}`,
			language: "uk",
		});

		await add.execute({ quizSetId, questions });

		return quizSetId;
	};

	const answerCurrent = async (correct: boolean) => {
		const attempt = context.attempts.findActiveByUser(USER);
		const questionId = attempt?.questionIds[attempt.responses.length];
		const question = questionsOf(attempt?.quizSetId as QuizSetId).find(
			(candidate) => candidate.id === questionId,
		);
		const option = question?.options.find(
			(candidate) => candidate.isCorrect === correct,
		);

		context.clock.advance(60_000);
		await answer.execute({
			telegramUserId: USER,
			questionId: question?.id as never,
			selectedOptionPositions: [option?.position ?? 0],
		});
	};

	return {
		context,
		practice: new StartPracticeSessionUseCase(context),
		archive: new ArchiveQuizSetUseCase(context),
		finish,
		seedDraftSet,

		seedPublishedSet: async (questions) => {
			const quizSetId = await seedDraftSet(questions);
			await publish.execute({ quizSetId });

			return quizSetId;
		},

		playAttempt: async (quizSetId, correct) => {
			await start.execute({ quizSetId, telegramUserId: USER });

			for (const isCorrect of correct) {
				await answerCurrent(isCorrect);
			}

			context.clock.advance(60_000);
			await finish.execute({ telegramUserId: USER });
		},

		answerCurrent,
		promptsOf: (quizSetId) =>
			questionsOf(quizSetId).map((question) => question.prompt),

		plannedPrompts: (quizSetId) => {
			const questions = questionsOf(quizSetId);
			const attempt = context.attempts.findActiveByUser(USER);

			return (attempt?.questionIds ?? []).map(
				(questionId) =>
					questions.find((candidate) => candidate.id === questionId)?.prompt ??
					"",
			);
		},
	};
}
