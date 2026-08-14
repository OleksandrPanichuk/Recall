import { resolve } from "node:path";
import { count, eq, inArray } from "drizzle-orm";
import type { QuizDatabase } from "@/adapters/persistence/sqlite/database";
import {
	questionResponses,
	questions,
	quizAttempts,
	quizSets,
} from "@/adapters/persistence/sqlite/schema";
import { QuizAttemptStatus } from "@/domain/quiz-attempt/quiz-attempt";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";

export interface StatusReport {
	readonly databasePath: string;
	readonly timezone: string;
	readonly publishedSets: number;
	readonly draftSets: number;
	readonly questions: number;
	readonly completedAttempts: number;
	readonly unfinishedAttempts: number;
	readonly answeredQuestions: number;
}

export interface StatusOptions {
	readonly databasePath: string;
	readonly timezone: string;
}

const total = (
	database: QuizDatabase,
	// biome-ignore lint/suspicious/noExplicitAny: any Drizzle table works here
	table: any,
	where?: ReturnType<typeof eq>,
): number =>
	database.select({ value: count() }).from(table).where(where).get()?.value ??
	0;

/** A read-only snapshot for the health command. Never touches user content. */
export function readStatus(
	database: QuizDatabase,
	options: StatusOptions,
): StatusReport {
	return {
		databasePath: options.databasePath,
		timezone: options.timezone,
		publishedSets: total(
			database,
			quizSets,
			eq(quizSets.status, QuizSetStatus.Published),
		),
		draftSets: total(
			database,
			quizSets,
			eq(quizSets.status, QuizSetStatus.Draft),
		),
		questions: total(database, questions),
		completedAttempts: total(
			database,
			quizAttempts,
			eq(quizAttempts.status, QuizAttemptStatus.Completed),
		),
		unfinishedAttempts:
			database
				.select({ value: count() })
				.from(quizAttempts)
				.where(
					inArray(quizAttempts.status, [
						QuizAttemptStatus.Active,
						QuizAttemptStatus.Paused,
					]),
				)
				.get()?.value ?? 0,
		answeredQuestions: total(database, questionResponses),
	};
}

export function formatStatus(report: StatusReport): string {
	return [
		`database:            ${resolve(report.databasePath)}`,
		`timezone:            ${report.timezone}`,
		`published sets:      ${report.publishedSets}`,
		`draft sets:          ${report.draftSets}`,
		`questions:           ${report.questions}`,
		`completed attempts:  ${report.completedAttempts}`,
		`unfinished attempts: ${report.unfinishedAttempts}`,
		`answered questions:  ${report.answeredQuestions}`,
	].join("\n");
}
