import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import { AnswerQuestionUseCase } from "@/application/use-cases/attempts/answer-question";
import { FinishQuizAttemptUseCase } from "@/application/use-cases/attempts/finish-quiz-attempt";
import { GetCurrentQuestionUseCase } from "@/application/use-cases/attempts/get-current-question";
import {
	PauseQuizAttemptUseCase,
	ResumeQuizAttemptUseCase,
} from "@/application/use-cases/attempts/resume-quiz-attempt";
import { StartQuizAttemptUseCase } from "@/application/use-cases/attempts/start-quiz-attempt";
import { BrowseFolderUseCase } from "@/application/use-cases/folders/browse-folder";
import { CreateFolderUseCase } from "@/application/use-cases/folders/create-folder";
import { DeleteFolderUseCase } from "@/application/use-cases/folders/delete-folder";
import { EnsureFolderPathUseCase } from "@/application/use-cases/folders/ensure-folder-path";
import { ListFolderTreeUseCase } from "@/application/use-cases/folders/list-folder-tree";
import { MoveFolderUseCase } from "@/application/use-cases/folders/move-folder";
import { RenameFolderUseCase } from "@/application/use-cases/folders/rename-folder";
import { ResolveFolderPathUseCase } from "@/application/use-cases/folders/resolve-folder-path";
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
import { GetAttemptDetailUseCase } from "@/application/use-cases/statistics/get-attempt-detail";
import { GetQuizStatisticsUseCase } from "@/application/use-cases/statistics/get-quiz-statistics";
import { silentLogger } from "@/infrastructure/logging/logger";
import type { Logger } from "@/infrastructure/logging/logger.types";
import {
	createPostgresConnection,
	type PostgresConnection,
} from "@/persistence/postgres/client";
import {
	createPostgresUnitOfWork,
	readOnlyScope,
} from "@/persistence/postgres/unit-of-work";

export const systemClock: Clock = { now: () => new Date() };

export const uuidGenerator: IdGenerator = {
	generate: () => crypto.randomUUID(),
};

export interface Application {
	readonly connection: PostgresConnection;
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
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
	readonly createFolder: CreateFolderUseCase;
	readonly renameFolder: RenameFolderUseCase;
	readonly moveFolder: MoveFolderUseCase;
	readonly deleteFolder: DeleteFolderUseCase;
	readonly ensureFolderPath: EnsureFolderPathUseCase;
	readonly resolveFolderPath: ResolveFolderPathUseCase;
	readonly listFolderTree: ListFolderTreeUseCase;
	readonly browseFolder: BrowseFolderUseCase;
	readonly startQuizAttempt: StartQuizAttemptUseCase;
	readonly startPracticeSession: StartPracticeSessionUseCase;
	readonly updateQuestion: UpdateQuestionUseCase;
	readonly deleteQuestion: DeleteQuestionUseCase;
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
	close(): Promise<void>;
}

export interface ApplicationOptions {
	readonly databaseUrl: string;
	readonly timezone?: string;
	readonly clock?: Clock;
	readonly idGenerator?: IdGenerator;
	readonly logger?: Logger;
	readonly maxConnections?: number;
}

export function createApplication(options: ApplicationOptions): Application {
	const logger = options.logger ?? silentLogger;
	const connection = createPostgresConnection({
		url: options.databaseUrl,
		maxConnections: options.maxConnections,
	});

	logger.info("database ready", { driver: "postgres" });

	const dependencies = {
		unitOfWork: createPostgresUnitOfWork(connection.db),
		scope: readOnlyScope(connection.db),
		clock: options.clock ?? systemClock,
		idGenerator: options.idGenerator ?? uuidGenerator,
		timezone: options.timezone ?? "UTC",
	};

	const addQuestions = new AddQuestionsUseCase(dependencies);

	return {
		connection,
		unitOfWork: dependencies.unitOfWork,
		scope: dependencies.scope,
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
		createFolder: new CreateFolderUseCase(dependencies),
		renameFolder: new RenameFolderUseCase(dependencies),
		moveFolder: new MoveFolderUseCase(dependencies),
		deleteFolder: new DeleteFolderUseCase(dependencies),
		ensureFolderPath: new EnsureFolderPathUseCase(dependencies),
		resolveFolderPath: new ResolveFolderPathUseCase(dependencies),
		listFolderTree: new ListFolderTreeUseCase(dependencies),
		browseFolder: new BrowseFolderUseCase(dependencies),
		startQuizAttempt: new StartQuizAttemptUseCase(dependencies),
		startPracticeSession: new StartPracticeSessionUseCase(dependencies),
		updateQuestion: new UpdateQuestionUseCase(dependencies),
		deleteQuestion: new DeleteQuestionUseCase(dependencies),
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
		close: async () => {
			await connection.close();
			logger.debug("database closed", { driver: "postgres" });
		},
	};
}
