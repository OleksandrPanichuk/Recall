import {
	createMemoryContext,
	type MemoryContext,
} from "@tests/fixtures/memory.fixture";
import type { QuestionId } from "@/domain/quiz-set/question";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	AddQuestionsUseCase,
	type QuestionInput,
} from "../quiz-sets/add-questions";
import { ArchiveQuizSetUseCase } from "../quiz-sets/archive-quiz-set";
import { CreateQuizSetUseCase } from "../quiz-sets/create-quiz-set";
import { PublishQuizSetUseCase } from "../quiz-sets/publish-quiz-set";
import { AnswerQuestionUseCase } from "./answer-question";
import { FinishQuizAttemptUseCase } from "./finish-quiz-attempt";
import {
	PauseQuizAttemptUseCase,
	ResumeQuizAttemptUseCase,
} from "./resume-quiz-attempt";
import { StartQuizAttemptUseCase } from "./start-quiz-attempt";

export const USER = 42;

export const aQuestionInput = (prompt: string): QuestionInput => ({
	type: QuestionType.SingleChoice,
	prompt,
	difficulty: Difficulty.Medium,
	explanation: `Because of ${prompt}`,
	options: [
		{ text: `Right for ${prompt}`, isCorrect: true },
		{ text: `Wrong for ${prompt}`, isCorrect: false },
	],
});

export interface AttemptsHarness {
	readonly context: MemoryContext;
	readonly create: CreateQuizSetUseCase;
	readonly add: AddQuestionsUseCase;
	readonly archive: ArchiveQuizSetUseCase;
	readonly start: StartQuizAttemptUseCase;
	readonly pause: PauseQuizAttemptUseCase;
	readonly resume: ResumeQuizAttemptUseCase;
	readonly answer: AnswerQuestionUseCase;
	readonly finish: FinishQuizAttemptUseCase;
	seedPublishedSet(prompts?: string[]): Promise<QuizSetId>;
	positionOf(quizSetId: QuizSetId, index: number, correct: boolean): number;
	questionIdOf(quizSetId: QuizSetId, index: number): QuestionId;
}

export function createAttemptsHarness(): AttemptsHarness {
	const context = createMemoryContext();
	const create = new CreateQuizSetUseCase(context);
	const add = new AddQuestionsUseCase(context);
	const publish = new PublishQuizSetUseCase(context);

	const questionsOf = (quizSetId: QuizSetId) =>
		await context.scope.quizzes.findById(quizSetId)?.questions ?? [];

	return {
		context,
		create,
		add,
		archive: new ArchiveQuizSetUseCase(context),
		start: new StartQuizAttemptUseCase(context),
		pause: new PauseQuizAttemptUseCase(context),
		resume: new ResumeQuizAttemptUseCase(context),
		answer: new AnswerQuestionUseCase(context),
		finish: new FinishQuizAttemptUseCase(context),

		seedPublishedSet: async (prompts = ["One", "Two"]) => {
			const { quizSetId } = await create.execute({
				title: "Bun persistence",
				language: "uk",
			});

			await add.execute({ quizSetId, questions: prompts.map(aQuestionInput) });
			await publish.execute({ quizSetId });

			return quizSetId;
		},

		positionOf: (quizSetId, index, correct) => {
			const question = questionsOf(quizSetId)[index];
			const option = question?.options.find(
				(candidate) => candidate.isCorrect === correct,
			);

			if (option === undefined) {
				throw new Error("fixture is missing an option");
			}

			return option.position;
		},

		questionIdOf: (quizSetId, index) => {
			const question = questionsOf(quizSetId)[index];

			if (question === undefined) {
				throw new Error("fixture is missing a question");
			}

			return question.id;
		},
	};
}
