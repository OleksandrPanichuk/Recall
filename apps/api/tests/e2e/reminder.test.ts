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
interface SentMessage {
	readonly chat: number;
	readonly text: string;
	readonly markup?: { inline_keyboard?: unknown[] };
}

let sent: SentMessage[];

const fakeBot = {
	telegram: {
		sendMessage: async (
			chat: number,
			text: string,
			extra?: { reply_markup?: { inline_keyboard?: unknown[] } },
		) => {
			sent.push({ chat, text, markup: extra?.reply_markup });
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
	const target = context.clock.now().getTime();
	const startedAt = Date.now();
	const timer = startDailyReminder({
		bot: fakeBot as never,
		listDueRepetitions: new ListDueRepetitions(context),
		telegramUserId: USER,
		timezone: "UTC",
		hour: new Date(target).getUTCHours(),
		now: () => new Date(target - 5 + (Date.now() - startedAt)),
		log: (error) => {
			throw error;
		},
	});

	await Bun.sleep(40);
	timer.stop();
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

	test("sends to the allowed chat with the same buttons the menu shows", async () => {
		await publishAndTake("set-1", "Alpha");
		context.clock.advance(2 * day);

		await fireOnce();

		expect(sent).toHaveLength(1);
		expect(sent[0]?.chat).toBe(USER);
		expect(sent[0]?.markup?.inline_keyboard?.length ?? 0).toBeGreaterThan(1);
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
