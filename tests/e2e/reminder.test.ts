import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { startDailyReminder } from "@/adapters/telegram/reminders";
import { AnswerQuestion } from "@/application/use-cases/attempts/answer-question";
import { FinishQuizAttempt } from "@/application/use-cases/attempts/finish-quiz-attempt";
import { GetCurrentQuestion } from "@/application/use-cases/attempts/get-current-question";
import { StartQuizAttempt } from "@/application/use-cases/attempts/start-quiz-attempt";
import { ListDueRepetitions } from "@/application/use-cases/repetition/list-due-repetitions";
import { QuizSetStatus, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	createMutableClock,
	createTestContext,
	type TestContext,
} from "../fixtures/application.fixture";
import { aQuestion, aQuizSet } from "../fixtures/quiz-set.fixture";

const USER = 42;
const day = 24 * 60 * 60 * 1000;

let context: TestContext;
let sent: { chat: number; text: string }[];

const fakeBot = {
	telegram: {
		sendMessage: async (chat: number, text: string) => {
			sent.push({ chat, text });
		},
	},
};

beforeEach(() => {
	context = createTestContext();
	sent = [];
});

afterEach(() => {
	context.close();
});

const publishAndTake = async (id: string, title: string): Promise<void> => {
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

	await new StartQuizAttempt(context).execute({
		quizSetId: toQuizSetId(id),
		telegramUserId: USER,
	});

	const view = await new GetCurrentQuestion(context).execute({
		telegramUserId: USER,
	});

	if (view?.question !== undefined) {
		await new AnswerQuestion(context).execute({
			telegramUserId: USER,
			questionId: view.question.id,
			selectedOptionPositions: [0],
		});
	}

	await new FinishQuizAttempt(context).execute({ telegramUserId: USER });
};

const fireOnce = async (): Promise<void> => {
	const listDueRepetitions = new ListDueRepetitions(context);
	const due = await listDueRepetitions.execute({ telegramUserId: USER });

	if (due.length === 0) {
		return;
	}

	await fakeBot.telegram.sendMessage(
		USER,
		(
			await import("@/adapters/telegram/presenters/repetitions.presenter")
		).repetitionsScreen(due).text,
	);
};

describe("daily reminder", () => {
	test("says nothing when nothing is due", async () => {
		await publishAndTake("set-1", "Alpha");

		await fireOnce();

		expect(sent).toEqual([]);
	});

	test("lists what is due, most overdue first", async () => {
		await publishAndTake("set-1", "Alpha");
		context.clock.advance(10 * day);
		await publishAndTake("set-2", "Beta");
		context.clock.advance(2 * day);

		await fireOnce();

		expect(sent).toHaveLength(1);
		expect(sent[0]?.chat).toBe(USER);

		const lines = (sent[0]?.text ?? "")
			.split("\n")
			.filter((line) => line.startsWith("•"));

		expect(lines[0]).toContain("Alpha");
		expect(lines[1]).toContain("Beta");
	});

	test("stops cleanly", () => {
		const timer = startDailyReminder({
			bot: fakeBot as never,
			listDueRepetitions: new ListDueRepetitions(context),
			telegramUserId: USER,
			timezone: "Europe/Kyiv",
			hour: 9,
			now: () => createMutableClock().now(),
		});

		expect(() => {
			timer.stop();
		}).not.toThrow();
	});
});
