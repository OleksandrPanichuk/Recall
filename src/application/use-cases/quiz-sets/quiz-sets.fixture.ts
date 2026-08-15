import {
	createTestContext,
	type TestContext,
} from "@tests/fixtures/application.fixture";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { AddQuestions, type QuestionInput } from "./add-questions";
import { AddVocabulary } from "./add-vocabulary";
import { ArchiveQuizSet } from "./archive-quiz-set";
import { CreateQuizSet } from "./create-quiz-set";
import { PublishQuizSet } from "./publish-quiz-set";
import { UpdateQuizSet } from "./update-quiz-set";
import { UpdateVocabulary } from "./update-vocabulary";

export const aQuestionInput = (
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

export const anotherQuestionInput = (): QuestionInput =>
	aQuestionInput({ prompt: "What does PRAGMA foreign_keys do?" });

export interface QuizSetsHarness {
	readonly context: TestContext;
	readonly create: CreateQuizSet;
	readonly update: UpdateQuizSet;
	readonly add: AddQuestions;
	readonly publish: PublishQuizSet;
	readonly archive: ArchiveQuizSet;
	readonly addVocabulary: AddVocabulary;
	readonly updateVocabulary: UpdateVocabulary;
	newDraft(): Promise<QuizSetId>;
	newPublished(): Promise<QuizSetId>;
}

export function createQuizSetsHarness(): QuizSetsHarness {
	const context = createTestContext();
	const create = new CreateQuizSet(context);
	const add = new AddQuestions(context);
	const publish = new PublishQuizSet(context);

	const newDraft = async (): Promise<QuizSetId> => {
		const { quizSetId } = await create.execute({
			title: "Bun persistence",
			language: "uk",
		});

		return quizSetId;
	};

	return {
		context,
		create,
		update: new UpdateQuizSet(context),
		add,
		publish,
		archive: new ArchiveQuizSet(context),
		addVocabulary: new AddVocabulary({ ...context, addQuestions: add }),
		updateVocabulary: new UpdateVocabulary(context),

		newDraft,

		newPublished: async () => {
			const quizSetId = await newDraft();

			await add.execute({ quizSetId, questions: [aQuestionInput()] });
			await publish.execute({ quizSetId });

			return quizSetId;
		},
	};
}
