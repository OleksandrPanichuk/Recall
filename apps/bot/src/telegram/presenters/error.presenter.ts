import { ApiErrorName, isApiError } from "@recall/contracts";
import { CallbackAction } from "../callbacks/callback-data.constants";
import { notice } from "./menu.presenter";
import type { Screen } from "./screen.types";
import { button } from "./utils/button";

const messages: Readonly<Record<string, string>> = {
	[ApiErrorName.NoActiveAttempt]:
		"Немає активної спроби. Оберіть набір у меню.",
	[ApiErrorName.AttemptAlreadyInProgress]:
		"У вас є незавершена спроба. Продовжіть її або скасуйте, щоб почати іншу.",
	[ApiErrorName.AttemptNotActive]:
		"Спробу призупинено. Натисніть «Продовжити навчання».",
	[ApiErrorName.QuestionNotInAttempt]: "Це питання вже позаду. Оновіть екран.",
	[ApiErrorName.QuizSetNotPublished]: "Цей набір ще не опубліковано.",
	[ApiErrorName.QuizSetNotFound]: "Набір не знайдено.",
};

export function userMessageFor(error: unknown): string {
	if (isApiError(error)) {
		return messages[error.errorName] ?? "Сталася помилка. Спробуйте ще раз.";
	}

	return "Сталася помилка. Спробуйте ще раз.";
}

export function errorScreen(error: unknown): Screen {
	const text = userMessageFor(error);

	if (!isApiError(error, ApiErrorName.AttemptAlreadyInProgress)) {
		return notice(text);
	}

	return {
		text,
		keyboard: [
			[button("▶️ Продовжити ту спробу", { action: CallbackAction.Resume })],
			[button("🗑 Скасувати спробу", { action: CallbackAction.Abandon })],
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}
