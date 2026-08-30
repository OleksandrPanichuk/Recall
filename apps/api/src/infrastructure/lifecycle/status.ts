import { count, eq, inArray } from "drizzle-orm";
import { QuizAttemptStatus } from "@/domain/quiz-attempt/quiz-attempt";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import { describeDatabaseUrl } from "@/infrastructure/config/database-url";
import type { RecallDatabase } from "@/persistence/postgres/client";
import {
	attempts,
	questions,
	quizzes,
	responses,
} from "@/persistence/postgres/schema";

export interface StatusReport {
	readonly databaseUrl: string;
	readonly timezone: string;
	readonly publishedSets: number;
	readonly draftSets: number;
	readonly questions: number;
	readonly completedAttempts: number;
	readonly unfinishedAttempts: number;
	readonly answeredQuestions: number;
}

export interface StatusOptions {
	readonly databaseUrl: string;
	readonly timezone: string;
}

const total = async (
	database: RecallDatabase,
	// biome-ignore lint/suspicious/noExplicitAny: any Drizzle table works here
	table: any,
	where?: ReturnType<typeof eq>,
): Promise<number> => {
	const [row] = await database
		.select({ value: count() })
		.from(table)
		.where(where);

	return Number(row?.value ?? 0);
};

export async function readStatus(
	database: RecallDatabase,
	options: StatusOptions,
): Promise<StatusReport> {
	return {
		databaseUrl: options.databaseUrl,
		timezone: options.timezone,
		publishedSets: await total(
			database,
			quizzes,
			eq(quizzes.status, QuizSetStatus.Published),
		),
		draftSets: await total(
			database,
			quizzes,
			eq(quizzes.status, QuizSetStatus.Draft),
		),
		questions: await total(database, questions),
		completedAttempts: await total(
			database,
			attempts,
			eq(attempts.status, QuizAttemptStatus.Completed),
		),
		unfinishedAttempts: await total(
			database,
			attempts,
			inArray(attempts.status, [
				QuizAttemptStatus.Active,
				QuizAttemptStatus.Paused,
			]),
		),
		answeredQuestions: await total(database, responses),
	};
}

export function formatStatus(report: StatusReport): string {
	return [
		`database        ${describeDatabaseUrl(report.databaseUrl)}`,
		`timezone        ${report.timezone}`,
		`published sets  ${report.publishedSets}`,
		`draft sets      ${report.draftSets}`,
		`questions       ${report.questions}`,
		`attempts done   ${report.completedAttempts}`,
		`attempts open   ${report.unfinishedAttempts}`,
		`answers stored  ${report.answeredQuestions}`,
	].join("\n");
}
