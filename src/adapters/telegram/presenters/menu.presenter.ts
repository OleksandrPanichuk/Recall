import { CallbackAction } from "../callbacks/callback-data.constants";
import type { InlineButton, Screen } from "./screen.types";
import { button } from "./utils/button";

export type { InlineButton, Screen } from "./screen.types";
export { button } from "./utils/button";

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
			[button("📚 Мої набори", { action: CallbackAction.Sets })],
			[button("▶️ Продовжити навчання", { action: CallbackAction.Resume })],
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

export const UNAVAILABLE_FEATURES: Readonly<Record<string, string>> = {
	settings: "Налаштування з'являться у Phase 6.",
};
