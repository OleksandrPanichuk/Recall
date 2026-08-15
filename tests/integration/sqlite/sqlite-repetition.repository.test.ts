import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDrizzleClient } from "@/adapters/persistence/sqlite/database";
import { createSqliteQuizSetRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository";
import { createSqliteRepetitionRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-repetition.repository";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
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

const seedSet = (id: string): void => {
	const draft = aQuizSet({ id, questions: [aQuestion({ id: `${id}-q` })] });

	quizSets.save({
		...draft,
		status: QuizSetStatus.Published,
		publishedAt: now,
	});
};

const schedule = (
	id: string,
	dueAt: Date | undefined,
	count = 1,
): RepetitionSchedule => ({
	quizSetId: toQuizSetId(id),
	telegramUserId: user,
	repetitionCount: count,
	lastCompletedAt: now,
	dueAt,
});

describe("schedules", () => {
	test("round-trips a schedule", () => {
		seedSet("set-1");
		repetition.saveSchedule(schedule("set-1", at("2026-08-16T09:00:00.000Z")));

		const stored = repetition.findSchedule(toQuizSetId("set-1"), user);

		expect(stored?.repetitionCount).toBe(1);
		expect(stored?.dueAt).toEqual(at("2026-08-16T09:00:00.000Z"));
	});

	test("round-trips a retired schedule", () => {
		seedSet("set-1");
		repetition.saveSchedule(schedule("set-1", undefined, 10));

		expect(
			repetition.findSchedule(toQuizSetId("set-1"), user)?.dueAt,
		).toBeUndefined();
	});

	test("saving twice updates rather than duplicating", () => {
		seedSet("set-1");
		repetition.saveSchedule(schedule("set-1", at("2026-08-16T09:00:00.000Z")));
		repetition.saveSchedule(
			schedule("set-1", at("2026-08-20T09:00:00.000Z"), 2),
		);

		const stored = repetition.findSchedule(toQuizSetId("set-1"), user);

		expect(stored?.repetitionCount).toBe(2);
		expect(stored?.dueAt).toEqual(at("2026-08-20T09:00:00.000Z"));
	});

	test("lists what is due, most overdue first", () => {
		seedSet("set-1");
		seedSet("set-2");
		seedSet("set-3");
		repetition.saveSchedule(schedule("set-1", at("2026-08-14T09:00:00.000Z")));
		repetition.saveSchedule(schedule("set-2", at("2026-08-10T09:00:00.000Z")));
		repetition.saveSchedule(schedule("set-3", at("2026-08-20T09:00:00.000Z")));

		expect(
			repetition.listDue(user, now).map((entry) => String(entry.quizSetId)),
		).toEqual(["set-2", "set-1"]);
	});

	test("never lists a retired schedule", () => {
		seedSet("set-1");
		repetition.saveSchedule(schedule("set-1", undefined));

		expect(repetition.listDue(user, now)).toEqual([]);
	});

	test("keeps another user's schedules out", () => {
		seedSet("set-1");
		repetition.saveSchedule({
			...schedule("set-1", at("2026-08-10T09:00:00.000Z")),
			telegramUserId: 7,
		});

		expect(repetition.listDue(user, now)).toEqual([]);
	});

	test("goes away with its quiz set", () => {
		seedSet("set-1");
		repetition.saveSchedule(schedule("set-1", at("2026-08-14T09:00:00.000Z")));

		database.run("DELETE FROM quiz_sets WHERE id = 'set-1'");

		expect(repetition.findSchedule(toQuizSetId("set-1"), user)).toBeUndefined();
	});
});

describe("settings", () => {
	const custom = { ...defaultRepetitionSettings(), maxIntervalDays: 7 };

	test("round-trips per-set settings", () => {
		seedSet("set-1");
		repetition.saveSettings(toQuizSetId("set-1"), custom);

		expect(repetition.findSettings(toQuizSetId("set-1"))?.maxIntervalDays).toBe(
			7,
		);
	});

	test("has none until saved", () => {
		expect(repetition.findSettings(toQuizSetId("set-1"))).toBeUndefined();
		expect(repetition.findDefaults()).toBeUndefined();
	});

	test("round-trips defaults and keeps exactly one row", () => {
		repetition.saveDefaults(custom);
		repetition.saveDefaults({ ...custom, maxRepetitions: 4 });

		expect(repetition.findDefaults()?.maxRepetitions).toBe(4);
		expect(
			database.query("SELECT count(*) AS total FROM repetition_defaults").get(),
		).toEqual({ total: 1 });
	});

	test("round-trips the interval list itself", () => {
		repetition.saveDefaults({ ...custom, intervalsDays: [1, 3, 9, 27] });

		expect(repetition.findDefaults()?.intervalsDays).toEqual([1, 3, 9, 27]);
	});

	test("names the row when the interval list is not JSON", () => {
		repetition.saveDefaults(custom);
		database.run("UPDATE repetition_defaults SET intervals_days = 'oops'");

		expect(() => repetition.findDefaults()).toThrow(/intervals_days/);
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
