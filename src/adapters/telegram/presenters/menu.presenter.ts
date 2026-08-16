import { CallbackAction } from "../callbacks/callback-data.constants";
import type { InlineButton, Screen } from "./screen.types";
import { button } from "./utils/button";

const backToMenu = (): readonly InlineButton[] => [
	button("« Меню", { action: CallbackAction.Menu }),
];

export interface MenuState {
	readonly hasUnfinishedAttempt: boolean;
	readonly awaitingFinish: boolean;
}

export function mainMenu(state: MenuState): Screen {
	return {
		text: state.awaitingFinish
			? "Головне меню. Спроба пройдена — залишилось її завершити."
			: state.hasUnfinishedAttempt
				? "Головне меню. У вас є незавершена спроба."
				: "Головне меню.",
		keyboard: [
			...(state.hasUnfinishedAttempt
				? [[button("🏁 Завершити спробу", { action: CallbackAction.Finish })]]
				: []),
			[button("▶️ Продовжити навчання", { action: CallbackAction.Resume })],
			[button("📚 Мої набори", { action: CallbackAction.Sets })],
			[button("🔁 Повторення", { action: CallbackAction.Repetitions })],
			[button("📊 Статистика", { action: CallbackAction.Statistics })],
			[button("⚙️ Налаштування", { action: CallbackAction.Settings })],
		],
	};
}

export function finishPrompt(): Screen {
	return {
		text: "Усі питання пройдено. Завершіть спробу, щоб побачити результат.",
		keyboard: [
			[button("🏁 Завершити", { action: CallbackAction.Finish })],
			backToMenu(),
		],
	};
}

export function notice(text: string): Screen {
	return { text, keyboard: [backToMenu()] };
}
