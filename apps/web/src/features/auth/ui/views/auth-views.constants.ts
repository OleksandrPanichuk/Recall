const MESSAGES: Readonly<Record<string, string>> = {
	INVALID_EMAIL_OR_PASSWORD: "Невірна пошта або пароль.",
	USER_ALREADY_EXISTS: "Акаунт із такою поштою вже існує.",
	PASSWORD_TOO_SHORT: "Пароль закороткий.",
};

export const failureText = (message: string | undefined): string => {
	if (message === undefined) {
		return "Не вдалося. Спробуйте ще раз.";
	}

	if (message.toLowerCase().includes("too many requests")) {
		return "Забагато спроб. Зачекайте трохи.";
	}

	return MESSAGES[message] ?? message;
};
