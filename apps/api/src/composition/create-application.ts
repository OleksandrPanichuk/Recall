import type { Logger } from "@recall/kit";
import { silentLogger } from "@recall/kit";
import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { OwnerId } from "@/application/ports/owner";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import { UnitOfWorkTransaction } from "@/application/unit-of-work.transaction";
import type { ApplicationDependencies } from "@/application/use-case";
import { GetInsightsUseCase } from "@/application/use-cases/analytics/get-insights";
import { AbandonQuizAttemptUseCase } from "@/application/use-cases/attempts/abandon-quiz-attempt";
import { AnswerQuestionUseCase } from "@/application/use-cases/attempts/answer-question";
import { FinishQuizAttemptUseCase } from "@/application/use-cases/attempts/finish-quiz-attempt";
import { GetCurrentQuestionUseCase } from "@/application/use-cases/attempts/get-current-question";
import { RateRecallUseCase } from "@/application/use-cases/attempts/rate-recall";
import {
	PauseQuizAttemptUseCase,
	ResumeQuizAttemptUseCase,
} from "@/application/use-cases/attempts/resume-quiz-attempt";
import { StartQuizAttemptUseCase } from "@/application/use-cases/attempts/start-quiz-attempt";
import { AttachQuizUseCase } from "@/application/use-cases/folders/attach-quiz";
import { BrowseFolderUseCase } from "@/application/use-cases/folders/browse-folder";
import { StartPracticeSessionUseCase } from "@/application/use-cases/practice/start-practice-session";
import { ListDueRepetitionsUseCase } from "@/application/use-cases/repetition/list-due-repetitions";
import { ListLeechesUseCase } from "@/application/use-cases/repetition/list-leeches";
import { ResolveQuizSettingsUseCase } from "@/application/use-cases/settings/resolve-quiz-settings";
import { UpdateQuizSettingsUseCase } from "@/application/use-cases/settings/update-quiz-settings";
import { ReadSharedPageUseCase } from "@/application/use-cases/sharing/read-shared-page";
import {
	SharePageUseCase,
	UnsharePageUseCase,
} from "@/application/use-cases/sharing/share-page";
import { GetAttemptDetailUseCase } from "@/application/use-cases/statistics/get-attempt-detail";
import { GetQuizStatisticsUseCase } from "@/application/use-cases/statistics/get-quiz-statistics";
import { DatabaseConnection } from "@/db/connection";
import {
	CreatePageUseCase,
	DeletePageUseCase,
	DetachQuizUseCase,
	EnsurePagePathUseCase,
	ListPageRevisionsUseCase,
	ListPageTreeUseCase,
	MovePageUseCase,
	PagesService,
	RenamePageUseCase,
	ReorderPageUseCase,
	ResolvePagePathUseCase,
	SearchPagesUseCase,
	SetPageIconUseCase,
	WriteSummaryUseCase,
} from "@/modules/pages";
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
import {
	AddVocabularyUseCase,
	ListVocabularyUseCase,
	UpdateVocabularyUseCase,
} from "@/modules/vocabulary";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";

export const systemClock: Clock = { now: () => new Date() };

export const uuidGenerator: IdGenerator = {
	generate: () => crypto.randomUUID(),
};

export interface UseCases {
	readonly createQuizSet: CreateQuizSetUseCase;
	readonly updateQuizSet: UpdateQuizSetUseCase;
	readonly addQuestions: AddQuestionsUseCase;
	readonly addVocabulary: AddVocabularyUseCase;
	readonly updateVocabulary: UpdateVocabularyUseCase;
	readonly listVocabulary: ListVocabularyUseCase;
	readonly publishQuizSet: PublishQuizSetUseCase;
	readonly archiveQuizSet: ArchiveQuizSetUseCase;
	readonly listQuizSets: ListQuizSetsUseCase;
	readonly listQuestions: ListQuestionsUseCase;
	readonly getQuizSet: GetQuizSetUseCase;
	readonly moveQuizSet: MoveQuizSetUseCase;
	readonly createFolder: CreatePageUseCase;
	readonly renameFolder: RenamePageUseCase;
	readonly moveFolder: MovePageUseCase;
	readonly reorderFolder: ReorderPageUseCase;
	readonly deleteFolder: DeletePageUseCase;
	readonly ensureFolderPath: EnsurePagePathUseCase;
	readonly resolveFolderPath: ResolvePagePathUseCase;
	readonly listFolderTree: ListPageTreeUseCase;
	readonly browseFolder: BrowseFolderUseCase;
	readonly writeSummary: WriteSummaryUseCase;
	readonly listRevisions: ListPageRevisionsUseCase;
	readonly searchPages: SearchPagesUseCase;
	readonly setPageIcon: SetPageIconUseCase;
	readonly getInsights: GetInsightsUseCase;
	readonly abandonQuizAttempt: AbandonQuizAttemptUseCase;
	readonly sharePage: SharePageUseCase;
	readonly unsharePage: UnsharePageUseCase;
	readonly readSharedPage: ReadSharedPageUseCase;
	readonly attachQuiz: AttachQuizUseCase;
	readonly detachQuiz: DetachQuizUseCase;
	readonly startQuizAttempt: StartQuizAttemptUseCase;
	readonly startPracticeSession: StartPracticeSessionUseCase;
	readonly updateQuestion: UpdateQuestionUseCase;
	readonly deleteQuestion: DeleteQuestionUseCase;
	readonly rateRecall: RateRecallUseCase;
	readonly pauseQuizAttempt: PauseQuizAttemptUseCase;
	readonly resumeQuizAttempt: ResumeQuizAttemptUseCase;
	readonly getCurrentQuestion: GetCurrentQuestionUseCase;
	readonly answerQuestion: AnswerQuestionUseCase;
	readonly finishQuizAttempt: FinishQuizAttemptUseCase;
	readonly getQuizStatistics: GetQuizStatisticsUseCase;
	readonly getAttemptDetail: GetAttemptDetailUseCase;
	readonly listDueRepetitions: ListDueRepetitionsUseCase;
	readonly listLeeches: ListLeechesUseCase;
	readonly resolveQuizSettings: ResolveQuizSettingsUseCase;
	readonly updateQuizSettings: UpdateQuizSettingsUseCase;
}

export interface Application extends UseCases {
	readonly connection: DatabaseConnection;
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	close(): Promise<void>;
}

export interface ApplicationOptions {
	readonly databaseUrl: string;
	readonly owner: OwnerId;
	readonly timezone?: string;
	readonly clock?: Clock;
	readonly idGenerator?: IdGenerator;
	readonly logger?: Logger;
	readonly maxConnections?: number;
}

export function createUseCases(
	dependencies: ApplicationDependencies,
): UseCases {
	const { clock, idGenerator } = dependencies;
	const pages = dependencies.scope.pages;
	const quizzes = dependencies.scope.quizzes;
	const attemptsRepo = dependencies.scope.attempts;
	const termPairs = dependencies.scope.termPairs;
	const pagesService = new PagesService(pages);
	const transaction = new UnitOfWorkTransaction(dependencies.unitOfWork);
	const addQuestions = new AddQuestionsUseCase(
		quizzes,
		transaction,
		clock,
		idGenerator,
	);

	return {
		createQuizSet: new CreateQuizSetUseCase(
			quizzes,
			pagesService,
			transaction,
			clock,
			idGenerator,
		),
		updateQuizSet: new UpdateQuizSetUseCase(quizzes, transaction, clock),
		addQuestions,
		addVocabulary: new AddVocabularyUseCase(
			addQuestions,
			termPairs,
			transaction,
			clock,
			idGenerator,
		),
		updateVocabulary: new UpdateVocabularyUseCase(
			termPairs,
			quizzes,
			transaction,
			clock,
			idGenerator,
		),
		listVocabulary: new ListVocabularyUseCase(termPairs, quizzes),
		publishQuizSet: new PublishQuizSetUseCase(quizzes, transaction, clock),
		archiveQuizSet: new ArchiveQuizSetUseCase(quizzes, transaction, clock),
		listQuizSets: new ListQuizSetsUseCase(quizzes),
		listQuestions: new ListQuestionsUseCase(quizzes, attemptsRepo),
		getQuizSet: new GetQuizSetUseCase(quizzes),
		moveQuizSet: new MoveQuizSetUseCase(
			quizzes,
			pagesService,
			transaction,
			clock,
		),
		createFolder: new CreatePageUseCase(
			pages,
			pagesService,
			transaction,
			clock,
			idGenerator,
		),
		renameFolder: new RenamePageUseCase(
			pages,
			pagesService,
			transaction,
			clock,
		),
		moveFolder: new MovePageUseCase(pages, pagesService, transaction, clock),
		reorderFolder: new ReorderPageUseCase(
			pages,
			pagesService,
			transaction,
			clock,
		),
		deleteFolder: new DeletePageUseCase(pages, pagesService, transaction),
		ensureFolderPath: new EnsurePagePathUseCase(
			pages,
			pagesService,
			transaction,
			clock,
			idGenerator,
		),
		resolveFolderPath: new ResolvePagePathUseCase(pages),
		listFolderTree: new ListPageTreeUseCase(pages),
		browseFolder: new BrowseFolderUseCase(dependencies),
		writeSummary: new WriteSummaryUseCase(
			pages,
			pagesService,
			transaction,
			clock,
			idGenerator,
		),
		listRevisions: new ListPageRevisionsUseCase(pages, pagesService),
		searchPages: new SearchPagesUseCase(pages),
		setPageIcon: new SetPageIconUseCase(
			pages,
			pagesService,
			transaction,
			clock,
		),
		getInsights: new GetInsightsUseCase(dependencies),
		abandonQuizAttempt: new AbandonQuizAttemptUseCase(dependencies),
		sharePage: new SharePageUseCase(dependencies),
		unsharePage: new UnsharePageUseCase(dependencies),
		readSharedPage: new ReadSharedPageUseCase(dependencies),
		attachQuiz: new AttachQuizUseCase(dependencies),
		detachQuiz: new DetachQuizUseCase(pages, pagesService, transaction),
		startQuizAttempt: new StartQuizAttemptUseCase(dependencies),
		startPracticeSession: new StartPracticeSessionUseCase(dependencies),
		updateQuestion: new UpdateQuestionUseCase(
			quizzes,
			transaction,
			clock,
			idGenerator,
		),
		deleteQuestion: new DeleteQuestionUseCase(
			quizzes,
			attemptsRepo,
			transaction,
			clock,
		),
		rateRecall: new RateRecallUseCase(dependencies),
		pauseQuizAttempt: new PauseQuizAttemptUseCase(dependencies),
		resumeQuizAttempt: new ResumeQuizAttemptUseCase(dependencies),
		getCurrentQuestion: new GetCurrentQuestionUseCase(dependencies),
		answerQuestion: new AnswerQuestionUseCase(dependencies),
		finishQuizAttempt: new FinishQuizAttemptUseCase(dependencies),
		getQuizStatistics: new GetQuizStatisticsUseCase(dependencies),
		getAttemptDetail: new GetAttemptDetailUseCase(dependencies),
		listDueRepetitions: new ListDueRepetitionsUseCase(dependencies),
		listLeeches: new ListLeechesUseCase(dependencies),
		resolveQuizSettings: new ResolveQuizSettingsUseCase(dependencies),
		updateQuizSettings: new UpdateQuizSettingsUseCase(dependencies),
	};
}

export function createApplication(options: ApplicationOptions): Application {
	const logger = options.logger ?? silentLogger;
	const connection = new DatabaseConnection({
		url: options.databaseUrl,
		maxConnections: options.maxConnections,
	});

	logger.info("database ready", { driver: "postgres" });

	const dependencies: ApplicationDependencies = {
		unitOfWork: createPostgresUnitOfWork(connection.db, options.owner),
		scope: readOnlyScope(connection.db, options.owner),
		clock: options.clock ?? systemClock,
		idGenerator: options.idGenerator ?? uuidGenerator,
		timezone: options.timezone ?? "UTC",
	};

	return {
		connection,
		unitOfWork: dependencies.unitOfWork,
		scope: dependencies.scope,
		...createUseCases(dependencies),
		close: async () => {
			await connection.close();
			logger.debug("database closed", { driver: "postgres" });
		},
	};
}
