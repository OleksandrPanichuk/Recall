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
import { AddQuestionsUseCase } from "@/application/use-cases/quiz-sets/add-questions";
import { AddVocabularyUseCase } from "@/application/use-cases/quiz-sets/add-vocabulary";
import { ArchiveQuizSetUseCase } from "@/application/use-cases/quiz-sets/archive-quiz-set";
import { CreateQuizSetUseCase } from "@/application/use-cases/quiz-sets/create-quiz-set";
import { DeleteQuestionUseCase } from "@/application/use-cases/quiz-sets/delete-question";
import { GetQuizSetUseCase } from "@/application/use-cases/quiz-sets/get-quiz-set";
import { ListQuestionsUseCase } from "@/application/use-cases/quiz-sets/list-questions";
import { ListQuizSetsUseCase } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import { ListVocabularyUseCase } from "@/application/use-cases/quiz-sets/list-vocabulary";
import { MoveQuizSetUseCase } from "@/application/use-cases/quiz-sets/move-quiz-set";
import { PublishQuizSetUseCase } from "@/application/use-cases/quiz-sets/publish-quiz-set";
import { UpdateQuestionUseCase } from "@/application/use-cases/quiz-sets/update-question";
import { UpdateQuizSetUseCase } from "@/application/use-cases/quiz-sets/update-quiz-set";
import { UpdateVocabularyUseCase } from "@/application/use-cases/quiz-sets/update-vocabulary";
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
	const addQuestions = new AddQuestionsUseCase(dependencies);
	const pages = dependencies.scope.pages;
	const pagesService = new PagesService(pages);
	const transaction = new UnitOfWorkTransaction(dependencies.unitOfWork);
	const { clock, idGenerator } = dependencies;

	return {
		createQuizSet: new CreateQuizSetUseCase(dependencies),
		updateQuizSet: new UpdateQuizSetUseCase(dependencies),
		addQuestions,
		addVocabulary: new AddVocabularyUseCase({ ...dependencies, addQuestions }),
		updateVocabulary: new UpdateVocabularyUseCase(dependencies),
		listVocabulary: new ListVocabularyUseCase(dependencies),
		publishQuizSet: new PublishQuizSetUseCase(dependencies),
		archiveQuizSet: new ArchiveQuizSetUseCase(dependencies),
		listQuizSets: new ListQuizSetsUseCase(dependencies),
		listQuestions: new ListQuestionsUseCase(dependencies),
		getQuizSet: new GetQuizSetUseCase(dependencies),
		moveQuizSet: new MoveQuizSetUseCase(dependencies),
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
		updateQuestion: new UpdateQuestionUseCase(dependencies),
		deleteQuestion: new DeleteQuestionUseCase(dependencies),
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
