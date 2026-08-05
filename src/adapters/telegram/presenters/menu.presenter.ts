import type { QuizSetSummary } from "@/application/ports/repositories/quiz-set.repository";
import {
	type Callback,
	CallbackAction,
	encodeCallback,
} from "../callbacks/callback-data";

export interface InlineButton {
	readonly text: string;
	readonly callback_data: string;
}

export interface Screen {
	readonly text: string;
	readonly keyboard: readonly (readonly InlineButton[])[];
}

export const button = (text: string, callback: Callback): InlineButton => ({
	text,
	callback_data: encodeCallback(callback),
});

const backToMenu = (): readonly InlineButton[] => [
	button("« Меню", { action: CallbackAction.Menu }),
];

export function mainMenu(hasUnfinishedAttempt: boolean): Screen {
	return {
		text: hasUnfinishedAttempt
			? "Головне меню. У вас є незавершена спроба."
			: "Головне меню.",
		keyboard: [
			[button("📚 Мої набори", { action: CallbackAction.Sets })],
			[button("▶️ Продовжити навчання", { action: CallbackAction.Resume })],
			[button("🔁 Повторити помилки", { action: CallbackAction.Mistakes })],
			[button("📉 Слабкі теми", { action: CallbackAction.WeakTopics })],
			[button("📊 Статистика", { action: CallbackAction.Statistics })],
			[
				button("⚙️ Налаштування", {
					action: CallbackAction.Unavailable,
					feature: "settings",
				}),
			],
		],
	};
}

export function quizSetList(
	sets: readonly QuizSetSummary[],
	action: typeof CallbackAction.StartSet | typeof CallbackAction.StatisticsFor,
): Screen {
	if (sets.length === 0) {
		return {
			text: "Опублікованих наборів ще немає. Створіть набір через Claude (MCP).",
			keyboard: [backToMenu()],
		};
	}

	return {
		text: "Оберіть набір:",
		keyboard: [
			...sets.map((set) => [
				button(`${set.title} (${set.questionCount})`, {
					action,
					quizSetId: set.id,
				}),
			]),
			backToMenu(),
		],
	};
}

export function notice(text: string): Screen {
	return { text, keyboard: [backToMenu()] };
}

export const UNAVAILABLE_FEATURES: Readonly<Record<string, string>> = {
	settings: "Налаштування з'являться у Phase 6.",
};
