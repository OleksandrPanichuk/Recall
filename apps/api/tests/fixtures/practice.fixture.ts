import { attemptsOver } from "@tests/fixtures/attempts.use-cases";
import {
	createMemoryContext,
	type MemoryContext,
} from "@tests/fixtures/memory.fixture";
import { quizzesOver } from "@tests/fixtures/quizzes.use-cases";
import { FinishQuizAttemptUseCase } from "@/modules/attempts";
import { StartPracticeSessionUseCase } from "@/modules/practice";
import {
	ArchiveQuizSetUseCase,
	Difficulty,
	type QuestionInput,
	QuestionType,
	type QuizSetId,
} from "@/modules/quizzes";
import { StudySettingsService } from "@/modules/study-settings";

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
	readonly context: MemoryContext;
	readonly practice: StartPracticeSessionUseCase;
	readonly archive: ArchiveQuizSetUseCase;
	readonly finish: FinishQuizAttemptUseCase;
	seedPublishedSet(questions: readonly QuestionInput[]): Promise<QuizSetId>;
	seedDraftSet(questions: readonly QuestionInput[]): Promise<QuizSetId>;
	playAttempt(quizSetId: QuizSetId, correct: readonly boolean[]): Promise<void>;
	answerCurrent(correct: boolean): Promise<void>;
	promptsOf(quizSetId: QuizSetId): Promise<readonly string[]>;
	plannedPrompts(quizSetId: QuizSetId): Promise<readonly string[]>;
}

export function createPracticeHarness(): PracticeHarness {
	const context = createMemoryContext();
	const create = quizzesOver(context).createQuizSet;
	const add = quizzesOver(context).addQuestions;
	const publish = quizzesOver(context).publishQuizSet;
	const start = attemptsOver(context).startQuizAttempt;
	const answer = attemptsOver(context).answerQuestion;
	const finish = attemptsOver(context).finishQuizAttempt;

	const questionsOf = async (quizSetId: QuizSetId) =>
		(await context.scope.quizzes.findById(quizSetId))?.questions ?? [];

	const seedDraftSet = async (questions: readonly QuestionInput[]) => {
		const { quizSetId } = await create.execute({
			title: `Set ${questions.length}`,
			language: "uk",
		});

		await add.execute({ quizSetId, questions });

		return quizSetId;
	};

	const answerCurrent = async (correct: boolean) => {
		const attempt = await context.scope.attempts.findActive();
		const questionId = attempt?.questionIds[attempt.responses.length];
		const question = (await questionsOf(attempt?.quizSetId as QuizSetId)).find(
			(candidate) => candidate.id === questionId,
		);
		const option = question?.options.find(
			(candidate) => candidate.isCorrect === correct,
		);

		context.clock.advance(60_000);
		await answer.execute({
			questionId: question?.id as never,
			selectedOptionPositions: [option?.position ?? 0],
		});
	};

	return {
		context,
		practice: new StartPracticeSessionUseCase(
			context.scope.attempts,
			context.scope.quizzes,
			new StudySettingsService(context.scope.reviews),
			context.transaction,
			context.clock,
			context.idGenerator,
		),
		archive: quizzesOver(context).archiveQuizSet,
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
			await finish.execute({});
		},

		answerCurrent,
		promptsOf: async (quizSetId) =>
			(await questionsOf(quizSetId)).map((question) => question.prompt),

		plannedPrompts: async (quizSetId) => {
			const questions = await questionsOf(quizSetId);
			const attempt = await context.scope.attempts.findActive();

			return (attempt?.questionIds ?? []).map(
				(questionId) =>
					questions.find((candidate) => candidate.id === questionId)?.prompt ??
					"",
			);
		},
	};
}
