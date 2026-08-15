import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { FinishQuizAttempt } from "@/application/use-cases/attempts/finish-quiz-attempt";
import { StartQuizAttempt } from "@/application/use-cases/attempts/start-quiz-attempt";
import { QuizSetStatus, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { defaultRepetitionSettings } from "@/domain/repetition/repetition";
import {
	createTestContext,
	type TestContext,
} from "../../../../tests/fixtures/application.fixture";
import {
	aQuestion,
	aQuizSet,
} from "../../../../tests/fixtures/quiz-set.fixture";
import { ListDueRepetitions } from "./list-due-repetitions";
import { resolveRepetitionSettings } from "./resolve-repetition-settings";
import { UpdateRepetitionSettings } from "./update-repetition-settings";

const USER = 42;
const day = 24 * 60 * 60 * 1000;

let context: TestContext;
let start: StartQuizAttempt;
let finish: FinishQuizAttempt;
let listDue: ListDueRepetitions;
let updateSettings: UpdateRepetitionSettings;

beforeEach(() => {
	context = createTestContext();
	start = new StartQuizAttempt(context);
	finish = new FinishQuizAttempt(context);
	listDue = new ListDueRepetitions(context);
	updateSettings = new UpdateRepetitionSettings(context);
});

afterEach(() => {
	context.close();
});

const publish = (id: string, title = id): void => {
	const draft = aQuizSet({
		id,
		title,
		questions: [aQuestion({ id: `${id}-q` })],
	});

	context.quizSets.save({
		...draft,
		status: QuizSetStatus.Published,
		publishedAt: context.clock.now(),
	});
};

const takeAndFinish = async (id: string): Promise<void> => {
	await start.execute({ quizSetId: toQuizSetId(id), telegramUserId: USER });
	await finish.execute({ telegramUserId: USER });
};

describe("finishing an attempt schedules a repetition", () => {
	test("the set comes back the next day", async () => {
		publish("set-1");
		await takeAndFinish("set-1");

		expect(await listDue.execute({ telegramUserId: USER })).toEqual([]);

		context.clock.advance(day);

		const due = await listDue.execute({ telegramUserId: USER });

		expect(due).toHaveLength(1);
		expect(due[0]?.repetitionCount).toBe(1);
	});

	test("taking it again pushes it three days out", async () => {
		publish("set-1");
		await takeAndFinish("set-1");
		context.clock.advance(day);
		await takeAndFinish("set-1");

		context.clock.advance(2 * day);
		expect(await listDue.execute({ telegramUserId: USER })).toEqual([]);

		context.clock.advance(day);
		expect(await listDue.execute({ telegramUserId: USER })).toHaveLength(1);
	});

	test("a missed repetition does not shorten the next one", async () => {
		publish("set-1");
		await takeAndFinish("set-1");

		context.clock.advance(30 * day);
		await takeAndFinish("set-1");

		context.clock.advance(2 * day);
		expect(await listDue.execute({ telegramUserId: USER })).toEqual([]);

		context.clock.advance(day);
		expect(await listDue.execute({ telegramUserId: USER })).toHaveLength(1);
	});

	test("the most overdue set comes first", async () => {
		publish("old", "Old");
		publish("new", "New");
		await takeAndFinish("old");
		context.clock.advance(10 * day);
		await takeAndFinish("new");
		context.clock.advance(2 * day);

		expect(
			(await listDue.execute({ telegramUserId: USER })).map(
				(entry) => entry.title,
			),
		).toEqual(["Old", "New"]);
	});

	test("reports how many days overdue", async () => {
		publish("set-1");
		await takeAndFinish("set-1");
		context.clock.advance(6 * day);

		expect(
			(await listDue.execute({ telegramUserId: USER }))[0]?.overdueDays,
		).toBe(5);
	});

	test("retires a set once its repetition limit is reached", async () => {
		publish("set-1");
		await updateSettings.execute({
			quizSetId: toQuizSetId("set-1"),
			settings: { ...defaultRepetitionSettings(), maxRepetitions: 2 },
		});

		await takeAndFinish("set-1");
		context.clock.advance(day);
		expect(await listDue.execute({ telegramUserId: USER })).toHaveLength(1);

		await takeAndFinish("set-1");
		context.clock.advance(365 * day);

		expect(await listDue.execute({ telegramUserId: USER })).toEqual([]);
	});
});

describe("settings resolution", () => {
	test("falls back to the built-in defaults", () => {
		expect(
			resolveRepetitionSettings(context.repetition, toQuizSetId("set-1"))
				.maxIntervalDays,
		).toBe(defaultRepetitionSettings().maxIntervalDays);
	});

	test("a global setting beats the built-in default", async () => {
		await updateSettings.execute({
			settings: { ...defaultRepetitionSettings(), maxIntervalDays: 7 },
		});

		expect(
			resolveRepetitionSettings(context.repetition, toQuizSetId("set-1"))
				.maxIntervalDays,
		).toBe(7);
	});

	test("a per-set setting beats the global one", async () => {
		publish("set-1");
		await updateSettings.execute({
			settings: { ...defaultRepetitionSettings(), maxIntervalDays: 7 },
		});
		await updateSettings.execute({
			quizSetId: toQuizSetId("set-1"),
			settings: { ...defaultRepetitionSettings(), maxIntervalDays: 14 },
		});

		expect(
			resolveRepetitionSettings(context.repetition, toQuizSetId("set-1"))
				.maxIntervalDays,
		).toBe(14);
	});

	test("a per-set ceiling pins the interval", async () => {
		publish("set-1");
		await updateSettings.execute({
			quizSetId: toQuizSetId("set-1"),
			settings: { ...defaultRepetitionSettings(), maxIntervalDays: 1 },
		});

		await takeAndFinish("set-1");
		context.clock.advance(day);

		expect(await listDue.execute({ telegramUserId: USER })).toHaveLength(1);
	});
});
