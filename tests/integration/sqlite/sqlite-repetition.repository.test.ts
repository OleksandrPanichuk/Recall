import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDrizzleClient } from "@/adapters/persistence/sqlite/database";
import { createSqliteQuizSetRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository";
import { createSqliteRepetitionRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-repetition.repository";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import { toQuestionId } from "@/domain/quiz-set/question";
import { QuizSetStatus, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	defaultRepetitionSettings,
	type RepetitionSchedule,
} from "@/domain/repetition/repetition";
import { aQuestion, aQuizSet } from "../../fixtures/quiz-set.fixture";
import { openMigratedDatabase } from "./migrated-database";

const at = (iso: string): Date => new Date(iso);
const now = at("2026-08-15T09:00:00.000Z");
const user = 42;

let database: Database;
let repetition: RepetitionRepository;
let quizSets: QuizSetRepository;

beforeEach(() => {
	database = openMigratedDatabase();

	const client = createDrizzleClient(database);
	const transaction = createSqliteTransaction(client);

	repetition = createSqliteRepetitionRepository(client, transaction, () => now);
	quizSets = createSqliteQuizSetRepository(client, transaction);
});

afterEach(() => {
	database.close();
});

describe("schedules", () => {
	const seedQuestions = (setId: string, count: number): string[] => {
		const ids = Array.from({ length: count }, (_v, i) => `${setId}-q${i}`);
		const draft = aQuizSet({
			id: setId,
			questions: ids.map((id) => aQuestion({ id })),
		});

		quizSets.save({
			...draft,
			status: QuizSetStatus.Published,
			publishedAt: now,
		});

		return ids;
	};

	const schedule = (
		questionId: string,
		dueAt: Date | undefined,
		overrides: Partial<RepetitionSchedule> = {},
	): RepetitionSchedule => ({
		questionId: toQuestionId(questionId),
		telegramUserId: user,
		repetitionCount: 1,
		lapses: 0,
		lastCompletedAt: now,
		dueAt,
		...overrides,
	});

	test("round-trips a schedule", () => {
		seedQuestions("set-1", 1);
		repetition.saveSchedules([
			schedule("set-1-q0", at("2026-08-16T09:00:00.000Z")),
		]);

		const [stored] = repetition.findSchedules([toQuestionId("set-1-q0")], user);

		expect(stored?.repetitionCount).toBe(1);
		expect(stored?.dueAt).toEqual(at("2026-08-16T09:00:00.000Z"));
	});

	test("round-trips a retired schedule", () => {
		seedQuestions("set-1", 1);
		repetition.saveSchedules([
			schedule("set-1-q0", undefined, { repetitionCount: 10 }),
		]);

		expect(
			repetition.findSchedules([toQuestionId("set-1-q0")], user)[0]?.dueAt,
		).toBeUndefined();
	});

	test("saving twice updates rather than duplicating", () => {
		seedQuestions("set-1", 1);
		repetition.saveSchedules([
			schedule("set-1-q0", at("2026-08-16T09:00:00.000Z")),
		]);
		repetition.saveSchedules([
			schedule("set-1-q0", at("2026-08-20T09:00:00.000Z"), {
				repetitionCount: 2,
			}),
		]);

		const [stored] = repetition.findSchedules([toQuestionId("set-1-q0")], user);

		expect(stored?.repetitionCount).toBe(2);
		expect(stored?.dueAt).toEqual(at("2026-08-20T09:00:00.000Z"));
	});

	test("lists what is due, most overdue first", () => {
		const ids = seedQuestions("set-1", 3);

		repetition.saveSchedules([
			schedule(ids[0] as string, at("2026-08-14T09:00:00.000Z")),
			schedule(ids[1] as string, at("2026-08-10T09:00:00.000Z")),
			schedule(ids[2] as string, at("2026-08-20T09:00:00.000Z")),
		]);

		expect(
			repetition.listDue(user, now).map((entry) => String(entry.questionId)),
		).toEqual([ids[1] as string, ids[0] as string]);
	});

	test("never lists a retired schedule", () => {
		seedQuestions("set-1", 1);
		repetition.saveSchedules([schedule("set-1-q0", undefined)]);

		expect(repetition.listDue(user, now)).toEqual([]);
	});

	test("keeps another user's schedules out", () => {
		seedQuestions("set-1", 1);
		repetition.saveSchedules([
			schedule("set-1-q0", at("2026-08-10T09:00:00.000Z"), {
				telegramUserId: 7,
			}),
		]);

		expect(repetition.listDue(user, now)).toEqual([]);
	});

	test("goes away with its question", () => {
		seedQuestions("set-1", 1);
		repetition.saveSchedules([
			schedule("set-1-q0", at("2026-08-14T09:00:00.000Z")),
		]);

		database.run("DELETE FROM quiz_sets WHERE id = 'set-1'");

		expect(repetition.findSchedules([toQuestionId("set-1-q0")], user)).toEqual(
			[],
		);
	});

	test("lists the questions that keep being forgotten", () => {
		const ids = seedQuestions("set-1", 3);

		repetition.saveSchedules([
			schedule(ids[0] as string, at("2026-08-20T00:00:00.000Z"), { lapses: 7 }),
			schedule(ids[1] as string, at("2026-08-20T00:00:00.000Z"), { lapses: 5 }),
			schedule(ids[2] as string, at("2026-08-20T00:00:00.000Z"), { lapses: 1 }),
		]);

		expect(
			repetition.listLeeches(user, 5).map((entry) => String(entry.questionId)),
		).toEqual([ids[0] as string, ids[1] as string]);
	});
});

describe("settings", () => {
	const seedSet = (id: string): void => {
		const draft = aQuizSet({ id, questions: [aQuestion({ id: `${id}-q` })] });

		quizSets.save({
			...draft,
			status: QuizSetStatus.Published,
			publishedAt: now,
		});
	};

	const custom = {
		repetition: { ...defaultRepetitionSettings(), maxIntervalDays: 7 },
		shuffleOptions: false,
	};

	test("round-trips per-set settings", () => {
		seedSet("set-1");
		repetition.saveSettings(toQuizSetId("set-1"), custom);

		expect(
			repetition.findSettings(toQuizSetId("set-1"))?.repetition.maxIntervalDays,
		).toBe(7);
	});

	test("has none until saved", () => {
		expect(repetition.findSettings(toQuizSetId("set-1"))).toBeUndefined();
		expect(repetition.findDefaults()).toBeUndefined();
	});

	test("round-trips defaults and keeps exactly one row", () => {
		repetition.saveDefaults(custom);
		repetition.saveDefaults({
			...custom,
			repetition: { ...custom.repetition, maxRepetitions: 4 },
		});

		expect(repetition.findDefaults()?.repetition.maxRepetitions).toBe(4);
		expect(
			database.query("SELECT count(*) AS total FROM repetition_defaults").get(),
		).toEqual({ total: 1 });
	});

	test("round-trips the interval list itself", () => {
		repetition.saveDefaults({
			...custom,
			repetition: { ...custom.repetition, intervalsDays: [1, 3, 9, 27] },
		});

		expect(repetition.findDefaults()?.repetition.intervalsDays).toEqual([
			1, 3, 9, 27,
		]);
	});

	test("names the row when the interval list is not JSON", () => {
		repetition.saveDefaults(custom);
		database.run("UPDATE repetition_defaults SET intervals_days = 'oops'");

		expect(() => repetition.findDefaults()).toThrow(/intervals_days/);
	});

	test("round-trips the shuffle toggle", () => {
		seedSet("set-1");
		repetition.saveSettings(toQuizSetId("set-1"), {
			...custom,
			shuffleOptions: true,
		});

		expect(repetition.findSettings(toQuizSetId("set-1"))?.shuffleOptions).toBe(
			true,
		);
	});

	test("clearing a set's settings sends it back to the global ones", () => {
		seedSet("set-1");
		repetition.saveSettings(toQuizSetId("set-1"), custom);
		repetition.clearSettings(toQuizSetId("set-1"));

		expect(repetition.findSettings(toQuizSetId("set-1"))).toBeUndefined();
	});

	test("refuses a second defaults row", () => {
		repetition.saveDefaults(custom);

		expect(() => {
			database.run(
				"INSERT INTO repetition_defaults (id, intervals_days, max_interval_days, max_repetitions, updated_at) VALUES (2, '[1]', 1, 1, '2026-08-15T09:00:00.000Z')",
			);
		}).toThrow();
	});
});
