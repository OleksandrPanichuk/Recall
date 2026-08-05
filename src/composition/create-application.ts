import type { Database } from "bun:sqlite";
import { createDatabase } from "@/adapters/persistence/sqlite/database";
import { applyMigrations } from "@/adapters/persistence/sqlite/migrator";
import { createSqliteQuizAttemptRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-attempt.repository";
import { createSqliteQuizSetRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository";
import { createSqliteReviewRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-review.repository";
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
import { AddQuestions } from "@/application/use-cases/quiz-sets/add-questions";
import { ArchiveQuizSet } from "@/application/use-cases/quiz-sets/archive-quiz-set";
import { CreateQuizSet } from "@/application/use-cases/quiz-sets/create-quiz-set";
import { GetQuizSet } from "@/application/use-cases/quiz-sets/get-quiz-set";
import { ListQuizSets } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import { PublishQuizSet } from "@/application/use-cases/quiz-sets/publish-quiz-set";
import { UpdateQuizSet } from "@/application/use-cases/quiz-sets/update-quiz-set";
import { GetQuizStatistics } from "@/application/use-cases/statistics/get-quiz-statistics";

export const systemClock: Clock = { now: () => new Date() };

/**
 * Short, URL-safe, collision-resistant enough for a single user's library. Ids
 * travel inside Telegram callback payloads, which are capped at 64 bytes, so a
 * 36-character UUID would crowd out everything else.
 */
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
	readonly publishQuizSet: PublishQuizSet;
	readonly archiveQuizSet: ArchiveQuizSet;
	readonly listQuizSets: ListQuizSets;
	readonly getQuizSet: GetQuizSet;
	readonly startQuizAttempt: StartQuizAttempt;
	readonly pauseQuizAttempt: PauseQuizAttempt;
	readonly resumeQuizAttempt: ResumeQuizAttempt;
	readonly getCurrentQuestion: GetCurrentQuestion;
	readonly answerQuestion: AnswerQuestion;
	readonly finishQuizAttempt: FinishQuizAttempt;
	readonly getQuizStatistics: GetQuizStatistics;
	close(): void;
}

export interface ApplicationOptions {
	readonly databasePath: string;
	readonly clock?: Clock;
	readonly idGenerator?: IdGenerator;
}

export function createApplication(options: ApplicationOptions): Application {
	const database = createDatabase({ path: options.databasePath });

	applyMigrations(database);

	const transaction = createSqliteTransaction(database);
	const dependencies = {
		quizSets: createSqliteQuizSetRepository(database, transaction),
		attempts: createSqliteQuizAttemptRepository(database, transaction),
		reviews: createSqliteReviewRepository(database, transaction),
		clock: options.clock ?? systemClock,
		idGenerator: options.idGenerator ?? shortIdGenerator,
		transaction,
	};

	return {
		database,
		createQuizSet: new CreateQuizSet(dependencies),
		updateQuizSet: new UpdateQuizSet(dependencies),
		addQuestions: new AddQuestions(dependencies),
		publishQuizSet: new PublishQuizSet(dependencies),
		archiveQuizSet: new ArchiveQuizSet(dependencies),
		listQuizSets: new ListQuizSets(dependencies),
		getQuizSet: new GetQuizSet(dependencies),
		startQuizAttempt: new StartQuizAttempt(dependencies),
		pauseQuizAttempt: new PauseQuizAttempt(dependencies),
		resumeQuizAttempt: new ResumeQuizAttempt(dependencies),
		getCurrentQuestion: new GetCurrentQuestion(dependencies),
		answerQuestion: new AnswerQuestion(dependencies),
		finishQuizAttempt: new FinishQuizAttempt(dependencies),
		getQuizStatistics: new GetQuizStatistics(dependencies),
		close: () => {
			database.close();
		},
	};
}
