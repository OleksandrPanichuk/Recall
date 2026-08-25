import { ApiErrorName, isApiError } from "@recall/contracts";

const messages: Readonly<Record<string, string>> = {
	[ApiErrorName.NoActiveAttempt]:
		"Немає активної спроби. Оберіть набір у меню.",
	[ApiErrorName.AttemptAlreadyInProgress]:
		"У вас є незавершена спроба. Завершіть її, перш ніж почати іншу.",
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
