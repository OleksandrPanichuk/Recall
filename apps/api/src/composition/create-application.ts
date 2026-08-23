import type { Database } from "bun:sqlite";
import type { QuizDatabase } from "@/adapters/persistence/sqlite/database";
import {
	closeDatabase,
	createDatabase,
	createDrizzleClient,
} from "@/adapters/persistence/sqlite/database";
import { applyMigrations } from "@/adapters/persistence/sqlite/migrator";
import { createSqliteFolderRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-folder.repository";
import { createSqliteQuizAttemptRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-attempt.repository";
import { createSqliteQuizSetRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository";
import { createSqliteRepetitionRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-repetition.repository";
import { createSqliteVocabularyRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-vocabulary.repository";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { Transaction } from "@/application/ports/transaction";
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

export const systemClock: Clock = { now: () => new Date() };

export const shortIdGenerator: IdGenerator = {
	generate: () => {
		const bytes = new Uint8Array(9);

		crypto.getRandomValues(bytes);

		return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join(
			"",
		);
	},
};

export interface Application {
	readonly database: Database;
	readonly client: QuizDatabase;
	readonly transaction: Transaction;
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
	close(): void;
}

export interface ApplicationOptions {
	readonly databasePath: string;
	readonly timezone?: string;
	readonly clock?: Clock;
	readonly idGenerator?: IdGenerator;
	readonly logger?: Logger;
}

export function createApplication(options: ApplicationOptions): Application {
	const logger = options.logger ?? silentLogger;
	const database = createDatabase({ path: options.databasePath });
	const applied = applyMigrations(database);

	logger.info("database ready", {
		path: database.filename,
		migrationCount: applied.length,
		appliedMigrations: [...applied],
	});

	const client = createDrizzleClient(database);
	const transaction = createSqliteTransaction(client);
	const dependencies = {
		quizSets: createSqliteQuizSetRepository(client, transaction),
		folders: createSqliteFolderRepository(client, transaction),
		vocabulary: createSqliteVocabularyRepository(client, transaction),
		repetition: createSqliteRepetitionRepository(client, transaction, () =>
			(options.clock ?? systemClock).now(),
		),
		attempts: createSqliteQuizAttemptRepository(client, transaction),
		clock: options.clock ?? systemClock,
		idGenerator: options.idGenerator ?? shortIdGenerator,
		timezone: options.timezone ?? "UTC",
		transaction,
	};

	const addQuestions = new AddQuestionsUseCase(dependencies);

	return {
		database,
		client,
		transaction,
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
		close: () => {
			closeDatabase(database);
			logger.debug("database closed", { path: database.filename });
		},
	};
}
