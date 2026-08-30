import { ApiErrorName, isApiError } from "@recall/contracts";

const messages: Readonly<Record<string, string>> = {
	[ApiErrorName.NoActiveAttempt]:
		"Спроби вже немає. Поверніться до набору й почніть знову.",
	[ApiErrorName.AttemptNotActive]:
		"Спробу призупинено. Поверніться до набору, щоб продовжити.",
	[ApiErrorName.QuestionNotInAttempt]:
		"Це питання вже позаду. Оновіть сторінку.",
};

export const messageFor = (error: unknown): string => {
	if (isApiError(error)) {
		return (
			messages[error.errorName] ??
			"Відповідь не зарахувалась. Спробуйте ще раз."
		);
	}

	return "Не вдалося зв'язатися з сервером. Спробуйте ще раз.";
};
