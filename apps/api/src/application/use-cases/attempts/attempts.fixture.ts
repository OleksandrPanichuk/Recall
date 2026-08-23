import {
	createTestContext,
	type TestContext,
} from "@tests/fixtures/application.fixture";
import type { QuestionId } from "@/domain/quiz-set/question";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { AddQuestions, type QuestionInput } from "../quiz-sets/add-questions";
import { ArchiveQuizSet } from "../quiz-sets/archive-quiz-set";
import { CreateQuizSet } from "../quiz-sets/create-quiz-set";
import { PublishQuizSet } from "../quiz-sets/publish-quiz-set";
import { AnswerQuestion } from "./answer-question";
import { FinishQuizAttempt } from "./finish-quiz-attempt";
import { PauseQuizAttempt, ResumeQuizAttempt } from "./resume-quiz-attempt";
import { StartQuizAttempt } from "./start-quiz-attempt";

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
	readonly context: TestContext;
	readonly create: CreateQuizSet;
	readonly add: AddQuestions;
	readonly archive: ArchiveQuizSet;
	readonly start: StartQuizAttempt;
	readonly pause: PauseQuizAttempt;
	readonly resume: ResumeQuizAttempt;
	readonly answer: AnswerQuestion;
	readonly finish: FinishQuizAttempt;
	seedPublishedSet(prompts?: string[]): Promise<QuizSetId>;
	positionOf(quizSetId: QuizSetId, index: number, correct: boolean): number;
	questionIdOf(quizSetId: QuizSetId, index: number): QuestionId;
}

export function createAttemptsHarness(): AttemptsHarness {
	const context = createTestContext();
	const create = new CreateQuizSet(context);
	const add = new AddQuestions(context);
	const publish = new PublishQuizSet(context);

	const questionsOf = (quizSetId: QuizSetId) =>
		context.quizSets.findById(quizSetId)?.questions ?? [];

	return {
		context,
		create,
		add,
		archive: new ArchiveQuizSet(context),
		start: new StartQuizAttempt(context),
		pause: new PauseQuizAttempt(context),
		resume: new ResumeQuizAttempt(context),
		answer: new AnswerQuestion(context),
		finish: new FinishQuizAttempt(context),

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
