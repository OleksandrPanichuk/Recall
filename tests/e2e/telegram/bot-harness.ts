import { type Telegraf, Telegram } from "telegraf";
import { createBot } from "@/adapters/telegram/bot";
import type { QuestionInput } from "@/application/use-cases/quiz-sets/add-questions";
import {
	type Application,
	createApplication,
} from "@/composition/create-application";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	createMutableClock,
	createRealisticIdGenerator,
	type MutableClock,
} from "../../fixtures/application.fixture";

export const ALLOWED_USER = 42;
export const OTHER_USER = 7;

export interface ApiCall {
	readonly method: string;
	readonly payload: Record<string, unknown>;
}

export interface InlineButton {
	readonly text: string;
	readonly callback_data: string;
}

export interface BotHarness {
	readonly bot: Telegraf;
	readonly application: Application;
	readonly clock: MutableClock;
	readonly calls: ApiCall[];
	send(text: string, userId?: number): Promise<void>;
	tap(data: string, userId?: number): Promise<void>;
	/** Text of the most recent screen the bot rendered. */
	lastText(): string;
	/** Inline keyboard of the most recent screen, flattened. */
	lastButtons(): readonly InlineButton[];
	answeredQueries(): readonly string[];
	/** Makes the next call to `method` reject, as the real API would. */
	failNext(failure: TelegramFailure): void;
	close(): void;
}

let updateId = 0;

// Telegraf builds a fresh Telegram instance for every update so a webhook can
// answer inline, which means stubbing bot.telegram never reaches a handler. The
// prototype is the only shared seam; calls are routed to whichever harness is
// currently live, and each test builds its own.
let activeCalls: ApiCall[] | undefined;
let activeFailures: TelegramFailure[] | undefined;
let prototypePatched = false;

export interface TelegramFailure {
	/** Matches the API method, e.g. "editMessageText". */
	readonly method: string;
	readonly message: string;
}

/** Telegram's own hard limits, enforced on every outbound call. */
const TEXT_LIMIT = 4096;
const CALLBACK_DATA_LIMIT = 64;

function assertWithinTelegramLimits(
	method: string,
	payload: Record<string, unknown>,
): void {
	const text = payload.text;

	if (typeof text === "string" && text.length > TEXT_LIMIT) {
		throw new Error(
			`400: Bad Request: message is too long (${text.length} > ${TEXT_LIMIT}) in ${method}`,
		);
	}

	const markup = payload.reply_markup as
		| { inline_keyboard?: { callback_data?: string }[][] }
		| undefined;

	for (const row of markup?.inline_keyboard ?? []) {
		for (const button of row) {
			const data = button.callback_data ?? "";

			if (data.length > CALLBACK_DATA_LIMIT) {
				throw new Error(
					`400: Bad Request: BUTTON_DATA_INVALID (${data.length} > ${CALLBACK_DATA_LIMIT}) in ${method}`,
				);
			}
		}
	}
}

function patchTelegramTransport(): void {
	if (prototypePatched) {
		return;
	}

	prototypePatched = true;
	Telegram.prototype.callApi = (async (
		method: string,
		payload: Record<string, unknown>,
	) => {
		activeCalls?.push({ method, payload });

		const failureIndex =
			activeFailures?.findIndex((entry) => entry.method === method) ?? -1;

		if (activeFailures !== undefined && failureIndex >= 0) {
			const [failure] = activeFailures.splice(failureIndex, 1);

			throw new Error(failure?.message ?? "telegram failed");
		}

		// The real API rejects these outright, and a stub that always succeeds is
		// how a length overflow reaches production unnoticed.
		assertWithinTelegramLimits(method, payload);

		return true;
	}) as typeof Telegram.prototype.callApi;
}

export function createBotHarness(): BotHarness {
	const clock = createMutableClock();
	const application = createApplication({
		databasePath: ":memory:",
		clock,
		idGenerator: createRealisticIdGenerator("q"),
	});
	const bot = createBot({
		token: "test-token",
		allowedTelegramUserId: ALLOWED_USER,
		useCases: application,
		log: () => {},
	});
	const calls: ApiCall[] = [];

	const failures: TelegramFailure[] = [];

	patchTelegramTransport();
	activeCalls = calls;
	activeFailures = failures;

	// Supplying botInfo stops Telegraf calling getMe on the first update.
	bot.botInfo = {
		id: 1,
		is_bot: true,
		first_name: "Quiz",
		username: "quiz_bot",
		can_join_groups: false,
		can_read_all_group_messages: false,
		supports_inline_queries: false,
	};

	const from = (userId: number) => ({
		id: userId,
		is_bot: false,
		first_name: "Tester",
	});
	const chat = (userId: number) => ({
		id: userId,
		type: "private" as const,
		first_name: "Tester",
	});

	const screenCalls = () =>
		calls.filter(
			(call) =>
				call.method === "sendMessage" || call.method === "editMessageText",
		);

	return {
		bot,
		application,
		clock,
		calls,
		send: async (text, userId = ALLOWED_USER) => {
			updateId += 1;
			await bot.handleUpdate({
				update_id: updateId,
				message: {
					message_id: updateId,
					date: 0,
					chat: chat(userId),
					from: from(userId),
					text,
					entities: text.startsWith("/")
						? [{ type: "bot_command", offset: 0, length: text.length }]
						: undefined,
				},
			} as never);
		},
		tap: async (data, userId = ALLOWED_USER) => {
			updateId += 1;
			await bot.handleUpdate({
				update_id: updateId,
				callback_query: {
					id: `cb-${updateId}`,
					from: from(userId),
					chat_instance: "1",
					data,
					message: {
						message_id: 1,
						date: 0,
						chat: chat(userId),
						text: "previous screen",
					},
				},
			} as never);
		},
		lastText: () => String(screenCalls().at(-1)?.payload.text ?? ""),
		lastButtons: () => {
			const markup = screenCalls().at(-1)?.payload.reply_markup as
				| { inline_keyboard: InlineButton[][] }
				| undefined;

			return (markup?.inline_keyboard ?? []).flat();
		},
		failNext: (failure) => {
			failures.push(failure);
		},
		answeredQueries: () =>
			calls
				.filter((call) => call.method === "answerCallbackQuery")
				.map((call) => String(call.payload.text ?? "")),
		close: () => {
			application.close();
		},
	};
}

export const aQuestionInput = (
	prompt: string,
	overrides: Partial<QuestionInput> = {},
): QuestionInput => ({
	type: QuestionType.SingleChoice,
	prompt,
	difficulty: Difficulty.Medium,
	explanation: `Explanation for ${prompt}`,
	options: [
		{ text: `Right for ${prompt}`, isCorrect: true },
		{ text: `Wrong for ${prompt}`, isCorrect: false },
	],
	...overrides,
});

export async function seedPublishedSet(
	harness: BotHarness,
	title: string,
	questions: readonly QuestionInput[],
): Promise<QuizSetId> {
	const { quizSetId } = await harness.application.createQuizSet.execute({
		title,
		language: "uk",
	});

	await harness.application.addQuestions.execute({ quizSetId, questions });
	await harness.application.publishQuizSet.execute({ quizSetId });

	return quizSetId;
}
