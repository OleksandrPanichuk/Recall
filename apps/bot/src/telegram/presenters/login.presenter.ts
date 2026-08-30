import { CallbackAction } from "../callbacks/callback-data.constants";
import type { Screen } from "./screen.types";
import { button } from "./utils/button";

const minutesUntil = (expiresAt: Date): number =>
	Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));

export function loginLinkScreen(url: string, expiresAt: Date): Screen {
	return {
		text: [
			"Ось посилання для входу на платформу:",
			"",
			url,
			"",
			`Воно одноразове і діє ${minutesUntil(expiresAt)} хв. Після входу браузер запамʼятає вас надовго.`,
		].join("\n"),
		keyboard: [[button("« Меню", { action: CallbackAction.Menu })]],
	};
}

export function loginUnavailable(): Screen {
	return {
		text: "Вхід на платформу ще не налаштований на цьому сервері.",
		keyboard: [[button("« Меню", { action: CallbackAction.Menu })]],
	};
}
