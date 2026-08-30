import {
	createMemoryContext,
	type MemoryContext,
} from "@tests/fixtures/memory.fixture";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { AddQuestionsUseCase, type QuestionInput } from "./add-questions";
import { AddVocabularyUseCase } from "./add-vocabulary";
import { ArchiveQuizSetUseCase } from "./archive-quiz-set";
import { CreateQuizSetUseCase } from "./create-quiz-set";
import { ListVocabularyUseCase } from "./list-vocabulary";
import { PublishQuizSetUseCase } from "./publish-quiz-set";
import { UpdateQuizSetUseCase } from "./update-quiz-set";
import { UpdateVocabularyUseCase } from "./update-vocabulary";

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
	readonly context: MemoryContext;
	readonly create: CreateQuizSetUseCase;
	readonly update: UpdateQuizSetUseCase;
	readonly add: AddQuestionsUseCase;
	readonly publish: PublishQuizSetUseCase;
	readonly archive: ArchiveQuizSetUseCase;
	readonly addVocabulary: AddVocabularyUseCase;
	readonly updateVocabulary: UpdateVocabularyUseCase;
	readonly listVocabulary: ListVocabularyUseCase;
	newDraft(): Promise<QuizSetId>;
	newPublished(): Promise<QuizSetId>;
	newArchived(): Promise<QuizSetId>;
}

export function createQuizSetsHarness(): QuizSetsHarness {
	const context = createMemoryContext();
	const create = new CreateQuizSetUseCase(context);
	const add = new AddQuestionsUseCase(context);
	const publish = new PublishQuizSetUseCase(context);

	const archive = new ArchiveQuizSetUseCase(context);

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
		update: new UpdateQuizSetUseCase(context),
		add,
		publish,
		archive,
		addVocabulary: new AddVocabularyUseCase({ ...context, addQuestions: add }),
		updateVocabulary: new UpdateVocabularyUseCase(context),
		listVocabulary: new ListVocabularyUseCase(context),

		newDraft,

		newPublished: async () => {
			const quizSetId = await newDraft();

			await add.execute({ quizSetId, questions: [aQuestionInput()] });
			await publish.execute({ quizSetId });

			return quizSetId;
		},

		newArchived: async () => {
			const quizSetId = await newDraft();

			await add.execute({ quizSetId, questions: [aQuestionInput()] });
			await archive.execute({ quizSetId });

			return quizSetId;
		},
	};
}
