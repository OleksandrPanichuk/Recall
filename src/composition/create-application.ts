import type { Database } from "bun:sqlite";
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
import { AnswerQuestion } from "@/application/use-cases/attempts/answer-question";
import { FinishQuizAttempt } from "@/application/use-cases/attempts/finish-quiz-attempt";
import { GetCurrentQuestion } from "@/application/use-cases/attempts/get-current-question";
import {
	PauseQuizAttempt,
	ResumeQuizAttempt,
} from "@/application/use-cases/attempts/resume-quiz-attempt";
import { StartQuizAttempt } from "@/application/use-cases/attempts/start-quiz-attempt";
import { BrowseFolder } from "@/application/use-cases/folders/browse-folder";
import { CreateFolder } from "@/application/use-cases/folders/create-folder";
import { DeleteFolder } from "@/application/use-cases/folders/delete-folder";
import { EnsureFolderPath } from "@/application/use-cases/folders/ensure-folder-path";
import { ListFolderTree } from "@/application/use-cases/folders/list-folder-tree";
import { MoveFolder } from "@/application/use-cases/folders/move-folder";
import { RenameFolder } from "@/application/use-cases/folders/rename-folder";
import { ResolveFolderPath } from "@/application/use-cases/folders/resolve-folder-path";
import { AddQuestions } from "@/application/use-cases/quiz-sets/add-questions";
import { AddVocabulary } from "@/application/use-cases/quiz-sets/add-vocabulary";
import { ArchiveQuizSet } from "@/application/use-cases/quiz-sets/archive-quiz-set";
import { CreateQuizSet } from "@/application/use-cases/quiz-sets/create-quiz-set";
import { GetQuizSet } from "@/application/use-cases/quiz-sets/get-quiz-set";
import { ListQuizSets } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import { MoveQuizSet } from "@/application/use-cases/quiz-sets/move-quiz-set";
import { PublishQuizSet } from "@/application/use-cases/quiz-sets/publish-quiz-set";
import { UpdateQuizSet } from "@/application/use-cases/quiz-sets/update-quiz-set";
import { ListDueRepetitions } from "@/application/use-cases/repetition/list-due-repetitions";
import { ResolveRepetitionSettings } from "@/application/use-cases/repetition/resolve-repetition-settings";
import { UpdateRepetitionSettings } from "@/application/use-cases/repetition/update-repetition-settings";
import { GetQuizStatistics } from "@/application/use-cases/statistics/get-quiz-statistics";
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
	readonly createQuizSet: CreateQuizSet;
	readonly updateQuizSet: UpdateQuizSet;
	readonly addQuestions: AddQuestions;
	readonly addVocabulary: AddVocabulary;
	readonly publishQuizSet: PublishQuizSet;
	readonly archiveQuizSet: ArchiveQuizSet;
	readonly listQuizSets: ListQuizSets;
	readonly getQuizSet: GetQuizSet;
	readonly moveQuizSet: MoveQuizSet;
	readonly createFolder: CreateFolder;
	readonly renameFolder: RenameFolder;
	readonly moveFolder: MoveFolder;
	readonly deleteFolder: DeleteFolder;
	readonly ensureFolderPath: EnsureFolderPath;
	readonly resolveFolderPath: ResolveFolderPath;
	readonly listFolderTree: ListFolderTree;
	readonly browseFolder: BrowseFolder;
	readonly startQuizAttempt: StartQuizAttempt;
	readonly pauseQuizAttempt: PauseQuizAttempt;
	readonly resumeQuizAttempt: ResumeQuizAttempt;
	readonly getCurrentQuestion: GetCurrentQuestion;
	readonly answerQuestion: AnswerQuestion;
	readonly finishQuizAttempt: FinishQuizAttempt;
	readonly getQuizStatistics: GetQuizStatistics;
	readonly listDueRepetitions: ListDueRepetitions;
	readonly resolveRepetitionSettings: ResolveRepetitionSettings;
	readonly updateRepetitionSettings: UpdateRepetitionSettings;
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

	const addQuestions = new AddQuestions(dependencies);

	return {
		database,
		createQuizSet: new CreateQuizSet(dependencies),
		updateQuizSet: new UpdateQuizSet(dependencies),
		addQuestions,
		addVocabulary: new AddVocabulary({ ...dependencies, addQuestions }),
		publishQuizSet: new PublishQuizSet(dependencies),
		archiveQuizSet: new ArchiveQuizSet(dependencies),
		listQuizSets: new ListQuizSets(dependencies),
		getQuizSet: new GetQuizSet(dependencies),
		moveQuizSet: new MoveQuizSet(dependencies),
		createFolder: new CreateFolder(dependencies),
		renameFolder: new RenameFolder(dependencies),
		moveFolder: new MoveFolder(dependencies),
		deleteFolder: new DeleteFolder(dependencies),
		ensureFolderPath: new EnsureFolderPath(dependencies),
		resolveFolderPath: new ResolveFolderPath(dependencies),
		listFolderTree: new ListFolderTree(dependencies),
		browseFolder: new BrowseFolder(dependencies),
		startQuizAttempt: new StartQuizAttempt(dependencies),
		pauseQuizAttempt: new PauseQuizAttempt(dependencies),
		resumeQuizAttempt: new ResumeQuizAttempt(dependencies),
		getCurrentQuestion: new GetCurrentQuestion(dependencies),
		answerQuestion: new AnswerQuestion(dependencies),
		finishQuizAttempt: new FinishQuizAttempt(dependencies),
		getQuizStatistics: new GetQuizStatistics(dependencies),
		listDueRepetitions: new ListDueRepetitions(dependencies),
		resolveRepetitionSettings: new ResolveRepetitionSettings(dependencies),
		updateRepetitionSettings: new UpdateRepetitionSettings(dependencies),
		close: () => {
			closeDatabase(database);
			logger.debug("database closed", { path: database.filename });
		},
	};
}
