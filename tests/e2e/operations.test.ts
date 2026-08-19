import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { createMutableClock } from "@tests/fixtures/application.fixture";
import { createDrizzleClient } from "@/adapters/persistence/sqlite/database";
import {
	type Application,
	createApplication,
} from "@/composition/create-application";
import { QuizAttemptStatus } from "@/domain/quiz-attempt/quiz-attempt";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	assertRestorable,
	BackupError,
	backupDatabase,
} from "@/infrastructure/lifecycle/backup";
import { readStatus } from "@/infrastructure/lifecycle/status";
import { makeTempDirectory, removeTempDirectory } from "../fixtures/temp-dir";

const USER = 42;

let directory: string;
let databasePath: string;

beforeEach(() => {
	directory = makeTempDirectory("recall-ops-");
	databasePath = join(directory, "quiz.sqlite");
});

afterEach(() => {
	removeTempDirectory(directory);
});

const clock = createMutableClock();

const open = (): Application => createApplication({ databasePath, clock });

const aQuestion = (prompt: string) => ({
	type: QuestionType.SingleChoice,
	prompt,
	difficulty: Difficulty.Medium,
	options: [
		{ text: `Right for ${prompt}`, isCorrect: true },
		{ text: `Wrong for ${prompt}`, isCorrect: false },
	],
});

async function seed(application: Application): Promise<QuizSetId> {
	const { quizSetId } = await application.createQuizSet.execute({
		title: "Bun persistence",
		language: "uk",
	});

	await application.addQuestions.execute({
		quizSetId,
		questions: [aQuestion("One"), aQuestion("Two")],
	});
	await application.publishQuizSet.execute({ quizSetId });

	return quizSetId;
}

async function startAndAnswerOne(
	application: Application,
	quizSetId: QuizSetId,
): Promise<void> {
	await application.startQuizAttempt.execute({
		quizSetId,
		telegramUserId: USER,
	});

	const question = application.getQuizSet
		? (await application.getQuizSet.execute({ quizSetId })).questions[0]
		: undefined;

	clock.advance(60_000);
	await application.answerQuestion.execute({
		telegramUserId: USER,
		questionId: question?.id as never,
		selectedOptionPositions: [0],
	});
}

describe("backup and restore (§6.3)", () => {
	test("a restored backup carries quiz sets and attempt history", async () => {
		const application = open();
		const quizSetId = await seed(application);
		await startAndAnswerOne(application, quizSetId);
		clock.advance(60_000);
		await application.finishQuizAttempt.execute({ telegramUserId: USER });

		const backupPath = join(directory, "backup.sqlite");
		backupDatabase(databasePath, backupPath);
		application.close();

		rmSync(databasePath, { force: true });
		rmSync(`${databasePath}-wal`, { force: true });
		rmSync(`${databasePath}-shm`, { force: true });

		assertRestorable(backupPath);
		await Bun.write(databasePath, Bun.file(backupPath));

		const restored = open();
		const sets = await restored.listQuizSets.execute({});
		const statistics = await restored.getQuizStatistics.execute({
			telegramUserId: USER,
			quizSetId,
		});

		expect(sets).toHaveLength(1);
		expect(sets[0]?.questionCount).toBe(2);
		expect(statistics.attempts).toHaveLength(1);
		expect(statistics.attempts[0]?.score.correct).toBe(1);
		restored.close();
	});

	test("a backup can be taken while the database is open", async () => {
		const application = open();
		await seed(application);

		const backupPath = join(directory, "hot.sqlite");
		backupDatabase(databasePath, backupPath);

		assertRestorable(backupPath);
		application.close();
	});

	// applicationTables is the "is this a Recall backup" signature, not the live
	// table list: a backup taken before a feature shipped must still restore.
	test("restores a backup taken before the newer tables existed", async () => {
		const application = open();

		await seed(application);

		const backupPath = join(directory, "old.sqlite");

		backupDatabase(databasePath, backupPath);
		application.close();

		const older = new Database(backupPath);

		for (const table of [
			"repetition_defaults",
			"repetition_schedules",
			"repetition_settings",
			"vocabulary_items",
			"folders",
		]) {
			older.run(`DROP TABLE IF EXISTS ${table}`);
		}

		older.close();

		expect(() => {
			assertRestorable(backupPath);
		}).not.toThrow();
	});

	test("refuses to restore a file that is not a Recall backup", async () => {
		const application = open();
		await seed(application);
		application.close();

		const notADatabase = join(directory, "notes.txt");
		await Bun.write(notADatabase, "these are my notes, not a database");

		expect(() => {
			assertRestorable(notADatabase);
		}).toThrow(BackupError);
	});

	test("refuses to restore a SQLite file with the wrong schema", async () => {
		const stranger = join(directory, "stranger.sqlite");
		const { Database } = await import("bun:sqlite");
		const other = new Database(stranger, { create: true });

		other.run("CREATE TABLE unrelated (id TEXT)");
		other.close();

		expect(() => {
			assertRestorable(stranger);
		}).toThrow(BackupError);
	});

	test("reports a target it cannot write", async () => {
		const application = open();
		await seed(application);
		application.close();

		expect(() => {
			backupDatabase(databasePath, join(directory, "missing", "b.sqlite"));
		}).toThrow(BackupError);
	});
});

describe("restart continuity (§6.4)", () => {
	test("an unfinished attempt survives closing and reopening the database", async () => {
		const first = open();
		const quizSetId = await seed(first);
		await startAndAnswerOne(first, quizSetId);
		clock.advance(60_000);
		await first.pauseQuizAttempt.execute({ telegramUserId: USER });
		first.close();

		const second = open();
		const current = await second.getCurrentQuestion.execute({
			telegramUserId: USER,
		});

		expect(current?.index).toBe(1);
		expect(current?.status).toBe(QuizAttemptStatus.Paused);

		clock.advance(60_000);
		await second.resumeQuizAttempt.execute({ telegramUserId: USER });
		clock.advance(60_000);
		const finished = await second.finishQuizAttempt.execute({
			telegramUserId: USER,
		});

		expect(finished.score.correct).toBe(1);
		second.close();
	});
});

describe("status command (§6.4)", () => {
	test("counts what is in the database without reading content", async () => {
		const application = open();
		const quizSetId = await seed(application);
		await startAndAnswerOne(application, quizSetId);

		const report = readStatus(createDrizzleClient(application.database), {
			databasePath,
			timezone: "Europe/Kyiv",
		});

		expect(report).toEqual({
			databasePath,
			timezone: "Europe/Kyiv",
			publishedSets: 1,
			draftSets: 0,
			questions: 2,
			completedAttempts: 0,
			unfinishedAttempts: 1,
			answeredQuestions: 1,
		});
		application.close();
	});

	test("reports zeroes for a fresh database", () => {
		const application = open();

		const report = readStatus(createDrizzleClient(application.database), {
			databasePath,
			timezone: "UTC",
		});

		expect(report.publishedSets).toBe(0);
		expect(report.unfinishedAttempts).toBe(0);
		application.close();
	});
});
