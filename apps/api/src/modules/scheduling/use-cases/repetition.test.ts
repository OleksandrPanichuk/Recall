import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { attemptsOver } from "@tests/fixtures/attempts.use-cases";
import {
	createMemoryContext,
	type MemoryContext,
} from "@tests/fixtures/memory.fixture";
import {
	AnswerQuestionUseCase,
	FinishQuizAttemptUseCase,
	GetCurrentQuestionUseCase,
	StartQuizAttemptUseCase,
} from "@/modules/attempts";
import { QuizSetStatus, toQuizSetId } from "@/modules/quizzes";
import { ScheduleEntity } from "@/modules/scheduling";
import {
	StudySettingsService,
	UpdateQuizSettingsUseCase,
} from "@/modules/study-settings";
import {
	aQuestion,
	aQuizSet,
} from "../../../../tests/fixtures/quiz-set.fixture";
import { ListDueRepetitionsUseCase } from "./list-due-repetitions";

const USER = 42;
const day = 24 * 60 * 60 * 1000;

let context: MemoryContext;
let start: StartQuizAttemptUseCase;
let finish: FinishQuizAttemptUseCase;
let listDue: ListDueRepetitionsUseCase;
let answer: AnswerQuestionUseCase;
let current: GetCurrentQuestionUseCase;
let updateSettings: UpdateQuizSettingsUseCase;

beforeEach(() => {
	context = createMemoryContext();
	start = attemptsOver(context).startQuizAttempt;
	finish = attemptsOver(context).finishQuizAttempt;
	listDue = new ListDueRepetitionsUseCase(
		context.scope.reviews,
		context.scope.quizzes,
		context.clock,
		{ name: () => context.timezone },
	);
	answer = attemptsOver(context).answerQuestion;
	current = attemptsOver(context).getCurrentQuestion;
	updateSettings = new UpdateQuizSettingsUseCase(
		new StudySettingsService(context.scope.reviews),
		context.scope.quizzes,
		context.transaction,
	);
});

afterEach(() => {
	context.close();
});

const publish = async (id: string, title = id): Promise<void> => {
	const draft = aQuizSet({
		id,
		title,
		questions: [aQuestion({ id: `${id}-q` })],
	});

	await context.unitOfWork.run(({ quizzes }) =>
		quizzes.save({
			...draft,
			status: QuizSetStatus.Published,
			publishedAt: context.clock.now(),
		}),
	);
};

const takeAndFinish = async (id: string): Promise<void> => {
	await start.execute({ quizSetId: toQuizSetId(id), telegramUserId: USER });

	const view = await current.execute({});

	if (view?.question !== undefined) {
		await answer.execute({
			questionId: view.question.id,
			selectedOptionPositions: [0],
		});
	}

	await finish.execute({});
};

const abandon = async (id: string): Promise<void> => {
	await start.execute({ quizSetId: toQuizSetId(id), telegramUserId: USER });
	await finish.execute({});
};

describe("finishing an attempt schedules a repetition", () => {
	test("the set comes back the next day", async () => {
		await publish("set-1");
		await takeAndFinish("set-1");

		expect(await listDue.execute({})).toEqual([]);

		context.clock.advance(day);

		const due = await listDue.execute({});

		expect(due).toHaveLength(1);
		expect(due[0]?.dueCount).toBe(1);
	});

	test("taking it again pushes it three days out", async () => {
		await publish("set-1");
		await takeAndFinish("set-1");
		context.clock.advance(day);
		await takeAndFinish("set-1");

		context.clock.advance(2 * day);
		expect(await listDue.execute({})).toEqual([]);

		context.clock.advance(day);
		expect(await listDue.execute({})).toHaveLength(1);
	});

	test("a missed repetition does not shorten the next one", async () => {
		await publish("set-1");
		await takeAndFinish("set-1");

		context.clock.advance(30 * day);
		await takeAndFinish("set-1");

		context.clock.advance(2 * day);
		expect(await listDue.execute({})).toEqual([]);

		context.clock.advance(day);
		expect(await listDue.execute({})).toHaveLength(1);
	});

	test("the most overdue set comes first", async () => {
		await publish("old", "Old");
		await publish("new", "New");
		await takeAndFinish("old");
		context.clock.advance(10 * day);
		await takeAndFinish("new");
		context.clock.advance(2 * day);

		expect((await listDue.execute({})).map((entry) => entry.title)).toEqual([
			"Old",
			"New",
		]);
	});

	test("reports how many days overdue", async () => {
		await publish("set-1");
		await takeAndFinish("set-1");
		context.clock.advance(6 * day);

		expect((await listDue.execute({}))[0]?.overdueDays).toBe(5);
	});

	test("retires a set after the configured number of repetitions", async () => {
		await publish("set-1");
		await updateSettings.execute({
			quizSetId: toQuizSetId("set-1"),
			repetition: { ...ScheduleEntity.defaultSettings(), maxRepetitions: 2 },
		});

		await takeAndFinish("set-1");

		for (let repetition = 0; repetition < 2; repetition += 1) {
			context.clock.advance(30 * day);

			expect(await listDue.execute({})).toHaveLength(1);

			await takeAndFinish("set-1");
		}

		context.clock.advance(365 * day);

		expect(await listDue.execute({})).toEqual([]);
	});
});

describe("attempts that answer nothing", () => {
	test("do not schedule a repetition", async () => {
		await publish("set-1");
		await abandon("set-1");

		context.clock.advance(365 * day);

		expect(await listDue.execute({})).toEqual([]);
	});

	test("do not advance a schedule that already exists", async () => {
		await publish("set-1");
		await takeAndFinish("set-1");
		context.clock.advance(day);
		await abandon("set-1");

		expect(await listDue.execute({})).toHaveLength(1);
		expect((await listDue.execute({}))[0]?.dueCount).toBe(1);
	});
});

describe("sets that cannot be taken", () => {
	test("an archived set is not offered", async () => {
		await publish("set-1");
		await takeAndFinish("set-1");
		context.clock.advance(2 * day);

		expect(await listDue.execute({})).toHaveLength(1);

		const stored = await context.scope.quizzes.findById(toQuizSetId("set-1"));

		await context.unitOfWork.run(({ quizzes }) =>
			quizzes.save({
				...(stored as NonNullable<typeof stored>),
				status: QuizSetStatus.Archived,
				archivedAt: context.clock.now(),
			}),
		);

		expect(await listDue.execute({})).toEqual([]);
	});
});

describe("settings resolution", () => {
	test("falls back to the built-in defaults", async () => {
		expect(
			(
				await new StudySettingsService(context.scope.reviews).repetitionFor(
					toQuizSetId("set-1"),
				)
			).maxIntervalDays,
		).toBe(ScheduleEntity.defaultSettings().maxIntervalDays);
	});

	test("a global setting beats the built-in default", async () => {
		await updateSettings.execute({
			repetition: { ...ScheduleEntity.defaultSettings(), maxIntervalDays: 7 },
		});

		expect(
			(
				await new StudySettingsService(context.scope.reviews).repetitionFor(
					toQuizSetId("set-1"),
				)
			).maxIntervalDays,
		).toBe(7);
	});

	test("refuses settings for a set that does not exist", async () => {
		await expect(
			updateSettings.execute({
				quizSetId: toQuizSetId("ghost"),
				repetition: ScheduleEntity.defaultSettings(),
			}),
		).rejects.toBeInstanceOf(Error);
	});

	test("a per-set setting beats the global one", async () => {
		await publish("set-1");
		await updateSettings.execute({
			repetition: { ...ScheduleEntity.defaultSettings(), maxIntervalDays: 7 },
		});
		await updateSettings.execute({
			quizSetId: toQuizSetId("set-1"),
			repetition: { ...ScheduleEntity.defaultSettings(), maxIntervalDays: 14 },
		});

		expect(
			(
				await new StudySettingsService(context.scope.reviews).repetitionFor(
					toQuizSetId("set-1"),
				)
			).maxIntervalDays,
		).toBe(14);
	});

	test("a per-set ceiling pins the interval", async () => {
		await publish("set-1");
		await updateSettings.execute({
			quizSetId: toQuizSetId("set-1"),
			repetition: { ...ScheduleEntity.defaultSettings(), maxIntervalDays: 1 },
		});

		await takeAndFinish("set-1");
		context.clock.advance(day);

		expect(await listDue.execute({})).toHaveLength(1);
	});
});
