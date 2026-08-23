import type { Database } from "bun:sqlite";
import {
	Global,
	Inject,
	Module,
	type OnApplicationShutdown,
} from "@nestjs/common";
import {
	closeDatabase,
	createDatabase,
	createDrizzleClient,
	type QuizDatabase,
} from "@/adapters/persistence/sqlite/database";
import { applyMigrations } from "@/adapters/persistence/sqlite/migrator";
import { createSqliteFolderRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-folder.repository";
import { createSqliteQuizAttemptRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-attempt.repository";
import { createSqliteQuizSetRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository";
import { createSqliteRepetitionRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-repetition.repository";
import { createSqliteVocabularyRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-vocabulary.repository";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import type { Transaction } from "@/application/ports/transaction";
import {
	shortIdGenerator,
	systemClock,
} from "@/composition/create-application";
import { loadApiEnvironment } from "../config/api-env";
import {
	DATABASE,
	DRIZZLE,
	TRANSACTION,
	USE_CASE_DEPENDENCIES,
} from "./tokens";

export interface UseCaseDependencies {
	readonly quizSets: ReturnType<typeof createSqliteQuizSetRepository>;
	readonly folders: ReturnType<typeof createSqliteFolderRepository>;
	readonly vocabulary: ReturnType<typeof createSqliteVocabularyRepository>;
	readonly repetition: ReturnType<typeof createSqliteRepetitionRepository>;
	readonly attempts: ReturnType<typeof createSqliteQuizAttemptRepository>;
	readonly clock: typeof systemClock;
	readonly idGenerator: typeof shortIdGenerator;
	readonly timezone: string;
	readonly transaction: Transaction;
}

@Global()
@Module({
	providers: [
		{
			provide: DATABASE,
			useFactory: (): Database => {
				const database = createDatabase({
					path: loadApiEnvironment().databasePath,
				});

				applyMigrations(database);

				return database;
			},
		},
		{
			provide: DRIZZLE,
			inject: [DATABASE],
			useFactory: (database: Database): QuizDatabase =>
				createDrizzleClient(database),
		},
		{
			provide: TRANSACTION,
			inject: [DRIZZLE],
			useFactory: (client: QuizDatabase): Transaction =>
				createSqliteTransaction(client),
		},
		{
			provide: USE_CASE_DEPENDENCIES,
			inject: [DRIZZLE, TRANSACTION],
			useFactory: (
				client: QuizDatabase,
				transaction: Transaction,
			): UseCaseDependencies => ({
				quizSets: createSqliteQuizSetRepository(client, transaction),
				folders: createSqliteFolderRepository(client, transaction),
				vocabulary: createSqliteVocabularyRepository(client, transaction),
				repetition: createSqliteRepetitionRepository(client, transaction, () =>
					systemClock.now(),
				),
				attempts: createSqliteQuizAttemptRepository(client, transaction),
				clock: systemClock,
				idGenerator: shortIdGenerator,
				timezone: process.env.APP_TIMEZONE ?? "UTC",
				transaction,
			}),
		},
	],
	exports: [DATABASE, DRIZZLE, TRANSACTION, USE_CASE_DEPENDENCIES],
})
export class DatabaseModule implements OnApplicationShutdown {
	constructor(@Inject(DATABASE) private readonly database: Database) {}

	onApplicationShutdown(): void {
		closeDatabase(this.database);
	}
}
