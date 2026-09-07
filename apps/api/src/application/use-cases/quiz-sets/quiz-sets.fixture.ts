import {
	createMemoryContext,
	type MemoryContext,
} from "@tests/fixtures/memory.fixture";
import { quizzesOver } from "@tests/fixtures/quizzes.use-cases";
import {
	AddQuestionsUseCase,
	ArchiveQuizSetUseCase,
	CreateQuizSetUseCase,
	Difficulty,
	PublishQuizSetUseCase,
	type QuestionInput,
	QuestionType,
	type QuizSetId,
	UpdateQuizSetUseCase,
} from "@/modules/quizzes";
import { AddVocabularyUseCase } from "./add-vocabulary";
import { ListVocabularyUseCase } from "./list-vocabulary";
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
	const quizzes = quizzesOver(context);
	const create = quizzes.createQuizSet;
	const add = quizzes.addQuestions;
	const publish = quizzes.publishQuizSet;
	const archive = quizzes.archiveQuizSet;

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
		update: quizzes.updateQuizSet,
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
