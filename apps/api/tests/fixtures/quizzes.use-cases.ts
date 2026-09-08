import { PagesService } from "@/modules/pages";
import {
	AddQuestionsUseCase,
	ArchiveQuizSetUseCase,
	CreateQuizSetUseCase,
	DeleteQuestionUseCase,
	GetQuizSetUseCase,
	ListQuestionsUseCase,
	ListQuizSetsUseCase,
	MoveQuizSetUseCase,
	PublishQuizSetUseCase,
	UpdateQuestionUseCase,
	UpdateQuizSetUseCase,
} from "@/modules/quizzes";
import type { MemoryContext } from "./memory.fixture";

export interface QuizzesUseCases {
	readonly addQuestions: AddQuestionsUseCase;
	readonly archiveQuizSet: ArchiveQuizSetUseCase;
	readonly createQuizSet: CreateQuizSetUseCase;
	readonly deleteQuestion: DeleteQuestionUseCase;
	readonly getQuizSet: GetQuizSetUseCase;
	readonly listQuestions: ListQuestionsUseCase;
	readonly listQuizSets: ListQuizSetsUseCase;
	readonly moveQuizSet: MoveQuizSetUseCase;
	readonly publishQuizSet: PublishQuizSetUseCase;
	readonly updateQuestion: UpdateQuestionUseCase;
	readonly updateQuizSet: UpdateQuizSetUseCase;
}

export function quizzesOver(context: MemoryContext): QuizzesUseCases {
	const { scope, transaction, clock, idGenerator } = context;
	const quizzes = scope.quizzes;
	const pagesService = new PagesService(scope.pages);

	return {
		addQuestions: new AddQuestionsUseCase(
			quizzes,
			transaction,
			clock,
			idGenerator,
		),
		archiveQuizSet: new ArchiveQuizSetUseCase(quizzes, transaction, clock),
		createQuizSet: new CreateQuizSetUseCase(
			quizzes,
			pagesService,
			transaction,
			clock,
			idGenerator,
		),
		deleteQuestion: new DeleteQuestionUseCase(quizzes, transaction, clock),
		getQuizSet: new GetQuizSetUseCase(quizzes),
		listQuestions: new ListQuestionsUseCase(quizzes),
		listQuizSets: new ListQuizSetsUseCase(quizzes),
		moveQuizSet: new MoveQuizSetUseCase(
			quizzes,
			pagesService,
			transaction,
			clock,
		),
		publishQuizSet: new PublishQuizSetUseCase(quizzes, transaction, clock),
		updateQuestion: new UpdateQuestionUseCase(
			quizzes,
			transaction,
			clock,
			idGenerator,
		),
		updateQuizSet: new UpdateQuizSetUseCase(quizzes, transaction, clock),
	};
}
